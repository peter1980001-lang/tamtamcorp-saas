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

function makeBuckets(now: Date) {
  // Same pattern as your RPC (minute:YYYY-MM-DD"T"HH24:MI, day:YYYY-MM-DD)
  const pad = (x: number) => String(x).padStart(2, "0");
  const yyyy = now.getUTCFullYear();
  const mm = pad(now.getUTCMonth() + 1);
  const dd = pad(now.getUTCDate());
  const hh = pad(now.getUTCHours());
  const mi = pad(now.getUTCMinutes());

  const min_bucket = `minute:${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  const day_bucket = `day:${yyyy}-${mm}-${dd}`;

  const reset_minute = new Date(Date.UTC(yyyy, now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), 0, 0));
  reset_minute.setUTCMinutes(reset_minute.getUTCMinutes() + 1);

  const reset_day = new Date(Date.UTC(yyyy, now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  reset_day.setUTCDate(reset_day.getUTCDate() + 1);

  return { min_bucket, day_bucket, reset_minute: reset_minute.toISOString(), reset_day: reset_day.toISOString() };
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

  // 2) company settings -> chat rate limits from branding.chat or limits.chat
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

  // 4) Usage counters (minute/day) from company_usage_counters
  const now = new Date();
  const { min_bucket, day_bucket, reset_minute, reset_day } = makeBuckets(now);

  const { data: counters, error: cErr } = await supabaseServer
    .from("company_usage_counters")
    .select("bucket,count,updated_at")
    .eq("company_id", company_id)
    .in("bucket", [min_bucket, day_bucket]);

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const byBucket = new Map<string, any>((counters || []).map((r: any) => [String(r.bucket), r]));
  const minute_count = Number(byBucket.get(min_bucket)?.count ?? 0);
  const day_count = Number(byBucket.get(day_bucket)?.count ?? 0);

  const remaining_minute = Math.max(0, effective_per_minute - minute_count);
  const remaining_day = Math.max(0, effective_per_day - day_count);

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

    // usage
    usage: {
      minute_bucket: min_bucket,
      day_bucket,
      minute_count,
      day_count,
      remaining_minute,
      remaining_day,
      reset_minute,
      reset_day,
    },
  });
}
