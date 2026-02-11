import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

function getAppUrl() {
  // Prefer explicit URL
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  // Vercel provides VERCEL_URL without protocol
  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
  }

  return "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const company_id = String(body?.company_id || "").trim();

    if (!company_id) {
      return NextResponse.json({ error: "company_id_required" }, { status: 400 });
    }

    const appUrl = getAppUrl();
    if (!appUrl) {
      return NextResponse.json(
        { error: "missing_app_url", hint: "set NEXT_PUBLIC_APP_URL in Vercel env" },
        { status: 500 }
      );
    }

    const { data: billing, error: bErr } = await supabaseServer
      .from("company_billing")
      .select("stripe_customer_id")
      .eq("company_id", company_id)
      .maybeSingle();

    if (bErr) {
      return NextResponse.json({ error: "db_billing_failed", details: bErr.message }, { status: 500 });
    }

    const customerId = String(billing?.stripe_customer_id || "").trim();
    if (!customerId) {
      return NextResponse.json(
        { error: "no_stripe_customer", hint: "customer created after first checkout" },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/admin/companies/${company_id}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: "portal_failed", details: err?.message }, { status: 500 });
  }
}
