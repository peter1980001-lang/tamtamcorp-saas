// app/api/admin/knowledge/ingest/route.ts
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import OpenAI from "openai";
import { importFromWebsite } from "@/lib/knowledgeImport";
import crypto from "crypto";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/** --------- helpers --------- */

function isUrl(s: string) {
  const t = String(s || "").trim();
  return /^https?:\/\/[^\s]+$/i.test(t);
}

function extractUrlsFromText(input: string) {
  const urls = new Set<string>();
  const s = String(input || "");
  const re = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const u = String(m[0]).trim();
    if (u) urls.add(u);
  }
  return Array.from(urls);
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function cleanText(t: string) {
  return String(t || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Old char-based chunking (keep for manual text fallback)
 */
function chunkText(text: string, size = 900, overlap = 120) {
  const chunks: string[] = [];
  const clean = cleanText(text);
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return chunks.filter(Boolean);
}

/** --------- embeddings + insert --------- */

async function embedAndInsertRows(rows: Array<{ company_id: string; title: string; content: string; source_ref?: string | null; metadata?: any }>) {
  if (!rows.length) return { chunks: 0 };

  const inputs = rows.map((r) => r.content);
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: inputs,
  });

  const insertRows = rows.map((r, idx) => ({
    company_id: r.company_id,
    title: r.title,
    content: r.content,
    embedding: emb.data[idx].embedding,
    source_ref: r.source_ref ?? null,
    metadata: r.metadata ?? {},
  }));

  const { error } = await supabase.from("knowledge_chunks").insert(insertRows);
  if (error) throw new Error(`insert_failed:${error.message}`);

  return { chunks: rows.length };
}

/**
 * Manual text mode (char-based) – keep as-is
 */
async function embedAndInsert(company_id: string, title: string, content: string) {
  const chunks = chunkText(content);
  const rows = chunks.map((c) => ({
    company_id,
    title,
    content: c,
    source_ref: null as any,
    metadata: { kind: "manual", created_at: new Date().toISOString() },
  }));

  return embedAndInsertRows(rows);
}

/** --------- NEW: audit + semantic chunk builder from pages[] --------- */

type IngestPage = {
  url: string;
  title?: string | null;
  text: string;
  captured_at?: string | null;
};

type BrandHints = {
  primary_color_guess?: string | null;
  accent_color_guess?: string | null;
  logo_url?: string | null;
};

function normalizePages(pages: IngestPage[]) {
  const out: Array<{ url: string; title: string; text: string; captured_at: string | null }> = [];

  for (const p of pages || []) {
    const url = String(p?.url || "").trim();
    if (!isUrl(url)) continue;

    const title = String(p?.title || "").trim();
    const text = cleanText(p?.text || "");
    if (!text) continue;

    out.push({
      url,
      title: title || "Untitled",
      text,
      captured_at: p?.captured_at ? String(p.captured_at) : null,
    });
  }

  // de-dup by url (keep longest text)
  const byUrl = new Map<string, (typeof out)[number]>();
  for (const p of out) {
    const prev = byUrl.get(p.url);
    if (!prev || p.text.length > prev.text.length) byUrl.set(p.url, p);
  }

  return Array.from(byUrl.values());
}

function isHexColor(x: any) {
  const s = String(x || "").trim();
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s);
}

/** deterministic fallback chunking when model outputs too few chunks */
function extractPricingChunksFromText(page: { url: string; title: string; text: string }) {
  const t = page.text;

  // Capture blocks around plan names (works for your German page)
  const planNames = ["Starter", "Wachstum", "Pro", "Custom"];
  const chunks: Array<{ title: string; content: string }> = [];

  for (const name of planNames) {
    const idx = t.toLowerCase().indexOf(name.toLowerCase());
    if (idx === -1) continue;

    // take a window after plan heading
    const window = t.slice(idx, idx + 1800);
    // stop early if we hit next plan
    let end = window.length;
    for (const other of planNames) {
      if (other === name) continue;
      const j = window.toLowerCase().indexOf(other.toLowerCase());
      if (j > 50) end = Math.min(end, j);
    }
    const block = cleanText(window.slice(0, end));
    if (block.length < 200) continue;

    chunks.push({
      title: `Pricing Plan: ${name}`,
      content: `PRICING PLAN\nName: ${name}\nSource: ${page.url}\n\n${block}`,
    });
  }

  return chunks;
}

