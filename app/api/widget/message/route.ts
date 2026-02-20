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

  if (/(contact|call|appointment|termin|kontakt|anruf|reach|demo|meeting|book)/i.test(t)) {
    return "contact";
  }

  return null;
}

function detectCommercialIntent(text: string): boolean {
  return /(price|pricing|cost|quote|offer|demo|trial|subscribe|plan|package|preis|kosten|angebot|paket|abo)/i.test(text);
}

function detectContactSharing(text: string): boolean {
  const email = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text);
  const phone = /(\+?\d[\d\s().-]{7,}\d)/.test(text);
  return email || phone;
}

function extractEmail(text: string): string | null {
  const m = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  return m ? m[0].trim().toLowerCase() : null;
}

function extractPhone(text: string): string | null {
  const m = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

function intentScore(intent: string | null): number {
  if (intent === "pricing") return 10;
  if (intent === "contact") return 8;
  if (intent === "faq") return 2;
  return 0;
}

function computeScore(params: {
  message: string;
  commercial: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  intent: string | null;
}) {
  let score = 0;

  // Base: commercial intent creates a lead (warm baseline)
  if (params.commercial) score += 25;

  // Intent
  score += intentScore(params.intent);

  // Strong buying signals
  if (/(demo|call|appointment|termin|book|schedule|meeting|beratung)/i.test(params.message)) score += 20;
  if (/(budget|€|aed|dirham|euro|usd)/i.test(params.message)) score += 10;
  if (/(asap|urgent|sofort|heute|this week|tomorrow|morgen)/i.test(params.message)) score += 10;

  // Contact info => HOT
  if (params.hasEmail) score += 25;
  if (params.hasPhone) score += 25;

  if (score > 100) score = 100;
  return score;
}

function bandFromScore(score: number): "cold" | "warm" | "hot" {
  if (score >= 60) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}

function buildLeadPreview(input: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  intent?: string | null;
  score_band: "cold" | "warm" | "hot";
  message: string;
}) {
  const bits: string[] = [];
  bits.push(input.score_band.toUpperCase());
  if (input.intent) bits.push(input.intent.toUpperCase());
  if (input.name) bits.push(input.name);
  if (input.email) bits.push(input.email);
  if (input.phone) bits.push(input.phone);

  const msg = input.message.replace(/\s+/g, " ").trim();
  const snippet = msg.length > 140 ? msg.slice(0, 140) + "…" : msg;

  return `${bits.join(" · ")} — ${snippet}`;
}

async function embedQuery(text: string): Promise<number[]> {
  const r = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return r.data[0].embedding as unknown as number[];
}

async function matchKnowledgeChunks(company_id: string, embedding: number[], match_count: number, intent: string | null) {
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

async function upsertCompanyLead(params: {
  company_id: string;
  conversation_id: string;
  message: string;
  intent: string | null;
  commercial: boolean;
}) {
  const email = extractEmail(params.message);
  const phone = extractPhone(params.message);
  const hasContact = !!email || !!phone;

  // If it's not commercial and no contact detected, we only update if a lead already exists.
  const { data: existing } = await supabaseServer
    .from("company_leads")
    .select("id,name,email,phone,score_total,score_band,status,qualification_json,consents_json,tags")
    .eq("company_id", params.company_id)
    .eq("conversation_id", params.conversation_id)
    .maybeSingle();

  const shouldCreate = params.commercial || hasContact;
  if (!existing && !shouldCreate) return; // do nothing

  const prevScore = Number(existing?.score_total ?? 0);
  const nextScore = Math.max(
    prevScore,
    computeScore({
      message: params.message,
      commercial: params.commercial,
      hasEmail: !!email || !!existing?.email,
      hasPhone: !!phone || !!existing?.phone,
      intent: params.intent,
    })
  );

  const nextBand = bandFromScore(nextScore);

  const mergedEmail = existing?.email || email || null;
  const mergedPhone = existing?.phone || phone || null;

  const prevQual = existing?.qualification_json && typeof existing.qualification_json === "object" ? existing.qualification_json : {};
  const nextQual = {
    ...prevQual,
    // lightweight trace (optional)
    last_user_message: params.message,
    last_intent: params.intent,
  };

  const lead_preview = buildLeadPreview({
    name: existing?.name || null,
    email: mergedEmail,
    phone: mergedPhone,
    intent: params.intent,
    score_band: nextBand,
    message: params.message,
  });

  const row: any = {
    company_id: params.company_id,
    conversation_id: params.conversation_id,
    channel: "widget",
    lead_state: existing ? existing.lead_state || "discovery" : "discovery",
    status: existing ? existing.status || "new" : "new",
    name: existing?.name || null,
    email: mergedEmail,
    phone: mergedPhone,
    qualification_json: nextQual,
    intent_score: Math.max(Number(existing?.intent_score ?? 0), intentScore(params.intent)),
    score_total: nextScore,
    score_band: nextBand,
    tags: existing?.tags ?? [],
    last_touch_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lead_preview,
  };

  // With the unique index (company_id, conversation_id), we can upsert safely.
  await supabaseServer.from("company_leads").upsert(row, {
    onConflict: "company_id,conversation_id",
  });
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

  // store user message
  await supabaseServer.from("messages").insert({
    conversation_id,
    role: "user",
    content: message,
  });

  const intent = detectIntent(message);
  const commercial = detectCommercialIntent(message);
  const contactShared = detectContactSharing(message);
  const needLead = commercial || contactShared;

  // ✅ Lead creation/enrichment (commercial creates lead, contact => hot)
  try {
    await upsertCompanyLead({
      company_id,
      conversation_id,
      message,
      intent,
      commercial,
    });
  } catch {
    // never block chat
  }

  // knowledge context
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

  // store assistant message
  await supabaseServer.from("messages").insert({
    conversation_id,
    role: "assistant",
    content: reply,
  });

  return NextResponse.json({
    reply,
    need_lead_capture: needLead,
    sources,
  });
}