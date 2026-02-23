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

  const { data, error } = await supabaseServer
    .from("company_integrations")
    .select("id,company_id,provider,status,account_email,external_account_id,token_expires_at,scopes,provider_meta,created_at,updated_at")
    .eq("company_id", company_id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, integrations: data || [] });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const action = String(body?.action || "").toLowerCase();
  const provider = String(body?.provider || "").trim();

  if (action !== "disconnect") return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  if (!provider) return NextResponse.json({ error: "missing_provider" }, { status: 400 });

  const { error } = await supabaseServer
    .from("company_integrations")
    .delete()
    .eq("company_id", company_id)
    .eq("provider", provider);

  if (error) return NextResponse.json({ error: "delete_failed", details: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}