import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/adminGuard";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await ctx.params;

  await requireOwner(companyId);

  const { data, error } = await supabaseServer.rpc("get_company_usage", {
    p_company_id: companyId,
  });

  if (error) {
    return NextResponse.json({ error: "usage_rpc_failed", details: error.message }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    minute_count: row?.minute_count ?? 0,
    day_count: row?.day_count ?? 0,
    reset_minute: row?.reset_minute ?? null,
    reset_day: row?.reset_day ?? null,
  });
}
