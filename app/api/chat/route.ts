export const runtime = "nodejs";

import { requireOwner } from "@/lib/adminGuard";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

// ---------- Company-config (from DB) ----------
type ChatMode = "knowledge_only" | "hybrid";

type CompanyChatConfig = {
  mode: ChatMode;
  model: string;
  temperature: number;
  max_chunks: number;
  system_prompt: string;
  unknown_answer: string;
  include_sources: boolean;

  rate_limits?: {
    per_minute?: number;
    per_day?: number;
  };
};

type PlanEntitlements = {
  rate_limits?: { per_minute?: number; per_day?: number };
  features?: Record<string, boolean>;
  knowledge?: Record<string, any>;
};

function normalizeConfig(raw: any): CompanyChatConfig {
  const defaults: CompanyChatConfig = {
    mode: "hybrid",
    model: "gpt-4o-mini",
    temperature: 0.1,
    max_chunks: 6,
    system_prompt: "You are the company's website assistant. Be concise, factual and helpful.",
    unknown_answer:
      "Ich habe dazu aktuell keine gesicherten Informationen in der Wissensdatenbank. Ich kann Ihnen aber sofort helfen, die naechsten Schritte sauber vorzubereiten.",
    include_sources: false,
    rate_limits: { per_minute: 10, per_day: 1000 },
  };

  const cfg = { ...defaults, ...(raw || {}) };

  if (cfg.mode !== "knowledge_only" && cfg.mode !== "hybrid") cfg.mode = defaults.mode;
  if (typeof cfg.model !== "string" || !cfg.model) cfg.model = defaults.model;
  if (typeof cfg.temperature !== "number") cfg.temperature = defaults.temperature;
  cfg.temperature = Math.max(0, Math.min(1, cfg.temperature));
  if (typeof cfg.max_chunks !== "number") cfg.max_chunks = defaults.max_chunks;
  cfg.max_chunks = Math.max(1, Math.min(12, Math.floor(cfg.max_chunks)));
  if (typeof cfg.system_prompt !== "string" || !cfg.system_prompt.trim()) cfg.system_prompt = defaults.system_prompt;
  if (typeof cfg.unknown_answer !== "string" || !cfg.unknown_answer.trim()) cfg.unknown_answer = defaults.unknown_answer;
  cfg.include_sources = !!cfg.include_sources;

  const rl = (cfg.rate_limits || {}) as any;
  const perMinute = typeof rl.per_minute === "number" ? rl.per_minute : defaults.rate_limits!.per_minute!;
  const perDay = typeof rl.per_day === "number" ? rl.per_day : defaults.rate_limits!.per_day!;

  cfg.rate_limits = {
    per_minute: Math.max(1, Math.min(600, Math.floor(perMinute))),
    per_day: Math.max(1, Math.min(200000, Math.floor(perDay))),
  };

  return cfg;
}

async function loadCompanyConfig(company_id: string): Promise<CompanyChatConfig> {
  const { data, error } = await supabaseServer
    .from("company_settings")
    .select("branding_json, limits_json")
    .eq("company_id", company_id)
    .maybeSingle();

  if (error || !data) return normalizeConfig(null);

  const branding = data.branding_json || {};
  const limits = data.limits_json || {};
  const raw = branding.chat ?? limits.chat ?? null;
  return normalizeConfig(raw);
}

// Minimal extra read for lead/legal microcopy
type CompanyLeadMeta = {
  company_name?: string | null;
  privacy_url?: string | null;
  handoff_email?: string | null;
  handoff_phone?: string | null;
};

async function loadCompanyLeadMeta(company_id: string): Promise<CompanyLeadMeta> {
  const { data } = await supabaseServer
    .from("company_settings")
    .select("branding_json")
    .eq("company_id", company_id)
    .maybeSingle();

  const chat = (data?.branding_json?.chat || {}) as any;

  return {
    company_name: typeof chat.company_name === "string" ? chat.company_name : null,
    privacy_url: typeof chat.privacy_url === "string" ? chat.privacy_url : null,
    handoff_email: typeof chat.handoff_email === "string" ? chat.handoff_email : null,
    handoff_phone: typeof chat.handoff_phone === "string" ? chat.handoff_phone : null,
  };
}

