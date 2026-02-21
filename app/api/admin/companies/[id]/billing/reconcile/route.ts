export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(_req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const nowIso = new Date().toISOString();

  // Find expired trials
  const { data: trials, error: tErr } = await supabaseServer
    .from("company_billing")
    .select("company_id,status,current_period_end,plan_key")
    .eq("status", "trialing")
    .not("current_period_end", "is", null)
    .lt("current_period_end", nowIso);

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  const expired = trials ?? [];
  if (expired.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, expired: 0, updated: 0 });
  }

  // Update expired -> expired
  const companyIds = expired.map((r: any) => r.company_id);

  const { error: uErr } = await supabaseServer
    .from("company_billing")
    .update({ status: "expired", updated_at: nowIso })
    .in("company_id", companyIds);

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    scanned: expired.length,
    expired: expired.length,
    updated: expired.length,
    company_ids: companyIds,
  });
}

// Optional: allow GET for cron ping testing
export async function GET(req: NextRequest) {
const supabase = createSupabaseServerClient();
  // small safety: require owner even for GET
  return POST(req);
}
