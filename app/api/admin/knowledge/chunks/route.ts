// app/api/admin/knowledge/chunks/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireOwnerOrCompanyAdmin } from "@/lib/adminGuard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();
  const url = new URL(req.url);
  const company_id = String(url.searchParams.get("company_id") || "").trim();
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 100)));

  if (!company_id) return NextResponse.json({ error: "company_id_required" }, { status: 400 });

  const auth = await requireOwnerOrCompanyAdmin(company_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseServer
    .from("knowledge_chunks")
    .select("id, company_id, title, content, source_ref, metadata, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: "list_failed", details: error.message }, { status: 500 });

  const rows = (data || []).filter((r: any) => {
    if (!q) return true;
    const hay = `${r.title || ""} ${r.source_ref || ""} ${r.content || ""} ${JSON.stringify(r.metadata || {})}`.toLowerCase();
    return hay.includes(q);
  });

  return NextResponse.json({ ok: true, chunks: rows });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);

  const company_id = String(body?.company_id || "").trim();
  const id = String(body?.id || "").trim();

  const title = body?.title != null ? String(body.title) : null;
  const content = body?.content != null ? String(body.content) : null;

  if (!company_id) return NextResponse.json({ error: "company_id_required" }, { status: 400 });
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  if (title == null && content == null) return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });

  const auth = await requireOwnerOrCompanyAdmin(company_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Extra safety: ensure chunk belongs to company
  const { data: existing, error: selErr } = await supabaseServer
    .from("knowledge_chunks")
    .select("id, company_id")
    .eq("id", id)
    .maybeSingle();

  if (selErr) return NextResponse.json({ error: "lookup_failed", details: selErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (String((existing as any).company_id) !== company_id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const update: any = {};
  if (title != null) update.title = title;
  if (content != null) update.content = content;

  // NOTE: Embedding becomes stale on edit. (We can add re-embed on save next.)
  const { data, error } = await supabaseServer
    .from("knowledge_chunks")
    .update(update)
    .eq("id", id)
    .select("id, company_id, title, content, source_ref, metadata, created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "update_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, chunk: data });
}