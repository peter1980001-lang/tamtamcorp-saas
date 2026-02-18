// app/api/admin/knowledge/ingest/route.ts
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";
import OpenAI from "openai";
import { importFromWebsite } from "@/lib/knowledgeImport";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function chunkText(text: string, size = 900, overlap = 120) {
  const chunks: string[] = [];
  const clean = text.replace(/\s+/g, " ").trim();
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return chunks.filter(Boolean);
}

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

async function embedAndInsert(company_id: string, title: string, content: string) {
  const chunks = chunkText(content);

  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks,
  });

  const rows = chunks.map((c, idx) => ({
    company_id,
    title,
    content: c,
    embedding: emb.data[idx].embedding,
    source_ref: null as any,
    metadata: { kind: "manual", created_at: new Date().toISOString() },
  }));

  const { error } = await supabaseServer.from("knowledge_chunks").insert(rows);
  if (error) throw new Error(`insert_failed:${error.message}`);

  return { chunks: chunks.length };
}

/**
 * NEW: Turn raw crawler JSON into semantically clean chunks.
 * We deliberately let OpenAI do the semantic structuring (pricing/features/faq/cta),
 * then embed those semantic blocks (not character-based splitting).
 */
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
`,
      },
      { role: "user", content: JSON.stringify(crawlerData) },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || "{}";

  let structured: any;
  try {
    structured = JSON.parse(raw);
  } catch {
    // If model returns non-JSON by accident, fail hard — better than ingesting garbage
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

  // Final sanity filter
  return chunks.map((c) => c.trim()).filter(Boolean);
}

async function embedAndInsertSemanticChunks(company_id: string, title: string, chunks: string[], source_url?: string | null) {
  if (!chunks.length) return { chunks: 0 };

  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks,
  });

  const rows = chunks.map((c, idx) => ({
    company_id,
    title,
    content: c,
    embedding: emb.data[idx].embedding,
    source_ref: source_url || null,
    metadata: { kind: "crawler_structured", created_at: new Date().toISOString() },
  }));

  const { error } = await supabaseServer.from("knowledge_chunks").insert(rows);
  if (error) throw new Error(`insert_failed:${error.message}`);

  return { chunks: chunks.length };
}

export async function POST(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);

  const company_id = String(body?.company_id || "").trim();
  const content = String(body?.content || "").trim();
  const title = String(body?.title || "Manual Entry").trim();

  if (!company_id) {
    return NextResponse.json({ error: "company_id_required" }, { status: 400 });
  }

  // -------------------------------------------------------
  // NEW MODE: Ingest structured crawler data (from Replit crawler)
  //
  // Call this route with:
  // {
  //   company_id,
  //   crawler_data: { ...raw json from crawler... },
  //   source_url?: "https://example.com"
  // }
  // -------------------------------------------------------
  if (body?.crawler_data) {
    try {
      const source_url = String(body?.source_url || "").trim() || null;
      const chunks = await structureCrawlerDataToChunks(body.crawler_data);

      const r = await embedAndInsertSemanticChunks(
        company_id,
        "Website Import",
        chunks,
        source_url
      );

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

  // -------------------------------------------------------
  // Original behavior: If admin pasted URL(s), use deep website importer
  // -------------------------------------------------------
  if (!content) {
    return NextResponse.json({ error: "company_id_and_content_required" }, { status: 400 });
  }

  const urls = extractUrlsFromText(content);
  const urlMode =
    urls.length > 0 &&
    (isUrl(content) || content.split(/\s+/).every((t) => isUrl(t)));

  if (urlMode) {
    const maxPages = Number.isFinite(Number(body?.max_pages)) ? Number(body.max_pages) : 5;
    const companyNameHint = String(body?.company_name_hint || "").trim() || undefined;

    // if multiple urls, run importer per url (limited)
    const limitedUrls = urls.slice(0, 3); // safety to avoid accidental huge runs
    const results: any[] = [];

    for (const url of limitedUrls) {
      const r = await importFromWebsite({
        company_id,
        url,
        maxPages: Math.max(1, Math.min(25, Math.floor(maxPages))),
        companyNameHint,
      });

      results.push({ url, ...(r as any) });
    }

    return NextResponse.json({ ok: true, mode: "website_import", company_id, runs: results.length, results });
  }

  // -------------------------------------------------------
  // Manual text mode (original)
  // -------------------------------------------------------
  try {
    const r = await embedAndInsert(company_id, title, content);
    return NextResponse.json({ ok: true, mode: "text", company_id, chunks: r.chunks });
  } catch (e: any) {
    return NextResponse.json({ error: "insert_failed", details: e?.message || "unknown" }, { status: 500 });
  }
}
