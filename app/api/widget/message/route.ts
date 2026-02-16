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

function toInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function makeBuckets(now: Date) {
  const pad = (x: number) => String(x).padStart(2, "0");

  const yyyy = now.getUTCFullYear();
  const mm = pad(now.getUTCMonth() + 1);
  const dd = pad(now.getUTCDate());
  const hh = pad(now.getUTCHours());
  const mi = pad(now.getUTCMinutes());

  const min_bucket = `minute:${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  const day_bucket = `day:${yyyy}-${mm}-${dd}`;

  const reset_minute = new Date(
    Date.UTC(yyyy, now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), 0, 0)
  );
  reset_minute.setUTCMinutes(reset_minute.getUTCMinutes() + 1);

  const reset_day = new Date(Date.UTC(yyyy, now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  reset_day.setUTCDate(reset_day.getUTCDate() + 1);

  return {
    min_bucket,
    day_bucket,
    reset_minute: reset_minute.toISOString(),
    reset_day: reset_day.toISOString(),
  };
}

async function enforceRateLimitsViaUsageCounters(company_id: string, limits: { per_minute: number; per_day: number }) {
  const now = new Date();
  const { min_bucket, day_bucket, reset_minute, reset_day } = makeBuckets(now);

  const per_minute = Math.max(1, Math.min(600, toInt(limits.per_minute, 10)));
  const per_day = Math.max(1, Math.min(200000, toInt(limits.per_day, 1000)));

  const { data: counters, error: cErr } = await supabaseServer
    .from("company_usage_counters")
    .select("bucket,count,updated_at")
    .eq("company_id", company_id)
    .in("bucket", [min_bucket, day_bucket]);

  if (cErr) {
    return { ok: false as const, status: 500, error: "rate_limit_read_failed", details: cErr.message };
  }

  const byBucket = new Map<string, any>((counters || []).map((r: any) => [String(r.bucket), r]));
  const minuteCount = Number(byBucket.get(min_bucket)?.count ?? 0);
  const dayCount = Number(byBucket.get(day_bucket)?.count ?? 0);

  if (per_minute > 0 && minuteCount >= per_minute) {
    return {
      ok: false as const,
      status: 429,
      error: "rate_limited",
      scope: "minute",
      limit: per_minute,
      count: minuteCount,
      reset_hint: reset_minute,
    };
  }

  if (per_day > 0 && dayCount >= per_day) {
    return {
      ok: false as const,
      status: 429,
      error: "rate_limited",
      scope: "day",
      limit: per_day,
      count: dayCount,
      reset_hint: reset_day,
    };
  }

  const nowIso = new Date().toISOString();

  const { error: upErr } = await supabaseServer
    .from("company_usage_counters")
    .upsert(
      [
        { company_id, bucket: min_bucket, count: minuteCount + 1, updated_at: nowIso } as any,
        { company_id, bucket: day_bucket, count: dayCount + 1, updated_at: nowIso } as any,
      ],
      { onConflict: "company_id,bucket" }
    );

  if (upErr) {
    return { ok: false as const, status: 500, error: "rate_limit_write_failed", details: upErr.message };
  }

  return { ok: true as const };
}

// -------------------- LANGUAGE --------------------

type Lang = "de" | "en";

function detectLanguage(text: string): Lang {
  const t = String(text || "").toLowerCase();

  // quick DE markers
  const deMarkers = [
    " kann ",
    " bitte",
    " ich ",
    " wir ",
    " nicht ",
    " warum ",
    " wie ",
    " was ",
    " danke",
    " hallo",
    " guten",
    " sprache",
    " lernen",
    " hilft",
    " funktioniert",
    " würde",
    " könnte",
    " möchte",
    " benötige",
    " vielleicht",
  ];

  const hasUmlaut = /[äöüß]/.test(t);
  const hasDeMarker = deMarkers.some((m) => t.includes(m));

  // quick EN markers
  const enMarkers = [" please", " can you", " how ", " what ", " why ", " thanks", "hello", "help me", "learn "];
  const hasEnMarker = enMarkers.some((m) => t.includes(m));

  if (hasUmlaut || (hasDeMarker && !hasEnMarker)) return "de";
  return "en";
}

function getLangFromBranding(branding_json: any): Lang | null {
  const v = branding_json?.chat?.language ?? branding_json?.language ?? null;
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (s.startsWith("de")) return "de";
  if (s.startsWith("en")) return "en";
  return null;
}

function unknownByLang(lang: Lang) {
  return lang === "de" ? "Dazu habe ich in den bereitgestellten Informationen keine Antwort." : "I don’t have enough information to answer that.";
}

function languageSystemRule(lang: Lang) {
  if (lang === "de") {
    return [
      "Du bist der Assistent der Company.",
      "Antworte IMMER vollständig auf Deutsch, ohne Englisch-Mischung.",
      "Wenn der User Englisch schreibt, darfst du auf Englisch antworten; sonst auf Deutsch.",
    ].join("\n");
  }
  return [
    "You are the company's assistant.",
    "Always reply fully in English, without mixing German.",
    "If the user writes in German, you may reply in German; otherwise reply in English.",
  ].join("\n");
}

// -------------------- KNOWLEDGE (RAG) --------------------

async function embedQuery(text: string): Promise<number[]> {
  const r = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return r.data[0].embedding as unknown as number[];
}

/**
 * Your project already has an RPC "match_knowledge_chunks".
 * Parameter names sometimes differ across setups.
 * We try multiple common signatures (no snippets in caller).
 */
async function matchKnowledgeChunks(company_id: string, embedding: number[], match_count: number) {
  const tries: Array<{ args: any }> = [
    { args: { p_company_id: company_id, p_query_embedding: embedding, p_match_count: match_count } },
    { args: { company_id, query_embedding: embedding, match_count } },
    { args: { p_company_id: company_id, query_embedding: embedding, match_count: match_count } },
    { args: { company_id: company_id, p_query_embedding: embedding, p_match_count: match_count } },
  ];

  let lastErr: any = null;

  for (const t of tries) {
    const { data, error } = await supabaseServer.rpc("match_knowledge_chunks", t.args);
    if (!error) {
      const rows = Array.isArray(data) ? data : [];
      return { ok: true as const, rows };
    }
    lastErr = error;
  }

  return { ok: false as const, rows: [] as any[], error: lastErr?.message || "match_knowledge_chunks_failed" };
}

function buildContext(rows: any[]) {
  const cleaned = (rows || [])
    .map((r) => ({
      content: String(r?.content || "").trim(),
      title: String(r?.title || r?.source || "").trim(),
      similarity: typeof r?.similarity === "number" ? r.similarity : null,
    }))
    .filter((x) => x.content.length > 0);

  if (cleaned.length === 0) return "";

  return cleaned
    .map((x, i) => {
      const head = x.title ? `SOURCE: ${x.title}\n` : "";
      return `[#${i + 1}]\n${head}${x.content}`;
    })
    .join("\n\n---\n\n");
}

