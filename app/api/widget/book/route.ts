// app/api/widget/book/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkBillingGate } from "@/lib/billingGate";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function asIso(d: Date) {
  return d.toISOString();
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

async function resolveCompanyLeadId(params: { company_id: string; company_lead_id?: string | null; conversation_id?: string | null }) {
  const { company_id, company_lead_id, conversation_id } = params;

  if (company_lead_id) {
    const { data } = await supabaseServer.from("company_leads").select("id,company_id").eq("id", company_lead_id).maybeSingle();
    if (data && String((data as any).company_id) === company_id) return String((data as any).id);
  }

  if (conversation_id) {
    const { data } = await supabaseServer
      .from("company_leads")
      .select("id,company_id")
      .eq("conversation_id", conversation_id)
      .eq("company_id", company_id)
      .maybeSingle();

    if (data) return String((data as any).id);
  }

  return null;
}

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

  let payload: any;
  try {
    payload = jwt.verify(token, process.env.WIDGET_JWT_SECRET!);
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const company_id = String(payload.company_id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company" }, { status: 401 });

  const bill = await checkBillingGate(company_id);
  if (!bill.ok) return NextResponse.json({ error: bill.code }, { status: 402 });

  const body = await req.json().catch(() => null);

  const hold_token = String(body?.hold_token || "").trim();
  const conversation_id = String(body?.conversation_id || "").trim() || null;

  const company_lead_id_in = String(body?.company_lead_id || "").trim() || null;

  const contact_name = body?.contact_name ? String(body.contact_name).trim() : null;
  const contact_email = body?.contact_email ? String(body.contact_email).trim().toLowerCase() : null;
  const contact_phone = body?.contact_phone ? String(body.contact_phone).trim() : null;

  const title = body?.title ? String(body.title).trim() : null;
  const description = body?.description ? String(body.description).trim() : null;

  const meta = body?.meta ?? {};

  if (!hold_token) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  // Validate conversation (optional but recommended)
  if (conversation_id) {
    const { data: conv } = await supabaseServer.from("conversations").select("id,company_id").eq("id", conversation_id).maybeSingle();
    if (!conv || String((conv as any).company_id) !== company_id) {
      return NextResponse.json({ error: "invalid_conversation" }, { status: 403 });
    }
  }

  const now = new Date();

  // Fetch hold
  const { data: hold, error: hErr } = await supabaseServer
    .from("company_appointment_holds")
    .select("*")
    .eq("company_id", company_id)
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

  // Prefer company_lead_id:
  const resolvedCompanyLeadId = await resolveCompanyLeadId({
    company_id,
    company_lead_id: company_lead_id_in || String((hold as any).company_lead_id || "").trim() || null,
    conversation_id: conversation_id || String((hold as any).conversation_id || "").trim() || null,
  });

  // Final conflict check (appointments + active holds excluding current hold)
  const { data: appts, error: aErr } = await supabaseServer
    .from("company_appointments")
    .select("start_at,end_at,status")
    .eq("company_id", company_id)
    .neq("status", "cancelled")
    .lte("start_at", asIso(end))
    .gte("end_at", asIso(start));

  if (aErr) return NextResponse.json({ error: "appointments_load_failed" }, { status: 500 });

  const { data: holds, error: holdsErr } = await supabaseServer
    .from("company_appointment_holds")
    .select("id,start_at,end_at,expires_at")
    .eq("company_id", company_id)
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

  // Consume hold (delete) BEFORE insert to ensure single-use
  const { data: deleted, error: dErr } = await supabaseServer
    .from("company_appointment_holds")
    .delete()
    .eq("company_id", company_id)
    .eq("hold_token", hold_token)
    .gt("expires_at", asIso(now))
    .select("id")
    .maybeSingle();

  if (dErr) return NextResponse.json({ error: "hold_consume_failed" }, { status: 500 });
  if (!deleted) return NextResponse.json({ error: "hold_already_used" }, { status: 409 });

  // Create appointment
  const insertPayload: any = {
    company_id,
    company_lead_id: resolvedCompanyLeadId,
    conversation_id: conversation_id || String((hold as any).conversation_id || "").trim() || null,

    start_at: asIso(start),
    end_at: asIso(end),

    status: "confirmed",
    source: "widget",

    title,
    description,

    contact_name,
    contact_email,
    contact_phone,

    meta: {
      ...meta,
      hold_meta: (hold as any).meta ?? {},
    },
  };

  const { data: appt, error: iErr } = await supabaseServer.from("company_appointments").insert(insertPayload).select("*").maybeSingle();
  if (iErr) return NextResponse.json({ error: "appointment_create_failed" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    appointment: appt,
  });
}