export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

function isCronAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;

  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

async function reconcileTrials() {
  const nowIso = new Date().toISOString();

  // Find expired trials
  const { data: trials, error: tErr } = await supabaseServer
    .from("company_billing")
    .select("company_id,status,current_period_end,plan_key")
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

// Cron Jobs are GET requests on Vercel.
// We accept GET + POST.
// Auth: Either CRON_SECRET (Vercel cron header) OR platform owner (cookie session).
async function authorize(req: NextRequest) {
  if (isCronAuthorized(req)) return { ok: true as const, via: "cron_secret" as const };

  const auth = await requireOwner();
  if (!auth.ok) return { ok: false as const, status: auth.status, error: auth.error };

  return { ok: true as const, via: "owner" as const };
}

export async function GET(req: NextRequest) {
  const a = await authorize(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const result = await reconcileTrials();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ...result, authorized_via: a.via });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
