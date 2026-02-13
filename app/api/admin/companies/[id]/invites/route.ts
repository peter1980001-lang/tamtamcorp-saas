export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  const role = String(body?.role || "admin").trim();

  if (!email) return NextResponse.json({ error: "missing_email" }, { status: 400 });
  if (!["admin", "agent", "viewer"].includes(role)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  const token = makeToken();

  const { data, error } = await supabaseServer
    .from("company_invites")
    .insert({
      company_id,
      email,
      role,
      token,
      invited_by: auth.user_id,
    })
    .select("id, token, email, role, expires_at, created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const invite_url = `${appUrl.replace(/\/$/, "")}/invite/${token}`;

  return NextResponse.json({ invite: data, invite_url });
}
