import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabaseServer";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

type WidgetClaims = {
  company_id: string;
  public_key: string;
  iat?: number;
  exp?: number;
};

const WIDGET_JWT_SECRET = process.env.WIDGET_JWT_SECRET || process.env.JWT_SECRET || "";

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "missing_bearer" }, { status: 401 });

    if (!WIDGET_JWT_SECRET) return NextResponse.json({ error: "missing_widget_jwt_secret" }, { status: 500 });

    let claims: WidgetClaims;
    try {
      claims = jwt.verify(token, WIDGET_JWT_SECRET) as any;
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const companyId = String(claims.company_id || "").trim();
    if (!companyId) return NextResponse.json({ error: "missing_company_id" }, { status: 401 });

    const { data: settings, error: sErr } = await supabaseServer
      .from("company_settings")
      .select("branding_json")
      .eq("company_id", companyId)
      .maybeSingle();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const branding = (settings?.branding_json as any) || {};

    // normalize: allow common keys
    const primary = String(branding.primary || branding.primary_color || "").trim();
    const secondary = String(branding.secondary || branding.secondary_color || "").trim();
    const accent = String(branding.accent || branding.accent_color || "").trim();
    const logo_url = branding.logo_url ? String(branding.logo_url) : null;
    const company_name = branding.company_name ? String(branding.company_name) : null;
    const greeting = branding.greeting ? String(branding.greeting) : null;

    return NextResponse.json({
      ok: true,
      company_id: companyId,
      branding: {
        primary: primary || null,
        secondary: secondary || null,
        accent: accent || null,
        logo_url,
        company_name,
        greeting,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown" }, { status: 500 });
  }
}
