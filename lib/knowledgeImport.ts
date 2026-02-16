import OpenAI from "openai";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type ImportResult = {
  ok: true;
  pages?: Array<{ url: string; title: string }>;
  pdf?: { filename: string };
  chunksInserted: number;
  brandingUpdated: boolean;
  brandingPreview?: any;
};

function normalizeText(text: string) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hash16(input: string) {
  return crypto.createHash("sha256").update(String(input || "")).digest("hex").slice(0, 16);
}

function isWs(ch: string) {
  return ch === " " || ch === "\n" || ch === "\t" || ch === "\r";
}

// ✅ never start chunks mid-word (overlap safe)
function chunkTextSmart(text: string, size = 900, overlap = 120) {
  const clean = normalizeText(text);
  if (!clean) return [];

  const chunks: string[] = [];
  let i = 0;

  const minBreak = Math.max(180, Math.floor(size * 0.55));

  while (i < clean.length) {
    // skip leading whitespace
    while (i < clean.length && isWs(clean[i])) i++;

    const end = Math.min(clean.length, i + size);
    if (end >= clean.length) {
      const last = clean.slice(i).trim();
      if (last) chunks.push(last);
      break;
    }

    const window = clean.slice(i, end);

    const candidates: number[] = [];
    const dn = window.lastIndexOf("\n\n");
    if (dn >= minBreak) candidates.push(dn + 2);

    const sn = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
    if (sn >= minBreak) candidates.push(sn + 2);

    const sp = window.lastIndexOf(" ");
    if (sp >= minBreak) candidates.push(sp + 1);

    const cut = candidates.length ? Math.max(...candidates) : window.length;

    // ensure chunk end is not mid-word
    let cutAbs = i + cut;
    if (cutAbs < clean.length && !isWs(clean[cutAbs])) {
      // move left to whitespace if possible
      let j = cutAbs;
      while (j > i + minBreak && !isWs(clean[j])) j--;
      if (isWs(clean[j])) cutAbs = j;
    }

    const chunk = clean.slice(i, cutAbs).trim();
    if (chunk) chunks.push(chunk);

    let next = cutAbs - overlap;
    next = Math.max(next, i + 1);

    // ensure next start is not mid-word
    if (next > 0 && next < clean.length && !isWs(clean[next]) && !isWs(clean[next - 1])) {
      while (next < clean.length && !isWs(clean[next])) next++;
    }
    i = next;
  }

  return chunks.filter(Boolean);
}

async function embedBatch(chunks: string[]) {
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks,
  });
  return emb.data.map((x) => x.embedding as unknown as number[]);
}

