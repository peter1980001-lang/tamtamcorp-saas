export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function genToken() {
  return crypto.randomBytes(24).toString("hex"); // 48 chars
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  // RBAC: owner oder admin dieser company
  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const email = body?.email ? normalizeEmail(body.email) : null;
  const role = String(body?.role || "admin"); // admin | agent | viewer (du kannst es einschränken)

  const allowedRoles = new Set(["admin", "agent", "viewer"]);
  const safeRole = allowedRoles.has(role) ? role : "admin";

  // 7 Tage gültig
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  let token = genToken();

  // Insert (retry bei token collision)
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabaseServer
      .from("company_invites")
      .insert({
        company_id,
        email,
        role: safeRole,
        token,
        expires_at: expiresAt,
        created_by: auth.user_id,
        status: "pending",
      })
      .select("id, company_id, email, role, token, expires_at, status, created_at")
      .maybeSingle();

    if (!error && data) {
      return NextResponse.json({
        invite: data,
        // Link für Copy/Paste
        link: `/invite/${data.token}`,
      });
    }

    // Wenn collision (unique token) -> neu versuchen
    token = genToken();
  }

  return NextResponse.json({ error: "invite_create_failed" }, { status: 500 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseServer
    .from("company_invites")
    .select("id, company_id, email, role, token, expires_at, status, created_at, used_at, used_by")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
}
