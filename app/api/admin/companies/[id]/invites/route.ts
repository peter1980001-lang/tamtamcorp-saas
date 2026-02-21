export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";
import crypto from "crypto";

function toRole(input: any) {
  const r = String(input || "").trim().toLowerCase();
  // must match your company_admins.role CHECK constraint values
  if (r === "owner") return "owner";
  if (r === "admin") return "admin";
  if (r === "member") return "member";
  if (r === "viewer") return "viewer";
  // fallback (safe)
  return "admin";
}

export async function GET(
  const supabase = createSupabaseServerClient();
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: company_id } = await context.params;
  await requireCompanyAccess(company_id);

  const { data: admins, error: aErr } = await supabaseServer
    .from("company_admins")
    .select("id,company_id,user_id,role,created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false });

  if (aErr) {
    return NextResponse.json(
      { error: "admins_load_failed", details: aErr.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const { data: invites, error: iErr } = await supabaseServer
    .from("company_invites")
    .select("id,company_id,token,email,role,status,expires_at,created_by,accepted_by,accepted_at,created_at,updated_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (iErr) {
    return NextResponse.json(
      { error: "invites_load_failed", details: iErr.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, admins: admins ?? [], invites: invites ?? [] },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: company_id } = await context.params;
  await requireCompanyAccess(company_id);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const role = toRole(body?.role);
  const email = body?.email ? String(body.email).trim() : null;

  const token = crypto.randomUUID();
  const expiresDays = Math.max(1, Math.min(30, Number(body?.expires_days ?? 7)));
  const expires_at = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error: insErr } = await supabaseServer
    .from("company_invites")
    .insert({
      company_id,
      token,
      email,
      role,
      status: "pending",
      expires_at,
    })
    .select("id,company_id,token,email,role,status,expires_at,created_at")
    .single();

  if (insErr) {
    return NextResponse.json(
      { error: "invite_create_failed", details: insErr.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, invite },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: company_id } = await context.params;
  await requireCompanyAccess(company_id);

  const url = new URL(req.url);
  const invite_id = String(url.searchParams.get("invite_id") || "").trim();
  if (!invite_id) {
    return NextResponse.json(
      { error: "missing_invite_id" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const { data: updated, error: uErr } = await supabaseServer
    .from("company_invites")
    .update({ status: "revoked" })
    .eq("company_id", company_id)
    .eq("id", invite_id)
    .select("id,status,updated_at")
    .single();

  if (uErr) {
    return NextResponse.json(
      { error: "invite_revoke_failed", details: uErr.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, invite: updated },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