function normalizeUrl(u: string) {
  try {
    const url = new URL(u);
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function isSameOrigin(a: string, b: string) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

function isLikelyHtmlPath(pathname: string) {
  const p = String(pathname || "").toLowerCase();
  if (p.endsWith(".pdf")) return false;
  if (p.match(/\.(jpg|jpeg|png|webp|gif|svg|ico|css|js|mp4|mov|avi|zip)$/i)) return false;
  return true;
}

const COMMON_PATHS = [
  "/",
  "/leadgenerator",
  "/pricing",
  "/prices",
  "/packages",
  "/about",
  "/about-us",
  "/company",
  "/services",
  "/service",
  "/products",
  "/solutions",
  "/contact",
  "/impressum",
  "/faq",
  "/terms",
  "/privacy",
];

function unique(arr: string[]) {
  return Array.from(new Set(arr));
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "TamTamCorpBot/1.0 (+https://tamtamcorp.tech)",
      accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  const ct = String(res.headers.get("content-type") || "").toLowerCase();
  if (!res.ok) return { ok: false as const, status: res.status, error: `fetch_failed_${res.status}` };
  if (!ct.includes("text/html") && !ct.includes("application/xhtml+xml")) {
    return { ok: false as const, status: 415, error: "not_html" };
  }

  const html = await res.text();
  return { ok: true as const, html };
}

// ✅ client-side rendered pages fallback: fully readable text
async function fetchJinaText(url: string) {
  const clean = normalizeUrl(url);
  if (!clean) return { ok: false as const, status: 400, error: "invalid_url" };

  const prefix = clean.startsWith("https://") ? "https://r.jina.ai/https://" : "https://r.jina.ai/http://";
  const target = clean.replace(/^https?:\/\//i, "");

  const res = await fetch(prefix + target, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "TamTamCorpBot/1.0 (+https://tamtamcorp.tech)",
      accept: "text/plain",
    },
    cache: "no-store",
  });

  if (!res.ok) return { ok: false as const, status: res.status, error: `jina_failed_${res.status}` };
  const text = normalizeText(await res.text());
  return { ok: true as const, text };
}

function extractLinks(baseUrl: string, html: string) {
  const $ = cheerio.load(html);
  const links: string[] = [];
  $("a[href]").each((_i, el) => {
    const href = String($(el).attr("href") || "").trim();
    if (!href) return;
    try {
      links.push(new URL(href, baseUrl).toString());
    } catch {}
  });
  return links;
}

function extractTitleFromHtml(pageUrl: string, html: string) {
  try {
    const $ = cheerio.load(html);
    return String($("title").first().text() || "").trim() || pageUrl;
  } catch {
    return pageUrl;
  }
}

function detectSectionType(title: string) {
  const t = String(title || "").toLowerCase();
  if (/(price|pricing|preise|preis|cost|paket|plan|package)/i.test(t)) return "pricing";
  if (/(faq|fragen|frage|questions|q&a)/i.test(t)) return "faq";
  if (/(contact|kontakt|reach|call|termin)/i.test(t)) return "contact";
  if (/(feature|features|service|services|solution|solutions|leistungen)/i.test(t)) return "feature";
  if (/(about|company|unternehmen|über uns)/i.test(t)) return "about";
  if (/(privacy|datenschutz|terms|impressum|legal)/i.test(t)) return "legal";
  return "general";
}

function looksLikePricingLine(line: string) {
  const s = String(line || "").trim();
  if (!s) return false;
  if (/(aed|usd|eur|\$|€|درهم)/i.test(s)) return true;
  if (/(\/mo|\/month|per month|monthly|yearly|\/yr|\/year)/i.test(s)) return true;
  if (/(starter|basic|pro|premium|enterprise|package|plan|paket)/i.test(s)) return true;
  if (/^\d{2,6}(\.\d{1,2})?$/.test(s)) return true;
  return false;
}

// ✅ build proper sections from Jina markdown-ish text
function splitJinaIntoSections(jinaText: string) {
  const lines = String(jinaText || "").split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const sections: Array<{ title: string; content: string; order: number }> = [];

  let currentTitle = "Page Content";
  let buf: string[] = [];
  let order = 0;

  function flush() {
    const content = normalizeText(buf.join("\n"));
    if (content && content.length >= 120) {
      sections.push({ title: currentTitle, content, order: order || 1 });
    }
    buf = [];
  }

  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;

    // headings
    const m = l.match(/^(#{1,4})\s+(.*)$/);
    if (m) {
      flush();
      order += 1;
      currentTitle = normalizeText(m[2]) || `Section ${order}`;
      continue;
    }

    // keep short pricing lines too
    if (l.length < 14 && !looksLikePricingLine(l)) continue;

    // remove obvious junk
    if (/^(cookie|cookies|privacy policy|terms of service|accept all|reject all)$/i.test(l)) continue;

    buf.push(l);
  }

  flush();

  if (sections.length === 0) {
    const all = normalizeText(jinaText);
    if (all) sections.push({ title: "Page Content", content: all, order: 1 });
  }

  return sections;
}

function extractStructuredSectionsFromHtml(pageUrl: string, html: string) {
  const $ = cheerio.load(html);

  $("script,style,noscript,svg,canvas,iframe").remove();
  $("header,nav,footer").remove();
  $('[role="navigation"],[aria-label="breadcrumb"],[aria-label="navigation"],.nav,.navbar,.footer,.header').remove();

  const docTitle = String($("title").first().text() || "").trim() || pageUrl;
  const root = $("main").first().length ? $("main").first() : $("body");

  const sections: Array<{ title: string; content: string; order: number }> = [];
  const h2s = root.find("h2").toArray();

  function regionText(region: any) {
    const parts: string[] = [];
    region.find("h1,h2,h3,p,li,div,span,a,button,td,th").each((_i: any, el: any) => {
      const t = normalizeText($(el).text());
      if (!t) return;

      // ✅ allow short lines (pricing cards)
      if (t.length < 10 && !looksLikePricingLine(t)) return;

      parts.push(t);
    });
    return normalizeText(parts.join("\n"));
  }

  if (h2s.length === 0) {
    const all = regionText(root);
    const h1 = normalizeText(root.find("h1").first().text());
    const title = h1 || "Page Content";
    if (all && all.length >= 200) {
      sections.push({ title, content: all, order: 1 });
    }
    return { docTitle, sections };
  }

  let order = 0;
  for (let i = 0; i < h2s.length; i++) {
    order += 1;
    const h2 = $(h2s[i]);
    const secTitle = normalizeText(h2.text()) || `Section ${order}`;

    const regionEls: any[] = [];
    let cur: any = (h2[0] as any).nextSibling;

    while (cur) {
      const $cur = $(cur);
      if ($cur.is("h2")) break;
      regionEls.push(cur);
      cur = cur.nextSibling;
    }

    let content = "";
    if (regionEls.length) {
      const wrapper = $("<div></div>");
      for (const el of regionEls) wrapper.append($(el).clone());
      content = regionText(wrapper);
    } else {
      const parent = h2.parent();
      const block = parent.find("*").toArray().slice(0, 800);
      const wrapper = $("<div></div>");
      for (const el of block) wrapper.append($(el).clone());
      content = regionText(wrapper);
    }

    content = normalizeText(`${secTitle}\n${content}`);
    if (content && content.length >= 200) {
      sections.push({ title: secTitle, content, order });
    }
  }

  return { docTitle, sections };
}

async function extractBrandingFromText(input: { companyNameHint?: string; homepageUrl?: string | null; combinedText: string }) {
  const prompt = [
    "You are an expert brand strategist and company analyst.",
    "Extract a compact company profile and branding hints from the provided text.",
    "Return STRICT JSON only (no markdown).",
    "",
    "JSON schema:",
    "{",
    '  "company_name": string | null,',
    '  "tagline": string | null,',
    '  "summary": string | null,',
    '  "products_services": string[],',
    '  "industries": string[],',
    '  "target_customers": string[],',
    '  "tone": "formal"|"friendly"|"luxury"|"technical"|"playful"|"neutral"|null,',
    '  "brand_colors": { "primary": string|null, "secondary": string|null, "accent": string|null },',
    '  "logo_url": string | null,',
    '  "contact": { "email": string|null, "phone": string|null, "address": string|null, "website": string|null }',
    "}",
    "",
    "Rules:",
    "- If you cannot find something, use null or []",
    "- brand_colors must be hex if present (e.g. #111111), otherwise nulls",
    "- Keep summary <= 80 words",
    "",
    `Hints: companyNameHint=${input.companyNameHint || ""} homepageUrl=${input.homepageUrl || ""}`,
    "",
    "TEXT:",
    input.combinedText.slice(0, 120000),
  ].join("\n");

  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [{ role: "system", content: prompt }],
  });

  const raw = String(r.choices?.[0]?.message?.content || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function upsertBranding(company_id: string, brandingPatch: any) {
  if (!brandingPatch || typeof brandingPatch !== "object") {
    return { ok: true as const, updated: false as const };
  }

  const { data, error } = await supabaseServer
    .from("company_settings")
    .select("company_id, branding_json")
    .eq("company_id", company_id)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };

  const current = (data as any)?.branding_json ?? {};
  const next = {
    ...current,
    brand: {
      ...(current.brand ?? {}),
      ...brandingPatch,
    },
  };

  const { error: upErr } = await supabaseServer
    .from("company_settings")
    .upsert({ company_id, branding_json: next }, { onConflict: "company_id" });

  if (upErr) return { ok: false as const, error: upErr.message };
  return { ok: true as const, updated: true as const, branding: next };
}

export async function insertKnowledgeChunks(params: { company_id: string; title: string; content: string }) {
  const chunks = chunkTextSmart(params.content);
  if (chunks.length === 0) return { ok: true as const, inserted: 0 };

  const vectors = await embedBatch(chunks);

  const rows = chunks.map((c, idx) => ({
    company_id: params.company_id,
    title: params.title,
    content: c,
    embedding: vectors[idx],
    source_type: "text",
    source_ref: null,
    metadata: { kind: "text", chunk_index: idx },
  }));

  const { error } = await supabaseServer.from("knowledge_chunks").insert(rows);
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, inserted: chunks.length };
}