function extractFeatureChunkFromText(page: { url: string; title: string; text: string }) {
  const t = page.text;

  // Heuristic: find "Alles, was Sie brauchen" / feature bullet-ish section
  const anchors = [
    "Alles, was Sie brauchen",
    "24/7",
    "Vollständig gebrandmarkt",
    "Gesprächsanalysen",
    "Multi-Tenant",
  ];

  let start = -1;
  for (const a of anchors) {
    const i = t.toLowerCase().indexOf(a.toLowerCase());
    if (i !== -1) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  const window = cleanText(t.slice(start, start + 1600));
  if (window.length < 300) return null;

  return {
    title: "Core Features",
    content: `CORE FEATURES\nSource: ${page.url}\n\n${window}`,
  };
}

function extractIndustriesChunkFromText(page: { url: string; title: string; text: string }) {
  const t = page.text;
  const anchor = "Entwickelt für";
  const i = t.toLowerCase().indexOf(anchor.toLowerCase());
  if (i === -1) return null;
  const window = cleanText(t.slice(i, i + 900));
  if (window.length < 200) return null;
  return {
    title: "Industries & Target Customers",
    content: `TARGET INDUSTRIES\nSource: ${page.url}\n\n${window}`,
  };
}

function extractCtasChunkFromText(page: { url: string; title: string; text: string }) {
  const links = page.text.match(/https?:\/\/[^\s)]+/g) || [];
  const uniq = Array.from(new Set(links)).slice(0, 25);
  if (!uniq.length) return null;
  return {
    title: "Calls to Action & Links",
    content: `CTAS & LINKS\nSource: ${page.url}\n\n- ${uniq.join("\n- ")}`,
  };
}

/**
 * Build semantic chunks + missing-info report.
 * Facts-only, no guessing.
 */
