export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

function toRole(input: any) {
  const r = String(input || "").trim().toLowerCase();
  // must match your CHECK constraint values in company_admins.role
  if (r === "owner") return "owner";
  if (r === "admin") return "admin";
  if (r === "member") return "member";
  if (r === "viewer") return "viewer";
  return null;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const user_id = String(body?.user_id || "").trim();
  const role = toRole(body?.role);

  if (!user_id || !role) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const { data: updated, error: uErr } = await supabaseServer
    .from("company_admins")
    .update({ role })
    .eq("company_id", company_id)
    .eq("user_id", user_id)
    .select("id,company_id,user_id,role,created_at")
    .maybeSingle();

  if (uErr) return NextResponse.json({ error: "admin_role_update_failed", details: uErr.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "admin_not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, admin: updated }, { status: 200, headers: { "cache-control": "no-store" } });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const url = new URL(req.url);
  const user_id = String(url.searchParams.get("user_id") || "").trim();
  if (!user_id) return NextResponse.json({ error: "missing_user_id" }, { status: 400 });

  // Prevent deleting last admin mapping
  const { data: countRows, error: cErr } = await supabaseServer
    .from("company_admins")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id);

  if (cErr) return NextResponse.json({ error: "admin_count_failed", details: cErr.message }, { status: 500 });

  const total = Number((countRows as any)?.length ?? 0); // head:true returns empty array in some clients; count is not exposed here consistently
  // fallback: fetch rows count in a compatible way
  let effectiveCount = total;
  if (!Number.isFinite(effectiveCount) || effectiveCount <= 0) {
    const { data: rows2, error: c2Err } = await supabaseServer
      .from("company_admins")
      .select("id")
      .eq("company_id", company_id)
      .limit(1000);
    if (c2Err) return NextResponse.json({ error: "admin_count_failed", details: c2Err.message }, { status: 500 });
    effectiveCount = (rows2 ?? []).length;
  }

  if (effectiveCount <= 1) {
    return NextResponse.json({ error: "cannot_remove_last_admin" }, { status: 409, headers: { "cache-control": "no-store" } });
  }

  const { error: dErr } = await supabaseServer
    .from("company_admins")
    .delete()
    .eq("company_id", company_id)
    .eq("user_id", user_id);

  if (dErr) return NextResponse.json({ error: "admin_remove_failed", details: dErr.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } });
}
