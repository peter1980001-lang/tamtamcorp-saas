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

export async function POST(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const company_id = String(body?.company_id || "").trim();
  const content = String(body?.content || "").trim();
  const title = String(body?.title || "Manual Entry").trim();

  if (!company_id || !content) {
    return NextResponse.json({ error: "company_id_and_content_required" }, { status: 400 });
  }

  // If admin pasted URL(s), use the deep website importer (same as /import/url)
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

  // Manual text mode (original behavior)
  try {
    const r = await embedAndInsert(company_id, title, content);
    return NextResponse.json({ ok: true, mode: "text", company_id, chunks: r.chunks });
  } catch (e: any) {
    return NextResponse.json({ error: "insert_failed", details: e?.message || "unknown" }, { status: 500 });
  }
}
