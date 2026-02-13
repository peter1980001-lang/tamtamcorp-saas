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
  // Global defaults:
  // - hybrid gives natural UX if KB isn't filled yet
  // - knowledge_only still supported per-company if explicitly set
  const defaults: CompanyChatConfig = {
    mode: "hybrid",
    model: "gpt-4o-mini",
    temperature: 0.1,
    max_chunks: 6,
    system_prompt: "You are the company's website assistant. Be concise, factual and helpful.",
    // Important: avoid endlessly asking for contact here - Lead Engine handles contact capture once needed
    unknown_answer:
      "Ich habe dazu aktuell keine gesicherten Information in der Wissensdatenbank. Wenn Sie moechten, kann ich ein paar kurze Fragen stellen und dann ein Angebot oder einen Rueckruf vorbereiten.",
    include_sources: false,
    rate_limits: {
      per_minute: 10,
      per_day: 1000,
    },
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

// Minimal extra read for lead/legal microcopy (keeps core untouched)
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
function buildKnowledgeOnlySystemPrompt(base: string) {
  return (
    base.trim() +
    "\n\n" +
    [
      "STRICT RULES:",
      "1) Only answer using the provided Context snippets.",
      "2) If Context does not contain the answer, say you don't know and use the unknown_answer instruction.",
      "3) Do NOT use general world knowledge.",
      "4) Do NOT guess. Do NOT invent details.",
      "5) Keep replies concise.",
    ].join("\n")
  );
}

function buildHybridSystemPrompt(base: string) {
  return (
    base.trim() +
    "\n\n" +
    [
      "RULES:",
      "1) Prefer the provided Context when relevant.",
      "2) If Context is empty or not relevant, you may answer generally, but be transparent and concise.",
      "3) Do not invent company-specific facts.",
    ].join("\n")
  );
}

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

// ---------- Lead Engine (Structured Outputs + DSGVO gating) ----------
type LeadRow = {
  id: string;
  company_id: string;
  conversation_id: string;
  channel: string | null;
  source: string | null;
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
  tags: string[];
  last_touch_at: string;
  created_at: string;
  updated_at: string;
};

type LeadAnalysis = {
  intent_level: "none" | "low" | "medium" | "high";
  requested_action: "none" | "pricing" | "offer" | "demo" | "booking" | "callback" | "comparison" | "implementation";
  urgency: "low" | "medium" | "high";
  sentiment: "negative" | "neutral" | "positive";
  pii_present: boolean;

  slots: {
    use_case: string | null;
    timeline: "unknown" | "over_3_months" | "one_to_three_months" | "under_1_month" | "asap";
    role: "unknown" | "decision_maker" | "influencer" | "researcher";
    budget_band: "unknown" | "low" | "mid" | "high" | "enterprise";
    preferred_contact_channel: "unknown" | "email" | "phone" | "whatsapp";
  };

  missing_signals: string[];
  next_question: string;
  next_question_key: string;
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
    /name\s*:\s*([A-Za-zÀ-ÖØ-öø-ÿ'’\- ]{2,60})/i,
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
    .select(
      "id, company_id, conversation_id, channel, source, lead_state, status, name, email, phone, qualification_json, consents_json, intent_score, score_total, score_band, tags, last_touch_at, created_at, updated_at"
    )
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
    .select(
      "id, company_id, conversation_id, channel, source, lead_state, status, name, email, phone, qualification_json, consents_json, intent_score, score_total, score_band, tags, last_touch_at, created_at, updated_at"
    )
    .maybeSingle();

  return (data as any) ?? null;
}

function calcScores(a: LeadAnalysis) {
  const intentScore =
    a.intent_level === "none" ? 0 : a.intent_level === "low" ? 30 : a.intent_level === "medium" ? 60 : 85;

  const needScore = a.slots.use_case ? 15 : 0;

  const timelineScore =
    a.slots.timeline === "asap" || a.slots.timeline === "under_1_month"
      ? 15
      : a.slots.timeline === "one_to_three_months"
      ? 10
      : a.slots.timeline === "over_3_months"
      ? 5
      : 0;

  const authorityScore = a.slots.role === "decision_maker" ? 12 : a.slots.role === "influencer" ? 8 : 0;

  const budgetScore =
    a.slots.budget_band === "enterprise" || a.slots.budget_band === "high"
      ? 10
      : a.slots.budget_band === "mid"
      ? 6
      : a.slots.budget_band === "low"
      ? 3
      : 0;

  const commitmentScore =
    a.requested_action === "offer" ||
    a.requested_action === "booking" ||
    a.requested_action === "callback" ||
    a.requested_action === "demo"
      ? 20
      : a.requested_action === "pricing" || a.requested_action === "implementation" || a.requested_action === "comparison"
      ? 8
      : 0;

  const urgencyScore = a.urgency === "high" ? 10 : a.urgency === "medium" ? 5 : 0;

  let total = intentScore + needScore + timelineScore + authorityScore + budgetScore + commitmentScore + urgencyScore;
  total = Math.max(0, Math.min(100, Math.floor(total)));

  const band: "cold" | "warm" | "hot" = total >= 70 ? "hot" : total >= 40 ? "warm" : "cold";

  return { intent_score: intentScore, score_total: total, score_band: band };
}

function nextLeadState(prev: string, a: LeadAnalysis, scores: { score_total: number }) {
  const strongCommit =
    a.requested_action === "offer" ||
    a.requested_action === "booking" ||
    a.requested_action === "callback" ||
    a.requested_action === "demo";

  if (strongCommit) return "committed";
  if (scores.score_total >= 40 && prev === "discovery") return "qualifying";
  if (scores.score_total >= 70) return prev === "committed" ? "handoff" : "qualifying";
  return prev || "discovery";
}

function buildConsentMicrocopy(meta: CompanyLeadMeta) {
  const parts: string[] = [];
  if (meta.privacy_url) parts.push(`Datenschutz: ${meta.privacy_url}`);
  return parts.length ? `\n\nHinweis: ${parts.join(" ")}` : "";
}

// Structured Outputs (JSON Schema) with fallback if SDK lacks responses API
async function runLeadAnalysisStructured(args: {
  userText: string;
  assistantText: string;
  mode: ChatMode;
  chunkHints: string[];
  existingQualification: any;
}): Promise<LeadAnalysis> {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      intent_level: { type: "string", enum: ["none", "low", "medium", "high"] },
      requested_action: {
        type: "string",
        enum: ["none", "pricing", "offer", "demo", "booking", "callback", "comparison", "implementation"],
      },
      urgency: { type: "string", enum: ["low", "medium", "high"] },
      sentiment: { type: "string", enum: ["negative", "neutral", "positive"] },
      pii_present: { type: "boolean" },
      slots: {
        type: "object",
        additionalProperties: false,
        properties: {
          use_case: { anyOf: [{ type: "string" }, { type: "null" }] },
          timeline: { type: "string", enum: ["unknown", "over_3_months", "one_to_three_months", "under_1_month", "asap"] },
          role: { type: "string", enum: ["unknown", "decision_maker", "influencer", "researcher"] },
          budget_band: { type: "string", enum: ["unknown", "low", "mid", "high", "enterprise"] },
          preferred_contact_channel: { type: "string", enum: ["unknown", "email", "phone", "whatsapp"] },
        },
        required: ["use_case", "timeline", "role", "budget_band", "preferred_contact_channel"],
      },
      missing_signals: { type: "array", items: { type: "string" } },
      next_question: { type: "string" },
      next_question_key: { type: "string" },
    },
    required: [
      "intent_level",
      "requested_action",
      "urgency",
      "sentiment",
      "pii_present",
      "slots",
      "missing_signals",
      "next_question",
      "next_question_key",
    ],
  };

  const system = [
    "You are a lead qualification analyzer for a DACH SME website chatbot.",
    "Return only valid JSON following the provided schema.",
    "Be conservative. Do not invent user data.",
    "If uncertain, use unknown values.",
    "",
    "Interpretation guidance:",
    "- intent_level: buying intent level",
    "- requested_action: what user wants next (pricing, offer, booking, callback, demo)",
    "- slots.use_case: a short label or phrase describing the main use case",
    "- slots.timeline: categorize timeline",
    "- slots.role: decision maker vs influencer vs researcher",
    "- slots.budget_band: rough budget band if implied",
    "- preferred_contact_channel only if user indicates it",
    "- missing_signals: list which of [use_case, timeline, role, budget_band, contact] are missing and important next",
    "- next_question: exactly one short, polite German Sie-form question to collect the next most important missing signal",
    "- Do not request sensitive data. Do not request address. Only business relevant signals.",
  ].join("\n");

  const user = [
    `MODE: ${args.mode}`,
    `USER_MESSAGE: ${args.userText}`,
    `ASSISTANT_ANSWER: ${args.assistantText}`,
    `CHUNK_HINTS: ${args.chunkHints.join(" | ")}`,
    `KNOWN_QUALIFICATION_JSON: ${JSON.stringify(args.existingQualification || {})}`,
  ].join("\n");

  try {
    const anyOpenAI: any = openai as any;
    if (anyOpenAI.responses && typeof anyOpenAI.responses.create === "function") {
      const resp = await anyOpenAI.responses.create({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "lead_qualification",
            schema,
            strict: true,
          },
        },
        temperature: 0,
      });

      const text = resp.output_text || "";
      const parsed = JSON.parse(text);
      return parsed as LeadAnalysis;
    }
  } catch {
    // fall through
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" } as any,
    messages: [
      { role: "system", content: system + "\n\nIMPORTANT: Output must be a JSON object matching the schema keys." },
      { role: "user", content: user + "\n\nReturn JSON only." },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as LeadAnalysis;
}

async function updateLeadFromAnalysis(params: {
  company_id: string;
  conversation_id: string;
  analysis: LeadAnalysis;
  meta: CompanyLeadMeta;
  userText: string;
}): Promise<{ lead: LeadRow | null; followUp: string | null }> {
  const email = extractEmail(params.userText);
  const phone = extractPhone(params.userText);
  const name = extractName(params.userText);

  const shouldCreate =
    params.analysis.intent_level === "high" ||
    params.analysis.intent_level === "medium" ||
    params.analysis.requested_action !== "none" ||
    !!email ||
    !!phone;

  let lead = shouldCreate
    ? await ensureLead(params.company_id, params.conversation_id)
    : await getLead(params.company_id, params.conversation_id);

  if (!lead) return { lead: null, followUp: null };

  const scores = calcScores(params.analysis);
  const newState = nextLeadState(lead.lead_state, params.analysis, { score_total: scores.score_total });

  const prevQual = (lead.qualification_json || {}) as any;

  const nextQual = {
    ...prevQual,
    use_case: params.analysis.slots.use_case ?? prevQual.use_case ?? null,
    timeline: params.analysis.slots.timeline ?? prevQual.timeline ?? "unknown",
    role: params.analysis.slots.role ?? prevQual.role ?? "unknown",
    budget_band: params.analysis.slots.budget_band ?? prevQual.budget_band ?? "unknown",
    requested_action: params.analysis.requested_action,
    urgency: params.analysis.urgency,
    sentiment: params.analysis.sentiment,
    preferred_contact_channel: params.analysis.slots.preferred_contact_channel ?? prevQual.preferred_contact_channel ?? "unknown",
    missing_signals: params.analysis.missing_signals || [],
    next_question_key: params.analysis.next_question_key || null,
    _last_followup_key: prevQual._last_followup_key ?? null,
    _last_followup_at: prevQual._last_followup_at ?? null,
  };

  const consents = { ...(lead.consents_json || {}) };

  const contactUpdate: Record<string, any> = {};
  if (!lead.email && email) contactUpdate.email = email;
  if (!lead.phone && phone) contactUpdate.phone = phone;
  if (!lead.name && name) contactUpdate.name = name;

  const storingPII = Object.keys(contactUpdate).length > 0;
  if (storingPII && !consents.contact_processing) {
    consents.contact_processing = {
      legal_basis: "Art6(1)(b)",
      timestamp: new Date().toISOString(),
      source: "user_provided",
    };
  }

  const { data: updated } = await supabaseServer
    .from("company_leads")
    .update({
      lead_state: newState,
      intent_score: scores.intent_score,
      score_total: scores.score_total,
      score_band: scores.score_band,
      qualification_json: nextQual,
      consents_json: consents,
      last_touch_at: new Date().toISOString(),
      ...contactUpdate,
    })
    .eq("id", lead.id)
    .select(
      "id, company_id, conversation_id, channel, source, lead_state, status, name, email, phone, qualification_json, consents_json, intent_score, score_total, score_band, tags, last_touch_at, created_at, updated_at"
    )
    .maybeSingle();

  lead = (updated as any) ?? lead;
  if (!lead) return { lead: null, followUp: null };

  // ---- Follow-up decision (ANTI LOOP) ----
  const strongCommit =
    params.analysis.requested_action === "offer" ||
    params.analysis.requested_action === "booking" ||
    params.analysis.requested_action === "callback" ||
    params.analysis.requested_action === "demo";

  const committedNow = newState === "committed" || strongCommit;

  const haveContact = !!lead.email || !!lead.phone;
  const preferred = ((lead.qualification_json || {}) as any).preferred_contact_channel ?? "unknown";

  const lastKey = ((lead.qualification_json || {}) as any)._last_followup_key as string | null;
  const lastAt = ((lead.qualification_json || {}) as any)._last_followup_at as string | null;
  const lastAtMs = lastAt ? new Date(lastAt).getTime() : 0;

  async function markAsked(key: string) {
    await supabaseServer
      .from("company_leads")
      .update({
        qualification_json: {
          ...(lead?.qualification_json || {}),
          _last_followup_key: key,
          _last_followup_at: new Date().toISOString(),
        },
        last_touch_at: new Date().toISOString(),
      })
      .eq("id", lead!.id);
  }

  // 1) committed + missing contact -> ask ONCE
  if (committedNow && !haveContact) {
    if (lastKey === "contact") return { lead, followUp: null };
    await markAsked("contact");
    const privacy = buildConsentMicrocopy(params.meta);
    const ask = "Wie duerfen wir Sie am besten erreichen (E-Mail oder Telefon)?" + privacy;
    return { lead, followUp: ask };
  }

  // 2) committed + have contact but preferred channel unknown -> ask ONCE
  if (committedNow && haveContact && preferred === "unknown") {
    if (lastKey === "preferred_channel") return { lead, followUp: null };
    await markAsked("preferred_channel");
    return { lead, followUp: "Bevorzugen Sie E-Mail, Telefon oder WhatsApp?" };
  }

  // 3) qualifying -> ask model next_question (no loop)
  const nq = (params.analysis.next_question || "").trim();
  const nqKey = (params.analysis.next_question_key || "").trim();
  const askedRecentlySame =
    !!nqKey && !!lastKey && nqKey === lastKey && Date.now() - lastAtMs < 10 * 60 * 1000;

  const looksLikeContactQuestion = /e-?mail|telefon|whats\s*app|erreichen|kontakt/i.test(nq);

  if (newState === "qualifying" && nq && !askedRecentlySame) {
    if (haveContact && looksLikeContactQuestion) return { lead, followUp: null };
    if (nqKey) await markAsked(nqKey);
    return { lead, followUp: nq };
  }

  return { lead, followUp: null };
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

  if (convErr) {
    return NextResponse.json({ error: "db_conv_failed", details: convErr.message }, { status: 500 });
  }
  if (!conv) {
    return NextResponse.json(
      { error: "conversation_not_found", hint: "call POST /api/widget/conversation first" },
      { status: 400 }
    );
  }
  if (String(conv.company_id) !== company_id) {
    return NextResponse.json({ error: "conversation_company_mismatch" }, { status: 403 });
  }

  const billing = await loadCompanyEntitlements(company_id);
  const features = billing.entitlements?.features || {};
  const chatEnabled = !!features.chat;

  // Owner-Bypass for Admin Test-Chat only
  let ownerBypass = false;
  try {
    const auth = await requireOwner();
    ownerBypass = !!auth?.ok;
  } catch {
    ownerBypass = false;
  }

  if ((!chatEnabled || !isPayingStatus(billing.status)) && !ownerBypass) {
    return NextResponse.json(
      {
        error: "payment_required",
        status: billing.status,
        plan: billing.plan_key,
        hint: "subscription_required",
      },
      { status: 402 }
    );
  }

  const cfg = await loadCompanyConfig(company_id);
  const leadMeta = await loadCompanyLeadMeta(company_id);

  const effectiveLimits = capRateLimits(cfg, billing.entitlements);

  const { data: rl, error: rlErr } = await supabaseServer.rpc("enforce_company_rate_limit", {
    p_company_id: company_id,
    p_limit_per_minute: effectiveLimits.per_minute,
    p_limit_per_day: effectiveLimits.per_day,
  });

  if (rlErr) {
    return NextResponse.json({ error: "rate_limit_rpc_failed", details: rlErr.message }, { status: 500 });
  }

  // IMPORTANT: Supabase RPC often returns an array for set-returning functions
  const rlRow: any = Array.isArray(rl) ? rl[0] : rl;

  if (!rlRow?.allowed) {
    const retryAfter = getRetryAfterSeconds(rlRow?.reset_minute, rlRow?.reset_day);

    return new NextResponse(
      JSON.stringify({
        error: "rate_limited",
        limits: { per_minute: effectiveLimits.per_minute, per_day: effectiveLimits.per_day },
        usage: { minute_count: rlRow?.minute_count ?? null, day_count: rlRow?.day_count ?? null },
        resets: { reset_minute: rlRow?.reset_minute ?? null, reset_day: rlRow?.reset_day ?? null },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  const { error: m1Err } = await supabaseServer.from("messages").insert({
    conversation_id,
    role: "user",
    content: userText,
  });
  if (m1Err) {
    return NextResponse.json({ error: "db_insert_user_failed", details: m1Err.message }, { status: 500 });
  }

  // ---------------- RAG ----------------
  let chunks: any[] = [];

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(userText);
  } catch (e: any) {
    return NextResponse.json({ error: "embedding_failed", details: e?.message || String(e) }, { status: 500 });
  }

  const { data: rpcData, error: rpcErr } = await supabaseServer.rpc("match_knowledge_chunks", {
    p_company_id: company_id,
    p_query_embedding: queryEmbedding,
    p_match_count: cfg.max_chunks,
  });

  if (rpcErr) {
    return NextResponse.json({ error: "rpc_failed", details: rpcErr.message }, { status: 500 });
  }

  chunks = (rpcData ?? []) as any[];

  // ---------------- knowledge_only strict branch (lead-safe) ----------------
  if (cfg.mode === "knowledge_only" && (!chunks || chunks.length === 0)) {
    let finalText = cfg.unknown_answer;

    try {
      const existingLead = await getLead(company_id, conversation_id);
      const existingQual = existingLead?.qualification_json || {};

      const analysis = await runLeadAnalysisStructured({
        userText,
        assistantText: finalText,
        mode: cfg.mode,
        chunkHints: [],
        existingQualification: existingQual,
      });

      const updated = await updateLeadFromAnalysis({
        company_id,
        conversation_id,
        analysis,
        meta: leadMeta,
        userText,
      });

      if (updated.followUp) {
        finalText = `${finalText}\n\n${updated.followUp}`;
      }
    } catch {
      // Lead engine must never break chat
    }

    const { error: m2Err } = await supabaseServer.from("messages").insert({
      conversation_id,
      role: "assistant",
      content: finalText,
    });

    if (m2Err) {
      return NextResponse.json({ error: "db_insert_assistant_failed", details: m2Err.message }, { status: 500 });
    }

    return NextResponse.json({ reply: finalText, chunks: [] });
  }

  const contextText = makeContextText(chunks);
  const systemPrompt =
    cfg.mode === "knowledge_only"
      ? buildKnowledgeOnlySystemPrompt(cfg.system_prompt)
      : buildHybridSystemPrompt(cfg.system_prompt);

  const messages: { role: "system" | "user"; content: string }[] = [{ role: "system", content: systemPrompt }];

  if (contextText) {
    messages.push({ role: "system", content: `Context:\n${contextText}` });
  }

  if (cfg.mode === "knowledge_only") {
    messages.push({
      role: "system",
      content: `If the answer is not in Context, reply exactly with:\n${cfg.unknown_answer}`,
    });
  }

  messages.push({ role: "user", content: userText });

  const completion = await openai.chat.completions.create({
    model: cfg.model,
    temperature: cfg.temperature,
    messages,
  });

  let assistantText = completion.choices?.[0]?.message?.content ?? "";

  if (cfg.include_sources && chunks.length > 0) {
    const sources = makeSourcesText(chunks);
    if (sources) assistantText = `${assistantText}\n\nSources:\n${sources}`;
  }

  // ---------------- Lead Engine Hook (Business Layer) ----------------
  let finalText = assistantText;

  try {
    const existingLead = await getLead(company_id, conversation_id);
    const existingQual = existingLead?.qualification_json || {};

    const chunkHints = (chunks || [])
      .slice(0, 4)
      .map((c: any) => String(c.title || c.source || "").slice(0, 80))
      .filter(Boolean);

    const analysis = await runLeadAnalysisStructured({
      userText,
      assistantText,
      mode: cfg.mode,
      chunkHints,
      existingQualification: existingQual,
    });

    const updated = await updateLeadFromAnalysis({
      company_id,
      conversation_id,
      analysis,
      meta: leadMeta,
      userText,
    });

    if (updated.followUp) {
      finalText = `${finalText}\n\n${updated.followUp}`;
    }
  } catch {
    // Lead engine must never break chat
  }

  const { error: m2Err } = await supabaseServer.from("messages").insert({
    conversation_id,
    role: "assistant",
    content: finalText,
  });

  if (m2Err) {
    return NextResponse.json({ error: "db_insert_assistant_failed", details: m2Err.message }, { status: 500 });
  }

  return NextResponse.json({ reply: finalText, chunks });
}
