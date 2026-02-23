export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function startOfDayUtc(dateStr: string) {
  // dateStr = YYYY-MM-DD
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

function endOfDayUtc(dateStr: string) {
  return new Date(`${dateStr}T23:59:59.999Z`).toISOString();
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const url = new URL(req.url);
  const status = String(url.searchParams.get("status") || "upcoming").toLowerCase();
  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();

  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  let q = supabaseServer
    .from("company_appointments")
    .select(
      "id,company_id,start_at,end_at,status,source,title,description,contact_name,contact_email,contact_phone,conversation_id,company_lead_id,created_at",
      { count: "exact" }
    )
    .eq("company_id", company_id);

  // status filter
  if (status === "confirmed" || status === "pending" || status === "cancelled") {
    q = q.eq("status", status);
  } else if (status === "upcoming") {
    q = q.neq("status", "cancelled").gte("start_at", new Date().toISOString());
  } else {
    // "all" => no status restriction
  }

  // date range filters (UTC boundaries)
  if (from && isIsoDate(from)) q = q.gte("start_at", startOfDayUtc(from));
  if (to && isIsoDate(to)) q = q.lte("start_at", endOfDayUtc(to));

  const { data, error, count } = await q
    .order("start_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: "db_calendar_failed", details: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    count: count ?? null,
    appointments: data ?? [],
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const action = String(body?.action || "").toLowerCase();

  if (action !== "cancel") return NextResponse.json({ error: "unsupported_action" }, { status: 400 });

  const appointment_id = String(body?.appointment_id || "").trim();
  if (!appointment_id) return NextResponse.json({ error: "missing_appointment_id" }, { status: 400 });

  // update status -> cancelled (only within company)
  const { data, error } = await supabaseServer
    .from("company_appointments")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("company_id", company_id)
    .eq("id", appointment_id)
    .select("id,status")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_cancel_failed", details: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, appointment: data });
}