async function insertStructuredWebsite(params: {
  company_id: string;
  page_url: string;
  doc_title: string;
  sections: Array<{ title: string; content: string; order: number }>;
}) {
  const doc_id = hash16(params.page_url);
  let inserted = 0;

  for (const section of params.sections) {
    const chunks = chunkTextSmart(section.content);
    if (!chunks.length) continue;

    const vectors = await embedBatch(chunks);

    const rows = chunks.map((c, idx) => ({
      company_id: params.company_id,
      source_type: "website",
      source_ref: params.page_url,
      title: section.title,
      content: c,
      metadata: {
        kind: "web",
        doc_id,
        page_url: params.page_url,
        doc_title: params.doc_title,
        section_title: section.title,
        section_type: detectSectionType(section.title),
        section_order: section.order,
        chunk_index: idx,
      },
      embedding: vectors[idx],
    }));

    const { error } = await supabaseServer.from("knowledge_chunks").insert(rows);
    if (error) throw new Error(error.message);

    inserted += rows.length;
  }

  return inserted;
}

export async function importFromWebsite(params: {
  company_id: string;
  url: string;
  maxPages?: number;
  companyNameHint?: string;
}): Promise<ImportResult | { ok: false; error: string; details?: any }> {
  const startUrl = normalizeUrl(params.url);
  if (!startUrl) return { ok: false, error: "invalid_url" };

  const maxPages = Math.max(1, Math.min(10, Number(params.maxPages || 5)));
  const origin = new URL(startUrl).origin;

  const baseCandidates = COMMON_PATHS.map((p) => normalizeUrl(origin + p)).filter(Boolean);

  const pagesRaw: Array<{ url: string; title: string; html: string; links: string[]; readableText: string }> = [];

  const first = await fetchHtml(startUrl);
  if (!first.ok) return { ok: false, error: first.error, details: { url: startUrl, status: first.status } };

  const firstTitle = extractTitleFromHtml(startUrl, first.html);
  const firstLinks = extractLinks(startUrl, first.html);

  pagesRaw.push({
    url: startUrl,
    title: firstTitle,
    html: first.html,
    links: firstLinks,
    readableText: "",
  });

  const linkCandidates = unique(firstLinks)
    .map((x) => normalizeUrl(x))
    .filter(Boolean)
    .filter((x) => isSameOrigin(x, startUrl))
    .filter((x) => isLikelyHtmlPath(new URL(x).pathname));

  const candidates = unique([...baseCandidates, ...linkCandidates]).filter((u) => u !== startUrl);

  for (const u of candidates) {
    if (pagesRaw.length >= maxPages) break;
    if (pagesRaw.some((p) => p.url === u)) continue;

    const f = await fetchHtml(u);
    if (!f.ok) continue;

    const t = extractTitleFromHtml(u, f.html);
    const links = extractLinks(u, f.html);

    pagesRaw.push({ url: u, title: t, html: f.html, links, readableText: "" });
  }

  let totalInserted = 0;
  const pagesOut: Array<{ url: string; title: string }> = [];

  for (const p of pagesRaw) {
    // Try HTML first
    let structured = extractStructuredSectionsFromHtml(p.url, p.html);
    let totalChars = structured.sections.reduce((sum, s) => sum + (s.content?.length || 0), 0);

    // If thin => Jina fallback with real sections
    if (structured.sections.length === 0 || totalChars < 1200) {
      const jina = await fetchJinaText(p.url);
      if (jina.ok) {
        const sections = splitJinaIntoSections(jina.text);
        structured = { docTitle: p.title, sections };
        p.readableText = jina.text;
        totalChars = sections.reduce((sum, s) => sum + (s.content?.length || 0), 0);
      }
    }

    // If still nothing, skip insert
    if (structured.sections.length) {
      const ins = await insertStructuredWebsite({
        company_id: params.company_id,
        page_url: p.url,
        doc_title: structured.docTitle,
        sections: structured.sections,
      });
      totalInserted += ins;
    }

    pagesOut.push({ url: p.url, title: structured.docTitle || p.title });

    // Ensure we have readable text for branding prompt
    if (!p.readableText) {
      const fallback = normalizeText(
        structured.sections.map((s) => `## ${s.title}\n${s.content}`).join("\n\n")
      );
      p.readableText = fallback.slice(0, 60000);
    }
  }

  const combinedText = pagesRaw
    .map((p) => `URL: ${p.url}\nTITLE: ${p.title}\n\n${normalizeText(p.readableText).slice(0, 60000)}`)
    .join("\n\n---\n\n");

  const profile = await extractBrandingFromText({
    companyNameHint: params.companyNameHint,
    homepageUrl: startUrl,
    combinedText,
  });

  const brandPatch = profile
    ? {
        company_name: profile.company_name ?? null,
        tagline: profile.tagline ?? null,
        summary: profile.summary ?? null,
        products_services: Array.isArray(profile.products_services) ? profile.products_services : [],
        industries: Array.isArray(profile.industries) ? profile.industries : [],
        target_customers: Array.isArray(profile.target_customers) ? profile.target_customers : [],
        tone: profile.tone ?? null,
        brand_colors: profile.brand_colors ?? { primary: null, secondary: null, accent: null },
        logo_url: profile.logo_url ?? null,
        contact: profile.contact ?? { email: null, phone: null, address: null, website: startUrl },
        homepage_url: startUrl,
      }
    : null;

  const up = await upsertBranding(params.company_id, brandPatch);
  if (!up.ok) return { ok: false, error: "branding_update_failed", details: (up as any).error };

  return {
    ok: true,
    pages: pagesOut,
    chunksInserted: totalInserted,
    brandingUpdated: !!brandPatch,
    brandingPreview: brandPatch || undefined,
  };
}

