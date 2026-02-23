export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: s, error } = await supabaseServer
    .from("company_settings")
    .select("public_booking_key")
    .eq("company_id", company_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "settings_load_failed" }, { status: 500 });

  const key = String((s as any)?.public_booking_key || "").trim();
  if (!key) return NextResponse.json({ error: "missing_public_booking_key" }, { status: 404 });

  const u = new URL(req.url);
  const base = `${u.protocol}//${u.host}`;
  const link = `${base}/book/${key}`;

  return NextResponse.json({ ok: true, public_booking_key: key, link });
}