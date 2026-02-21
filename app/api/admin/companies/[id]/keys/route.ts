export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

function maskSecret(s: string | null) {
  if (!s) return null;
  if (s.length <= 10) return "********";
  return s.slice(0, 6) + "…" + s.slice(-4);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = createSupabaseServerClient();
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ ok: false, error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "forbidden" }, { status: auth.status });

  // IMPORTANT: adjust table name if yours differs
  const { data, error } = await supabaseServer
    .from("company_api_keys")
    .select("public_key, secret_key, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: "db_failed", details: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    public_key: data?.public_key ?? null,
    secret_key_masked: maskSecret(data?.secret_key ?? null),
    keys_rotated_at: data?.created_at ?? null,
  });
}
