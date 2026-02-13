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

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const t = String(token || "").trim();
  if (!t) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  // Muss eingeloggt sein (Supabase Auth)
  const supabase = getSupabaseAuthServer();
  const { data: u, error: uErr } = await supabase.auth.getUser();
  const user_id = u?.user?.id;

  if (uErr || !user_id) {
    return NextResponse.json({ error: "unauthorized_login_required" }, { status: 401 });
  }

  // Invite prüfen
  const { data: inv, error: invErr } = await supabaseServer
    .from("company_invites")
    .select("id, company_id, email, role, token, expires_at, status, used_at")
    .eq("token", t)
    .maybeSingle();

  if (invErr) return NextResponse.json({ error: "db_failed", details: invErr.message }, { status: 500 });
  if (!inv) return NextResponse.json({ error: "invalid_invite" }, { status: 404 });

  if (inv.used_at || inv.status === "used") {
    return NextResponse.json({ error: "invite_already_used" }, { status: 409 });
  }

  const exp = inv.expires_at ? new Date(inv.expires_at).getTime() : 0;
  if (exp && Date.now() > exp) {
    return NextResponse.json({ error: "invite_expired" }, { status: 410 });
  }

  // Optional: wenn invite email gesetzt ist, muss user.email matchen
  if (inv.email) {
    const userEmail = String(u.user?.email || "").toLowerCase();
    if (!userEmail || userEmail !== String(inv.email).toLowerCase()) {
      return NextResponse.json({ error: "invite_email_mismatch" }, { status: 403 });
    }
  }

  const role = String(inv.role || "admin");

  // Mapping setzen
  const { error: upErr } = await supabaseServer.from("company_admins").upsert(
    {
      company_id: inv.company_id,
      user_id,
      role,
      created_at: new Date().toISOString(),
    },
    { onConflict: "company_id,user_id" }
  );

  if (upErr) return NextResponse.json({ error: "grant_failed", details: upErr.message }, { status: 500 });

  // Invite als used markieren
  const { error: markErr } = await supabaseServer
    .from("company_invites")
    .update({
      status: "used",
      used_at: new Date().toISOString(),
      used_by: user_id,
    })
    .eq("id", inv.id);

  if (markErr) return NextResponse.json({ error: "invite_mark_used_failed", details: markErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, company_id: inv.company_id, role });
}
