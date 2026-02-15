// app/api/widget/message/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function nowIso() {
  return new Date().toISOString();
}

function isPayingStatus(status: string) {
  return status === "active" || status === "trialing";
}

async function enforceBillingGate(companyId: string) {
  const { data: billing, error: bErr } = await supabaseServer
    .from("company_billing")
    .select("status,plan_key,stripe_price_id,current_period_end")
    .eq("company_id", companyId)
    .maybeSingle();

  if (bErr) return { ok: false as const, status: 500, error: "db_billing_failed", details: bErr.message };
  if (!billing) return { ok: false as const, status: 402, error: "payment_required" };

  const status = String(billing.status || "none");
  const cpe = billing.current_period_end ? String(billing.current_period_end) : null;

  if (!isPayingStatus(status)) return { ok: false as const, status: 402, error: "payment_required" };
  if (cpe && cpe < nowIso()) return { ok: false as const, status: 402, error: "trial_expired" };

  // plan must have chat feature enabled
  let plan: any = null;
  if (billing.plan_key) {
    const { data: p, error: pErr } = await supabaseServer
      .from("billing_plans")
      .select("plan_key,is_active,entitlements_json")
      .eq("plan_key", billing.plan_key)
      .maybeSingle();
    if (pErr) return { ok: false as const, status: 500, error: "db_plan_failed", details: pErr.message };
    plan = p ?? null;
  } else if (billing.stripe_price_id) {
    const { data: p, error: pErr } = await supabaseServer
      .from("billing_plans")
      .select("plan_key,is_active,entitlements_json")
      .eq("stripe_price_id", billing.stripe_price_id)
      .maybeSingle();
    if (pErr) return { ok: false as const, status: 500, error: "db_plan_failed", details: pErr.message };
    plan = p ?? null;
  }

  if (!plan || !plan.is_active) return { ok: false as const, status: 402, error: "invalid_or_inactive_plan" };

  const ent = plan.entitlements_json || {};
  const features = ent.features || {};
  if (!features.chat) return { ok: false as const, status: 402, error: "feature_disabled" };

  return { ok: true as const };
}

// ✅ Allow GET so visiting in browser doesn’t look like “broken”
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

  // 🔒 Monetization lock
  const gate = await enforceBillingGate(company_id);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error, ...(gate.details ? { details: gate.details } : {}) },
      { status: gate.status }
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
    messages: (history || []).map((m: any) => ({
      role: m.role,
      content: m.content,
    })) as any,
    temperature: 0.7,
  });

  const reply = String(completion.choices?.[0]?.message?.content || "").trim();

  // Store assistant reply
  const { error: insAsstErr } = await supabaseServer.from("messages").insert({
    conversation_id,
    role: "assistant",
    content: reply,
  });
  if (insAsstErr) {
    return NextResponse.json(
      { error: "db_insert_assistant_message_failed", details: insAsstErr.message },
      { status: 500 }
    );
  }

  // Usage increment (if RPC exists; if not, ignore)
  try {
    await supabaseServer.rpc("increment_company_usage", { p_company_id: company_id });
  } catch {
    // ignore
  }

  return NextResponse.json({ reply });
}
