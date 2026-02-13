export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { data, error } = await supabaseServer
    .from("company_leads")
    .select("*")
    .eq("company_id", company_id)
    .order("last_touch_at", { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });
  return NextResponse.json({ leads: data || [] });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const lead_id = String(body?.lead_id || "").trim();
  const status = body?.status ? String(body.status) : null;
  const lead_state = body?.lead_state ? String(body.lead_state) : null;

  if (!lead_id) return NextResponse.json({ error: "missing_lead_id" }, { status: 400 });

  const patch: any = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  if (lead_state) patch.lead_state = lead_state;

  const { data, error } = await supabaseServer
    .from("company_leads")
    .update(patch)
    .eq("id", lead_id)
    .eq("company_id", company_id)
    .select("*")
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "update_failed", details: error?.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}
