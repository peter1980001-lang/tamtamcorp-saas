// app/api/onboarding/state/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAuthServer } from "@/lib/supabaseAuthServer";
import { supabaseServer } from "@/lib/supabaseServer";

// Auth pattern: supabaseAuthServer verifies the session; supabaseServer (service role)
// is used for all DB queries because company_admins and user_onboarding require
// cross-table access that the anon-key client cannot do safely. Membership is
// enforced explicitly in code rather than relying on RLS.
async function getAuthedUser() {
  const supabase = await supabaseAuthServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/** GET /api/onboarding/state?company_id=:id */
export async function GET(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const company_id = String(req.nextUrl.searchParams.get("company_id") || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  // Verify user belongs to company
  const { data: membership, error: mErr } = await supabaseServer
    .from("company_admins")
    .select("role")
    .eq("company_id", company_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (mErr) return NextResponse.json({ error: "db_failed", details: mErr.message }, { status: 500 });
  if (!membership) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: row, error: rowErr } = await supabaseServer
    .from("user_onboarding")
    .select("wizard_done, dismissed_at")
    .eq("user_id", user.id)
    .eq("company_id", company_id)
    .maybeSingle();

  if (rowErr) return NextResponse.json({ error: "db_failed", details: rowErr.message }, { status: 500 });

  return NextResponse.json({
    wizard_done: row?.wizard_done ?? false,
    dismissed_at: row?.dismissed_at ?? null,
  });
}

/** POST /api/onboarding/state */
export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { action?: string; company_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action;
  const company_id = String(body.company_id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });
  if (!action || !["complete_wizard", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  // Verify user belongs to company
  const { data: membership, error: mErr } = await supabaseServer
    .from("company_admins")
    .select("role")
    .eq("company_id", company_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (mErr) return NextResponse.json({ error: "db_failed", details: mErr.message }, { status: 500 });
  if (!membership) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const validAction = action as "complete_wizard" | "dismiss";
  const patch =
    validAction === "complete_wizard"
      ? { wizard_done: true }
      : { dismissed_at: new Date().toISOString() };

  const { error: uErr } = await supabaseServer
    .from("user_onboarding")
    .upsert(
      { user_id: user.id, company_id, ...patch },
      { onConflict: "user_id,company_id" }
    );

  if (uErr) return NextResponse.json({ error: "db_failed", details: uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