async function auditAndStructurePages(input: {
  company_id: string;
  website_url?: string | null;
  pages: Array<{ url: string; title: string; text: string; captured_at: string | null }>;
  brand_hints?: BrandHints | null;
}) {
  // Snippet risk heuristic
  const lens = input.pages.map((p) => p.text.length);
  const shortCount = lens.filter((l) => l < 800).length;
  const snippet_risk =
    input.pages.length === 0
      ? "high"
      : shortCount / input.pages.length >= 0.6
      ? "high"
      : shortCount / input.pages.length >= 0.3
      ? "medium"
      : "low";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `
You are Nova, an enterprise knowledge-base builder for a multi-tenant AI chat widget.

You will receive JSON with:
- company_id
- website_url (may be empty)
- brand_hints (may be empty): { primary_color_guess, accent_color_guess, logo_url }
- pages[]: { url, title, text, captured_at }

TASK:
1) Audit crawl coverage and content quality.
2) Extract ONLY facts explicitly present in pages. Do NOT guess.
3) Use brand_hints as branding if provided and valid hex/url.
4) Create semantically clean knowledge chunks for retrieval (RAG).
   IMPORTANT: Produce MULTIPLE chunks:
   - at least: about, services/features, pricing (one chunk per plan if possible), contact/cta if available.
5) Detect missing critical business information (pricing, services, location, contact, hours, booking/order flow, policies).
6) Propose next best URLs to crawl to fill gaps.

STRICT RULES:
- Use ONLY provided pages as sources (except brand_hints).
- If unknown, output "unknown" and list it in missing_info.
- Do NOT invent prices, addresses, services, or claims.
- Keep chunks concise and focused.

OUTPUT: Return STRICT JSON with this exact schema:

{
  "audit": {
    "pages_count": 0,
    "coverage_notes": ["..."],
    "content_quality": "good|mixed|poor",
    "snippet_risk": "low|medium|high"
  },
  "company_profile": {
    "company_name": "string|unknown",
    "tagline": "string|unknown",
    "industry": "string|unknown",
    "value_proposition": "string|unknown",
    "products_or_services_summary": "string|unknown",
    "locations": ["string"],
    "contact": {
      "email": "string|unknown",
      "phone": "string|unknown",
      "address": "string|unknown",
      "whatsapp": "string|unknown"
    },
    "hours": "string|unknown",
    "booking_or_order_flow": "string|unknown",
    "social_links": ["string"]
  },
  "branding": {
    "primary_color_guess": "hex|unknown",
    "accent_color_guess": "hex|unknown",
    "logo_url": "string|unknown",
    "tone_of_voice": "string|unknown",
    "greeting_suggestion": "string"
  },
  "knowledge_chunks": [
    {
      "type": "about|services|pricing|faq|contact|policies|other",
      "title": "string",
      "source_url": "string",
      "content": "string",
      "keywords": ["string"],
      "confidence": "high|medium|low"
    }
  ],
  "missing_info": [
    {
      "field": "pricing|services_details|location|hours|contact|refunds|delivery|booking|other",
      "why_it_matters": "string",
      "what_to_crawl_next": ["url_suggestion_1", "url_suggestion_2"]
    }
  ],
  "next_crawl_targets": [
    { "url": "string", "reason": "string" }
  ]
}
`.trim(),
      },
      { role: "user", content: JSON.stringify(input) },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || "{}";

  let structured: any;
  try {
    structured = JSON.parse(raw);
  } catch {
    throw new Error("audit_structuring_failed:invalid_json");
  }

  // Force our heuristic snippet risk
  if (!structured?.audit) structured.audit = {};
  structured.audit.pages_count = input.pages.length;
  structured.audit.snippet_risk = structured.audit.snippet_risk || snippet_risk;

  // Apply brand_hints if present (don’t let model return "unknown" if we already know)
  const bh = input.brand_hints || {};
  if (!structured.branding) structured.branding = {};

  if (isHexColor(bh.primary_color_guess)) structured.branding.primary_color_guess = bh.primary_color_guess;
  if (isHexColor(bh.accent_color_guess)) structured.branding.accent_color_guess = bh.accent_color_guess;
  if (bh.logo_url && String(bh.logo_url).trim() && bh.logo_url !== "unknown") structured.branding.logo_url = bh.logo_url;

  // Deterministic fallback: if model produced too few chunks, supplement from text
  const chunks = Array.isArray(structured?.knowledge_chunks) ? structured.knowledge_chunks : [];
  const MIN = 8;
  if (chunks.length < MIN) {
    const p0 = input.pages[0];

    const supplements: any[] = [];

    // Overview chunk
    supplements.push({
      type: "about",
      title: "Overview (Fallback)",
      source_url: p0.url,
      content: cleanText(p0.text.slice(0, 900)),
      keywords: ["overview", "company", "about"],
      confidence: structured?.audit?.snippet_risk === "high" ? "low" : "medium",
    });

    // Features
    const feat = extractFeatureChunkFromText(p0);
    if (feat) {
      supplements.push({
        type: "services",
        title: feat.title,
        source_url: p0.url,
        content: feat.content,
        keywords: ["features", "service", "lead", "automation"],
        confidence: "medium",
      });
    }

    // Industries
    const ind = extractIndustriesChunkFromText(p0);
    if (ind) {
      supplements.push({
        type: "services",
        title: ind.title,
        source_url: p0.url,
        content: ind.content,
        keywords: ["industries", "customers", "target"],
        confidence: "medium",
      });
    }

    // Pricing plans
    const plans = extractPricingChunksFromText(p0);
    for (const pl of plans) {
      supplements.push({
        type: "pricing",
        title: pl.title,
        source_url: p0.url,
        content: pl.content,
        keywords: ["pricing", "plan", "starter", "wachstum", "pro", "custom"],
        confidence: "high",
      });
    }

    // CTAs/links
    const cta = extractCtasChunkFromText(p0);
    if (cta) {
      supplements.push({
        type: "contact",
        title: cta.title,
        source_url: p0.url,
        content: cta.content,
        keywords: ["cta", "stripe", "whatsapp", "contact"],
        confidence: "medium",
      });
    }

    structured.knowledge_chunks = [...chunks, ...supplements].slice(0, 60);
  }

  return structured;
}

