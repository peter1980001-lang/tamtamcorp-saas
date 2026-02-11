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

async function upsertCompanyBilling(input: {
  company_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  status?: string | null;
  current_period_end?: string | null;
}) {
  const payload = {
    company_id: input.company_id,
    stripe_customer_id: input.stripe_customer_id ?? null,
    stripe_subscription_id: input.stripe_subscription_id ?? null,
    stripe_price_id: input.stripe_price_id ?? null,
    status: input.status ?? "none",
    current_period_end: input.current_period_end ?? null,
  };

  // plan_key sync (denormalize) from billing_plans by stripe_price_id
  let plan_key: string | null = null;
  if (payload.stripe_price_id) {
    const { data: plan } = await supabaseServer
      .from("billing_plans")
      .select("plan_key")
      .eq("stripe_price_id", payload.stripe_price_id)
      .maybeSingle();
    plan_key = plan?.plan_key ?? null;
  }

  const { error } = await supabaseServer.from("company_billing").upsert({
    ...payload,
    plan_key,
  });

  if (error) throw new Error(`company_billing_upsert_failed: ${error.message}`);
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

      const company_id = String(session.metadata?.company_id || "").trim();
      const customerId =
        (typeof session.customer === "string" ? session.customer : session.customer?.id) || null;
      const subscriptionId =
        (typeof session.subscription === "string" ? session.subscription : session.subscription?.id) || null;

      if (company_id && subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price"],
        });

        const priceId = sub.items.data?.[0]?.price?.id ?? null;

        // Stripe typings sometimes lag behind actual fields -> safe access
        const currentPeriodEndUnix = (sub as any).current_period_end as number | undefined;

        await upsertCompanyBilling({
          company_id,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          status: sub.status,
          current_period_end: toIsoOrNull(currentPeriodEndUnix ?? null),
        });
      }

      return NextResponse.json({ received: true });
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const customerId =
        (typeof sub.customer === "string" ? sub.customer : sub.customer?.id) || null;
      const priceId = sub.items.data?.[0]?.price?.id ?? null;

      let company_id: string | null = null;

      const bySub = await supabaseServer
        .from("company_billing")
        .select("company_id")
        .eq("stripe_subscription_id", sub.id)
        .maybeSingle();

      if (bySub.data?.company_id) {
        company_id = bySub.data.company_id;
      } else if (customerId) {
        const byCustomer = await supabaseServer
          .from("company_billing")
          .select("company_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (byCustomer.data?.company_id) company_id = byCustomer.data.company_id;
      }

      if (!company_id) {
        company_id = String((sub as any).metadata?.company_id || "").trim() || null;
      }

      // Stripe typings sometimes lag behind actual fields -> safe access
      const currentPeriodEndUnix = (sub as any).current_period_end as number | undefined;

      if (company_id) {
        await upsertCompanyBilling({
          company_id,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          status: sub.status,
          current_period_end: toIsoOrNull(currentPeriodEndUnix ?? null),
        });
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: "webhook_handler_failed", details: err?.message }, { status: 500 });
  }
}
