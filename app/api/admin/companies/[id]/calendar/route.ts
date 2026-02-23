export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { getBookingEntitlement } from "@/lib/bookingEntitlement";

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function startOfDayUtc(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

function endOfDayUtc(dateStr: string) {
  return new Date(`${dateStr}T23:59:59.999Z`).toISOString();
}

function asIso(d: Date) {
  return d.toISOString();
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
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

  if (action !== "cancel" && action !== "reschedule") {
    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  }

  const appointment_id = String(body?.appointment_id || "").trim();
  if (!appointment_id) return NextResponse.json({ error: "missing_appointment_id" }, { status: 400 });

  // CANCEL
  if (action === "cancel") {
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

  // RESCHEDULE (Pro or active trial)
  const ent = await getBookingEntitlement(company_id);
  if (!ent.can_book) {
    return NextResponse.json(
      {
        error: "booking_locked",
        message: ent.reason || "Booking is available on Pro plan (or during trial).",
        plan_key: ent.plan_key ?? null,
        status: (ent as any).status ?? null,
        trial_ends_at: (ent as any).current_period_end ?? null,
      },
      { status: 402 }
    );
  }

  const new_start_at = String(body?.new_start_at || "").trim();
  const new_end_at = String(body?.new_end_at || "").trim();

  if (!new_start_at || !new_end_at) {
    return NextResponse.json({ error: "missing_new_times" }, { status: 400 });
  }

  const ns = new Date(new_start_at);
  const ne = new Date(new_end_at);
  if (!Number.isFinite(ns.getTime()) || !Number.isFinite(ne.getTime()) || !(ne > ns)) {
    return NextResponse.json({ error: "invalid_new_times" }, { status: 400 });
  }

  // Load old appointment (within company)
  const { data: oldAppt, error: oErr } = await supabaseServer
    .from("company_appointments")
    .select("*")
    .eq("company_id", company_id)
    .eq("id", appointment_id)
    .maybeSingle();

  if (oErr) return NextResponse.json({ error: "db_load_old_failed", details: oErr.message }, { status: 500 });
  if (!oldAppt) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const oldStatus = String((oldAppt as any).status || "").toLowerCase();
  if (oldStatus === "cancelled") {
    return NextResponse.json({ error: "already_cancelled" }, { status: 409 });
  }

  // Conflict check against appointments + active holds
  const now = new Date();

  const { data: appts, error: aErr } = await supabaseServer
    .from("company_appointments")
    .select("id,start_at,end_at,status")
    .eq("company_id", company_id)
    .neq("status", "cancelled")
    .lte("start_at", asIso(ne))
    .gte("end_at", asIso(ns));

  if (aErr) return NextResponse.json({ error: "appointments_load_failed" }, { status: 500 });

  const { data: holds, error: hErr } = await supabaseServer
    .from("company_appointment_holds")
    .select("start_at,end_at,expires_at")
    .eq("company_id", company_id)
    .gt("expires_at", asIso(now))
    .lte("start_at", asIso(ne))
    .gte("end_at", asIso(ns));

  if (hErr) return NextResponse.json({ error: "holds_load_failed" }, { status: 500 });

  for (const a of appts || []) {
    const aid = String((a as any).id || "");
    if (aid === appointment_id) continue; // ignore itself
    const s = new Date(String((a as any).start_at));
    const e = new Date(String((a as any).end_at));
    if (intervalsOverlap(ns, ne, s, e)) return NextResponse.json({ error: "slot_taken" }, { status: 409 });
  }

  for (const h of holds || []) {
    const s = new Date(String((h as any).start_at));
    const e = new Date(String((h as any).end_at));
    if (intervalsOverlap(ns, ne, s, e)) return NextResponse.json({ error: "slot_held" }, { status: 409 });
  }

  // Create new appointment (copy key fields; link via meta)
  const oldMeta = ((oldAppt as any).meta ?? {}) as any;

  const insertPayload: any = {
    company_id,
    company_lead_id: (oldAppt as any).company_lead_id ?? null,
    conversation_id: (oldAppt as any).conversation_id ?? null,

    start_at: asIso(ns),
    end_at: asIso(ne),

    status: "confirmed",
    source: (oldAppt as any).source ?? "admin",

    title: (oldAppt as any).title ?? null,
    description: (oldAppt as any).description ?? null,

    contact_name: (oldAppt as any).contact_name ?? null,
    contact_email: (oldAppt as any).contact_email ?? null,
    contact_phone: (oldAppt as any).contact_phone ?? null,

    meta: {
      ...oldMeta,
      rescheduled_from: appointment_id,
    },
  };

  const { data: newAppt, error: iErr } = await supabaseServer
    .from("company_appointments")
    .insert(insertPayload)
    .select("*")
    .maybeSingle();

  if (iErr) return NextResponse.json({ error: "appointment_create_failed", details: iErr.message }, { status: 500 });
  if (!newAppt) return NextResponse.json({ error: "appointment_create_failed" }, { status: 500 });

  // Mark old as cancelled + link to new in meta
  const { error: uErr } = await supabaseServer
    .from("company_appointments")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
      meta: {
        ...oldMeta,
        rescheduled_to: String((newAppt as any).id),
      },
    })
    .eq("company_id", company_id)
    .eq("id", appointment_id);

  if (uErr) {
    // Worst case: new appointment exists but old didn't update.
    // Return ok but with warning.
    return NextResponse.json({
      ok: true,
      warning: "old_appointment_update_failed",
      old_id: appointment_id,
      new_id: String((newAppt as any).id),
    });
  }

  return NextResponse.json({
    ok: true,
    old_id: appointment_id,
    new_id: String((newAppt as any).id),
    appointment: newAppt,
  });
}