/**
 * Insert semantic chunks into knowledge_chunks with embeddings.
 */
async function embedAndInsertSemanticChunksFromAudit(company_id: string, auditJson: any) {
  const chunks = Array.isArray(auditJson?.knowledge_chunks) ? auditJson.knowledge_chunks : [];
  const cleaned = chunks
    .map((c: any) => {
      const type = String(c?.type || "other").trim();
      const title = cleanText(c?.title || "Knowledge");
      const source_url = String(c?.source_url || "").trim() || null;
      const content = cleanText(c?.content || "");
      const keywords = Array.isArray(c?.keywords) ? c.keywords.map((k: any) => cleanText(k)).filter(Boolean) : [];
      const confidence = String(c?.confidence || "medium").trim();

      if (!content) return null;

      const hash = sha256(`${company_id}::${source_url || ""}::${title}::${content}`);

      const snippetRisk = String(auditJson?.audit?.snippet_risk || "").toLowerCase();
      const finalConfidence =
        snippetRisk === "high" && confidence === "high" ? "medium" : confidence;

      return {
        company_id,
        title: `Website Import • ${type.toUpperCase()} • ${title}`,
        content,
        source_ref: source_url,
        metadata: {
          kind: "ui_pages_audit",
          type,
          keywords,
          confidence: finalConfidence,
          hash,
          created_at: new Date().toISOString(),
        },
      };
    })
    .filter(Boolean) as Array<{ company_id: string; title: string; content: string; source_ref?: string | null; metadata?: any }>;

  const limited = cleaned.slice(0, 120);
  return embedAndInsertRows(limited);
}

/**
 * Persist branding + inferred profile into company_settings.branding_json
 */
async function persistBrandingAndProfile(company_id: string, auditJson: any) {
  const profile = auditJson?.company_profile || null;
  const branding = auditJson?.branding || null;
  if (!profile && !branding) return;

  const { data: existing, error: selErr } = await supabaseServer
    .from("company_settings")
    .select("branding_json")
    .eq("company_id", company_id)
    .maybeSingle();

  if (selErr) return;

  const prev = (existing?.branding_json || {}) as any;

  const inferredPrimary =
    branding?.primary_color_guess && branding.primary_color_guess !== "unknown" ? branding.primary_color_guess : undefined;
  const inferredAccent =
    branding?.accent_color_guess && branding.accent_color_guess !== "unknown" ? branding.accent_color_guess : undefined;
  const inferredLogo =
    branding?.logo_url && branding.logo_url !== "unknown" ? branding.logo_url : undefined;

  const next = {
    ...prev,
    company_name: prev.company_name || (profile?.company_name && profile.company_name !== "unknown" ? profile.company_name : undefined),
    greeting: prev.greeting || (branding?.greeting_suggestion ? branding.greeting_suggestion : undefined),

    // normalize to your earlier admin UI "primary/accent/logo_url"
    primary: prev.primary || inferredPrimary,
    accent: prev.accent || inferredAccent,
    logo_url: prev.logo_url || inferredLogo,

    _inferred: {
      updated_at: new Date().toISOString(),
      company_profile: profile,
      branding_inference: branding,
      audit: auditJson?.audit || null,
    },
  };

  const { error: upErr } = await supabaseServer
    .from("company_settings")
    .upsert({ company_id, branding_json: next }, { onConflict: "company_id" });

  if (upErr) return;
}

/** --------- existing crawler_data structurer (keep) --------- */

