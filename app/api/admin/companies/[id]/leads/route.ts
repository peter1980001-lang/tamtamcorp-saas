export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

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
    .limit(500);

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
  const status = body?.status;
  const lead_state = body?.lead_state;

  if (!lead_id) return NextResponse.json({ error: "missing_lead_id" }, { status: 400 });

  const patch: any = {};
  if (typeof status === "string") patch.status = status;
  if (typeof lead_state === "string") patch.lead_state = lead_state;

  const { data, error } = await supabaseServer
    .from("company_leads")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", lead_id)
    .eq("company_id", company_id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "no_ids_provided" }, { status: 400 });
  }

  // 🔒 tenant-scope enforced
  const { data, error } = await supabaseServer
    .from("company_leads")
    .delete()
    .eq("company_id", company_id)
    .in("id", ids)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "delete_failed", details: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted_ids: (data || []).map((r: any) => r.id) });
}