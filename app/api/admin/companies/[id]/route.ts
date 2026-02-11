import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const company_id = String(id || "").trim();

  if (!company_id) {
    return NextResponse.json({ error: "missing_company_id" }, { status: 400 });
  }

  // Company
  const { data: company, error: cErr } = await supabaseServer
    .from("companies")
    .select("id,name,status,created_at")
    .eq("id", company_id)
    .single();

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 404 });
  }

  // Settings
  const { data: settings } = await supabaseServer
    .from("company_settings")
    .select("company_id, limits_json, branding_json")
    .eq("company_id", company_id)
    .maybeSingle();

  // Keys (robust: newest row)
  const { data: keysRows, error: kErr } = await supabaseServer
    .from("company_keys")
    .select("company_id, public_key, secret_key, allowed_domains, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (kErr) {
    return NextResponse.json({ error: kErr.message }, { status: 500 });
  }

  const keys = keysRows?.[0] ?? null;

  return NextResponse.json({
    company,
    settings: settings ?? { company_id, limits_json: {}, branding_json: {} },
    keys,
  });
}