async function getCompanyChatConfig(company_id: string) {
  const { data, error } = await supabaseServer
    .from("company_settings")
    .select("branding_json, limits_json")
    .eq("company_id", company_id)
    .maybeSingle();

  if (error) return null;

  const branding = (data as any)?.branding_json ?? {};
  const limits = (data as any)?.limits_json ?? {};

  const chat = branding?.chat ?? limits?.chat ?? {};

  // defaults (safe)
  const mode = String(chat?.mode || "hybrid"); // "knowledge_only" | "hybrid"
  const model = String(chat?.model || "gpt-4o-mini");
  const temperature = Number.isFinite(Number(chat?.temperature)) ? Number(chat.temperature) : 0.2;
  const max_chunks = Number.isFinite(Number(chat?.max_chunks)) ? Math.max(0, Math.min(20, Number(chat.max_chunks))) : 6;

  const system_prompt = String(chat?.system_prompt || "").trim();

  // NOTE: unknown_answer may exist in DB; we will localize at runtime if not explicitly set per language
  const unknown_answer = String(chat?.unknown_answer || "I don’t know based on the provided information.").trim();
  const include_sources = Boolean(chat?.include_sources ?? false);

  return { mode, model, temperature, max_chunks, system_prompt, unknown_answer, include_sources, branding };
}

