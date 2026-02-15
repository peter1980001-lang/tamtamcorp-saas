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

function todayUtcKey(d = new Date()) {
  // YYYY-MM-DD in UTC
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function minuteUtcKey(d = new Date()) {
  // YYYY-MM-DDTHH:MM in UTC
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

async function enforceRateLimits(company_id: string, limits: { per_minute: number; per_day: number }) {
  const now = new Date();
  const minute_key = minuteUtcKey(now);
  const day_key = todayUtcKey(now);

  // We count "requests". One widget message = one request.
  // Minute bucket in: public.rate_limit_minute(company_id, minute_bucket, count, reset_at?)
  // Day bucket in: public.usage_daily(company_id, day_bucket, count, reset_at?)
  //
  // If your columns differ, we’ll adjust after the first error message.
  //
  // We do this as: read -> if over -> block -> else increment.
  // (MVP; later we can move to a single RPC for atomicity)

  // 1) Minute read
  const { data: mRow, error: mErr } = await supabaseServer
    .from("rate_limit_minute")
    .select("count, bucket")
    .eq("company_id", company_id)
    .eq("bucket", `minute:${minute_key}`)
    .maybeSingle();

  if (mErr) {
    return { ok: false as const, status: 500, error: "rate_limit_read_failed", details: mErr.message };
  }

  const minuteCount = Number((mRow as any)?.count ?? 0);
  if (limits.per_minute > 0 && minuteCount >= limits.per_minute) {
    return {
      ok: false as const,
      status: 429,
      error: "rate_limited",
      scope: "minute",
      limit: limits.per_minute,
      count: minuteCount,
      reset_hint: "next_minute",
    };
  }

  // 2) Day read
  const { data: dRow, error: dErr } = await supabaseServer
    .from("usage_daily")
    .select("count, day")
    .eq("company_id", company_id)
    .eq("day", day_key)
    .maybeSingle();

  if (dErr) {
    return { ok: false as const, status: 500, error: "rate_limit_read_failed", details: dErr.message };
  }

  const dayCount = Number((dRow as any)?.count ?? 0);
  if (limits.per_day > 0 && dayCount >= limits.per_day) {
    return {
      ok: false as const,
      status: 429,
      error: "rate_limited",
      scope: "day",
      limit: limits.per_day,
      count: dayCount,
      reset_hint: "next_day",
    };
  }

  // 3) Increment minute (upsert)
  const { error: mUpErr } = await supabaseServer
    .from("rate_limit_minute")
    .upsert(
      {
        company_id,
        bucket: `minute:${minute_key}`,
        count: minuteCount + 1,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "company_id,bucket" }
    );

  if (mUpErr) {
    return { ok: false as const, status: 500, error: "rate_limit_write_failed", details: mUpErr.message };
  }

  // 4) Increment day (upsert)
  const { error: dUpErr } = await supabaseServer
    .from("usage_daily")
    .upsert(
      {
        company_id,
        day: day_key,
        count: dayCount + 1,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "company_id,day" }
    );

  if (dUpErr) {
    return { ok: false as const, status: 500, error: "rate_limit_write_failed", details: dUpErr.message };
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

  // 1) Billing gate (your existing logic)
  const bill = await checkBillingGate(company_id);
  if (!bill.ok) {
    return NextResponse.json({ error: bill.code, message: bill.message }, { status: 402 });
  }

  // 2) Hard Rate Limit (429) BEFORE OpenAI
  const rl = await enforceRateLimits(company_id, bill.limits);
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.error, ...(rl as any) },
      { status: rl.status }
    );
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
