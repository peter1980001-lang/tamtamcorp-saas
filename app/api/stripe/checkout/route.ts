export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // apiVersion intentionally omitted to avoid TS mismatch across stripe package versions
});

function getBaseUrl(req: NextRequest) {
  // Prefer explicit public URL envs if present
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (envUrl) return envUrl.replace(/\/$/, "");

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  return `${proto}://${host}`.replace(/\/$/, "");
}

type Body = {
  company_id: string;
  plan_key: "starter" | "growth" | "pro";
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const company_id = String(body?.company_id || "").trim();
    const plan_key = String(body?.plan_key || "").trim() as Body["plan_key"];

    if (!company_id) return NextResponse.json({ error: "company_id_required" }, { status: 400 });
    if (!["starter", "growth", "pro"].includes(plan_key))
      return NextResponse.json({ error: "invalid_plan_key" }, { status: 400 });

    // Auth: platform owner OR company admin
    const guard = await requireCompanyAccess(company_id);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    // Verify company exists
    const { data: company, error: cErr } = await supabaseServer
      .from("companies")
      .select("id,name")
      .eq("id", company_id)
      .maybeSingle();

    if (cErr) return NextResponse.json({ error: "db_company_failed", details: cErr.message }, { status: 500 });
    if (!company) return NextResponse.json({ error: "company_not_found" }, { status: 404 });

    // Load plan by plan_key -> must have stripe_price_id
    const { data: plan, error: pErr } = await supabaseServer
      .from("billing_plans")
      .select("plan_key,name,stripe_price_id,is_active")
      .eq("plan_key", plan_key)
      .maybeSingle();

    if (pErr) return NextResponse.json({ error: "db_plan_failed", details: pErr.message }, { status: 500 });
    if (!plan || !plan.is_active) return NextResponse.json({ error: "plan_not_available" }, { status: 400 });
    if (!plan.stripe_price_id) return NextResponse.json({ error: "plan_missing_stripe_price_id" }, { status: 500 });

    // Reuse existing Stripe customer if we already have one
    const { data: billingRow, error: bErr } = await supabaseServer
      .from("company_billing")
      .select("stripe_customer_id")
      .eq("company_id", company_id)
      .maybeSingle();

    if (bErr) return NextResponse.json({ error: "db_billing_failed", details: bErr.message }, { status: 500 });

    let stripeCustomerId = (billingRow?.stripe_customer_id as string | null) ?? null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: company.name || undefined,
        metadata: {
          company_id,
        },
      });
      stripeCustomerId = customer.id;

      // Store customer immediately (so portal works even before webhook)
      await supabaseServer.from("company_billing").upsert({
        company_id,
        stripe_customer_id: stripeCustomerId,
        status: "none",
      });
    }

    const baseUrl = getBaseUrl(req);
    const successUrl = `${baseUrl}/admin/companies/${company_id}?tab=billing&checkout=success`;
    const cancelUrl = `${baseUrl}/admin/companies/${company_id}?tab=billing&checkout=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        company_id,
        plan_key: plan.plan_key,
      },
      subscription_data: {
        metadata: {
          company_id,
          plan_key: plan.plan_key,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: "checkout_failed", details: err?.message }, { status: 500 });
  }
}
