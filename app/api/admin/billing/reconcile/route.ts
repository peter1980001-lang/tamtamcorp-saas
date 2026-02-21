export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

// bump this whenever you redeploy to verify you’re hitting the new code:
const VERSION = "reconcile_v3_debug_2026-02-15";

function getAuthHeader(req: NextRequest) {
  return req.headers.get("authorization") || req.headers.get("Authorization") || "";
}

function checkCron(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return { ok: false as const, reason: "missing_env_CRON_SECRET" as const };
  }

  const auth = (getAuthHeader(req) || "").trim();
  if (!auth) {
    return { ok: false as const, reason: "missing_authorization_header" as const };
  }

  const expected = `Bearer ${secret}`;
  if (auth !== expected) {
    return { ok: false as const, reason: "authorization_mismatch" as const };
  }

  return { ok: true as const, reason: "ok" as const };
}

async function reconcileTrials() {
  const nowIso = new Date().toISOString();

  const { data: trials, error: tErr } = await supabaseServer
    .from("company_billing")
    .select("company_id,status,current_period_end")
    .eq("status", "trialing")
    .not("current_period_end", "is", null)
    .lt("current_period_end", nowIso);

  if (tErr) {
    return { ok: false as const, status: 500 as const, error: tErr.message };
  }

  const expired = trials ?? [];
  if (expired.length === 0) {
    return { ok: true as const, scanned: 0, expired: 0, updated: 0, company_ids: [] as string[] };
  }

  const companyIds = expired.map((r: any) => String(r.company_id));

  const { error: uErr } = await supabaseServer
    .from("company_billing")
    .update({ status: "expired", updated_at: nowIso })
    .in("company_id", companyIds);

  if (uErr) {
    return { ok: false as const, status: 500 as const, error: uErr.message };
  }

  return {
    ok: true as const,
    scanned: expired.length,
    expired: expired.length,
    updated: expired.length,
    company_ids: companyIds,
  };
}

async function authorize(req: NextRequest) {
  const cron = checkCron(req);
  if (cron.ok) return { ok: true as const, via: "cron_secret" as const };

  const owner = await requireOwner();
  if (owner.ok) return { ok: true as const, via: "owner" as const };

  return {
    ok: false as const,
    status: owner.status,
    error: owner.error,
    cron_reason: cron.reason,
    has_env: !!(process.env.CRON_SECRET || "").trim(),
    auth_header_prefix: (getAuthHeader(req) || "").slice(0, 25),
  };
}

export async function GET(req: NextRequest) {
  const a = await authorize(req);

  if (!a.ok) {
    return NextResponse.json(
      {
        error: "unauthorized",
        version: VERSION,
        cron_reason: a.cron_reason,
        has_env: a.has_env,
        auth_header_prefix: a.auth_header_prefix,
      },
      { status: a.status }
    );
  }

  const result = await reconcileTrials();
  if (!result.ok) {
    return NextResponse.json({ error: result.error, version: VERSION }, { status: result.status });
  }

  return NextResponse.json({ ...result, authorized_via: a.via, version: VERSION });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
