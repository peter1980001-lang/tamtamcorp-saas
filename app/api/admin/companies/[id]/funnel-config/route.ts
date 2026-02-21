// app/api/admin/companies/[id]/funnel-config/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * GET Funnel Config
 */
export async function GET(
  const supabase = createSupabaseServerClient();
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const companyId = String(id || "").trim();

  if (!companyId) {
    return NextResponse.json(
      { error: "missing_company_id" },
      { status: 400 }
    );
  }

  const auth = await requireCompanyAccess(companyId);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const { data, error } = await supabaseServer
    .from("company_funnel_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "db_failed", details: error.message },
      { status: 500 }
    );
  }

  // Auto-create default config if missing
  if (!data) {
    const { data: created, error: cErr } = await supabaseServer
      .from("company_funnel_config")
      .insert({ company_id: companyId })
      .select("*")
      .single();

    if (cErr) {
      return NextResponse.json(
        { error: "db_failed", details: cErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: created });
  }

  return NextResponse.json({ config: data });
}

/**
 * PATCH Funnel Config
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const companyId = String(id || "").trim();

  if (!companyId) {
    return NextResponse.json(
      { error: "missing_company_id" },
      { status: 400 }
    );
  }

  const auth = await requireCompanyAccess(companyId);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer
    .from("company_funnel_config")
    .update({ ...body })
    .eq("company_id", companyId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "db_failed", details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ config: data });
}