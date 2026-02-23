// app/api/book/[public_key]/book/route.ts
export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveCompanyByPublicKey } from "@/lib/publicBooking";
import { getBookingEntitlement } from "@/lib/bookingEntitlement";
import { findOrCreateCompanyLead, updateLeadBookingSignals } from "@/lib/leadMerge";

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
  if (!ent.can_book) {
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

  const hold_token = String(body?.hold_token || "").trim();
  if (!hold_token) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  // Contact fields from body (may be missing if client only sends them on /hold)
  const body_contact_name = body?.contact_name ? String(body.contact_name).trim() : null;
  const body_contact_email = body?.contact_email ? String(body.contact_email).trim().toLowerCase() : null;
  const body_contact_phone = body?.contact_phone ? String(body.contact_phone).trim() : null;

  const now = new Date();

  // Fetch hold
  const { data: hold, error: hErr } = await supabaseServer
    .from("company_appointment_holds")
    .select("*")
    .eq("company_id", company.company_id)
    .eq("hold_token", hold_token)
    .maybeSingle();

  if (hErr) return NextResponse.json({ error: "hold_lookup_failed" }, { status: 500 });
  if (!hold) return NextResponse.json({ error: "hold_not_found" }, { status: 404 });

  const expires_at = new Date(String((hold as any).expires_at));
  if (!(expires_at > now)) return NextResponse.json({ error: "hold_expired" }, { status: 410 });

  const start = new Date(String((hold as any).start_at));
  const end = new Date(String((hold as any).end_at));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || !(end > start)) {
    return NextResponse.json({ error: "hold_invalid_time" }, { status: 500 });
  }

  // ✅ Fallback contact from hold.meta.contact (written by /hold route)
  const holdMeta = ((hold as any).meta ?? {}) as any;
  const holdContact = (holdMeta?.contact ?? {}) as any;

  const contact_name = body_contact_name ?? (holdContact?.name ? String(holdContact.name).trim() : null);
  const contact_email =
    body_contact_email ??
    (holdContact?.email ? String(holdContact.email).trim().toLowerCase() : null);
  const contact_phone = body_contact_phone ?? (holdContact?.phone ? String(holdContact.phone).trim() : null);

  // ✅ Public Booking V2: resolve or create lead (email/phone merge)
  const lead = await findOrCreateCompanyLead({
    company_id: company.company_id,
    conversation_id: null, // leadMerge will create a conversation if missing
    name: contact_name,
    email: contact_email,
    phone: contact_phone,
    source: "public_booking",
  });

  // Final conflict check (appointments + active holds excluding current hold)
  const { data: appts, error: aErr } = await supabaseServer
    .from("company_appointments")
    .select("start_at,end_at,status")
    .eq("company_id", company.company_id)
    .neq("status", "cancelled")
    .lte("start_at", asIso(end))
    .gte("end_at", asIso(start));

  if (aErr) return NextResponse.json({ error: "appointments_load_failed" }, { status: 500 });

  const { data: holds, error: holdsErr } = await supabaseServer
    .from("company_appointment_holds")
    .select("start_at,end_at,expires_at,hold_token")
    .eq("company_id", company.company_id)
    .gt("expires_at", asIso(now))
    .neq("hold_token", hold_token)
    .lte("start_at", asIso(end))
    .gte("end_at", asIso(start));

  if (holdsErr) return NextResponse.json({ error: "holds_load_failed" }, { status: 500 });

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

  // Consume hold (single-use)
  const { data: deleted, error: dErr } = await supabaseServer
    .from("company_appointment_holds")
    .delete()
    .eq("company_id", company.company_id)
    .eq("hold_token", hold_token)
    .gt("expires_at", asIso(now))
    .select("id")
    .maybeSingle();

  if (dErr) return NextResponse.json({ error: "hold_consume_failed" }, { status: 500 });
  if (!deleted) return NextResponse.json({ error: "hold_already_used" }, { status: 409 });

  // Create appointment (Public Booking V2: linked to company_leads)
  const { data: appt, error: iErr } = await supabaseServer
    .from("company_appointments")
    .insert({
      company_id: company.company_id,
      company_lead_id: String((lead as any).id),
      conversation_id: null,

      start_at: asIso(start),
      end_at: asIso(end),

      status: "confirmed",
      source: "public_booking",

      title: null,
      description: null,

      contact_name,
      contact_email,
      contact_phone,

      meta: {
        hold_meta: holdMeta,
      },
    })
    .select("*")
    .maybeSingle();

  if (iErr) return NextResponse.json({ error: "appointment_create_failed" }, { status: 500 });

  await updateLeadBookingSignals(String((lead as any).id));

  return NextResponse.json({ ok: true, appointment: appt });
}