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

function detectLang(text: string): Lang {
  const t = String(text || "").toLowerCase();
  if (/[äöüß]/i.test(t)) return "de";
  const germanHits = [" ich ", " du ", " nicht ", " und ", " oder ", " bitte ", " kann ", " helfen ", " was ", " wie ", " warum ", " wo ", " wir ", " angebot ", " preis ", " kosten "];
  let score = 0;
  for (const w of germanHits) if (t.includes(w.trim())) score += 1;
  return score >= 2 ? "de" : "en";
}

function defaultUnknown(lang: Lang) {
  return lang === "de"
    ? "Ich habe dazu in den bereitgestellten Informationen keine ausreichenden Details."
    : "I don’t have enough information in the provided knowledge to answer that.";
}

function defaultLeadPrompt(lang: Lang) {
  return lang === "de"
    ? "Damit wir dir schnell und passend helfen können: Wie heißt du, und wie können wir dich erreichen (E-Mail oder Telefonnummer)? Optional: Budget & Zeitrahmen."
    : "So we can help you quickly: what’s your name, and how can we reach you (email or phone)? Optional: budget & timeline.";
}

// -------------------- LEAD INTENT HEURISTICS --------------------

function includesAny(hay: string, needles: string[]) {
  for (const n of needles) if (hay.includes(n)) return true;
  return false;
}

function detectCommercialIntent(text: string): boolean {
  const t = String(text || "").toLowerCase();
  return includesAny(t, [
    "price", "pricing", "cost", "quote", "offer", "proposal", "demo", "trial", "subscribe", "plan", "package",
    "book", "appointment", "call", "contact", "sales",
    "preis", "preise", "kosten", "angebot", "offerte", "beratung", "termin", "anruf", "kontakt", "demo", "paket", "abo", "plan",
  ]);
}

function detectContactSharing(text: string): boolean {
  const t = String(text || "");
  const email = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(t);
  const phone = /(\+?\d[\d\s().-]{7,}\d)/.test(t);
  return email || phone;
}

// -------------------- KNOWLEDGE (RAG) --------------------

async function embedQuery(text: string): Promise<number[]> {
  const r = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return r.data[0].embedding as unknown as number[];
}

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

function extractKeywords(q: string) {
  const stop = new Set([
    "the","and","or","but","to","a","an","of","in","on","for","with","from","at","by",
    "ich","du","er","sie","wir","ihr","und","oder","aber","zu","der","die","das","ein","eine",
    "can","could","would","should","help","please","want",
  ]);

  return Array.from(
    new Set(
      String(q || "")
        .toLowerCase()
        .replace(/[^a-z0-9äöüß\s-]/gi, " ")
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 4)
        .filter((w) => !stop.has(w))
    )
  ).slice(0, 6);
}