async function structureCrawlerDataToChunks(crawlerData: any) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `
You are a SaaS website knowledge structuring engine.

Transform raw crawler JSON into structured knowledge blocks that are useful for retrieval (RAG).

Rules:
- Do NOT invent. Only use information supported by the crawler data.
- Prefer short, precise strings.
- If something is unknown, omit it (do not guess).

Return STRICTLY valid JSON with this schema:

{
  "overview": string,
  "pricing_plans": [
    {
      "name": string,
      "price": string,
      "billing_period": string,
      "features": string[],
      "target": string
    }
  ],
  "features": string[],
  "benefits": string[],
  "ctas": string[],
  "faqs": [
    { "question": string, "answer": string }
  ]
}
`.trim(),
      },
      { role: "user", content: JSON.stringify(crawlerData) },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || "{}";

  let structured: any;
  try {
    structured = JSON.parse(raw);
  } catch {
    throw new Error("crawler_structuring_failed:invalid_json");
  }

  const chunks: string[] = [];

  if (structured?.overview && String(structured.overview).trim()) {
    chunks.push(`COMPANY OVERVIEW:\n${String(structured.overview).trim()}`);
  }

  if (Array.isArray(structured?.pricing_plans) && structured.pricing_plans.length) {
    for (const p of structured.pricing_plans) {
      const name = String(p?.name || "").trim();
      const price = String(p?.price || "").trim();
      const billing = String(p?.billing_period || "").trim();
      const target = String(p?.target || "").trim();
      const features = Array.isArray(p?.features) ? p.features.map((x: any) => String(x).trim()).filter(Boolean) : [];

      const blockLines: string[] = [];
      blockLines.push("PRICING PLAN:");
      if (name) blockLines.push(`Name: ${name}`);
      if (price) blockLines.push(`Price: ${price}`);
      if (billing) blockLines.push(`Billing: ${billing}`);
      if (target) blockLines.push(`Target: ${target}`);
      if (features.length) blockLines.push(`Features:\n- ${features.join("\n- ")}`);

      if (blockLines.length > 1) chunks.push(blockLines.join("\n"));
    }
  }

  if (Array.isArray(structured?.features) && structured.features.length) {
    const feats = structured.features.map((x: any) => String(x).trim()).filter(Boolean);
    if (feats.length) chunks.push(`CORE FEATURES:\n- ${feats.join("\n- ")}`);
  }

  if (Array.isArray(structured?.benefits) && structured.benefits.length) {
    const bens = structured.benefits.map((x: any) => String(x).trim()).filter(Boolean);
    if (bens.length) chunks.push(`CUSTOMER BENEFITS:\n- ${bens.join("\n- ")}`);
  }

  if (Array.isArray(structured?.ctas) && structured.ctas.length) {
    const ctas = structured.ctas.map((x: any) => String(x).trim()).filter(Boolean);
    if (ctas.length) chunks.push(`CALLS TO ACTION:\n- ${ctas.join("\n- ")}`);
  }

  if (Array.isArray(structured?.faqs) && structured.faqs.length) {
    for (const f of structured.faqs) {
      const q = String(f?.question || "").trim();
      const a = String(f?.answer || "").trim();
      if (q && a) chunks.push(`FAQ:\nQ: ${q}\nA: ${a}`);
    }
  }

  return chunks.map((c) => c.trim()).filter(Boolean);
}

async function embedAndInsertSemanticChunks(company_id: string, title: string, chunks: string[], source_url?: string | null) {
  if (!chunks.length) return { chunks: 0 };

  const rows = chunks.slice(0, 120).map((c) => ({
    company_id,
    title,
    content: cleanText(c),
    source_ref: source_url || null,
    metadata: { kind: "crawler_structured", created_at: new Date().toISOString(), hash: sha256(`${company_id}::${source_url || ""}::${title}::${c}`) },
  }));

  return embedAndInsertRows(rows);
}

/** --------- route --------- */