// ---------- Billing / Entitlements ----------
async function loadCompanyEntitlements(company_id: string): Promise<{
  status: string;
  plan_key: string | null;
  entitlements: PlanEntitlements;
}> {
  const locked: PlanEntitlements = {
    features: { chat: false },
    rate_limits: { per_minute: 1, per_day: 1 },
  };

  const { data: billing, error: bErr } = await supabaseServer
    .from("company_billing")
    .select("status, stripe_price_id, plan_key")
    .eq("company_id", company_id)
    .maybeSingle();

  if (bErr || !billing) {
    return { status: "none", plan_key: null, entitlements: locked };
  }

  let plan = null as any;

  if (billing.plan_key) {
    const { data } = await supabaseServer
      .from("billing_plans")
      .select("plan_key, entitlements_json, is_active")
      .eq("plan_key", billing.plan_key)
      .maybeSingle();
    plan = data;
  } else if (billing.stripe_price_id) {
    const { data } = await supabaseServer
      .from("billing_plans")
      .select("plan_key, entitlements_json, is_active")
      .eq("stripe_price_id", billing.stripe_price_id)
      .maybeSingle();
    plan = data;
  }

  const entitlements: PlanEntitlements = plan?.is_active ? (plan.entitlements_json as any) : locked;

  return {
    status: String(billing.status || "none"),
    plan_key: plan?.plan_key ?? billing.plan_key ?? null,
    entitlements,
  };
}

function isPayingStatus(status: string) {
  return status === "active" || status === "trialing";
}

function capRateLimits(companyCfg: CompanyChatConfig, planEntitlements: PlanEntitlements) {
  const planPerMin = Number(planEntitlements?.rate_limits?.per_minute ?? 0);
  const planPerDay = Number(planEntitlements?.rate_limits?.per_day ?? 0);

  const cfgPerMin = Number(companyCfg.rate_limits?.per_minute ?? 10);
  const cfgPerDay = Number(companyCfg.rate_limits?.per_day ?? 1000);

  const effectivePerMin = planPerMin > 0 ? Math.min(cfgPerMin, planPerMin) : cfgPerMin;
  const effectivePerDay = planPerDay > 0 ? Math.min(cfgPerDay, planPerDay) : cfgPerDay;

  return {
    per_minute: Math.max(1, Math.floor(effectivePerMin)),
    per_day: Math.max(1, Math.floor(effectivePerDay)),
  };
}

// ---------- Prompt builders ----------
function makeContextText(chunks: any[]) {
  return (chunks || [])
    .map((c: any, i: number) => {
      const title = c.title ? ` (${c.title})` : "";
      return `[#${i + 1}]${title} ${c.content}`;
    })
    .join("\n")
    .slice(0, 8000);
}

function makeSourcesText(chunks: any[]) {
  return (chunks || [])
    .map((c: any, i: number) => {
      const label = c.title || c.source || `Source ${i + 1}`;
      return `[#${i + 1}] ${label}`;
    })
    .join("\n");
}

function buildCorePrompt(args: {
  mode: ChatMode;
  baseSystem: string;
  unknownAnswer: string;
  contextText: string;
  leadMeta: CompanyLeadMeta;
  leadState: any;
}) {
  const companyNameLine = args.leadMeta.company_name ? `Company name: ${args.leadMeta.company_name}` : "Company name: (unknown)";
  const privacyLine = args.leadMeta.privacy_url ? `Privacy URL: ${args.leadMeta.privacy_url}` : "Privacy URL: (none)";

  return [
    args.baseSystem.trim(),
    "",
    "You are also a lead qualification assistant.",
    "Your output must be a single, natural message: answer + (if appropriate) exactly ONE follow-up question.",
    "",
    "Hard rules:",
    "1) Never invent company-specific facts (years, staff, prices, client list, locations, numbers) unless they appear in Context.",
    "2) If Context is empty or not relevant, be transparent and switch to discovery: ask one question that moves the sales process forward.",
    "3) Never ask for contact details unless user explicitly wants an offer/demo/callback/booking OR the lead state is committed.",
    "4) If you ask for contact details, ask only once and do not ask again if already provided.",
    "5) If mode is knowledge_only: if answer is not in Context, reply exactly with unknown_answer (and you may add ONE qualifying question only if it does not add company facts).",
    "",
    `Lead state snapshot (do not reveal): ${JSON.stringify(args.leadState || {})}`,
    companyNameLine,
    privacyLine,
    "",
    args.contextText ? `Context:\n${args.contextText}` : "Context: (empty)",
    "",
    `unknown_answer: ${args.unknownAnswer}`,
  ].join("\n");
}

