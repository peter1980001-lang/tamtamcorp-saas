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

/** -------------------- Intent / signals -------------------- */
function detectIntent(text: string): "pricing" | "faq" | "contact" | null {
  const t = text.toLowerCase();

  if (/(price|pricing|cost|quote|offer|proposal|plan|package|preis|preise|kosten|angebot|paket|abo)/i.test(t)) return "pricing";
  if (/(faq|question|questions|frage|fragen|how does|wie funktioniert)/i.test(t)) return "faq";
  if (/(contact|call|appointment|termin|kontakt|anruf|reach|demo|meeting|book|schedule)/i.test(t)) return "contact";

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

function detectPriceObjection(text: string): boolean {
  return /(too expensive|expensive|teuer|zu teuer|pricey|costly|overpriced)/i.test(text);
}

function detectProceed(text: string): boolean {
  return /(how can we proceed|next step|what now|let's proceed|start|book|schedule|call|demo|meeting|weiter|wie geht es weiter)/i.test(text);
}

function extractEmail(text: string): string | null {
  const m = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  return m ? m[0].trim().toLowerCase() : null;
}

function extractPhone(text: string): string | null {
  const m = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

/** -------------------- Funnel config (white-label) -------------------- */
type FunnelConfig = {
  enabled: boolean;
  objection_handling: boolean;
  require_qualification: boolean;
  show_pricing: boolean;
  pricing_strategy: "multi-tier" | "anchor" | "request-only";
  allow_unknown_fallback: boolean;

  tone: "consultative" | "direct" | "luxury" | "formal" | "playful";
  response_length: "concise" | "medium" | "detailed";
  language: string; // auto | en | de | ar ...

  cta_style: "one-question" | "strong-close" | "soft-close";
  default_cta: string | null;

  qualification_fields: any;
  retrieval_overrides: any;
};

async function loadFunnelConfig(company_id: string): Promise<FunnelConfig> {
  const { data } = await supabaseServer
    .from("company_funnel_config")
    .select("*")
    .eq("company_id", company_id)
    .maybeSingle();

  // sensible defaults if missing
  const cfg: FunnelConfig = {
    enabled: data?.enabled ?? true,
    objection_handling: data?.objection_handling ?? true,
    require_qualification: data?.require_qualification ?? true,
    show_pricing: data?.show_pricing ?? true,
    pricing_strategy: (data?.pricing_strategy as any) ?? "multi-tier",
    allow_unknown_fallback: data?.allow_unknown_fallback ?? true,

    tone: (data?.tone as any) ?? "consultative",
    response_length: (data?.response_length as any) ?? "concise",
    language: (data?.language as any) ?? "auto",

    cta_style: (data?.cta_style as any) ?? "one-question",
    default_cta: data?.default_cta ?? null,

    qualification_fields:
      data?.qualification_fields ??
      {
        industry: true,
        goal: true,
        timeline: true,
        budget: true,
        location: false,
      },

    retrieval_overrides:
      data?.retrieval_overrides ??
      {
        pricing: { enabled: true, match_count: 12, force_sections: ["pricing", "plans"] },
      },
  };

  return cfg;
}

/** -------------------- Funnel state engine -------------------- */
type FunnelState = "awareness" | "pricing_interest" | "objection_price" | "qualification" | "contact_capture" | "closing";

function nextFunnelState(params: { message: string; prev?: FunnelState | null }): FunnelState {
  const { message, prev } = params;

  if (detectContactSharing(message)) return "contact_capture";
  if (detectPriceObjection(message)) return "objection_price";
  if (detectProceed(message)) return "closing";
  if (detectCommercialIntent(message)) return "pricing_interest";

  // sticky behavior
  if (prev === "pricing_interest" || prev === "objection_price") return "qualification";
  if (prev === "qualification") return "qualification";

  return "awareness";
}

function oneStrategicQuestion(state: FunnelState, fields: any): string {
  const wantIndustry = fields?.industry !== false;
  const wantGoal = fields?.goal !== false;
  const wantTimeline = fields?.timeline !== false;
  const wantBudget = fields?.budget !== false;

  if (state === "awareness") {
    if (wantIndustry) return "What industry are you in?";
    if (wantGoal) return "What outcome are you aiming for—more leads, bookings, or support automation?";
    return "What is the main goal you want to achieve with the AI assistant?";
  }

  if (state === "pricing_interest") {
    if (wantTimeline) return "When do you want to go live—this week, this month, or later?";
    return "Roughly how many conversations per month do you expect?";
  }

  if (state === "objection_price") {
    if (wantBudget) return "What monthly budget range would feel comfortable so I can recommend the best plan?";
    return "What’s your expected number of conversations per month?";
  }

  if (state === "qualification") {
    if (wantGoal) return "What would a ‘perfect lead’ look like for you (industry, budget, location, urgency)?";
    return "Do you want the bot to focus more on qualification or immediate appointment booking?";
  }

  if (state === "contact_capture") {
    return "Would you like a quick demo call, or should we set it up directly on your website first?";
  }

  return "Would you like to start with a quick demo or a setup checklist?";
}

/** -------------------- Prompt builder -------------------- */
function toneGuidelines(tone: FunnelConfig["tone"]) {
  if (tone === "luxury") return "Tone: premium, confident, concise. No hype. Elegant wording.";
  if (tone === "formal") return "Tone: formal, corporate, precise.";
  if (tone === "direct") return "Tone: direct, efficient, sales-oriented.";
  if (tone === "playful") return "Tone: friendly, light, but still professional.";
  return "Tone: consultative, helpful, confident.";
}

function lengthGuidelines(len: FunnelConfig["response_length"]) {
  if (len === "detailed") return "Length: detailed but structured (headings/bullets).";
  if (len === "medium") return "Length: medium. Short paragraphs, some bullets.";
  return "Length: concise. Max ~6–10 lines unless necessary.";
}

function buildSalesSystemPrompt(params: {
  companyName: string;
  config: FunnelConfig;
  state: FunnelState;
  strategicQuestion: string;
  knowledgeContext: string;
}) {
  const { companyName, config, state, strategicQuestion, knowledgeContext } = params;

  const rules: string[] = [
    "Never say: 'knowledge context does not provide'.",
    "If info is missing: ask a clarifying question or offer a next step.",
    "Ask exactly ONE strategic follow-up question at the end.",
    "Always keep the user moving toward qualification and contact capture.",
    "Be confident, professional, and conversion-oriented (not pushy).",
  ];

  if (config.show_pricing) {
    rules.push("If user asks about pricing: present ALL available plans in one compact block and recommend one based on their answers.");
    if (config.objection_handling) {
      rules.push("If user says it's expensive: validate, offer a lower tier, then ask a qualification question (traffic/budget/timeline).");
    }
  }

  const lang = config.language && config.language !== "auto" ? `Language: ${config.language}` : "Language: match the user's language.";

  return `
You are ${companyName}'s high-conversion AI Sales Concierge.

Goal:
1) Understand intent and funnel stage (${state})
2) Answer accurately using KNOWLEDGE CONTEXT
3) Qualify the visitor (one key question)
4) Move toward contact capture (email/phone) or booking

${lang}
${toneGuidelines(config.tone)}
${lengthGuidelines(config.response_length)}

Rules:
- ${rules.join("\n- ")}

End your answer with exactly one question:
"${strategicQuestion}"

KNOWLEDGE CONTEXT:
${knowledgeContext || "(empty)"}
`.trim();
}

/** -------------------- Knowledge retrieval -------------------- */
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

// Pricing override: pull more rows and filter for pricing-like chunks (best-effort)
async function fetchForcedPricingContext(company_id: string, match_count = 12) {
  const { data, error } = await supabaseServer
    .from("knowledge_chunks")
    .select("id, title, content, source_ref, metadata, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(Math.min(60, Math.max(8, match_count * 4)));

  if (error) return { ok: false as const, rows: [] as any[] };

  const rows = (data ?? []).filter((r: any) => {
    const m = r?.metadata || {};
    const type = String(m?.type || "").toLowerCase();
    const section = String(m?.section_title || "").toLowerCase();
    const title = String(r?.title || "").toLowerCase();
    const text = String(r?.content || "").toLowerCase();
    return (
      type.includes("pricing") ||
      type.includes("plan") ||
      section.includes("pricing") ||
      section.includes("plan") ||
      title.includes("pricing") ||
      title.includes("plan") ||
      text.includes("€/") ||
      text.includes("per month") ||
      text.includes("monat") ||
      text.includes("starter") ||
      text.includes("growth") ||
      text.includes("pro")
    );
  });

  const picked = rows.length ? rows.slice(0, match_count) : (data ?? []).slice(0, match_count);
  return { ok: true as const, rows: picked };
}

/** -------------------- Lead scoring + upsert (company_leads) -------------------- */
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
  state: FunnelState;
}) {
  let score = 0;

  // commercial creates lead baseline
  if (params.commercial) score += 25;

  // intent
  score += intentScore(params.intent);

  // buying signals
  if (/(demo|call|appointment|termin|book|schedule|meeting|beratung)/i.test(params.message)) score += 20;
  if (/(budget|€|aed|dirham|euro|usd)/i.test(params.message)) score += 10;
  if (/(asap|urgent|sofort|heute|this week|tomorrow|morgen)/i.test(params.message)) score += 10;

  // objection to price = high interest signal
  if (params.state === "objection_price") score += 10;

  // contact info => HOT
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

async function upsertCompanyLead(params: {
  company_id: string;
  conversation_id: string;
  message: string;
  intent: string | null;
  commercial: boolean;
  state: FunnelState;
}) {
  const email = extractEmail(params.message);
  const phone = extractPhone(params.message);
  const hasContact = !!email || !!phone;

  // Load existing lead for this conversation
  const { data: existing } = await supabaseServer
    .from("company_leads")
    .select("id,name,email,phone,score_total,score_band,status,lead_state,qualification_json,consents_json,tags,intent_score")
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
      hasEmail: !!(email || existing?.email),
      hasPhone: !!(phone || existing?.phone),
      intent: params.intent,
      state: params.state,
    })
  );

  const nextBand = bandFromScore(nextScore);

  const mergedEmail = existing?.email || email || null;
  const mergedPhone = existing?.phone || phone || null;

  const prevQual =
    existing?.qualification_json && typeof existing.qualification_json === "object" ? existing.qualification_json : {};
  const nextQual = {
    ...prevQual,
    last_user_message: params.message,
    last_intent: params.intent,
    funnel_state: params.state,
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

  // Needs unique index on (company_id, conversation_id)
  await supabaseServer.from("company_leads").upsert(row, { onConflict: "company_id,conversation_id" });
}

/** -------------------- Company name helper -------------------- */
async function loadCompanyName(company_id: string): Promise<string> {
  const { data } = await supabaseServer.from("companies").select("name").eq("id", company_id).maybeSingle();
  const name = String((data as any)?.name || "").trim();
  return name || "Nova";
}

/** -------------------- Main handler -------------------- */
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

  const { data: conv } = await supabaseServer.from("conversations").select("id,company_id").eq("id", conversation_id).maybeSingle();
  if (!conv || String(conv.company_id) !== company_id) {
    return NextResponse.json({ error: "invalid_conversation" }, { status: 403 });
  }

  const bill = await checkBillingGate(company_id);
  if (!bill.ok) return NextResponse.json({ error: bill.code }, { status: 402 });

  // Persist user message
  await supabaseServer.from("messages").insert({
    conversation_id,
    role: "user",
    content: message,
  });

  const intent = detectIntent(message);
  const commercial = detectCommercialIntent(message);
  const contactShared = detectContactSharing(message);
  const needLead = commercial || contactShared;

  // Load funnel config (white-label)
  const funnelConfig = await loadFunnelConfig(company_id);

  // Determine funnel state (you can later load prev from existing lead if you want true stickiness)
  const prevState: FunnelState | null = null;
  const state = nextFunnelState({ message, prev: prevState });

  const strategicQuestion = funnelConfig.default_cta?.trim()
    ? funnelConfig.default_cta.trim()
    : oneStrategicQuestion(state, funnelConfig.qualification_fields);

  // Lead creation/enrichment (commercial creates, contact => hot by scoring)
  try {
    if (funnelConfig.enabled) {
      await upsertCompanyLead({
        company_id,
        conversation_id,
        message,
        intent,
        commercial,
        state,
      });
    }
  } catch {
    // never block chat
  }

  // Knowledge retrieval
  let context = "";
  let sources: any[] = [];

  try {
    const isPricingStage = intent === "pricing" || state === "pricing_interest" || state === "objection_price";
    const pricingOverrideEnabled = !!funnelConfig?.retrieval_overrides?.pricing?.enabled;

    if (isPricingStage && pricingOverrideEnabled) {
      const mc = Number(funnelConfig?.retrieval_overrides?.pricing?.match_count ?? 12);
      const forced = await fetchForcedPricingContext(company_id, mc);
      if (forced.ok && forced.rows.length > 0) {
        sources = forced.rows;
        context = buildContext(forced.rows);
      } else {
        const emb = await embedQuery(message);
        const match = await matchKnowledgeChunks(company_id, emb, 12, intent);
        if (match.ok && match.rows.length > 0) {
          sources = match.rows;
          context = buildContext(match.rows);
        }
      }
    } else {
      const emb = await embedQuery(message);
      const match = await matchKnowledgeChunks(company_id, emb, 6, intent);
      if (match.ok && match.rows.length > 0) {
        sources = match.rows;
        context = buildContext(match.rows);
      }
    }
  } catch {
    // swallow
  }

  // Build sales prompt (enterprise)
  const companyName = await loadCompanyName(company_id);

  const systemPrompt = buildSalesSystemPrompt({
    companyName,
    config: funnelConfig,
    state,
    strategicQuestion,
    knowledgeContext: context || "(empty)",
  });

  // OpenAI response
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
  });

  const reply = String(completion.choices?.[0]?.message?.content || "").trim();

  // Persist assistant message
  await supabaseServer.from("messages").insert({
    conversation_id,
    role: "assistant",
    content: reply,
  });

  return NextResponse.json({
    reply,
    need_lead_capture: needLead,
    sources,
    funnel_state: state, // useful for debugging
  });
}