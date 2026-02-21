export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdmin(companyId) } from "@/lib/adminGuard"; // falls ihr requireOwner nutzt, sonst anpassen

function sanitizeExt(filename: string) {
  const m = filename.toLowerCase().match(/\.(png|jpg|jpeg|webp|svg)$/);
  return m ? m[1] : "png";
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    // ✅ Sicherstellen, dass nur Admin/Owner uploaden darf
    await requireOwner();

    const companyId = ctx.params.id;
    if (!companyId) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

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

    // Upload to Supabase Storage (public bucket)
    const { error: upErr } = await supabaseServer.storage
      .from("company-assets")
      .upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
        cacheControl: "3600",
      });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const { data: pub } = supabaseServer.storage.from("company-assets").getPublicUrl(path);
    const logoUrl = pub?.publicUrl || "";

    // Update branding_json.logo_url
    const { data: existing, error: sErr } = await supabaseServer
      .from("company_settings")
      .select("branding_json")
      .eq("company_id", companyId)
      .maybeSingle();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const branding = (existing?.branding_json || {}) as any;
    const nextBranding = { ...branding, logo_url: logoUrl };

    const { error: uErr } = await supabaseServer
      .from("company_settings")
      .update({ branding_json: nextBranding })
      .eq("company_id", companyId);

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, logo_url: logoUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown" }, { status: 401 });
  }
}