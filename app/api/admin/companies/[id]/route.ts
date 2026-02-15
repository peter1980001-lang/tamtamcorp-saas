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

  const [{ data: company, error: cErr }, { data: keysRow, error: kErr }, { data: settingsRow, error: sErr }] =
    await Promise.all([
      supabaseServer
        .from("companies")
        .select("id, name, status, plan, stripe_customer_id, stripe_subscription_id, created_at, updated_at")
        .eq("id", company_id)
        .maybeSingle(),
      supabaseServer
        .from("company_keys")
        .select("company_id, public_key, secret_key, allowed_domains, created_at")
        .eq("company_id", company_id)
        .maybeSingle(),
      supabaseServer
        .from("company_settings")
        .select("company_id, limits_json, branding_json")
        .eq("company_id", company_id)
        .maybeSingle(),
    ]);

  if (cErr) return NextResponse.json({ error: "db_company_failed", details: cErr.message }, { status: 500 });
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (kErr) return NextResponse.json({ error: "db_keys_failed", details: kErr.message }, { status: 500 });
  if (sErr) return NextResponse.json({ error: "db_settings_failed", details: sErr.message }, { status: 500 });

  return NextResponse.json({
    company,
    keys: keysRow
      ? {
          company_id: keysRow.company_id,
          public_key: keysRow.public_key,
          secret_key: keysRow.secret_key, // ok im Owner/Admin Panel
          allowed_domains: keysRow.allowed_domains ?? [],
          created_at: keysRow.created_at,
        }
      : null,
    settings: settingsRow
      ? {
          company_id: settingsRow.company_id,
          limits_json: settingsRow.limits_json ?? {},
          branding_json: settingsRow.branding_json ?? {},
        }
      : { company_id, limits_json: {}, branding_json: {} },
  });
}
