export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // new/contacted/closed/all
  const band = url.searchParams.get("band");     // hot/warm/cold/all
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(500, Math.max(20, Number(url.searchParams.get("limit") || 200)));

  // Base query: join companies for name (for inbox)
  let query = supabaseServer
    .from("company_leads")
    .select("id, company_id, conversation_id, lead_state, status, name, email, phone, score_total, score_band, intent_score, qualification_json, consents_json, last_touch_at, created_at, assigned_to, assigned_at, admin_notes, companies(name)")
    .order("last_touch_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") query = query.eq("status", status);
  if (band && band !== "all") query = query.eq("score_band", band);

  // optional: simple search (email/phone/name)
  // Supabase 'ilike' is case-insensitive but not for json; keep basic.
  if (q) {
    // note: or() needs comma-separated conditions
    query = query.or(`email.ilike.%${q}%,phone.ilike.%${q}%,name.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ leads: data ?? [] });
}

export async function PATCH(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);

  const lead_id = String(body?.lead_id || "").trim();
  if (!lead_id) return NextResponse.json({ error: "missing_lead_id" }, { status: 400 });

  const patch: Record<string, any> = {};
  if (body?.status) patch.status = String(body.status).trim();
  if (body?.lead_state) patch.lead_state = String(body.lead_state).trim();
  if (typeof body?.admin_notes === "string") patch.admin_notes = body.admin_notes;

  // Assign/unassign
  if (body?.assign === "me") {
    // for now: owner identity not tracked; use a constant or auth email if you have it
    patch.assigned_to = "owner";
    patch.assigned_at = new Date().toISOString();
  }
  if (body?.assign === "clear") {
    patch.assigned_to = null;
    patch.assigned_at = null;
  }

  patch.last_touch_at = new Date().toISOString();

  const { data, error } = await supabaseServer
    .from("company_leads")
    .update(patch)
    .eq("id", lead_id)
    .select("id, company_id, conversation_id, lead_state, status, name, email, phone, score_total, score_band, intent_score, qualification_json, consents_json, last_touch_at, created_at, assigned_to, assigned_at, admin_notes")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_update_failed", details: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "lead_not_found" }, { status: 404 });

  return NextResponse.json({ lead: data });
}
