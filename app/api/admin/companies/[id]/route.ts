export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

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

  if (cErr) return NextResponse.json({ error: "db_failed", details: cErr.message }, { status: 500 });
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: keysRow, error: kErr } = await supabaseServer
    .from("company_keys")
    .select("public_key, secret_key, created_at")
    .eq("company_id", company_id)
    .maybeSingle();

  if (kErr) return NextResponse.json({ error: "db_failed", details: kErr.message }, { status: 500 });

  return NextResponse.json({
    company,
    keys: keysRow
      ? {
          public_key: keysRow.public_key,
          secret_key: keysRow.secret_key, // ok im Owner/Admin Panel
          created_at: keysRow.created_at,
        }
      : null,
  });
}