export async function importFromPdf(params: {
  company_id: string;
  filename: string;
  buffer: Buffer;
  companyNameHint?: string;
}): Promise<ImportResult | { ok: false; error: string; details?: any }> {
  const mod: any = await import("pdf-parse");
  const pdfParseFn = mod?.default || mod;
  if (typeof pdfParseFn !== "function") {
    return { ok: false, error: "pdf_parse_import_failed" };
  }

  const data = await pdfParseFn(params.buffer);
  const text = String(data?.text || "").replace(/\s+/g, " ").trim();

  if (!text || text.length < 200) {
    return { ok: false, error: "pdf_text_too_short" };
  }

  const title = `PDF Import: ${params.filename || "document.pdf"}`;

  const ins = await insertKnowledgeChunks({ company_id: params.company_id, title, content: text });
  if (!ins.ok) return { ok: false, error: "knowledge_insert_failed", details: (ins as any).error };

  const profile = await extractBrandingFromText({
    companyNameHint: params.companyNameHint,
    homepageUrl: null,
    combinedText: text,
  });

  const brandPatch = profile
    ? {
        company_name: profile.company_name ?? null,
        tagline: profile.tagline ?? null,
        summary: profile.summary ?? null,
        products_services: Array.isArray(profile.products_services) ? profile.products_services : [],
        industries: Array.isArray(profile.industries) ? profile.industries : [],
        target_customers: Array.isArray(profile.target_customers) ? profile.target_customers : [],
        tone: profile.tone ?? null,
        brand_colors: profile.brand_colors ?? { primary: null, secondary: null, accent: null },
        logo_url: profile.logo_url ?? null,
        contact: profile.contact ?? { email: null, phone: null, address: null, website: null },
      }
    : null;

  const up = await upsertBranding(params.company_id, brandPatch);
  if (!up.ok) return { ok: false, error: "branding_update_failed", details: (up as any).error };

  return {
    ok: true,
    pdf: { filename: params.filename },
    chunksInserted: ins.inserted,
    brandingUpdated: !!brandPatch,
    brandingPreview: brandPatch || undefined,
  };
}
