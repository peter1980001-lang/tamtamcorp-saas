import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await ctx.params;

  // ✅ allow platform owner OR admins of THIS company
  const guard = await requireCompanyAccess(companyId);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  // Ensure company exists (clear error)
  const { data: company, error: cErr } = await supabaseServer
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) {
    return NextResponse.json(
      { error: "db_company_failed", details: cErr.message },
      { status: 500 }
    );
  }
  if (!company) {
    return NextResponse.json({ error: "company_not_found" }, { status: 404 });
  }

  const { data, error } = await supabaseServer.rpc("get_company_usage", {
    p_company_id: companyId,
  });

  if (error) {
    return NextResponse.json(
      { error: "usage_rpc_failed", details: error.message },
      { status: 500 }
    );
  }

  const row = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    minute_count: Number(row?.minute_count ?? 0),
    day_count: Number(row?.day_count ?? 0),
    reset_minute: row?.reset_minute ?? null,
    reset_day: row?.reset_day ?? null,
  });
}
