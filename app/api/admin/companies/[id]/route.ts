export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireCompanyAccess } from "@/lib/adminGuard";

export async function GET(
  const supabase = createSupabaseServerClient();
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();

  if (!company_id) {
    return NextResponse.json(
      { error: "missing_company_id" },
      { status: 400 }
    );
  }

  // 🔵 User Context (RLS aktiv)
  const supabase = createSupabaseServerClient();

  // Zugriff prüfen (dein bestehender Guard)
  const guard = await requireCompanyAccess(company_id);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error || "forbidden" },
      { status: 403 }
    );
  }

  // Company laden (RLS greift hier!)
  const { data: company, error: cErr } = await supabase
    .from("companies")
    .select("*")
    .eq("id", company_id)
    .maybeSingle();

  if (cErr || !company) {
    return NextResponse.json(
      { error: "company_not_found" },
      { status: 404 }
    );
  }

  // Company Admins laden (RLS greift)
  const { data: admins, error: aErr } = await supabase
    .from("company_admins")
    .select("id, user_id, role, created_at")
    .eq("company_id", company_id);

  if (aErr) {
    return NextResponse.json(
      { error: "failed_to_load_admins" },
      { status: 500 }
    );
  }

  const userIds = (admins || []).map((a: any) => a.user_id);

  let emailByUserId = new Map<string, string>();

  // 🔴 SYSTEM-ZUGRIFF (auth.users braucht Service Role)
  if (userIds.length > 0) {
    const { data: users, error: uErr } = await supabaseAdmin
      .from("auth.users")
      .select("id,email")
      .in("id", userIds);

    if (!uErr && Array.isArray(users)) {
      emailByUserId = new Map(
        users.map((u: any) => [
          String(u.id),
          String(u.email || ""),
        ])
      );
    }
  }

  const enrichedAdmins = (admins || []).map((a: any) => ({
    ...a,
    email: emailByUserId.get(String(a.user_id)) || null,
  }));

  return NextResponse.json({
    company,
    admins: enrichedAdmins,
  });
}