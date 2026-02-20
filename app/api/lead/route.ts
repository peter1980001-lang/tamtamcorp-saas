import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabaseServer";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const match = h.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(v: any): string | null {
  const s = String(v || "").trim().toLowerCase();
  return s && s.includes("@") ? s : null;
}

function normalizePhone(v: any): string | null {
  const s = String(v || "").trim();
  if (!s) return null;
  return s.replace(/\s+/g, " ");
}

function bandFromScore(score: number): "cold" | "warm" | "hot" {
  if (score >= 60) return "hot";
  if (score >= 30) return "warm";
  return "cold";
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
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const name = String(body.name || "").trim() || null;
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  const note = String(body.note || "").trim() || null;
  const conversation_id = String(body.conversation_id || "").trim() || null;

  if (!email && !phone) {
    return NextResponse.json({ error: "email_or_phone_required" }, { status: 400 });
  }

  // Lead form submission is a strong signal => score at least 70 (HOT)
  const score_total = 70 + (email ? 10 : 0) + (phone ? 10 : 0);
  const cappedScore = Math.min(100, score_total);
  const score_band = bandFromScore(cappedScore);

  const lead_preview = `${score_band.toUpperCase()} · LEAD FORM · ${email || ""}${email && phone ? " · " : ""}${phone || ""}${name ? " · " + name : ""}`;

  const row: any = {
    company_id,
    conversation_id,
    channel: "widget",
    lead_state: "captured",
    status: "new",
    name,
    email,
    phone,
    qualification_json: {
      ...(note ? { note } : {}),
      lead_form_submitted_at: nowIso(),
    },
    score_total: cappedScore,
    score_band,
    last_touch_at: nowIso(),
    updated_at: nowIso(),
    lead_preview,
  };

  // Upsert by unique key (company_id, conversation_id) if conversation_id present,
  // otherwise create a new row (still ok).
  if (conversation_id) {
    const { error } = await supabaseServer.from("company_leads").upsert(row, {
      onConflict: "company_id,conversation_id",
    });
    if (error) return NextResponse.json({ error: "db_upsert_failed", details: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // fallback: insert without conversation_id
  const { error } = await supabaseServer.from("company_leads").insert({
    ...row,
    intent_score: 0,
    consents_json: {},
    tags: [],
    created_at: nowIso(),
  });
  if (error) return NextResponse.json({ error: "db_insert_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}