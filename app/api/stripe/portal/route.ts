export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // apiVersion intentionally omitted to avoid TS mismatch across stripe package versions
});

function getBaseUrl(req: NextRequest) {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (envUrl) return envUrl.replace(/\/$/, "");

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  return `${proto}://${host}`.replace(/\/$/, "");
}

type Body = { company_id: string };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const company_id = String(body?.company_id || "").trim();
    if (!company_id) return NextResponse.json({ error: "company_id_required" }, { status: 400 });

    // Auth: platform owner OR company admin
    const guard = await requireCompanyAccess(company_id);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const { data: billing, error: bErr } = await supabaseServer
      .from("company_billing")
      .select("stripe_customer_id")
      .eq("company_id", company_id)
      .maybeSingle();

    if (bErr) return NextResponse.json({ error: "db_billing_failed", details: bErr.message }, { status: 500 });

    const customerId = (billing?.stripe_customer_id as string | null) ?? null;
    if (!customerId) return NextResponse.json({ error: "no_stripe_customer_yet" }, { status: 400 });

    const baseUrl = getBaseUrl(req);
    const returnUrl = `${baseUrl}/admin/companies/${company_id}?tab=billing`;

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portal.url });
  } catch (err: any) {
    return NextResponse.json({ error: "portal_failed", details: err?.message }, { status: 500 });
  }
}
