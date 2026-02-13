export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { data: company, error: cErr } = await supabaseServer
    .from("companies")
    .select("id, name, status, plan, stripe_customer_id, stripe_subscription_id, created_at, updated_at")
    .eq("id", company_id)
    .maybeSingle();

  if (cErr || !company) {
    return NextResponse.json({ error: "company_not_found", details: cErr?.message }, { status: 404 });
  }

  // IMPORTANT: only expose PUBLIC key to UI
  const { data: keyRow, error: kErr } = await supabaseServer
    .from("company_keys")
    .select("public_key, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (kErr) {
    return NextResponse.json({ error: "keys_lookup_failed", details: kErr.message }, { status: 500 });
  }

  return NextResponse.json({
    company: {
      ...company,
      public_key: keyRow?.public_key ?? null,
      keys_rotated_at: keyRow?.created_at ?? null,
    },
  });
}
