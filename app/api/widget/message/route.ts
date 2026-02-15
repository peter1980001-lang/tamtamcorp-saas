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
  // bucket format matches your billing usage route pattern:
  // minute:YYYY-MM-DDTHH:MM (UTC)
  // day:YYYY-MM-DD (UTC)
  const pad = (x: number) => String(x).padStart(2, "0");

  const yyyy = now.getUTCFullYear();
  const mm = pad(now.getUTCMonth() + 1);
  const dd = pad(now.getUTCDate());
  const hh = pad(now.getUTCHours());
  const mi = pad(now.getUTCMinutes());

  const min_bucket = `minute:${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  const day_bucket = `day:${yyyy}-${mm}-${dd}`;

  // optional hints
  const reset_minute = new Date(Date.UTC(yyyy, now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), 0, 0));
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

  // Read both buckets in one query
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

  // Increment both buckets (upsert)
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

  if (convErr) {
    return NextResponse.json({ error: "db_conversation_failed", details: convErr.message }, { status: 500 });
  }
  if (!conv || String(conv.company_id) !== company_id) {
    return NextResponse.json({ error: "invalid_conversation" }, { status: 403 });
  }

  // Billing gate
  const bill = await checkBillingGate(company_id);
  if (!bill.ok) {
    return NextResponse.json({ error: bill.code, message: bill.message }, { status: 402 });
  }

  // ✅ Hard Rate Limit (429) BEFORE OpenAI — using company_usage_counters (consistent with your billing usage route)
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

  // Get last 12 messages
  const { data: history, error: hErr } = await supabaseServer
    .from("messages")
    .select("role,content,created_at")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true })
    .limit(12);

  if (hErr) {
    return NextResponse.json({ error: "db_history_failed", details: hErr.message }, { status: 500 });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: (history || []).map((m: any) => ({ role: m.role, content: m.content })) as any,
    temperature: 0.7,
  });

  const reply = String(completion.choices?.[0]?.message?.content || "").trim();

  const { error: insAsstErr } = await supabaseServer.from("messages").insert({
    conversation_id,
    role: "assistant",
    content: reply,
  });

  if (insAsstErr) {
    return NextResponse.json({ error: "db_insert_assistant_message_failed", details: insAsstErr.message }, { status: 500 });
  }

  return NextResponse.json({ reply });
}
