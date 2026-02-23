// app/api/book/[public_key]/hold/route.ts
export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveCompanyByPublicKey } from "@/lib/publicBooking";
import { getBookingEntitlement } from "@/lib/bookingEntitlement";

function asIso(d: Date) {
  return d.toISOString();
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export async function POST(req: NextRequest, context: { params: Promise<{ public_key: string }> }) {
  const { public_key } = await context.params;

  const company = await resolveCompanyByPublicKey(public_key);
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // ✅ booking gate: Pro OR active trial
  const ent = await getBookingEntitlement(company.company_id);
  if (!ent.can_hold) {
    return NextResponse.json(
      {
        error: "booking_locked",
        message: ent.reason,
        plan_key: ent.plan_key,
        status: (ent as any).status ?? null,
        trial_ends_at: (ent as any).current_period_end ?? null,
      },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => null);

  const start_at = String(body?.start_at || "").trim();
  const end_at = String(body?.end_at || "").trim();
  const meta = body?.meta ?? {};

  if (!start_at || !end_at) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const start = new Date(start_at);
  const end = new Date(end_at);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || !(end > start)) {
    return NextResponse.json({ error: "invalid_time" }, { status: 400 });
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 10 * 60_000);

  // Conflict check against appointments + active holds
  const { data: appts, error: aErr } = await supabaseServer
    .from("company_appointments")
    .select("start_at,end_at,status")
    .eq("company_id", company.company_id)
    .neq("status", "cancelled")
    .lte("start_at", asIso(end))
    .gte("end_at", asIso(start));

  if (aErr) return NextResponse.json({ error: "appointments_load_failed" }, { status: 500 });

  const { data: holds, error: hErr } = await supabaseServer
    .from("company_appointment_holds")
    .select("start_at,end_at,expires_at")
    .eq("company_id", company.company_id)
    .gt("expires_at", asIso(now))
    .lte("start_at", asIso(end))
    .gte("end_at", asIso(start));

  if (hErr) return NextResponse.json({ error: "holds_load_failed" }, { status: 500 });

  for (const a of appts || []) {
    const s = new Date(String((a as any).start_at));
    const e = new Date(String((a as any).end_at));
    if (intervalsOverlap(start, end, s, e)) return NextResponse.json({ error: "slot_taken" }, { status: 409 });
  }
  for (const h of holds || []) {
    const s = new Date(String((h as any).start_at));
    const e = new Date(String((h as any).end_at));
    if (intervalsOverlap(start, end, s, e)) return NextResponse.json({ error: "slot_held" }, { status: 409 });
  }

  const hold_token = crypto.randomBytes(24).toString("hex");

  const { error: iErr } = await supabaseServer.from("company_appointment_holds").insert({
    company_id: company.company_id,
    hold_token,
    start_at: asIso(start),
    end_at: asIso(end),
    expires_at: asIso(expires),
    // public booking page: no conversation_id, no company_lead_id by default
    conversation_id: null,
    company_lead_id: null,
    meta,
  });

  if (iErr) return NextResponse.json({ error: "hold_create_failed" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    hold_token,
    expires_at: asIso(expires),
    start_at: asIso(start),
    end_at: asIso(end),
  });
}