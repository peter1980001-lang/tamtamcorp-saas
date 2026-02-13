export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("company_admins")
    .select("id, company_id, user_id, role, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });
  return NextResponse.json({ admins: data ?? [] });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const user_id = String(body?.user_id || "").trim();
  const role = String(body?.role || "admin").trim();

  if (!user_id) return NextResponse.json({ error: "missing_user_id" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("company_admins")
    .upsert({ company_id, user_id, role }, { onConflict: "company_id,user_id" })
    .select("id, company_id, user_id, role, created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });
  return NextResponse.json({ admin: data });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const url = new URL(req.url);
  const admin_id = String(url.searchParams.get("admin_id") || "").trim();
  if (!admin_id) return NextResponse.json({ error: "missing_admin_id" }, { status: 400 });

  const { error } = await supabaseServer.from("company_admins").delete().eq("id", admin_id).eq("company_id", company_id);
  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
