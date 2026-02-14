export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

function getBaseUrl(req: Request) {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const host = req.headers.get("host");
  return host ? `https://${host}` : "http://localhost:3000";
}

export async function POST(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const company_id = String(body?.company_id || "").trim();
  const plan_key = String(body?.plan_key || "").trim(); // starter/growth/pro

  if (!company_id || !plan_key) {
    return NextResponse.json({ error: "company_id_and_plan_key_required" }, { status: 400 });
  }

  // Find plan -> stripe_price_id
  const { data: plan, error: pErr } = await supabaseServer
    .from("billing_plans")
    .select("plan_key, stripe_price_id, is_active")
    .eq("plan_key", plan_key)
    .maybeSingle();

  if (pErr || !plan?.is_active || !plan?.stripe_price_id) {
    return NextResponse.json({ error: "plan_not_found_or_inactive" }, { status: 400 });
  }

  // Optional: reuse stored stripe_customer_id
  const { data: company } = await supabaseServer
    .from("companies")
    .select("id, stripe_customer_id")
    .eq("id", company_id)
    .maybeSingle();

  const baseUrl = getBaseUrl(req);
  const returnUrl = `${baseUrl}/admin/companies/${encodeURIComponent(company_id)}?tab=billing`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    allow_promotion_codes: true,

    // Critical: mapping for webhook -> company
    client_reference_id: company_id,
    metadata: { company_id, plan_key },

    ...(company?.stripe_customer_id ? { customer: company.stripe_customer_id } : {}),

    success_url: `${returnUrl}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}&checkout=cancel`,
  });

  return NextResponse.json({ url: session.url });
}
