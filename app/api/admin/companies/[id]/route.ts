export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

type Role = "owner" | "admin" | "viewer";

function toRole(v: any): Role {
  const r = String(v || "").toLowerCase();
  if (r === "owner" || r === "admin" || r === "viewer") return r;
  return "admin";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth: any = await requireCompanyAccess(company_id);
  if (!auth?.ok) return NextResponse.json({ error: "forbidden" }, { status: auth?.status || 403 });

  // We try to read role/user_id from requireCompanyAccess (if it provides it).
  const authUserId = String(auth?.user_id || auth?.userId || auth?.uid || "").trim();
  const authRoleFromGuard: Role | null = auth?.role ? toRole(auth.role) : null;

  const [
    { data: company, error: cErr },
    { data: keysRow, error: kErr },
    { data: settingsRow, error: sErr },
    { data: adminsRows, error: aErr },
  ] = await Promise.all([
    supabaseServer
      .from("companies")
      .select("id, name, status, plan, stripe_customer_id, stripe_subscription_id, created_at, updated_at")
      .eq("id", company_id)
      .maybeSingle(),
    supabaseServer
      .from("company_keys")
      .select("company_id, public_key, secret_key, allowed_domains, created_at")
      .eq("company_id", company_id)
      .maybeSingle(),
    supabaseServer
      .from("company_settings")
      .select("company_id, limits_json, branding_json")
      .eq("company_id", company_id)
      .maybeSingle(),
    supabaseServer
      .from("company_admins")
      .select("id, company_id, user_id, role, created_at")
      .eq("company_id", company_id)
      .order("created_at", { ascending: false }),
  ]);

  if (cErr) return NextResponse.json({ error: "db_company_failed", details: cErr.message }, { status: 500 });
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (kErr) return NextResponse.json({ error: "db_keys_failed", details: kErr.message }, { status: 500 });
  if (sErr) return NextResponse.json({ error: "db_settings_failed", details: sErr.message }, { status: 500 });
  if (aErr) return NextResponse.json({ error: "db_admins_failed", details: aErr.message }, { status: 500 });

  // Determine my_role:
  // 1) If guard already gave role -> trust it.
  // 2) Else lookup in company_admins by auth user id.
  // 3) Else fallback to "admin" (never "owner" by accident).
  let my_role: Role = authRoleFromGuard ?? "admin";

  if (!authRoleFromGuard && authUserId) {
    const row = (adminsRows || []).find((a: any) => String(a.user_id) === authUserId);
    if (row?.role) my_role = toRole(row.role);
  }

  // Map user emails (best-effort).
  const userIds = Array.from(new Set((adminsRows || []).map((a: any) => String(a.user_id)).filter(Boolean)));

  let emailByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users, error: uErr } = await supabaseServer
      .from("auth.users")
      .select("id,email")
      .in("id", userIds);

    if (!uErr && Array.isArray(users)) {
      emailByUserId = new Map<string, string>(
        users.map((u: any) => [String(u.id), String(u.email || "")])
      );
    }
  }

  // SECURITY: only owner receives secret_key (even if UI hides it anyway).
  const includeSecret = my_role === "owner";

  return NextResponse.json({
    my_role,

    company,

    keys: keysRow
      ? {
          company_id: keysRow.company_id,
          public_key: keysRow.public_key,
          secret_key: includeSecret ? keysRow.secret_key : null, // ✅ protected
          allowed_domains: keysRow.allowed_domains ?? [],
          created_at: keysRow.created_at,
        }
      : null,

    settings: settingsRow
      ? {
          company_id: settingsRow.company_id,
          limits_json: settingsRow.limits_json ?? {},
          branding_json: settingsRow.branding_json ?? {},
        }
      : { company_id, limits_json: {}, branding_json: {} },

    admins: (adminsRows || []).map((a: any) => ({
      id: a.id,
      company_id: a.company_id,
      user_id: a.user_id,
      email: emailByUserId.get(String(a.user_id)) || null,
      role: a.role,
      created_at: a.created_at,
    })),
  });
}
