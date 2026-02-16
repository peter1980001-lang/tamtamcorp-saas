export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { importFromWebsite } from "@/lib/knowledgeImport";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const url = String(body?.url || "").trim();
  const maxPages = Number(body?.max_pages || 5);
  const companyNameHint = String(body?.company_name_hint || "").trim() || undefined;

  if (!url) return NextResponse.json({ error: "url_required" }, { status: 400 });

  try {
    const r = await importFromWebsite({
      company_id,
      url,
      maxPages,
      companyNameHint,
    });

    if (!r.ok) return NextResponse.json({ error: r.error, details: (r as any).details }, { status: 400 });

    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: "import_failed", details: e?.message || String(e) }, { status: 500 });
  }
}
