export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // get public_key for this company
  const { data: rows, error } = await supabaseServer
    .from("company_keys")
    .select("public_key")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const public_key = rows?.[0]?.public_key;
  if (!public_key) return NextResponse.json({ error: "no_public_key_for_company" }, { status: 400 });

  const token = jwt.sign({ company_id, public_key }, process.env.WIDGET_JWT_SECRET!, {
    expiresIn: "12h",
  });

  return NextResponse.json({ token, company_id, public_key });
}

/**
 * Backward-compat if your UI still uses POST.
 * You can remove POST later and keep only GET, or vice versa.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return GET(req, ctx as any);
}