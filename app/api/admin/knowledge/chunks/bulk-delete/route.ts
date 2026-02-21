// app/api/admin/knowledge/chunks/bulk-delete/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwnerOrCompanyAdmin } from "@/lib/adminGuard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const company_id = String(body?.company_id || "").trim();
  const ids = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x).trim()).filter(Boolean) : [];

  if (!company_id) return NextResponse.json({ error: "company_id_required" }, { status: 400 });
  if (!ids.length) return NextResponse.json({ error: "ids_required" }, { status: 400 });

  const auth = await requireOwnerOrCompanyAdmin(company_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Safety: delete only rows belonging to company_id
  const { error } = await supabaseServer
    .from("knowledge_chunks")
    .delete()
    .eq("company_id", company_id)
    .in("id", ids.slice(0, 500)); // cap

  if (error) return NextResponse.json({ error: "bulk_delete_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: ids.length });
}