export async function POST(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);

  const company_id = String(body?.company_id || "").trim();
  if (!company_id) {
    return NextResponse.json({ error: "company_id_required" }, { status: 400 });
  }

  /**
   * NEW MODE: UI pages ingest (manual crawl via web UI)
   *
   * Call with:
   * {
   *   company_id,
   *   website_url?: "https://example.com",
   *   pages: [{ url, title?, text, captured_at? }],
   *   brand_hints?: { primary_color_guess?, accent_color_guess?, logo_url? },
   *   persist_profile?: true
   * }
   */
  if (Array.isArray(body?.pages)) {
    const pages = normalizePages(body.pages as IngestPage[]);
    const website_url = String(body?.website_url || "").trim() || null;

    const brand_hints: BrandHints | null = body?.brand_hints && typeof body.brand_hints === "object"
      ? {
          primary_color_guess: body.brand_hints.primary_color_guess ?? null,
          accent_color_guess: body.brand_hints.accent_color_guess ?? null,
          logo_url: body.brand_hints.logo_url ?? null,
        }
      : null;

    if (!pages.length) {
      return NextResponse.json({ error: "pages_required", details: "No valid pages with url+text found." }, { status: 400 });
    }

    const capped = pages.slice(0, 25);

    try {
      const structured = await auditAndStructurePages({
        company_id,
        website_url,
        pages: capped,
        brand_hints,
      });

      const r = await embedAndInsertSemanticChunksFromAudit(company_id, structured);

      const persist_profile = !!body?.persist_profile;
      if (persist_profile) {
        await persistBrandingAndProfile(company_id, structured);
      }

      return NextResponse.json({
        ok: true,
        mode: "ui_pages_audit",
        company_id,
        inserted_chunks: r.chunks,
        audit: structured?.audit || null,
        company_profile: structured?.company_profile || null,
        branding: structured?.branding || null,
        missing_info: structured?.missing_info || [],
        next_crawl_targets: structured?.next_crawl_targets || [],
      });
    } catch (e: any) {
      return NextResponse.json(
        { error: "ui_pages_ingest_failed", details: e?.message || "unknown" },
        { status: 500 }
      );
    }
  }

  /**
   * Existing mode: structured crawler JSON
   */
  if (body?.crawler_data) {
    try {
      const source_url = String(body?.source_url || "").trim() || null;
      const chunks = await structureCrawlerDataToChunks(body.crawler_data);

      const r = await embedAndInsertSemanticChunks(company_id, "Website Import", chunks, source_url);

      return NextResponse.json({
        ok: true,
        mode: "crawler_structured",
        company_id,
        chunks: r.chunks,
      });
    } catch (e: any) {
      return NextResponse.json(
        { error: "crawler_structured_ingest_failed", details: e?.message || "unknown" },
        { status: 500 }
      );
    }
  }

  /**
   * Existing mode: URL(s) import via importFromWebsite
   */
  const content = String(body?.content || "").trim();
  const title = String(body?.title || "Manual Entry").trim();

  if (!content) {
    return NextResponse.json({ error: "content_or_pages_required" }, { status: 400 });
  }

  const urls = extractUrlsFromText(content);
  const urlMode =
    urls.length > 0 &&
    (isUrl(content) || content.split(/\s+/).every((t) => isUrl(t)));

  if (urlMode) {
    const maxPages = Number.isFinite(Number(body?.max_pages)) ? Number(body.max_pages) : 5;
    const companyNameHint = String(body?.company_name_hint || "").trim() || undefined;

    const limitedUrls = urls.slice(0, 3);
    const results: any[] = [];

    for (const url of limitedUrls) {
      const r = await importFromWebsite({
        company_id,
        url,
        maxPages: clamp(Math.floor(maxPages), 1, 25),
        companyNameHint,
      });
      results.push({ url, ...(r as any) });
    }

    return NextResponse.json({
      ok: true,
      mode: "website_import",
      company_id,
      runs: results.length,
      results,
    });
  }

  /**
   * Existing mode: manual text
   */
  try {
    const r = await embedAndInsert(company_id, title, content);
    return NextResponse.json({ ok: true, mode: "text", company_id, chunks: r.chunks });
  } catch (e: any) {
    return NextResponse.json({ error: "insert_failed", details: e?.message || "unknown" }, { status: 500 });
  }
}