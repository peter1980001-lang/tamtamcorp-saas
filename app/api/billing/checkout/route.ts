import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

// Sicherheits-Helfer: nur gültige price_ids erlauben (aus DB)
async function getPlanByPriceId(priceId: string) {
  const { data, error } = await supabaseServer
    .from("billing_plans")
    .select("plan_key, stripe_price_id, is_active")
    .eq("stripe_price_id", priceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || !data.is_active) return null;
  return data;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const company_id = String(body?.company_id || "").trim();
    const price_id = String(body?.price_id || "").trim();

    if (!company_id || !price_id) {
      return NextResponse.json({ error: "company_id_and_price_id_required" }, { status: 400 });
    }

    // price_id muss zu einem aktiven Plan in unserer DB passen (kein Stripe-price injection)
    const plan = await getPlanByPriceId(price_id);
    if (!plan) {
      return NextResponse.json({ error: "invalid_or_inactive_price" }, { status: 400 });
    }

    // optional: company exists?
    const { data: company, error: cErr } = await supabaseServer
      .from("companies")
      .select("id, name")
      .eq("id", company_id)
      .maybeSingle();

    if (cErr) {
      return NextResponse.json({ error: "db_company_failed", details: cErr.message }, { status: 500 });
    }
    if (!company) {
      return NextResponse.json({ error: "company_not_found" }, { status: 404 });
    }

    // success/cancel URLs (Front-End kann später schöne Pages anbieten)
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL?.startsWith("http")
        ? process.env.VERCEL_URL
        : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "";

    if (!appUrl) {
      return NextResponse.json(
        { error: "missing_app_url", hint: "set NEXT_PUBLIC_APP_URL in Vercel env" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price_id, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${appUrl}/admin/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/admin/billing/cancel`,
      subscription_data: {
        metadata: {
          company_id,
        },
      },
      metadata: {
        company_id,
      },
      client_reference_id: company_id,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: "checkout_failed", details: err?.message }, { status: 500 });
  }
}
