export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

function isPayingStatus(status: string) {
  return status === "active" || status === "trialing";
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
    Date.UTC(
      yyyy,
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      0,
      0
    )
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

async function ensureCompanyExists(companyId: string) {
  const { data: company, error: cErr } = await supabaseServer
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) {
    return { ok: false as const, status: 500, error: "db_company_failed", details: cErr.message };
  }
  if (!company) {
    return { ok: false as const, status: 404, error: "company_not_found" };
  }
  return { ok: true as const };
}

async function validatePlanKey(planKey: string) {
  const { data, error } = await supabaseServer
    .from("billing_plans")
    .select("plan_key,is_active")
    .eq("plan_key", planKey)
    .maybeSingle();

  if (error) {
    return { ok: false as const, status: 500, error: "db_plan_failed", details: error.message };
  }
  if (!data || !data.is_active) {
    return { ok: false as const, status: 400, error: "invalid_or_inactive_plan" };
  }
  return { ok: true as const };
}

/**
 * GET: billing + usage (for owner OR company-admin of this company)
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = createSupabaseServerClient();
  const { id } = await context.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const companyCheck = await ensureCompanyExists(company_id);
  if (!companyCheck.ok) {
    return NextResponse.json(
      { error: companyCheck.error, ...(companyCheck.details ? { details: companyCheck.details } : {}) },
      { status: companyCheck.status }
    );
  }

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

  const effective_per_minute =
    plan_per_minute > 0 ? Math.min(company_per_minute, plan_per_minute) : company_per_minute;
  const effective_per_day =
    plan_per_day > 0 ? Math.min(company_per_day, plan_per_day) : company_per_day;

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

    chat_enabled,
    chat_feature_enabled,
    paying_status,

    company_rate_limits: { per_minute: company_per_minute, per_day: company_per_day },
    plan_rate_limits: { per_minute: plan_per_minute, per_day: plan_per_day },
    effective_rate_limits: { per_minute: effective_per_minute, per_day: effective_per_day },

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

/**
 * POST: start/extend trial (for owner OR company-admin of this company)
 * Body: { days: number, plan_key: string }
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const days = Math.max(1, Math.min(60, toInt(body?.days, 14)));
  const plan_key = String(body?.plan_key || "").trim();

  if (!plan_key) {
    return NextResponse.json({ error: "plan_key_required" }, { status: 400 });
  }

  const companyCheck = await ensureCompanyExists(company_id);
  if (!companyCheck.ok) {
    return NextResponse.json(
      { error: companyCheck.error, ...(companyCheck.details ? { details: companyCheck.details } : {}) },
      { status: companyCheck.status }
    );
  }

  const planCheck = await validatePlanKey(plan_key);
  if (!planCheck.ok) {
    return NextResponse.json(
      { error: planCheck.error, ...(planCheck.details ? { details: planCheck.details } : {}) },
      { status: planCheck.status }
    );
  }

  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();
  const endIso = end.toISOString();

  const { error: upErr } = await supabaseServer
    .from("company_billing")
    .upsert(
      {
        company_id,
        plan_key,
        status: "trialing",
        current_period_end: endIso,
        updated_at: nowIso,
        created_at: nowIso,
      } as any,
      { onConflict: "company_id" }
    );

  if (upErr) {
    return NextResponse.json({ error: "trial_upsert_failed", details: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    company_id,
    status: "trialing",
    plan_key,
    current_period_end: endIso,
  });
}
