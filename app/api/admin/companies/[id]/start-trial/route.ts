export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function toInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  // ✅ Owner OR admin of THIS company
  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({} as any));
  const plan_key = String(body?.plan_key || "dev_test").trim();
  const days = Math.max(1, Math.min(60, toInt(body?.days, 14)));

  const { data: plan, error: pErr } = await supabaseServer
    .from("billing_plans")
    .select("plan_key, is_active")
    .eq("plan_key", plan_key)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!plan?.is_active) {
    return NextResponse.json({ error: "plan_not_found_or_inactive" }, { status: 400 });
  }

  const current_period_end = addDaysIso(days);

  const { error: bErr } = await supabaseServer
    .from("company_billing")
    .upsert(
      {
        company_id,
        status: "trialing",
        plan_key,
        current_period_end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id" }
    );

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    company_id,
    status: "trialing",
    plan_key,
    current_period_end,
  });
}