// ---------- Embedding helper ----------
async function embedQuery(text: string): Promise<number[]> {
  const e = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const vec = e.data?.[0]?.embedding;
  if (!vec || !Array.isArray(vec)) throw new Error("embedding_missing");
  return vec;
}

// ---------- Rate limit helper ----------
function getRetryAfterSeconds(resetMinute: any, resetDay: any) {
  const now = Date.now();

  const toMs = (v: any) => {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : now + 60_000;
  };

  const minuteMs = toMs(resetMinute);
  const dayMs = toMs(resetDay);

  const secMinute = Math.max(0, Math.ceil((minuteMs - now) / 1000));
  const secDay = Math.max(0, Math.ceil((dayMs - now) / 1000));

  return Math.max(1, Math.min(secMinute || 999999, secDay || 999999));
}

// ---------- Lead storage helpers ----------
type LeadRow = {
  id: string;
  company_id: string;
  conversation_id: string;
  lead_state: string;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  qualification_json: any;
  consents_json: any;
  intent_score: number;
  score_total: number;
  score_band: "cold" | "warm" | "hot";
  last_touch_at: string;
  created_at: string;
  updated_at: string;
};

function extractEmail(text: string): string | null {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

function extractPhone(text: string): string | null {
  const m = text.replace(/[()]/g, " ").match(/(\+?\d[\d\s\-]{6,}\d)/);
  if (!m) return null;
  const raw = m[1].trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return raw;
}

function extractName(text: string): string | null {
  const patterns = [
    /(?:mein name ist|ich hei(?:ss|s)e)\s+([A-Za-zÀ-ÖØ-öø-ÿ'’\- ]{2,60})/i,
    /(?:my name is|i am)\s+([A-Za-zÀ-ÖØ-öø-ÿ'’\- ]{2,60})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

async function getLead(company_id: string, conversation_id: string): Promise<LeadRow | null> {
  const { data } = await supabaseServer
    .from("company_leads")
    .select("id, company_id, conversation_id, lead_state, status, name, email, phone, qualification_json, consents_json, intent_score, score_total, score_band, last_touch_at, created_at, updated_at")
    .eq("company_id", company_id)
    .eq("conversation_id", conversation_id)
    .maybeSingle();

  return (data as any) ?? null;
}

async function ensureLead(company_id: string, conversation_id: string): Promise<LeadRow | null> {
  const existing = await getLead(company_id, conversation_id);
  if (existing) return existing;

  const { data } = await supabaseServer
    .from("company_leads")
    .insert({
      company_id,
      conversation_id,
      channel: "widget",
      lead_state: "discovery",
      status: "new",
      score_band: "cold",
      score_total: 0,
      intent_score: 0,
      qualification_json: {},
      consents_json: {},
      tags: [],
      last_touch_at: new Date().toISOString(),
    })
    .select("id, company_id, conversation_id, lead_state, status, name, email, phone, qualification_json, consents_json, intent_score, score_total, score_band, last_touch_at, created_at, updated_at")
    .maybeSingle();

  return (data as any) ?? null;
}

// Lightweight “analysis” (we keep your structured analyzer concept, but tighter):
type LeadAnalysis = {
  intent_level: "none" | "low" | "medium" | "high";
  requested_action: "none" | "pricing" | "offer" | "demo" | "booking" | "callback" | "comparison" | "implementation";
  slots: {
    use_case: string | null;
    timeline: "unknown" | "over_3_months" | "one_to_three_months" | "under_1_month" | "asap";
    role: "unknown" | "decision_maker" | "influencer" | "researcher";
    budget_band: "unknown" | "low" | "mid" | "high" | "enterprise";
    preferred_contact_channel: "unknown" | "email" | "phone" | "whatsapp";
  };
};

function safeRequestedAction(text: string): LeadAnalysis["requested_action"] {
  const t = text.toLowerCase();
  if (/(angebot|offer|quote|kostenvoranschlag)/i.test(t)) return "offer";
  if (/(demo|vorf(ü|u)hrung)/i.test(t)) return "demo";
  if (/(termin|booking|kalender|call|gespr(ä|a)ch)/i.test(t)) return "booking";
  if (/(r(ü|u)ckruf|callback)/i.test(t)) return "callback";
  if (/(preis|pricing|kosten)/i.test(t)) return "pricing";
  if (/(vergleich|comparison)/i.test(t)) return "comparison";
  if (/(umsetzung|implementation|setup|einrichten)/i.test(t)) return "implementation";
  return "none";
}

function buildLeadAnalysis(userText: string): LeadAnalysis {
  const requested_action = safeRequestedAction(userText);

  let intent_level: LeadAnalysis["intent_level"] = "none";
  if (requested_action !== "none") intent_level = "high";
  else if (/(starten|sofort|jetzt|kaufen|beauftragen|interessiert|anfrage)/i.test(userText)) intent_level = "medium";
  else if (/(info|fragen|warum|wie)/i.test(userText)) intent_level = "low";

  return {
    intent_level,
    requested_action,
    slots: {
      use_case: null,
      timeline: /(asap|sofort|jetzt)/i.test(userText) ? "asap" : "unknown",
      role: "unknown",
      budget_band: "unknown",
      preferred_contact_channel: /whats\s*app/i.test(userText) ? "whatsapp" : "unknown",
    },
  };
}

function calcBand(analysis: LeadAnalysis, haveContact: boolean) {
  // Only "hot" if strong action + contact exists
  if (analysis.requested_action !== "none" && haveContact) return { score_total: 80, score_band: "hot" as const };
  if (analysis.intent_level === "high" || analysis.intent_level === "medium") return { score_total: 45, score_band: "warm" as const };
  return { score_total: 10, score_band: "cold" as const };
}

// ---------- Main handler ----------
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
  const userText = String(body?.message || "").trim();

  if (!conversation_id || !userText) {
    return NextResponse.json({ error: "conversation_id_and_message_required" }, { status: 400 });
  }

  const { data: conv, error: convErr } = await supabaseServer
    .from("conversations")
    .select("id, company_id")
    .eq("id", conversation_id)
    .maybeSingle();

  if (convErr) return NextResponse.json({ error: "db_conv_failed", details: convErr.message }, { status: 500 });
  if (!conv) return NextResponse.json({ error: "conversation_not_found" }, { status: 400 });
  if (String(conv.company_id) !== company_id) return NextResponse.json({ error: "conversation_company_mismatch" }, { status: 403 });

  const billing = await loadCompanyEntitlements(company_id);
  const features = billing.entitlements?.features || {};
  const chatEnabled = !!features.chat;

  // Owner bypass for admin testing only
  let ownerBypass = false;
  try {
    const auth = await requireOwner();
    ownerBypass = !!auth?.ok;
  } catch {
    ownerBypass = false;
  }

  if ((!chatEnabled || !isPayingStatus(billing.status)) && !ownerBypass) {
    return NextResponse.json({ error: "payment_required" }, { status: 402 });
  }

  const cfg = await loadCompanyConfig(company_id);
  const leadMeta = await loadCompanyLeadMeta(company_id);

  const effectiveLimits = capRateLimits(cfg, billing.entitlements);

  const { data: rl, error: rlErr } = await supabaseServer.rpc("enforce_company_rate_limit", {
    p_company_id: company_id,
    p_limit_per_minute: effectiveLimits.per_minute,
    p_limit_per_day: effectiveLimits.per_day,
  });

  if (rlErr) return NextResponse.json({ error: "rate_limit_rpc_failed", details: rlErr.message }, { status: 500 });

  const rlRow: any = Array.isArray(rl) ? rl[0] : rl;
  if (!rlRow?.allowed) {
    const retryAfter = getRetryAfterSeconds(rlRow?.reset_minute, rlRow?.reset_day);
    return new NextResponse(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
    });
  }

  // Store user message
  const { error: m1Err } = await supabaseServer.from("messages").insert({
    conversation_id,
    role: "user",
    content: userText,
  });
  if (m1Err) return NextResponse.json({ error: "db_insert_user_failed", details: m1Err.message }, { status: 500 });

  // RAG
  let chunks: any[] = [];
  const queryEmbedding = await embedQuery(userText);
  const { data: rpcData, error: rpcErr } = await supabaseServer.rpc("match_knowledge_chunks", {
    p_company_id: company_id,
    p_query_embedding: queryEmbedding,
    p_match_count: cfg.max_chunks,
  });
  if (rpcErr) return NextResponse.json({ error: "rpc_failed", details: rpcErr.message }, { status: 500 });
  chunks = (rpcData ?? []) as any[];

  const contextText = makeContextText(chunks);

  // Lead snapshot
  const existingLead = await getLead(company_id, conversation_id);
  const lead = existingLead ?? (await ensureLead(company_id, conversation_id));

  const email = extractEmail(userText);
  const phone = extractPhone(userText);
  const name = extractName(userText);

  const haveContact = !!(lead?.email || lead?.phone || email || phone);

  // Update lead with any provided PII (minimization: only if user provided)
  if (lead && (email || phone || name)) {
    const contactUpdate: any = {};
    if (!lead.email && email) contactUpdate.email = email;
    if (!lead.phone && phone) contactUpdate.phone = phone;
    if (!lead.name && name) contactUpdate.name = name;

    if (Object.keys(contactUpdate).length) {
      const consents = { ...(lead.consents_json || {}) };
      if (!consents.contact_processing) {
        consents.contact_processing = {
          legal_basis: "Art6(1)(b)",
          timestamp: new Date().toISOString(),
          source: "user_provided",
        };
      }
      await supabaseServer
        .from("company_leads")
        .update({ ...contactUpdate, consents_json: consents, last_touch_at: new Date().toISOString() })
        .eq("id", lead.id);
    }
  }

  const analysis = buildLeadAnalysis(userText);
  const band = calcBand(analysis, haveContact);

  // Persist lead scoring (safe, no hallucination)
  if (lead) {
    await supabaseServer
      .from("company_leads")
      .update({
        intent_score: analysis.intent_level === "high" ? 45 : analysis.intent_level === "medium" ? 25 : analysis.intent_level === "low" ? 10 : 0,
        score_total: band.score_total,
        score_band: band.score_band,
        qualification_json: {
          ...(lead.qualification_json || {}),
          requested_action: analysis.requested_action,
          timeline: analysis.slots.timeline,
        },
        last_touch_at: new Date().toISOString(),
      })
      .eq("id", lead.id);
  }

  // Single-pass assistant output (smooth)
  const coreSystem = buildCorePrompt({
    mode: cfg.mode,
    baseSystem: cfg.system_prompt,
    unknownAnswer: cfg.unknown_answer,
    contextText,
    leadMeta,
    leadState: {
      lead_state: lead?.lead_state ?? "discovery",
      have_contact: haveContact,
      score_band: band.score_band,
      requested_action: analysis.requested_action,
    },
  });

  const completion = await openai.chat.completions.create({
    model: cfg.model,
    temperature: cfg.mode === "knowledge_only" ? 0 : cfg.temperature,
    messages: [
      { role: "system", content: coreSystem },
      { role: "user", content: userText },
    ],
  });

  let assistantText = completion.choices?.[0]?.message?.content ?? "";

  if (cfg.include_sources && chunks.length > 0) {
    const sources = makeSourcesText(chunks);
    if (sources) assistantText = `${assistantText}\n\nSources:\n${sources}`;
  }

  const { error: m2Err } = await supabaseServer.from("messages").insert({
    conversation_id,
    role: "assistant",
    content: assistantText,
  });
  if (m2Err) return NextResponse.json({ error: "db_insert_assistant_failed", details: m2Err.message }, { status: 500 });

  return NextResponse.json({ reply: assistantText, chunks });
}
