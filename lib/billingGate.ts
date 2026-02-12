import { supabaseServer } from "@/lib/supabaseServer";

export type BillingDecision =
  | { ok: true; plan_key: string; limits: { per_minute: number; per_day: number } }
  | { ok: false; code: "payment_required"; message: string };

export async function checkBillingGate(company_id: string): Promise<BillingDecision> {
  // company_billing.plan_key comes from webhook mapping
  const { data: billing, error: bErr } = await supabaseServer
    .from("company_billing")
    .select("status, plan_key")
    .eq("company_id", company_id)
    .maybeSingle();

  if (bErr) {
    // fail closed
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
    status === "past_due"; // decide if you want to allow past_due; can change later

  if (!active || !plan_key) {
    return {
      ok: false,
      code: "payment_required",
      message: "Bitte aktiviere ein Abonnement, um den Chat zu nutzen.",
    };
  }

// IMPORTANT: we read entitlements_json.rate_limits
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

  const rl = (plan.entitlements_json || {}).rate_limits || {};
  const per_minute = Number(rl.per_minute ?? 10);
  const per_day = Number(rl.per_day ?? 1000);

  return {
    ok: true,
    plan_key,
    limits: {
      per_minute: Number.isFinite(per_minute) ? per_minute : 10,
      per_day: Number.isFinite(per_day) ? per_day : 1000,
    },
  };
}
