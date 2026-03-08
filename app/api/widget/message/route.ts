export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkBillingGate } from "@/lib/billingGate";
import {
  decideAction,
  detectBookingIntent,
  detectCommercial,
  detectContact,
  detectFrustration,
  detectHumanHandoffRequest,
  detectPriceObjection,
  nextFunnelState,
  oneStrategicQuestion,
  type AssistantMode,
  type ClosingStyle,
  type FunnelState,
  type PrimaryGoal,
  type QuestionStyle,
} from "@/lib/funnelEngine";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function detectIntent(text: string): "pricing" | "faq" | "contact" | null {
  if (/(price|pricing|cost|quote|offer|proposal|plan|package|preis|preise|kosten|angebot|paket|abo)/i.test(text)) return "pricing";
  if (/(faq|question|questions|frage|fragen|how does|wie funktioniert)/i.test(text)) return "faq";
  if (/(contact|call|appointment|termin|kontakt|anruf|reach|demo|meeting|book|schedule)/i.test(text)) return "contact";
  return null;
}

function extractEmail(text: string): string | null {
  const m = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  return m ? m[0].trim().toLowerCase() : null;
}

function extractPhone(text: string): string | null {
  const m = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

type FunnelConfig = {
  enabled: boolean;
  objection_handling: boolean;
  require_qualification: boolean;
  show_pricing: boolean;
  pricing_strategy: "multi-tier" | "anchor" | "request-only";
  allow_unknown_fallback: boolean;

  tone: "consultative" | "direct" | "luxury" | "formal" | "playful";
  response_length: "concise" | "medium" | "detailed";
  language: string;

  cta_style: "one-question" | "strong-close" | "soft-close";
  default_cta: string | null;

  qualification_fields: any;
  retrieval_overrides: any;

  assistant_mode: AssistantMode;
  primary_goal: PrimaryGoal;
  question_style: QuestionStyle;
  closing_style: ClosingStyle;
  booking_priority: boolean;
  human_handoff_enabled: boolean;
  human_handoff_triggers: any;
};

async function loadFunnelConfig(company_id: string): Promise<FunnelConfig> {
  const { data } = await supabaseServer
    .from("company_funnel_config")
    .select("*")
    .eq("company_id", company_id)
    .maybeSingle();

  return {
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
      data?.qualification_fields ?? {
        industry: true,
        goal: true,
        timeline: true,
        budget: true,
        location: false,
      },

    retrieval_overrides:
      data?.retrieval_overrides ?? {
        pricing: { enabled: true, match_count: 12, force_sections: ["pricing", "plans"] },
      },

    assistant_mode: (data?.assistant_mode as any) ?? "sales",
    primary_goal: (data?.primary_goal as any) ?? "capture_leads",
    question_style: (data?.question_style as any) ?? "guided",
    closing_style: (data?.closing_style as any) ?? "soft_close",
    booking_priority: data?.booking_priority ?? false,
    human_handoff_enabled: data?.human_handoff_enabled ?? true,
    human_handoff_triggers:
      data?.human_handoff_triggers ??
      ({
        owner_request: true,
        frustrated_user: true,
        repeated_failure: true,
      } as any),
  };
}

function toneGuidelines(tone: FunnelConfig["tone"]) {
  if (tone === "luxury") return "Tone: premium, confident, concise. No hype. Elegant wording.";
  if (tone === "formal") return "Tone: formal, corporate, precise.";
  if (tone === "direct") return "Tone: direct, efficient, sales-oriented.";
  if (tone === "playful") return "Tone: friendly, light, but still professional.";
  return "Tone: consultative, helpful, confident.";
}

function lengthGuidelines(len: FunnelConfig["response_length"]) {
  if (len === "detailed") return "Length: detailed but structured.";
  if (len === "medium") return "Length: medium. Short paragraphs.";
  return "Length: concise. Max ~6–10 lines unless necessary.";
}

function buildSystemPrompt(params: {
  companyName: string;
  config: FunnelConfig;
  state: FunnelState;
  strategicQuestion: string | null;
  knowledgeContext: string;
  action: "reply" | "show_slots" | "capture_contact" | "handoff";
  knownQualification: Record<string, any> | null;
}) {
  const { companyName, config, state, strategicQuestion, knowledgeContext, action, knownQualification } = params;

  const lang = config.language && config.language !== "auto" ? `Language: ${config.language}` : "Language: match the user's language.";
  const known = knownQualification && Object.keys(knownQualification).length
    ? `Known facts already collected:\n${JSON.stringify(knownQualification, null, 2)}`
    : "Known facts already collected:\n{}";

  const modeLine = `Assistant mode: ${config.assistant_mode}. Primary goal: ${config.primary_goal}. Question style: ${config.question_style}. Closing style: ${config.closing_style}.`;
  const actionLine =
    action === "show_slots"
      ? "The UI can show appointment slots right after your reply. Briefly acknowledge the booking request and avoid extra qualification."
      : action === "capture_contact"
      ? "The UI can open a contact form after your reply. Ask for the best contact details only if still missing."
      : action === "handoff"
      ? "The UI can help capture contact details for a human follow-up. Apologize briefly, stay calm, and do not keep qualifying."
      : "Answer naturally and only ask a follow-up if it truly helps.";

  const rules: string[] = [
    "Use the conversation history. Never ask again for information the user already provided.",
    "Answer the user's latest question directly before moving the conversation forward.",
    "Ask at most ONE follow-up question, and only if it is truly helpful.",
    "If the next step is obvious, do not force another question.",
    "Do not mention internal systems, funnel states, or knowledge context.",
    "If info is missing, either ask one useful clarifying question or offer the next step.",
    actionLine,
  ];

  if (config.assistant_mode === "local_service" || config.primary_goal === "book_appointments") {
    rules.push("Do not ask B2B qualification questions like industry unless explicitly relevant and enabled.");
    rules.push("Prioritize appointment coordination, design details, timing, and practical next steps.");
  }

  if (config.show_pricing) {
    rules.push("If the user asks about pricing, answer with a compact, useful pricing answer based on the knowledge context.");
    if (config.objection_handling) {
      rules.push("If the user objects to price, validate briefly and offer a reasonable next step.");
    }
  }

  if (action === "show_slots") {
    rules.push("Do not end with a generic sales CTA. Keep it short so the slot UI can take over.");
  }

  let endingInstruction = "Do not force a closing question.";
  if (strategicQuestion && action === "reply") {
    endingInstruction = `If you ask a follow-up question, it must be exactly this question:\n"${strategicQuestion}"`;
  } else if (strategicQuestion && action === "capture_contact") {
    endingInstruction = `If you ask for the next step, you may use this exact question:\n"${strategicQuestion}"`;
  }

  return `
You are ${companyName}'s AI assistant.

Goal:
1) Understand the user's intent and current stage (${state})
2) Answer accurately using the knowledge context
3) Move the conversation forward in the most natural way for this business
4) Avoid repetition and preserve trust

${lang}
${toneGuidelines(config.tone)}
${lengthGuidelines(config.response_length)}
${modeLine}

Rules:
- ${rules.join("\n- ")}

${known}

${endingInstruction}

KNOWLEDGE CONTEXT:
${knowledgeContext || "(empty)"}
`.trim();
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

async function loadChatHistory(conversation_id: string, limit = 18) {
  const { data } = await supabaseServer
    .from("messages")
    .select("role,content,created_at")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data ?? [])
    .filter((m: any) => m?.content && (m.role === "user" || m.role === "assistant"))
    .map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content).trim(),
    }));
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
  state: FunnelState;
}) {
  let score = 0;

  if (params.commercial) score += 25;
  score += intentScore(params.intent);

  if (/(demo|call|appointment|termin|book|schedule|meeting|beratung)/i.test(params.message)) score += 20;
  if (/(budget|€|aed|dirham|euro|usd)/i.test(params.message)) score += 10;
  if (/(asap|urgent|sofort|heute|this week|tomorrow|morgen)/i.test(params.message)) score += 10;

  if (params.state === "objection_price") score += 10;

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

function extractLeadSignals(text: string) {
  const t = text.toLowerCase();

  const timeline =
    /(tomorrow|morgen)/i.test(t) ? "tomorrow" :
    /(today|heute)/i.test(t) ? "today" :
    /(this week|diese woche)/i.test(t) ? "this_week" :
    /(asap|as soon as possible|urgent|sofort)/i.test(t) ? "asap" :
    null;

  const location =
    /(dubai|uae|abu dhabi|abudhabi|sharjah|ajman|rak|ras al khaimah)/i.test(t) ? "uae" : null;

  const industryMatch = t.match(/\b(oil|real estate|construction|tattoo|beauty|clinic|gym|salon|agency|saas)\b/i);
  const industry = industryMatch ? industryMatch[1].toLowerCase() : null;

  return { timeline, location, industry };
}

async function upsertCompanyLead(params: {
  company_id: string;
  conversation_id: string;
  message: string;
  intent: string | null;
  commercial: boolean;
  state: FunnelState;
  action: "reply" | "show_slots" | "capture_contact" | "handoff";
}) {
  const email = extractEmail(params.message);
  const phone = extractPhone(params.message);
  const hasContact = !!email || !!phone;
  const leadSignals = extractLeadSignals(params.message);

  const { data: existing } = await supabaseServer
    .from("company_leads")
    .select("id,name,email,phone,score_total,score_band,status,lead_state,qualification_json,consents_json,tags,intent_score")
    .eq("company_id", params.company_id)
    .eq("conversation_id", params.conversation_id)
    .maybeSingle();

  const shouldCreate =
    !!existing ||
    params.commercial ||
    hasContact ||
    params.intent === "contact" ||
    params.state === "closing" ||
    params.action === "show_slots" ||
    params.action === "handoff";

  if (!shouldCreate) return;

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

  const prevQual = existing?.qualification_json && typeof existing.qualification_json === "object" ? existing.qualification_json : {};
  const nextQual = {
    ...prevQual,
    last_user_message: params.message,
    last_intent: params.intent,
    funnel_state: params.state,
    ...(leadSignals.timeline ? { timeline: prevQual.timeline ?? leadSignals.timeline } : {}),
    ...(leadSignals.location ? { location: prevQual.location ?? leadSignals.location } : {}),
    ...(leadSignals.industry ? { industry: prevQual.industry ?? leadSignals.industry } : {}),
    booking_requested: prevQual.booking_requested || params.action === "show_slots",
    human_handoff_requested: prevQual.human_handoff_requested || params.action === "handoff",
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

  await supabaseServer.from("company_leads").upsert(row, { onConflict: "company_id,conversation_id" });
}

async function loadCompanyName(company_id: string): Promise<string> {
  const { data } = await supabaseServer.from("companies").select("name").eq("id", company_id).maybeSingle();
  const name = String((data as any)?.name || "").trim();
  return name || "Nova";
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

  if (!conv || String((conv as any).company_id) !== company_id) {
    return NextResponse.json({ error: "invalid_conversation" }, { status: 403 });
  }

  const bill = await checkBillingGate(company_id);
  if (!bill.ok) return NextResponse.json({ error: bill.code }, { status: 402 });

  await supabaseServer.from("messages").insert({
    conversation_id,
    role: "user",
    content: message,
  });

  const intent = detectIntent(message);
  const commercial = detectCommercial(message);
  const contactShared = detectContact(message);

  const funnelConfig = await loadFunnelConfig(company_id);

  let prevState: FunnelState | null = null;
  let knownQualification: Record<string, any> | null = null;

  try {
    const { data: existingLead } = await supabaseServer
      .from("company_leads")
      .select("qualification_json")
      .eq("company_id", company_id)
      .eq("conversation_id", conversation_id)
      .maybeSingle();

    const qual = ((existingLead as any)?.qualification_json ?? null) as Record<string, any> | null;
    knownQualification = qual;
    const ps = qual?.funnel_state;
    if (ps && typeof ps === "string") prevState = ps as FunnelState;
  } catch {
    // ignore
  }

  const state = nextFunnelState({
    message,
    prev: prevState,
    config: funnelConfig,
  });

  const action = decideAction({
    message,
    state,
    config: funnelConfig,
  });

  const strategicQuestion = funnelConfig.default_cta?.trim()
    ? funnelConfig.default_cta.trim()
    : oneStrategicQuestion(state, funnelConfig, knownQualification);

  const needLeadCapture =
    action === "capture_contact" ||
    action === "handoff" ||
    (contactShared && (action === "reply" || action === "capture_contact"));

  try {
    if (funnelConfig.enabled) {
      await upsertCompanyLead({
        company_id,
        conversation_id,
        message,
        intent,
        commercial,
        state,
        action,
      });
    }
  } catch {
    // never block chat
  }

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

  const companyName = await loadCompanyName(company_id);
  const systemPrompt = buildSystemPrompt({
    companyName,
    config: funnelConfig,
    state,
    strategicQuestion,
    knowledgeContext: context || "(empty)",
    action,
    knownQualification,
  });

  const historyMsgs = await loadChatHistory(conversation_id, 18);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [{ role: "system", content: systemPrompt }, ...historyMsgs],
  });

  let reply = String(completion.choices?.[0]?.message?.content || "").trim();

  if (!reply) {
    if (action === "show_slots") {
      reply = "Absolutely — I can help with that. Here are the next available appointment options.";
    } else if (action === "handoff") {
      reply = "Of course — I’m sorry for the frustration. I’ll help you get this to a real person.";
    } else {
      reply = "Absolutely — how can I help?";
    }
  }

  await supabaseServer.from("messages").insert({
    conversation_id,
    role: "assistant",
    content: reply,
  });

  return NextResponse.json({
    reply,
    action,
    need_lead_capture: needLeadCapture,
    lead_prompt: strategicQuestion || null,
    sources,
    funnel_state: state,
    booking_requested: action === "show_slots" || detectBookingIntent(message),
    human_handoff: action === "handoff" || detectHumanHandoffRequest(message) || detectFrustration(message),
  });
}