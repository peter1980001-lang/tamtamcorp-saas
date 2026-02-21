// app/api/admin/companies/[id]/logo/route.ts
export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/adminGuard"; // oder requireAdmin (siehe unten)

function sanitizeExt(filename: string) {
  const m = filename.toLowerCase().match(/\.(png|jpg|jpeg|webp|svg)$/);
  return m ? m[1] : "png";
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await context.params;

    if (!companyId) {
      return NextResponse.json({ error: "missing_company_id" }, { status: 400 });
    }

    // ✅ Auth guard (hier aufrufen)
    await requireOwner();
    // falls ihr company-admin check habt:
    // await requireAdmin(companyId);

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "file_too_large_max_2mb" }, { status: 400 });
    }

    const ext = sanitizeExt(file.name || "");
    const path = `${companyId}/logo.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("company-assets")
      .upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
        cacheControl: "3600",
      });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const { data: pub } = supabase.storage
      .from("company-assets")
      .getPublicUrl(path);

    const logoUrl = pub?.publicUrl || "";

    const { data: existing, error: sErr } = await supabaseServer
      .from("company_settings")
      .select("branding_json")
      .eq("company_id", companyId)
      .maybeSingle();

    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }

    const branding = (existing?.branding_json || {}) as any;
    const nextBranding = { ...branding, logo_url: logoUrl };

    const { error: uErr } = await supabaseServer
      .from("company_settings")
      .update({ branding_json: nextBranding })
      .eq("company_id", companyId);

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, logo_url: logoUrl });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unauthorized" },
      { status: 401 }
    );
  }
}