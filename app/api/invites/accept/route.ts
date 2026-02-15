export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function getBearer(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function POST(req: NextRequest) {
  const accessToken = getBearer(req);
  if (!accessToken) {
    return NextResponse.json(
      { error: "missing_access_token" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  const { data: userRes, error: uErr } = await supabaseServer.auth.getUser(accessToken);
  const user = userRes?.user;

  if (uErr || !user?.id) {
    return NextResponse.json(
      { error: "invalid_access_token" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const token = String(body?.token || "").trim();
  if (!token) {
    return NextResponse.json(
      { error: "missing_token" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  // Load invite
  const { data: invite, error: iErr } = await supabaseServer
    .from("company_invites")
    .select("id,company_id,role,status,expires_at")
    .eq("token", token)
    .maybeSingle();

  if (iErr) {
    return NextResponse.json(
      { error: "invite_load_failed", details: iErr.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  if (!invite) {
    return NextResponse.json(
      { error: "invite_not_found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    );
  }

  const status = String(invite.status || "").toLowerCase();
  if (status !== "pending") {
    return NextResponse.json(
      { error: "invite_not_pending", status },
      { status: 409, headers: { "cache-control": "no-store" } }
    );
  }

  const exp = new Date(String(invite.expires_at));
  if (!invite.expires_at || Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
    // mark expired
    await supabaseServer
      .from("company_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);

    return NextResponse.json(
      { error: "invite_expired" },
      { status: 410, headers: { "cache-control": "no-store" } }
    );
  }

  // Add mapping (company_admins)
  const company_id = String(invite.company_id);
  const role = String(invite.role || "admin");

  const { error: mapErr } = await supabaseServer
    .from("company_admins")
    .upsert(
      [{ company_id, user_id: user.id, role } as any],
      { onConflict: "company_id,user_id" }
    );

  if (mapErr) {
    return NextResponse.json(
      { error: "company_admins_upsert_failed", details: mapErr.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  // Mark invite accepted
  const { error: accErr } = await supabaseServer
    .from("company_invites")
    .update({
      status: "accepted",
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  if (accErr) {
    return NextResponse.json(
      { error: "invite_accept_failed", details: accErr.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, company_id },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
