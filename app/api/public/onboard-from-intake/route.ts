// app/api/public/onboard-from-intake/route.ts
//
// Server-to-server endpoint that auto-creates a company + settings + widget
// keys + 14-day billing trial from a /onboard intake form submission.
//
// Called by tamtam-leads/api/intake-submit.js right after the intake row
// is written. Authenticated via x-intake-secret header (must match
// INTAKE_SHARED_SECRET env var set on BOTH services).
//
// Idempotent only on the keys/settings level — calling twice with the same
// business_name creates two companies. The caller is expected to fire once
// per real intake.

import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function genKey(prefix: "pk" | "sk") {
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}

export async function POST(req: Request) {
  const sentSecret = req.headers.get("x-intake-secret") || "";
  const expected   = (process.env.INTAKE_SHARED_SECRET || "").trim();
  if (!expected) {
    return NextResponse.json({ error: "intake_secret_not_configured" }, { status: 503 });
  }
  // constant-time compare to avoid timing attacks
  const sentBuf = Buffer.from(sentSecret);
  const expBuf  = Buffer.from(expected);
  if (sentBuf.length !== expBuf.length || !crypto.timingSafeEqual(sentBuf, expBuf)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const business_name = String(body?.business_name || "").trim();
  if (!business_name) {
    return NextResponse.json({ error: "business_name_required" }, { status: 400 });
  }

  const contact_email          = String(body?.contact_email || "").trim() || null;
  const contact_name           = String(body?.contact_name  || "").trim() || null;
  const contact_phone          = String(body?.contact_phone || "").trim() || null;
  const website_url            = String(body?.website_url   || "").trim() || null;
  const industry               = String(body?.industry      || "").trim() || null;
  const intake_submission_id   = body?.intake_submission_id || null;

  // 1) Create company
  // NOTE: company_status enum does not include 'trial' — trial state is
  // tracked in company_billing.status='trialing' instead. Companies start
  // 'active' and rely on the billing check to gate paid features.
  const { data: company, error: cErr } = await supabaseServer
    .from("companies")
    .insert({
      name:   business_name,
      status: "active",
    } as any)
    .select("id, name, status, created_at")
    .single();

  if (cErr || !company?.id) {
    return NextResponse.json({ error: cErr?.message ?? "create_company_failed" }, { status: 500 });
  }

  const company_id = company.id;

  // 2) Settings — stash intake metadata under branding_json so admin can see
  //    the origin when they open the company's admin page.
  const { error: sErr } = await supabaseServer
    .from("company_settings")
    .upsert({
      company_id,
      limits_json: {},
      branding_json: {
        intake_source:        "tamtamcorp.tech/onboard",
        intake_submission_id,
        intake_contact_name:  contact_name,
        intake_contact_email: contact_email,
        intake_contact_phone: contact_phone,
        intake_website_url:   website_url,
        intake_industry:      industry,
      },
    } as any, { onConflict: "company_id" });

  if (sErr) {
    await supabaseServer.from("companies").delete().eq("id", company_id);
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  // 3) Widget keys — empty allowed_domains; admin sets the customer's domain later.
  const public_key = genKey("pk");
  const secret_key = genKey("sk");
  const { error: kErr } = await supabaseServer
    .from("company_keys")
    .upsert({
      company_id,
      public_key,
      secret_key,
      allowed_domains: [],
    } as any, { onConflict: "company_id" });

  if (kErr) {
    await supabaseServer.from("company_settings").delete().eq("company_id", company_id);
    await supabaseServer.from("companies").delete().eq("id", company_id);
    return NextResponse.json({ error: kErr.message }, { status: 500 });
  }

  // 4) 14-day billing trial
  const trial_end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseServer
    .from("company_billing")
    .upsert({
      company_id,
      status:             "trialing",
      plan_key:           null,
      current_period_end: trial_end,
    } as any, { onConflict: "company_id" });

  return NextResponse.json({
    ok:                   true,
    company_id,
    public_key,
    secret_key,
    trial_ends_at:        trial_end,
    intake_submission_id,
  });
}
