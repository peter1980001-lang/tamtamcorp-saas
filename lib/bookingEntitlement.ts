// lib/bookingEntitlement.ts
import { supabaseServer } from "@/lib/supabaseServer";

export type BookingEntitlement = {
  company_id: string;

  plan_key: string | null;
  status: string | null;
  current_period_end: string | null;

  is_pro: boolean;
  is_trialing: boolean;
  trial_active: boolean;

  can_view: boolean; // read-only always
  can_hold: boolean;
  can_book: boolean;

  reason?: string;
};

function isFutureIso(iso: string | null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > Date.now();
}

export async function getBookingEntitlement(company_id: string): Promise<BookingEntitlement> {
  const { data: billing, error } = await supabaseServer
    .from("company_billing")
    .select("plan_key,status,current_period_end")
    .eq("company_id", company_id)
    .maybeSingle();

  if (error) {
    // fail closed for booking actions
    return {
      company_id,
      plan_key: null,
      status: null,
      current_period_end: null,
      is_pro: false,
      is_trialing: false,
      trial_active: false,
      can_view: true,
      can_hold: false,
      can_book: false,
      reason: "Billing lookup failed.",
    };
  }

  const plan_key = (billing?.plan_key as string | null) ?? null;
  const status = (billing?.status as string | null) ?? null;
  const current_period_end = (billing?.current_period_end as string | null) ?? null;

  const is_pro = plan_key === "pro";
  const is_trialing = status === "trialing";
  const trial_active = is_trialing && isFutureIso(current_period_end);

  const can_hold = is_pro || trial_active;
  const can_book = is_pro || trial_active;

  const reason = can_book
    ? undefined
    : "Booking is available on the Pro plan. (Or during the 14-day trial.)";

  return {
    company_id,
    plan_key,
    status,
    current_period_end,

    is_pro,
    is_trialing,
    trial_active,

    can_view: true,
    can_hold,
    can_book,
    reason,
  };
}