async function fallbackKeywordSearch(company_id: string, query: string, limit: number) {
  const kws = extractKeywords(query);
  if (kws.length === 0) return { ok: true as const, rows: [] as any[] };

  const or = kws.map((k) => `content.ilike.%${k}%`).join(",");

  const { data, error } = await supabaseServer
    .from("knowledge_chunks")
    .select("title,content,created_at")
    .eq("company_id", company_id)
    .or(or)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { ok: false as const, rows: [] as any[], error: error.message };
  return { ok: true as const, rows: Array.isArray(data) ? data : [] };
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

  const mode = String(chat?.mode || "hybrid"); // "knowledge_only" | "hybrid"
  const model = String(chat?.model || "gpt-4o-mini");
  const temperature = Number.isFinite(Number(chat?.temperature)) ? Number(chat.temperature) : 0.2;
  const max_chunks = Number.isFinite(Number(chat?.max_chunks)) ? Math.max(0, Math.min(20, Number(chat.max_chunks))) : 6;

  const system_prompt = String(chat?.system_prompt || "").trim();
  const unknown_answer = String(chat?.unknown_answer || "").trim();
  const include_sources = Boolean(chat?.include_sources ?? false);

  // optional: greeting
  const greeting = String(chat?.greeting || "").trim();

  return { mode, model, temperature, max_chunks, system_prompt, unknown_answer, include_sources, greeting };
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

  const userLang = detectLang(message);

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
    .limit(10);

  if (hErr) return NextResponse.json({ error: "db_history_failed", details: hErr.message }, { status: 500 });

  const cfg = (await getCompanyChatConfig(company_id)) ?? {
    mode: "hybrid",
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_chunks: 6,
    system_prompt: "",
    unknown_answer: "",
    include_sources: false,
    greeting: "",
  };

  const unknown = cfg.unknown_answer || defaultUnknown(userLang);

  let context = "";
  let sources: any[] = [];
  let rag_mode: "rpc" | "fallback" | "empty" = "empty";

  try {
    const emb = await embedQuery(message);
    const match = await matchKnowledgeChunks(company_id, emb, cfg.max_chunks);

    if (match.ok && match.rows.length > 0) {
      sources = match.rows;
      context = buildContext(match.rows);
      rag_mode = "rpc";
    } else {
      const fb = await fallbackKeywordSearch(company_id, message, cfg.max_chunks);
      if (fb.ok && fb.rows.length > 0) {
        sources = fb.rows;
        context = buildContext(fb.rows);
        rag_mode = "fallback";
      } else {
        rag_mode = "empty";
      }
    }
  } catch {
    // fail soft
  }

  // If knowledge_only and no context -> unknown + lead capture signal
  if (cfg.mode === "knowledge_only" && !context) {
    const reply = unknown;

    const { error: insAsstErr } = await supabaseServer.from("messages").insert({
      conversation_id,
      role: "assistant",
      content: reply,
    });

    if (insAsstErr) {
      return NextResponse.json({ error: "db_insert_assistant_message_failed", details: insAsstErr.message }, { status: 500 });
    }

    const res = NextResponse.json({
      reply,
      need_lead_capture: true,
      lead_prompt: defaultLeadPrompt(userLang),
      sources: cfg.include_sources ? [] : undefined,
    });

    res.headers.set("x-tamtam-rag", rag_mode);
    res.headers.set("x-tamtam-lang", userLang);
    return res;
  }

  // -------------------- SALES CONCIERGE SYSTEM PROMPT --------------------

  const salesStyle =
    userLang === "de"
      ? [
          "Du bist ein freundlicher, aber direkter Sales-/Support-Assistent der Firma.",
          "Ziel: Nutzer schnell zur passenden Lösung führen und bei echtem Bedarf einen Lead erfassen.",
          "Stelle maximal 2 kurze Rückfragen, wenn es hilft (z.B. Ziel, Budget, Zeitrahmen).",
          "Biete proaktiv Hilfe an und schlage die nächsten Schritte vor.",
          "Wenn der Nutzer nach Preisen/Angebot/Demo/Termin fragt: frage gezielt nach Name + E-Mail oder Telefonnummer + Zeitrahmen.",
          "Antworte immer in der Sprache der letzten User-Nachricht.",
        ].join("\n")
      : [
          "You are a friendly but direct sales/support assistant for the company.",
          "Goal: quickly guide users to the right solution and capture a lead when appropriate.",
          "Ask at most 2 short follow-up questions when useful (e.g., goal, budget, timeline).",
          "Proactively offer help and propose next steps.",
          "If user asks for pricing/quote/demo/call: ask for name + email or phone + timeline.",
          "Always answer in the same language as the user’s latest message.",
        ].join("\n");

  const systemParts: string[] = [];
  if (cfg.system_prompt) systemParts.push(cfg.system_prompt);

  // Optional greeting hint (for first useful reply)
  if (cfg.greeting) {
    systemParts.push(
      userLang === "de"
        ? `Begrüßungsvorschlag (nur wenn passend, nicht jedes Mal): "${cfg.greeting}"`
        : `Greeting suggestion (only if appropriate, not every time): "${cfg.greeting}"`
    );
  }

  systemParts.push(
    salesStyle,
    "Use the provided KNOWLEDGE CONTEXT as the primary source of truth.",
    `If the answer is not contained in the KNOWLEDGE CONTEXT, reply exactly with: "${unknown}".`,
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
  if (!reply) reply = unknown;

  // -------------------- LEAD TRIGGERS --------------------
  // 1) exact unknown => lead capture
  // 2) commercial intent => lead capture
  // 3) user shares contact info => lead capture (we show the form to store it)
  const commercial = detectCommercialIntent(message);
  const contactShared = detectContactSharing(message);

  const needLead = reply === unknown || commercial || contactShared;

  // Store assistant reply
  const { error: insAsstErr } = await supabaseServer.from("messages").insert({
    conversation_id,
    role: "assistant",
    content: reply,
  });

  if (insAsstErr) {
    return NextResponse.json({ error: "db_insert_assistant_message_failed", details: insAsstErr.message }, { status: 500 });
  }

  const res = NextResponse.json({
    reply,
    need_lead_capture: needLead,
    lead_prompt: needLead ? defaultLeadPrompt(userLang) : undefined,
    sources: cfg.include_sources ? sources : undefined,
  });

  res.headers.set("x-tamtam-rag", rag_mode);
  res.headers.set("x-tamtam-lang", userLang);
  res.headers.set("x-tamtam-commercial", commercial ? "1" : "0");
  return res;
}
