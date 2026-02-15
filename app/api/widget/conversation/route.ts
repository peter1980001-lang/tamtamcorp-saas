// app/api/widget/conversation/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

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
  // 1) load billing row
  const { data: billing, error: bErr } = await supabaseServer
    .from("company_billing")
    .select("status,plan_key,stripe_price_id,current_period_end")
    .eq("company_id", companyId)
    .maybeSingle();

  if (bErr) return { ok: false as const, status: 500, error: "db_billing_failed", details: bErr.message };
  if (!billing) return { ok: false as const, status: 402, error: "payment_required" };

  const status = String(billing.status || "none");
  const cpe = billing.current_period_end ? String(billing.current_period_end) : null;

  if (!isPayingStatus(status)) {
    return { ok: false as const, status: 402, error: "payment_required" };
  }

  if (cpe && cpe < nowIso()) {
    // Trial/period ended
    return { ok: false as const, status: 402, error: "trial_expired" };
  }

  // 2) plan entitlements: chat feature must be enabled
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

  if (!plan || !plan.is_active) {
    return { ok: false as const, status: 402, error: "invalid_or_inactive_plan" };
  }

  const ent = plan.entitlements_json || {};
  const features = ent.features || {};
  const chatEnabled = !!features.chat;

  if (!chatEnabled) {
    return { ok: false as const, status: 402, error: "feature_disabled" };
  }

  return { ok: true as const, plan_key: String(plan.plan_key || billing.plan_key || "") };
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

  // ✅ Monetization Lock (Hard Gate)
  const gate = await enforceBillingGate(company_id);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error, ...(gate.details ? { details: gate.details } : {}) },
      { status: gate.status }
    );
  }

  // Create conversation
  const { data, error } = await supabaseServer
    .from("conversations")
    .insert({
      company_id,
      session_id: crypto.randomUUID(),
    })
    .select("id, company_id, session_id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversation: data });
}
