import { supabaseServer } from "@/lib/supabaseServer";

export type BillingDecision =
  | { ok: true; plan_key: string; limits: { per_minute: number; per_day: number } }
  | { ok: false; code: "payment_required"; message: string };

function toInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function checkBillingGate(company_id: string): Promise<BillingDecision> {
  // 1) billing state
  const { data: billing, error: bErr } = await supabaseServer
    .from("company_billing")
    .select("status, plan_key")
    .eq("company_id", company_id)
    .maybeSingle();

  if (bErr) {
    return {
      ok: false,
      code: "payment_required",
      message: "Billing status could not be verified. Please try again later.",
    };
  }

  const status = String(billing?.status || "none");
  const plan_key = String(billing?.plan_key || "").trim();

  const active =
    status === "active" ||
    status === "trialing" ||
    status === "past_due"; // you can tighten later

  if (!active || !plan_key) {
    return {
      ok: false,
      code: "payment_required",
      message: "Bitte aktiviere ein Abonnement, um den Chat zu nutzen.",
    };
  }

  // 2) plan entitlements limits (ceiling)
  const { data: plan, error: pErr } = await supabaseServer
    .from("billing_plans")
    .select("plan_key, entitlements_json, is_active")
    .eq("plan_key", plan_key)
    .maybeSingle();

  if (pErr || !plan || !plan.is_active) {
    return {
      ok: false,
      code: "payment_required",
      message: "Dein Plan ist nicht aktiv. Bitte wähle einen gültigen Tarif.",
    };
  }

  const planRl = (plan.entitlements_json || {}).rate_limits || {};
  const plan_per_minute = clamp(toInt(planRl.per_minute, 10), 1, 600);
  const plan_per_day = clamp(toInt(planRl.per_day, 1000), 1, 200000);

  // 3) company_settings overrides (can only LOWER, never raise above plan)
  const { data: settings, error: sErr } = await supabaseServer
    .from("company_settings")
    .select("limits_json")
    .eq("company_id", company_id)
    .maybeSingle();

  if (sErr) {
    // fail closed: keep plan limits (still safe)
    return {
      ok: true,
      plan_key,
      limits: { per_minute: plan_per_minute, per_day: plan_per_day },
    };
  }

  const limits_json = settings?.limits_json || {};
  // support both: limits_json.chat.rate_limits or limits_json.rate_limits
  const chat = limits_json?.chat ?? limits_json ?? {};
  const companyRl = chat?.rate_limits ?? {};

  const company_per_minute = toInt(companyRl.per_minute, plan_per_minute);
  const company_per_day = toInt(companyRl.per_day, plan_per_day);

  const eff_per_minute = clamp(Math.min(plan_per_minute, company_per_minute), 1, 600);
  const eff_per_day = clamp(Math.min(plan_per_day, company_per_day), 1, 200000);

  return {
    ok: true,
    plan_key,
    limits: {
      per_minute: eff_per_minute,
      per_day: eff_per_day,
    },
  };
}
