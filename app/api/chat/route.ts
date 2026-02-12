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
    mode: "knowledge_only",
    model: "gpt-4o-mini",
    temperature: 0.1,
    max_chunks: 6,
    system_prompt:
      "You are the company's website assistant. Be concise, factual and helpful.",
    unknown_answer:
      "I don’t have that information in the provided knowledge base yet. Please leave your email or phone and we’ll get back to you, or ask a question about our services/products.",
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
  if (typeof cfg.system_prompt !== "string" || !cfg.system_prompt.trim())
    cfg.system_prompt = defaults.system_prompt;
  if (typeof cfg.unknown_answer !== "string" || !cfg.unknown_answer.trim())
    cfg.unknown_answer = defaults.unknown_answer;
  cfg.include_sources = !!cfg.include_sources;

  const rl = (cfg.rate_limits || {}) as any;
  const perMinute =
    typeof rl.per_minute === "number" ? rl.per_minute : defaults.rate_limits!.per_minute!;
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

  const entitlements: PlanEntitlements =
    plan?.is_active ? (plan.entitlements_json as any) : locked;

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

  if (!chatEnabled || !isPayingStatus(billing.status)) {
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
  const effectiveLimits = capRateLimits(cfg, billing.entitlements);

  const { data: rl, error: rlErr } = await supabaseServer.rpc("enforce_company_rate_limit", {
    p_company_id: company_id,
    p_limit_per_minute: effectiveLimits.per_minute,
    p_limit_per_day: effectiveLimits.per_day,
  });

  if (rlErr) {
    return NextResponse.json({ error: "rate_limit_rpc_failed", details: rlErr.message }, { status: 500 });
  }

  if (!rl?.allowed) {
    const retryAfter = getRetryAfterSeconds(rl?.reset_minute, rl?.reset_day);

    return new NextResponse(
      JSON.stringify({
        error: "rate_limited",
        limits: { per_minute: effectiveLimits.per_minute, per_day: effectiveLimits.per_day },
        usage: { minute_count: rl?.minute_count ?? null, day_count: rl?.day_count ?? null },
        resets: { reset_minute: rl?.reset_minute ?? null, reset_day: rl?.reset_day ?? null },
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

  let chunks: any[] = [];

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(userText);
  } catch (e: any) {
    return NextResponse.json(
      { error: "embedding_failed", details: e?.message || String(e) },
      { status: 500 }
    );
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

  if (cfg.mode === "knowledge_only" && (!chunks || chunks.length === 0)) {
    const safe = cfg.unknown_answer;

    const { error: m2Err } = await supabaseServer.from("messages").insert({
      conversation_id,
      role: "assistant",
      content: safe,
    });

    if (m2Err) {
      return NextResponse.json({ error: "db_insert_assistant_failed", details: m2Err.message }, { status: 500 });
    }

    return NextResponse.json({ reply: safe, chunks: [] });
  }

  const contextText = makeContextText(chunks);
  const systemPrompt =
    cfg.mode === "knowledge_only"
      ? buildKnowledgeOnlySystemPrompt(cfg.system_prompt)
      : buildHybridSystemPrompt(cfg.system_prompt);

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

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

  const { error: m2Err } = await supabaseServer.from("messages").insert({
    conversation_id,
    role: "assistant",
    content: assistantText,
  });

  if (m2Err) {
    return NextResponse.json({ error: "db_insert_assistant_failed", details: m2Err.message }, { status: 500 });
  }

  return NextResponse.json({ reply: assistantText, chunks });
}
