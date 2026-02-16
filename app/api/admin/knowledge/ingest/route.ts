import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";
import OpenAI from "openai";

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

function isProbablyUrl(s: string) {
  const t = String(s || "").trim();
  if (!t) return false;
  if (/^https?:\/\/[^\s]+$/i.test(t)) return true;
  return false;
}

function extractUrlsFromText(input: string) {
  const urls = new Set<string>();
  const s = String(input || "");
  // capture common url patterns
  const re = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const u = String(m[0]).trim();
    if (u) urls.add(u);
  }
  return Array.from(urls);
}

function stripHtmlToText(html: string) {
  let s = String(html || "");

  // remove script/style/noscript
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  s = s.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ");

  // remove nav/footer/header/aside (best-effort)
  s = s.replace(/<(nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");

  // turn <br> and </p> into line breaks
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n");

  // remove all tags
  s = s.replace(/<[^>]+>/g, " ");

  // decode minimal entities
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  // cleanup whitespace
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s.trim();
}

function guessTitleFromHtml(html: string) {
  const m = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return "";
  return String(m[1] || "").replace(/\s+/g, " ").trim();
}

async function fetchUrlText(url: string) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      // simple, helps some servers
      "User-Agent": "TamTamCorpBot/1.0 (+knowledge-ingest)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const ct = String(res.headers.get("content-type") || "").toLowerCase();
  const raw = await res.text();

  // if not html, still store raw as text
  const title = ct.includes("text/html") ? guessTitleFromHtml(raw) : "";
  const text = ct.includes("text/html") ? stripHtmlToText(raw) : String(raw || "").trim();

  return { ok: res.ok, status: res.status, contentType: ct, title, text };
}

async function embedAndInsertRows(rows: Array<{ company_id: string; title: string; content: string; source_ref?: string | null; metadata?: any }>) {
  if (!rows.length) return { inserted: 0 };

  // embeddings in batches (safer for large inserts)
  const BATCH = 96;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const inputs = batch.map((r) => r.content);

    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: inputs,
    });

    const insertRows = batch.map((r, idx) => ({
      company_id: r.company_id,
      title: r.title,
      content: r.content,
      source_ref: r.source_ref ?? null,
      metadata: r.metadata ?? {},
      embedding: emb.data[idx].embedding,
    }));

    const { error } = await supabaseServer.from("knowledge_chunks").insert(insertRows);
    if (error) throw new Error(`insert_failed: ${error.message}`);

    inserted += insertRows.length;
  }

  return { inserted };
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

  // 1) URL mode: if content contains URL(s), we fetch+extract+chunk them
  const urls = extractUrlsFromText(content);
  const urlMode =
    urls.length > 0 &&
    // treat as url mode if content is JUST a url or a list of urls (common admin use)
    (isProbablyUrl(content) || content.split(/\s+/).every((t) => isProbablyUrl(t)));

  if (urlMode) {
    const pages: Array<{ url: string; ok: boolean; status: number; title: string; chars: number; chunks: number; error?: string }> = [];
    const allRows: Array<{ company_id: string; title: string; content: string; source_ref?: string | null; metadata?: any }> = [];

    for (const url of urls) {
      try {
        const { ok, status, title: pageTitle, text } = await fetchUrlText(url);

        const finalText = String(text || "").trim();
        if (!finalText) {
          pages.push({ url, ok, status, title: pageTitle || "", chars: 0, chunks: 0, error: "empty_extraction" });
          continue;
        }

        const chunks = chunkText(finalText);
        const t = pageTitle || title || "Website Import";

        for (const c of chunks) {
          allRows.push({
            company_id,
            title: t,
            content: c,
            source_ref: url,
            metadata: {
              kind: "web",
              url,
              fetched_at: new Date().toISOString(),
            },
          });
        }

        pages.push({ url, ok, status, title: pageTitle || "", chars: finalText.length, chunks: chunks.length });
      } catch (e: any) {
        pages.push({ url, ok: false, status: 0, title: "", chars: 0, chunks: 0, error: e?.message || "fetch_failed" });
      }
    }

    try {
      const result = await embedAndInsertRows(allRows);
      return NextResponse.json({
        ok: true,
        mode: "url",
        company_id,
        urls: urls.length,
        inserted_chunks: result.inserted,
        pages,
      });
    } catch (e: any) {
      return NextResponse.json({ error: "insert_failed", details: e?.message || "unknown" }, { status: 500 });
    }
  }

  // 2) Manual text mode (old behavior): chunk the given text and store
  const chunks = chunkText(content);

  const rows = chunks.map((c) => ({
    company_id,
    title,
    content: c,
    source_ref: null as any,
    metadata: { kind: "manual", created_at: new Date().toISOString() },
  }));

  try {
    const result = await embedAndInsertRows(rows);
    return NextResponse.json({ ok: true, mode: "text", company_id, chunks: chunks.length, inserted_chunks: result.inserted });
  } catch (e: any) {
    return NextResponse.json({ error: "insert_failed", details: e?.message || "unknown" }, { status: 500 });
  }
}
