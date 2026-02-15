// app/api/widget/message/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

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
  const { data: billing } = await supabaseServer
    .from("company_billing")
    .select("status,plan_key,current_period_end")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!billing) return { ok: false, status: 402, error: "payment_required" };

  const status = String(billing.status || "none");
  const cpe = billing.current_period_end
    ? String(billing.current_period_end)
    : null;

  if (!isPayingStatus(status)) {
    return { ok: false, status: 402, error: "payment_required" };
  }

  if (cpe && cpe < nowIso()) {
    return { ok: false, status: 402, error: "trial_expired" };
  }

  return { ok: true };
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

  // Validate conversation belongs to company
  const { data: conv } = await supabaseServer
    .from("conversations")
    .select("id,company_id")
    .eq("id", conversation_id)
    .maybeSingle();

  if (!conv || conv.company_id !== company_id) {
    return NextResponse.json({ error: "invalid_conversation" }, { status: 403 });
  }

  // 🔒 Monetization Lock
  const gate = await enforceBillingGate(company_id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  // Store user message
  await supabaseServer.from("messages").insert({
    conversation_id,
    role: "user",
    content: message,
  });

  // Get last 10 messages for context
  const { data: history } = await supabaseServer
    .from("messages")
    .select("role,content")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true })
    .limit(10);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: history as any,
    temperature: 0.7,
  });

  const reply = completion.choices[0]?.message?.content || "";

  // Store assistant reply
  await supabaseServer.from("messages").insert({
    conversation_id,
    role: "assistant",
    content: reply,
  });

  // Increment usage counter
  await supabaseServer.rpc("increment_company_usage", {
    p_company_id: company_id,
  });

  return NextResponse.json({
    reply,
  });
}
