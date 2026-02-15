export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { id } = await context.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const { data: billing, error: bErr } = await supabaseServer
    .from("company_billing")
    .select(
      "company_id,status,plan_key,stripe_price_id,stripe_customer_id,stripe_subscription_id,current_period_end,updated_at,created_at"
    )
    .eq("company_id", company_id)
    .maybeSingle();

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  // Optional plan enrichment
  let plan: any = null;

  if (billing?.plan_key) {
    const { data: p, error: pErr } = await supabaseServer
      .from("billing_plans")
      .select("plan_key,name,is_active,stripe_price_id,entitlements_json")
      .eq("plan_key", billing.plan_key)
      .maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    plan = p ?? null;
  } else if (billing?.stripe_price_id) {
    const { data: p, error: pErr } = await supabaseServer
      .from("billing_plans")
      .select("plan_key,name,is_active,stripe_price_id,entitlements_json")
      .eq("stripe_price_id", billing.stripe_price_id)
      .maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    plan = p ?? null;
  }

  return NextResponse.json({
    billing: billing ?? null,
    plan,
  });
}
