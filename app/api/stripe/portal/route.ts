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
  if (!company_id) return NextResponse.json({ error: "company_id_required" }, { status: 400 });

  const { data: billing } = await supabaseServer
    .from("company_billing")
    .select("stripe_customer_id")
    .eq("company_id", company_id)
    .maybeSingle();

  const customerId = billing?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "no_stripe_customer_yet" }, { status: 400 });
  }

  const baseUrl = getBaseUrl(req);
  const returnUrl = `${baseUrl}/admin/companies/${encodeURIComponent(company_id)}?tab=billing`;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: session.url });
}
