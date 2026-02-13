export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabaseServer";

function getSupabaseAuthServer() {
  const cookieStore = cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) throw new Error("missing_supabase_env_for_auth");

  return createServerClient(url, anon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = String(body?.token || "").trim();
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const supaAuth = getSupabaseAuthServer();
  const { data: u } = await supaAuth.auth.getUser();
  const user_id = u?.user?.id || null;
  const user_email = (u?.user?.email || "").toLowerCase();

  if (!user_id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: inv, error: iErr } = await supabaseServer
    .from("company_invites")
    .select("id, company_id, email, role, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle();

  if (iErr) return NextResponse.json({ error: "db_failed", details: iErr.message }, { status: 500 });
  if (!inv) return NextResponse.json({ error: "invite_not_found" }, { status: 404 });
  if (inv.accepted_at) return NextResponse.json({ error: "invite_already_used" }, { status: 409 });

  const exp = new Date(inv.expires_at).getTime();
  if (Date.now() > exp) return NextResponse.json({ error: "invite_expired" }, { status: 410 });

  if (String(inv.email || "").toLowerCase() !== user_email) {
    return NextResponse.json({ error: "email_mismatch" }, { status: 403 });
  }

  // upsert company_admins mapping
  const { error: mErr } = await supabaseServer
    .from("company_admins")
    .upsert(
      { company_id: inv.company_id, user_id, role: inv.role },
      { onConflict: "company_id,user_id" }
    );

  if (mErr) return NextResponse.json({ error: "mapping_failed", details: mErr.message }, { status: 500 });

  // mark invite accepted
  const { error: aErr } = await supabaseServer
    .from("company_invites")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user_id })
    .eq("id", inv.id);

  if (aErr) return NextResponse.json({ error: "invite_update_failed", details: aErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, company_id: inv.company_id, role: inv.role });
}