// ✅ Allow GET for quick health check
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/widget/message", methods: ["POST"] });
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

  // Ensure conversation belongs to company
  const { data: conv, error: convErr } = await supabaseServer
    .from("conversations")
    .select("id,company_id")
    .eq("id", conversation_id)
    .maybeSingle();

  if (convErr) return NextResponse.json({ error: "db_conversation_failed", details: convErr.message }, { status: 500 });
  if (!conv || String(conv.company_id) !== company_id) {
    return NextResponse.json({ error: "invalid_conversation" }, { status: 403 });
  }

  // Billing gate
  const bill = await checkBillingGate(company_id);
  if (!bill.ok) {
    return NextResponse.json({ error: bill.code, message: bill.message }, { status: 402 });
  }

  // Hard Rate Limit BEFORE OpenAI
  const rl = await enforceRateLimitsViaUsageCounters(company_id, bill.limits);
  if (!rl.ok) {
    return NextResponse.json({ error: rl.error, ...(rl as any) }, { status: rl.status });
  }

  // Store user message
  const { error: insUserErr } = await supabaseServer.from("messages").insert({
    conversation_id,
    role: "user",
    content: message,
  });
  if (insUserErr) {
    return NextResponse.json({ error: "db_insert_user_message_failed", details: insUserErr.message }, { status: 500 });
  }

  // Load recent history
  const { data: history, error: hErr } = await supabaseServer
    .from("messages")
    .select("role,content,created_at")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true })
    .limit(16);

  if (hErr) return NextResponse.json({ error: "db_history_failed", details: hErr.message }, { status: 500 });

  // Chat config + Knowledge
  const cfg =
    (await getCompanyChatConfig(company_id)) ?? ({
      mode: "hybrid",
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_chunks: 6,
      system_prompt: "",
      unknown_answer: "I don’t know based on the provided information.",
      include_sources: false,
      branding: {},
    } as any);

  // language decision:
  // 1) explicit company branding/setting (branding_json.chat.language or branding_json.language)
  // 2) detect from user message
  const lang: Lang = getLangFromBranding(cfg.branding) ?? detectLanguage(message);

  // unknown answer localization:
  // If DB unknown_answer is present AND looks localized already, keep it.
  // Otherwise, use our localized default to avoid mixed languages.
  const cfgUnknown = String(cfg.unknown_answer || "").trim();
  const unknown_answer =
    cfgUnknown && cfgUnknown !== "I don’t know based on the provided information."
      ? cfgUnknown
      : unknownByLang(lang);

  let context = "";
  let sources: any[] = [];

  try {
    const emb = await embedQuery(message);
    const match = await matchKnowledgeChunks(company_id, emb, cfg.max_chunks);
    if (match.ok) {
      sources = match.rows;
      context = buildContext(match.rows);
    }
  } catch {
    // fail soft: context stays empty
  }

  // ✅ enforce knowledge-only when configured
  if (cfg.mode === "knowledge_only" && !context) {
    const reply = unknown_answer;

    const { error: insAsstErr } = await supabaseServer.from("messages").insert({
      conversation_id,
      role: "assistant",
      content: reply,
    });

    if (insAsstErr) {
      return NextResponse.json({ error: "db_insert_assistant_message_failed", details: insAsstErr.message }, { status: 500 });
    }

    return NextResponse.json({ reply, sources: cfg.include_sources ? [] : undefined });
  }

  const systemParts: string[] = [];

  // 1) hard language rule first
  systemParts.push(languageSystemRule(lang));

  // 2) optional per-company system prompt
  if (cfg.system_prompt) systemParts.push(cfg.system_prompt);

  // 3) core RAG instructions
  systemParts.push(
    "Use the provided KNOWLEDGE CONTEXT as the primary source of truth.",
    `If the answer is not contained in the KNOWLEDGE CONTEXT, reply exactly with: "${unknown_answer}".`,
    "Be concise and accurate.",
    "",
    "KNOWLEDGE CONTEXT:",
    context || "(empty)"
  );

  const completion = await openai.chat.completions.create({
    model: cfg.model,
    temperature: cfg.temperature,
    messages: [
      { role: "system", content: systemParts.join("\n") },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
    ] as any,
  });

  let reply = String(completion.choices?.[0]?.message?.content || "").trim();
  if (!reply) reply = unknown_answer;

  // Safety: if model returns mixed language on DE request, force unknown answer when context empty.
  // (Most mixes happen on unknown cases.)
  if (!context && cfg.mode !== "knowledge_only") {
    // If user is DE and reply contains typical EN phrase, normalize to DE unknown.
    if (lang === "de" && /i\s+don['’]t\s+know|based\s+on\s+the\s+provided\s+information/i.test(reply)) {
      reply = unknown_answer;
    }
    if (lang === "en" && /ich\s+weiß\s+es\s+nicht|bereitgestellten\s+informationen/i.test(reply)) {
      reply = unknown_answer;
    }
  }

  // Store assistant reply
  const { error: insAsstErr } = await supabaseServer.from("messages").insert({
    conversation_id,
    role: "assistant",
    content: reply,
  });

  if (insAsstErr) {
    return NextResponse.json({ error: "db_insert_assistant_message_failed", details: insAsstErr.message }, { status: 500 });
  }

  return NextResponse.json({
    reply,
    sources: cfg.include_sources ? sources : undefined,
  });
}
