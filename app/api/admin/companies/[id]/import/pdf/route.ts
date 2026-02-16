export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { importFromPdf } from "@/lib/knowledgeImport";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  // multipart/form-data: field "file"
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });

  const file = form.get("file");
  const companyNameHint = String(form.get("company_name_hint") || "").trim() || undefined;

  if (!file || !(file as any).arrayBuffer) {
    return NextResponse.json({ error: "file_required", hint: 'Upload a PDF as form-data field "file".' }, { status: 400 });
  }

  const f = file as unknown as File;
  const filename = String((f as any).name || "document.pdf");

  try {
    const ab = await f.arrayBuffer();
    const buf = Buffer.from(ab);

    const r = await importFromPdf({
      company_id,
      filename,
      buffer: buf,
      companyNameHint,
    });

    if (!r.ok) return NextResponse.json({ error: r.error, details: (r as any).details }, { status: 400 });

    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: "import_failed", details: e?.message || String(e) }, { status: 500 });
  }
}
