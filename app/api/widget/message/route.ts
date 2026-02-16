// app/api/widget/message/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkBillingGate } from "@/lib/billingGate";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function detectIntent(text: string): "pricing" | "faq" | "contact" | null {
  const t = text.toLowerCase();

  if (/(price|pricing|cost|quote|offer|proposal|plan|package|preis|preise|kosten|angebot|paket|abo)/i.test(t)) {
    return "pricing";
  }

  if (/(faq|question|questions|frage|fragen|how does|wie funktioniert)/i.test(t)) {
    return "faq";
  }

  if (/(contact|call|appointment|termin|kontakt|anruf|reach)/i.test(t)) {
    return "contact";
  }

  return null;
}

async function embedQuery(text: string): Promise<number[]> {
  const r = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return r.data[0].embedding as unknown as number[];
}

async function matchKnowledgeChunks(
  company_id: string,
  embedding: number[],
  match_count: number,
  intent: string | null
) {
  const { data, error } = await supabaseServer.rpc("match_knowledge_chunks", {
    p_company_id: company_id,
    p_query_embedding: embedding,
    p_match_count: match_count,
    p_intent: intent,
  });

  if (error) return { ok: false as const, rows: [] as any[] };
  return { ok: true as const, rows: Array.isArray(data) ? data : [] };
}

function buildContext(rows: any[]) {
  if (!Array.isArray(rows) || rows.length === 0) return "";

  const sorted = [...rows].sort((a: any, b: any) => {
    const simA = Number(a.similarity ?? 0);
    const simB = Number(b.similarity ?? 0);
    if (simA !== simB) return simB - simA;

    const metaA = a.metadata || {};
    const metaB = b.metadata || {};

    const sectionA = Number(metaA.section_order ?? 0);
    const sectionB = Number(metaB.section_order ?? 0);
    if (sectionA !== sectionB) return sectionA - sectionB;

    const chunkA = Number(metaA.chunk_index ?? 0);
    const chunkB = Number(metaB.chunk_index ?? 0);
    return chunkA - chunkB;
  });

  return sorted
    .map((r: any, i: number) => {
      const meta = r.metadata || {};
      const section = meta.section_title ? `SECTION: ${meta.section_title}\n` : "";
      return `[#${i + 1}]\n${section}${String(r.content || "").trim()}`;
    })
    .join("\n\n---\n\n");
}

function detectCommercialIntent(text: string): boolean {
  return /(price|pricing|cost|quote|offer|demo|trial|subscribe|plan|package|preis|kosten|angebot|paket|abo)/i.test(text);
}

function detectContactSharing(text: string): boolean {
  const email = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text);
  const phone = /(\+?\d[\d\s().-]{7,}\d)/.test(text);
  return email || phone;
}

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

  let payload: any;
  try {
    payload = jwt.verify(token, process.env.WIDGET_JWT_SECRET!);
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const company_id = String(payload.company_id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const conversation_id = String(body?.conversation_id || "").trim();
  const message = String(body?.message || "").trim();

  if (!conversation_id || !message) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { data: conv } = await supabaseServer
    .from("conversations")
    .select("id,company_id")
    .eq("id", conversation_id)
    .maybeSingle();

  if (!conv || String(conv.company_id) !== company_id) {
    return NextResponse.json({ error: "invalid_conversation" }, { status: 403 });
  }

  const bill = await checkBillingGate(company_id);
  if (!bill.ok) {
    return NextResponse.json({ error: bill.code }, { status: 402 });
  }

  await supabaseServer.from("messages").insert({
    conversation_id,
    role: "user",
    content: message,
  });

  const intent = detectIntent(message);

  let context = "";
  let sources: any[] = [];

  try {
    const emb = await embedQuery(message);
    const match = await matchKnowledgeChunks(company_id, emb, 6, intent);

    if (match.ok && match.rows.length > 0) {
      sources = match.rows;
      context = buildContext(match.rows);
    }
  } catch {}

  const systemPrompt = `
You are a professional AI sales concierge.

Use the KNOWLEDGE CONTEXT as the primary source of truth.
If the answer is not clearly contained in the knowledge context, say so.
Be concise, structured and confident.

KNOWLEDGE CONTEXT:
${context || "(empty)"}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
  });

  const reply = String(completion.choices?.[0]?.message?.content || "").trim();

  await supabaseServer.from("messages").insert({
    conversation_id,
    role: "assistant",
    content: reply,
  });

  const commercial = detectCommercialIntent(message);
  const contactShared = detectContactSharing(message);
  const needLead = commercial || contactShared;

  return NextResponse.json({
    reply,
    need_lead_capture: needLead,
    sources,
  });
}
