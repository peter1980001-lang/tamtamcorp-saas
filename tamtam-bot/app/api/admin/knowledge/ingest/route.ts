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

  const chunks = chunkText(content);

  // embeddings in batches (faster + cheaper)
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks,
  });

  const rows = chunks.map((c, idx) => ({
    company_id,
    title,
    content: c,
    embedding: emb.data[idx].embedding,
  }));

  const { error } = await supabaseServer.from("knowledge_chunks").insert(rows);
  if (error) return NextResponse.json({ error: "insert_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, chunks: chunks.length });
}
