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
    .replace(/\s+/g, " ")
    .trim();
}

function hash16(input: string) {
  return crypto.createHash("sha256").update(String(input || "")).digest("hex").slice(0, 16);
}

function chunkTextSmart(text: string, size = 900, overlap = 120) {
  const clean = normalizeText(text);
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;

  const minBreak = Math.max(150, Math.floor(size * 0.55));

  while (i < clean.length) {
    const end = Math.min(clean.length, i + size);
    if (end === clean.length) {
      chunks.push(clean.slice(i).trim());
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

    const chunk = clean.slice(i, i + cut).trim();
    if (chunk) chunks.push(chunk);

    const next = i + cut - overlap;
    i = Math.max(i + 1, next);
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
  "/about",
  "/about-us",
  "/company",
  "/services",
  "/service",
  "/products",
  "/solutions",
  "/pricing",
  "/prices",
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

function extractTextAndLinks(baseUrl: string, html: string) {
  const $ = cheerio.load(html);

  // remove noise
  $("script,style,noscript,svg,canvas").remove();

  const title = String($("title").first().text() || "").trim() || baseUrl;

  // Links
  const links: string[] = [];
  $("a[href]").each((_i, el) => {
    const href = String($(el).attr("href") || "").trim();
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      links.push(abs);
    } catch {}
  });

  // Lightweight readable text (kept for branding extraction)
  const metaDesc = String($('meta[name="description"]').attr("content") || "").trim();
  const ogTitle = String($('meta[property="og:title"]').attr("content") || "").trim();
  const ogDesc = String($('meta[property="og:description"]').attr("content") || "").trim();

  const parts: string[] = [];
  const h1 = $("h1").first().text().trim();
  if (h1) parts.push(`H1: ${h1}`);

  const headings = $("h2,h3")
    .slice(0, 40)
    .map((_i, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  if (headings.length) parts.push("HEADINGS:\n" + headings.join("\n"));

  const paras = $("p,li")
    .slice(0, 400)
    .map((_i, el) => $(el).text().trim())
    .get()
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 40);
  if (paras.length) parts.push("TEXT:\n" + paras.join("\n"));

  const combined =
    [
      metaDesc ? `META: ${metaDesc}` : "",
      ogTitle ? `OG_TITLE: ${ogTitle}` : "",
      ogDesc ? `OG_DESC: ${ogDesc}` : "",
      parts.join("\n\n"),
    ]
      .filter(Boolean)
      .join("\n\n")
      .replace(/\s+/g, " ")
      .trim();

  return { title, text: combined, links };
}

function detectSectionType(title: string) {
  const t = String(title || "").toLowerCase();
  if (/(price|pricing|preise|preis|cost|paket|plan)/i.test(t)) return "pricing";
  if (/(faq|fragen|frage|questions|q&a)/i.test(t)) return "faq";
  if (/(contact|kontakt|reach|call|termin)/i.test(t)) return "contact";
  if (/(feature|features|service|services|solution|solutions|leistungen)/i.test(t)) return "feature";
  if (/(about|company|unternehmen|über uns)/i.test(t)) return "about";
  if (/(privacy|datenschutz|terms|impressum|legal)/i.test(t)) return "legal";
  return "general";
}

function extractStructuredSections(pageUrl: string, html: string) {
  const $ = cheerio.load(html);
  $("script,style,noscript,svg,canvas").remove();

  const docTitle = String($("title").first().text() || "").trim() || pageUrl;

  const sections: Array<{ title: string; content: string; order: number }> = [];
  let current = { title: "Introduction", content: "", order: 0 };
  let order = 0;

  $("body")
    .find("h2,h3,p,li")
    .each((_i, el) => {
      const tag = String((el as any).tagName || "").toLowerCase();
      const txt = normalizeText($(el).text());
      if (!txt) return;

      if (tag === "h2") {
        if (current.content.trim().length >= 120) sections.push(current);
        order += 1;
        current = { title: txt, content: "", order };
        return;
      }

      if (tag === "h3") {
        current.content += `\n\n${txt}\n`;
        return;
      }

      current.content += ` ${txt}`;
    });

  if (current.content.trim().length >= 120) sections.push(current);

  return { docTitle, sections };
}

async function extractBrandingFromText(input: {
  companyNameHint?: string;
  homepageUrl?: string | null;
  combinedText: string;
}) {
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

/**
 * Legacy helper used by PDF/manual ingestion: chunks + embeddings + insert.
 * Keeps working for all non-website imports.
 */
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

/**
 * NEW structured website insert:
 * per page -> per section -> per chunk, with metadata for doc/section ordering.
 */
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

  const pagesRaw: Array<{ url: string; title: string; html: string; links: string[]; brandingText: string }> = [];

  // Fetch homepage first
  const first = await fetchHtml(startUrl);
  if (!first.ok) return { ok: false, error: first.error, details: { url: startUrl, status: first.status } };

  const firstExtract = extractTextAndLinks(startUrl, first.html);
  pagesRaw.push({
    url: startUrl,
    title: firstExtract.title,
    html: first.html,
    links: firstExtract.links,
    brandingText: firstExtract.text,
  });

  const linkCandidates = unique(firstExtract.links)
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

    const ex = extractTextAndLinks(u, f.html);
    pagesRaw.push({ url: u, title: ex.title, html: f.html, links: ex.links, brandingText: ex.text });
  }

  // Insert structured knowledge: per page -> per sections
  let totalInserted = 0;
  const pagesOut: Array<{ url: string; title: string }> = [];

  for (const p of pagesRaw) {
    const structured = extractStructuredSections(p.url, p.html);
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
  }

  // Branding extraction uses combined lightweight readable text (not the chunks)
  const combinedText = pagesRaw
    .map((p) => `URL: ${p.url}\nTITLE: ${p.title}\n\n${p.brandingText}`)
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
