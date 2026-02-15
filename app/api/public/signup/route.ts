export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

function genKey(prefix: "pk" | "sk") {
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}

function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const token = m ? m[1] : null;

    if (!token) return NextResponse.json({ error: "missing_auth_token" }, { status: 401 });

    // Verify user via Supabase Auth using the access token from the browser
    const { data: uData, error: uErr } = await supabaseServer.auth.getUser(token);
    if (uErr || !uData?.user?.id) return NextResponse.json({ error: "invalid_auth_token" }, { status: 401 });

    const user_id = uData.user.id;

    const body = await req.json().catch(() => null);
    const company_name = String(body?.company_name || "").trim();
    const allowed_domains = Array.isArray(body?.allowed_domains)
      ? body.allowed_domains.map((x: any) => String(x).trim()).filter(Boolean)
      : [];

    if (!company_name) return NextResponse.json({ error: "company_name_required" }, { status: 400 });

    // 1) Create company
    const { data: company, error: cErr } = await supabaseServer
      .from("companies")
      .insert({ name: company_name, status: "active", plan: "starter" })
      .select("id")
      .single();

    if (cErr || !company?.id) return NextResponse.json({ error: cErr?.message || "company_create_failed" }, { status: 500 });

    const company_id = String(company.id);

    // 2) Create settings row (empty defaults)
    const { error: sErr } = await supabaseServer.from("company_settings").insert({
      company_id,
      limits_json: {
        chat: { mode: "hybrid", rate_limits: { per_minute: 10, per_day: 1000 } },
        max_tokens_per_day: 50000,
        max_requests_per_day: 50,
        max_requests_per_minute_per_ip: 5,
      },
      branding_json: {},
      tone_json: {},
      escalation_json: {},
    });

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    // 3) Create keys
    const public_key = genKey("pk");
    const secret_key = genKey("sk");

    const { error: kErr } = await supabaseServer.from("company_keys").insert({
      company_id,
      public_key,
      secret_key,
      allowed_domains,
    });

    if (kErr) return NextResponse.json({ error: kErr.message }, { status: 500 });

    // 4) Grant access to this user (so admin routes work)
    // Your requireCompanyAccess checks company_admins, so we insert that.
    const { error: aErr } = await supabaseServer.from("company_admins").insert({
      company_id,
      user_id,
      role: "admin",
    });

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

    // 5) Auto-start trial for 14 days (no Stripe)
    // We set plan_key to "starter" (must exist in billing_plans + have chat enabled feature)
    // and status trialing so your chat gate allows it.
    const trial_days = 14;

    const { error: bErr } = await supabaseServer.from("company_billing").upsert({
      company_id,
      plan_key: "starter",
      status: "trialing",
      current_period_end: plusDaysIso(trial_days),
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
    });

    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      company_id,
      public_key,
      trial_days,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "public_signup_failed", details: err?.message }, { status: 500 });
  }
}
