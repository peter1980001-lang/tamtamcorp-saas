export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

function isPayingStatus(status: string) {
  return status === "active" || status === "trialing";
}

function toInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { id } = await context.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  // 1) billing row
  const { data: billing, error: bErr } = await supabaseServer
    .from("company_billing")
    .select(
      "company_id,status,plan_key,stripe_price_id,stripe_customer_id,stripe_subscription_id,current_period_end,updated_at,created_at"
    )
    .eq("company_id", company_id)
    .maybeSingle();

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  // 2) company settings -> rate limits from branding.chat or limits.chat
  const { data: settings, error: sErr } = await supabaseServer
    .from("company_settings")
    .select("limits_json, branding_json")
    .eq("company_id", company_id)
    .maybeSingle();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const limits_json = settings?.limits_json || {};
  const branding_json = settings?.branding_json || {};
  const rawChat = branding_json?.chat ?? limits_json?.chat ?? {};
  const companyRateLimits = rawChat?.rate_limits || {};

  const company_per_minute = Math.max(1, Math.min(600, toInt(companyRateLimits?.per_minute, 10)));
  const company_per_day = Math.max(1, Math.min(200000, toInt(companyRateLimits?.per_day, 1000)));

  // 3) plan enrichment
  let plan: any = null;
  let planEntitlements: any = null;

  if (billing?.plan_key) {
    const { data: p, error: pErr } = await supabaseServer
      .from("billing_plans")
      .select("plan_key,name,is_active,stripe_price_id,entitlements_json")
      .eq("plan_key", billing.plan_key)
      .maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    plan = p ?? null;
    planEntitlements = plan?.is_active ? plan?.entitlements_json ?? null : null;
  } else if (billing?.stripe_price_id) {
    const { data: p, error: pErr } = await supabaseServer
      .from("billing_plans")
      .select("plan_key,name,is_active,stripe_price_id,entitlements_json")
      .eq("stripe_price_id", billing.stripe_price_id)
      .maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    plan = p ?? null;
    planEntitlements = plan?.is_active ? plan?.entitlements_json ?? null : null;
  }

  const status = String(billing?.status || "none");
  const features = planEntitlements?.features || {};
  const planRate = planEntitlements?.rate_limits || {};

  const plan_per_minute = Math.max(0, toInt(planRate?.per_minute, 0));
  const plan_per_day = Math.max(0, toInt(planRate?.per_day, 0));

  const effective_per_minute = plan_per_minute > 0 ? Math.min(company_per_minute, plan_per_minute) : company_per_minute;
  const effective_per_day = plan_per_day > 0 ? Math.min(company_per_day, plan_per_day) : company_per_day;

  const chat_feature_enabled = !!features?.chat;
  const paying_status = isPayingStatus(status);
  const chat_enabled = chat_feature_enabled && paying_status;

  return NextResponse.json({
    billing: billing ?? null,
    plan,

    // gating visibility
    chat_enabled,
    chat_feature_enabled,
    paying_status,

    // limits
    company_rate_limits: { per_minute: company_per_minute, per_day: company_per_day },
    plan_rate_limits: { per_minute: plan_per_minute, per_day: plan_per_day },
    effective_rate_limits: { per_minute: effective_per_minute, per_day: effective_per_day },
  });
}
