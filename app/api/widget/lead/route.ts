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

  const { data: conv, error: convErr } = await supabaseServer
    .from("conversations")
    .select("id,company_id")
    .eq("id", conversation_id)
    .maybeSingle();

  if (convErr) return NextResponse.json({ error: "db_conversation_failed", details: convErr.message }, { status: 500 });
  if (!conv || String(conv.company_id) !== company_id) return NextResponse.json({ error: "invalid_conversation" }, { status: 403 });

  // Load existing lead (best-effort)
  const { data: existing } = await supabaseServer
    .from("company_leads")
    .select("id,name,email,phone,score_total,lead_state,status,qualification_json,consents_json,tags,intent_score,score_band")
    .eq("company_id", company_id)
    .eq("conversation_id", conversation_id)
    .maybeSingle();

  // Simple enrichment scoring (never decrease)
  let score_total = 0;
  if (email || existing?.email) score_total += 25;
  if (phone || existing?.phone) score_total += 25;
  if (intent && intent.length >= 10) score_total += 10;
  if (budget) score_total += 5;
  if (timeline) score_total += 5;

  const prevScore = Number(existing?.score_total ?? 0);
  const nextScore = Math.max(prevScore, score_total);
  const score_band = bandFromScore(nextScore);

  const prevQual = existing?.qualification_json && typeof existing.qualification_json === "object" ? existing.qualification_json : {};
  const qualification_json = {
    ...prevQual,
    intent: intent ?? prevQual.intent ?? null,
    budget: budget ?? prevQual.budget ?? null,
    timeline: timeline ?? prevQual.timeline ?? null,
    captured_from: "widget",
  };

  const consents_json = {
    ...(existing?.consents_json && typeof existing.consents_json === "object" ? existing.consents_json : {}),
    marketing: Boolean(body?.consent_marketing ?? false),
    privacy: Boolean(body?.consent_privacy ?? true),
  };

  const row: any = {
    company_id,
    conversation_id,
    channel: "widget",
    source: existing ? (existing as any).source ?? "widget" : "widget",

    // keep existing if present
    lead_state: existing ? existing.lead_state || "discovery" : "discovery",
    status: existing ? existing.status || "new" : "new",

    name: existing?.name || name || null,
    email: existing?.email || email || null,
    phone: existing?.phone || phone || null,

    qualification_json,
    consents_json,

    intent_score: Math.max(Number(existing?.intent_score ?? 0), intent ? 10 : 0),
    score_total: nextScore,
    score_band,

    tags: existing?.tags ?? [],
    last_touch_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("company_leads")
    .upsert(row, { onConflict: "company_id,conversation_id" })
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "lead_upsert_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, lead: data });
}