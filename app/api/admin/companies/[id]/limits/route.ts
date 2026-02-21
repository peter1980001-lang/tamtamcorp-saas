import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

function isPlainObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: company_id } = await context.params;

  await requireCompanyAccess(company_id);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  // supported payload shapes:
  // 1) { limits_json: {...} }
  // 2) { limits_text: "{...json...}" }
  let limits: any = null;

  if (typeof body?.limits_text === "string") {
    try {
      limits = JSON.parse(body.limits_text);
    } catch {
      return NextResponse.json(
        { error: "limits_json_parse_failed" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }
  } else {
    limits = body?.limits_json;
  }

  if (limits === null || limits === undefined) {
    return NextResponse.json(
      { error: "limits_required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  if (!isPlainObject(limits)) {
    return NextResponse.json(
      { error: "limits_must_be_object" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  // minimal sanity: if rate_limits exists, it must be an object
  const rl = (limits as any)?.rate_limits;
  if (rl !== undefined && rl !== null && !isPlainObject(rl)) {
    return NextResponse.json(
      { error: "rate_limits_must_be_object" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const { data: updated, error: uErr } = await supabaseServer
    .from("company_settings")
    .update({ limits_json: limits })
    .eq("company_id", company_id)
    .select("company_id, limits_json, branding_json, updated_at")
    .single();

  if (uErr) {
    return NextResponse.json(
      { error: "db_update_failed", details: uErr.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, settings: updated },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
