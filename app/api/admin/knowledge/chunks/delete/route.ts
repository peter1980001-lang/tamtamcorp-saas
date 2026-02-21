// app/api/admin/knowledge/chunks/delete/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwnerOrCompanyAdmin } from "@/lib/adminGuard";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") || "").trim();
  const company_id = String(url.searchParams.get("company_id") || "").trim();

  if (!company_id) return NextResponse.json({ error: "company_id_required" }, { status: 400 });
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const auth = await requireOwnerOrCompanyAdmin(company_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Ensure chunk belongs to company
  const { data: existing, error: selErr } = await supabaseServer
    .from("knowledge_chunks")
    .select("id, company_id")
    .eq("id", id)
    .maybeSingle();

  if (selErr) return NextResponse.json({ error: "lookup_failed", details: selErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (String((existing as any).company_id) !== company_id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { error } = await supabaseServer.from("knowledge_chunks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "delete_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}