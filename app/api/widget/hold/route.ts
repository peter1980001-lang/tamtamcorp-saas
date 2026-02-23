// app/api/widget/hold/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
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

  const start_at = String(body?.start_at || "").trim();
  const end_at = String(body?.end_at || "").trim();

  const conversation_id = String(body?.conversation_id || "").trim();
  const company_lead_id = String(body?.company_lead_id || "").trim(); // preferred
  const meta = body?.meta ?? {};

  if (!start_at || !end_at) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const start = new Date(start_at);
  const end = new Date(end_at);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || !(end > start)) {
    return NextResponse.json({ error: "invalid_time" }, { status: 400 });
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 10 * 60_000);

  // (Optional) validate conversation belongs to company if provided (same pattern as widget/messages)
  if (conversation_id) {
    const { data: conv } = await supabaseServer.from("conversations").select("id,company_id").eq("id", conversation_id).maybeSingle();
    if (!conv || String((conv as any).company_id) !== company_id) {
      return NextResponse.json({ error: "invalid_conversation" }, { status: 403 });
    }
  }

  // Conflict check against appointments + active holds
  const { data: appts, error: aErr } = await supabaseServer
    .from("company_appointments")
    .select("start_at,end_at,status")
    .eq("company_id", company_id)
    .neq("status", "cancelled")
    .lte("start_at", asIso(end))
    .gte("end_at", asIso(start));

  if (aErr) return NextResponse.json({ error: "appointments_load_failed" }, { status: 500 });

  const { data: holds, error: hErr } = await supabaseServer
    .from("company_appointment_holds")
    .select("start_at,end_at,expires_at")
    .eq("company_id", company_id)
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
    company_id,
    hold_token,
    start_at: asIso(start),
    end_at: asIso(end),
    expires_at: asIso(expires),
    conversation_id: conversation_id || null,
    company_lead_id: company_lead_id || null,
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