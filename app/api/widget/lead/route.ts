export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabaseServer";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

  const body = await req.json().catch(() => null);

  const conversation_id = String(body?.conversation_id || "").trim();
  const name = body?.name ? String(body.name).trim() : null;
  const email = body?.email ? String(body.email).trim().toLowerCase() : null;
  const phone = body?.phone ? String(body.phone).trim() : null;

  const intent = body?.intent ? String(body.intent).trim() : null;
  const budget = body?.budget ? String(body.budget).trim() : null;
  const timeline = body?.timeline ? String(body.timeline).trim() : null;

  if (!conversation_id) return NextResponse.json({ error: "missing_conversation_id" }, { status: 400 });
  if (!email && !phone) return NextResponse.json({ error: "email_or_phone_required" }, { status: 400 });
  if (email && !isValidEmail(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  // conversation must belong to company
  const { data: conv, error: convErr } = await supabaseServer
    .from("conversations")
    .select("id,company_id")
    .eq("id", conversation_id)
    .maybeSingle();

  if (convErr) return NextResponse.json({ error: "db_conversation_failed", details: convErr.message }, { status: 500 });
  if (!conv || String(conv.company_id) !== company_id) return NextResponse.json({ error: "invalid_conversation" }, { status: 403 });

  // simple scoring MVP
  let score_total = 0;
  if (email) score_total += 10;
  if (phone) score_total += 10;
  if (intent && intent.length >= 10) score_total += 10;
  if (budget) score_total += 5;
  if (timeline) score_total += 5;

  const score_band = score_total >= 25 ? "hot" : score_total >= 15 ? "warm" : "cold";

  const qualification_json = {
    intent,
    budget,
    timeline,
    captured_from: "widget",
  };

  const consents_json = {
    marketing: Boolean(body?.consent_marketing ?? false),
    privacy: Boolean(body?.consent_privacy ?? true),
  };

  const insertRow: any = {
    company_id,
    conversation_id,
    channel: "widget",
    source: "widget",
    lead_state: "new",
    status: "new",
    name,
    email,
    phone,
    qualification_json,
    consents_json,
    intent_score: score_total,
    score_total,
    score_band,
    tags: [],
    last_touch_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("company_leads")
    .insert(insertRow)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "lead_insert_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, lead: data });
}
