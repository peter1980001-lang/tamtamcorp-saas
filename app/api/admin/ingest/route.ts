import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { chunkText } from "@/lib/chunkText";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  // simple admin protection
  const adminSecret = req.headers.get("x-admin-secret");
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const company_id = body.company_id as string;
  const content = body.content as string;
  const title = (body.title as string) || null;
  const source_type = (body.source_type as string) || "text";
  const source_ref = (body.source_ref as string) || null;

  if (!company_id || !content) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // chunk
  const chunks = chunkText(content, 900, 150);
  if (chunks.length === 0) {
    return NextResponse.json({ error: "empty_content" }, { status: 400 });
  }

  // embed each chunk
  const embeddings: number[][] = [];
  for (const chunk of chunks) {
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk,
    });
    embeddings.push(emb.data[0].embedding);
  }

  // insert rows
  const rows = chunks.map((chunk, i) => ({
    company_id,
    source_type,
    source_ref,
    title,
    content: chunk,
    embedding: embeddings[i],
    metadata: { chunk_index: i, chunks_total: chunks.length },
  }));

  const { error } = await supabase.from("knowledge_chunks").insert(rows);
  if (error) {
    return NextResponse.json({ error: "db_insert_failed", details: error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, chunks: chunks.length });
}
