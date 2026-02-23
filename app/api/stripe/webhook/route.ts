// /api/stripe/webhooks/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // apiVersion intentionally omitted to avoid TS mismatch across stripe package versions
});

function toIsoOrNull(unixSeconds?: number | null) {
  if (!unixSeconds || typeof unixSeconds !== "number") return null;
  return new Date(unixSeconds * 1000).toISOString();
}

async function resolvePlanKey(stripe_price_id?: string | null) {
  if (!stripe_price_id) return null;
  const { data: plan } = await supabaseServer
    .from("billing_plans")
    .select("plan_key, is_active")
    .eq("stripe_price_id", stripe_price_id)
    .maybeSingle();

  if (!plan?.is_active) return null;
  return plan.plan_key ?? null;
}

async function upsertCompanyBilling(input: {
  company_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  status?: string | null;
  current_period_end?: string | null;
}) {
  const stripe_price_id = input.stripe_price_id ?? null;
  const plan_key = await resolvePlanKey(stripe_price_id);

  const payload = {
    company_id: input.company_id,
    stripe_customer_id: input.stripe_customer_id ?? null,
    stripe_subscription_id: input.stripe_subscription_id ?? null,
    stripe_price_id,
    plan_key,
    status: input.status ?? "none",
    current_period_end: input.current_period_end ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseServer
    .from("company_billing")
    .upsert(payload, { onConflict: "company_id" });

  if (error) throw new Error(`company_billing_upsert_failed: ${error.message}`);

  return { plan_key };
}

/**
 * Booking Trial:
 * - starter/growth: set booking_trial_ends_at = now + 14 days (on successful payment / subscription activation)
 * - pro: leave booking_trial_ends_at as-is (not needed), pro always has booking
 */
async function maybeStartBookingTrial(company_id: string, plan_key: string | null) {
  if (!company_id) return;

  // Only starter/growth get a 14-day calendar trial
  if (plan_key !== "starter" && plan_key !== "growth") return;

  // Set trial end = now + 14 days
  const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  // "Best effort": update if row exists; if it doesn't, ignore silently (you can ensure row exists at company create)
  const { error } = await supabaseServer
    .from("company_settings")
    .update({ booking_trial_ends_at: trialEnds, updated_at: new Date().toISOString() as any })
    .eq("company_id", company_id);

  // If company_settings row doesn't exist, Supabase returns 0 updated but no error.
  // If error is real (permissions, schema), throw.
  if (error) throw new Error(`booking_trial_update_failed: ${error.message}`);
}

async function findCompanyIdForSubscription(sub: Stripe.Subscription) {
  const customerId = (typeof sub.customer === "string" ? sub.customer : sub.customer?.id) || null;

  // 1) Best: subscription metadata
  const metaCompany = String((sub as any).metadata?.company_id || "").trim();
  if (metaCompany) return metaCompany;

  // 2) Lookup by subscription_id
  const bySub = await supabaseServer
    .from("company_billing")
    .select("company_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

  if (bySub.data?.company_id) return bySub.data.company_id;

  // 3) Lookup by customer_id
  if (customerId) {
    const byCustomer = await supabaseServer
      .from("company_billing")
      .select("company_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (byCustomer.data?.company_id) return byCustomer.data.company_id;
  }

  return null;
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "missing_STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_stripe_signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = Buffer.from(await req.arrayBuffer());
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: "invalid_signature", details: err?.message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const company_id = String(session.metadata?.company_id || session.client_reference_id || "").trim();
      const customerId =
        (typeof session.customer === "string" ? session.customer : session.customer?.id) || null;
      const subscriptionId =
        (typeof session.subscription === "string" ? session.subscription : session.subscription?.id) || null;

      if (company_id && subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price"],
        });

        const priceId = sub.items.data?.[0]?.price?.id ?? null;
        const currentPeriodEndUnix = (sub as any).current_period_end as number | undefined;

        // OPTIONAL BUT RECOMMENDED: ensure subscription carries company_id in metadata
        // so future subscription.updated events can map without DB lookup.
        try {
          const existingMeta = String((sub as any).metadata?.company_id || "").trim();
          if (!existingMeta) {
            await stripe.subscriptions.update(sub.id, {
              metadata: { ...(sub as any).metadata, company_id },
            });
          }
        } catch {
          // non-fatal
        }

        const { plan_key } = await upsertCompanyBilling({
          company_id,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          status: sub.status,
          current_period_end: toIsoOrNull(currentPeriodEndUnix ?? null),
        });

        // ✅ Start 14-day booking trial for starter/growth on successful checkout
        await maybeStartBookingTrial(company_id, plan_key ?? null);
      }

      return NextResponse.json({ received: true });
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const company_id = await findCompanyIdForSubscription(sub);
      if (!company_id) {
        return NextResponse.json({ received: true, ignored: true, reason: "company_id_not_resolved" });
      }

      const customerId =
        (typeof sub.customer === "string" ? sub.customer : sub.customer?.id) || null;
      const priceId = sub.items.data?.[0]?.price?.id ?? null;

      const currentPeriodEndUnix = (sub as any).current_period_end as number | undefined;

      const status =
        event.type === "customer.subscription.deleted" ? "canceled" : (sub.status as any);

      const { plan_key } = await upsertCompanyBilling({
        company_id,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId,
        status,
        current_period_end: toIsoOrNull(currentPeriodEndUnix ?? null),
      });

      // Optional: if a subscription becomes active/created again, re-start the trial window
      // for starter/growth. This is up to you; I’m enabling it because it matches "after payment".
      // If you don't want this on "updated", remove this line.
      if (event.type !== "customer.subscription.deleted") {
        await maybeStartBookingTrial(company_id, plan_key ?? null);
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: "webhook_handler_failed", details: err?.message }, { status: 500 });
  }
}