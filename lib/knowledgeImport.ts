import OpenAI from "openai";
import * as cheerio from "cheerio";
import pdfParse from "pdf-parse";
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

function chunkText(text: string, size = 900, overlap = 120) {
  const chunks: string[] = [];
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    i += size - overlap;
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
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin;
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

function pickPriorityLinks(baseUrl: string, links: string[]) {
  const want = [
    "/about",
    "/about-us",
    "/company",
    "/services",
    "/service",
    "/products",
    "/pricing",
    "/solutions",
    "/contact",
    "/impressum",
    "/faq",
  ];

  const base = new URL(baseUrl);
  const normalized = Array.from(
    new Set(
      links
        .map((x) => normalizeUrl(x))
        .filter(Boolean)
        .filter((x) => isSameOrigin(x, baseUrl))
        .filter((x) => isLikelyHtmlPath(new URL(x).pathname))
    )
  );

  const scored = normalized
    .map((u) => {
      const path = new URL(u).pathname.toLowerCase();
      let score = 0;
      for (const w of want) {
        if (path === w || path.startsWith(w + "/")) score += 10;
      }
      // home gets slightly higher
      if (path === "/" || path === "") score += 5;
      return { u, score };
    })
    .sort((a, b) => b.score - a.score);

  // keep in order, remove duplicates
  return scored.map((x) => x.u);
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
  if (!res.ok) {
    return { ok: false as const, status: res.status, error: `fetch_failed_${res.status}` };
  }
  if (!ct.includes("text/html") && !ct.includes("application/xhtml+xml")) {
    return { ok: false as const, status: 415, error: "not_html" };
  }

  const html = await res.text();
  return { ok: true as const, html };
}

function extractTextAndLinks(baseUrl: string, html: string) {
  const $ = cheerio.load(html);

  const title = String($("title").first().text() || "").trim();
  // remove scripts/styles/noscript
  $("script,style,noscript").remove();

  const text = String($("body").text() || "").replace(/\s+/g, " ").trim();

  const links: string[] = [];
  $("a[href]").each((_i, el) => {
    const href = String($(el).attr("href") || "").trim();
    if (!href) return;

    try {
      const abs = new URL(href, baseUrl).toString();
      links.push(abs);
    } catch {
      // ignore
    }
  });

  return { title: title || baseUrl, text, links };
}

async function extractBrandingFromText(input: {
  companyNameHint?: string;
  homepageUrl?: string;
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
    // hard fallback: do not break import if parsing fails
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
    .upsert(
      { company_id, branding_json: next },
      { onConflict: "company_id" }
    );

  if (upErr) return { ok: false as const, error: upErr.message };
  return { ok: true as const, updated: true as const, branding: next };
}

export async function insertKnowledgeChunks(params: {
  company_id: string;
  title: string;
  content: string;
}) {
  const chunks = chunkText(params.content);
  if (chunks.length === 0) return { ok: true as const, inserted: 0 };

  const vectors = await embedBatch(chunks);

  const rows = chunks.map((c, idx) => ({
    company_id: params.company_id,
    title: params.title,
    content: c,
    embedding: vectors[idx],
  }));

  const { error } = await supabaseServer.from("knowledge_chunks").insert(rows);
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, inserted: chunks.length };
}

export async function importFromWebsite(params: {
  company_id: string;
  url: string;
  maxPages?: number;
  companyNameHint?: string;
}) : Promise<ImportResult | { ok: false; error: string; details?: any }> {
  const startUrl = normalizeUrl(params.url);
  if (!startUrl) return { ok: false, error: "invalid_url" };

  const maxPages = Math.max(1, Math.min(10, Number(params.maxPages || 5)));

  // Crawl: start page → collect links → pick priority → fetch up to maxPages
  const pages: Array<{ url: string; title: string; text: string; links: string[] }> = [];

  const first = await fetchHtml(startUrl);
  if (!first.ok) return { ok: false, error: first.error, details: { url: startUrl, status: first.status } };

  const firstExtract = extractTextAndLinks(startUrl, first.html);
  pages.push({ url: startUrl, title: firstExtract.title, text: firstExtract.text, links: firstExtract.links });

  const candidates = pickPriorityLinks(startUrl, firstExtract.links);
  for (const u of candidates) {
    if (pages.length >= maxPages) break;
    if (pages.some((p) => p.url === u)) continue;

    const f = await fetchHtml(u);
    if (!f.ok) continue;

    const ex = extractTextAndLinks(u, f.html);
    // skip ultra-thin pages
    if (ex.text.length < 300) continue;

    pages.push({ url: u, title: ex.title, text: ex.text, links: ex.links });
  }

  const combinedText = pages
    .map((p) => {
      return `URL: ${p.url}\nTITLE: ${p.title}\n\n${p.text}`;
    })
    .join("\n\n---\n\n");

  const title = `Website Import: ${new URL(startUrl).host}`;
  const ins = await insertKnowledgeChunks({ company_id: params.company_id, title, content: combinedText });
  if (!ins.ok) return { ok: false, error: "knowledge_insert_failed", details: ins.error };

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
  if (!up.ok) return { ok: false, error: "branding_update_failed", details: up.error };

  return {
    ok: true,
    pages: pages.map((p) => ({ url: p.url, title: p.title })),
    chunksInserted: ins.inserted,
    brandingUpdated: !!brandPatch,
    brandingPreview: brandPatch || undefined,
  };
}

export async function importFromPdf(params: {
  company_id: string;
  filename: string;
  buffer: Buffer;
  companyNameHint?: string;
}) : Promise<ImportResult | { ok: false; error: string; details?: any }> {
  const data = await pdfParse(params.buffer);
  const text = String(data.text || "").replace(/\s+/g, " ").trim();

  if (!text || text.length < 200) {
    return { ok: false, error: "pdf_text_too_short" };
  }

  const title = `PDF Import: ${params.filename || "document.pdf"}`;

  const ins = await insertKnowledgeChunks({ company_id: params.company_id, title, content: text });
  if (!ins.ok) return { ok: false, error: "knowledge_insert_failed", details: ins.error };

  const profile = await extractBrandingFromText({
    companyNameHint: params.companyNameHint,
    homepageUrl: null as any,
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
  if (!up.ok) return { ok: false, error: "branding_update_failed", details: up.error };

  return {
    ok: true,
    pdf: { filename: params.filename },
    chunksInserted: ins.inserted,
    brandingUpdated: !!brandPatch,
    brandingPreview: brandPatch || undefined,
  };
}
