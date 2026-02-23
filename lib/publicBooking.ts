// lib/publicBooking.ts
import { supabaseServer } from "@/lib/supabaseServer";

export type PublicBookingCompany = {
  company_id: string;
  company_name: string | null;

  branding_json: any;
  public_booking_key: string;

  // optional: falls du später greeting etc nutzen willst
  brand_json?: any;
  tone_json?: any;
};

export async function resolveCompanyByPublicKey(public_key: string): Promise<PublicBookingCompany | null> {
  const key = String(public_key || "").trim();
  if (!key) return null;

  // 1) settings lookup (public key lives here)
  const { data: settings, error: sErr } = await supabaseServer
    .from("company_settings")
    .select("company_id, public_booking_key, branding_json, brand_json, tone_json")
    .eq("public_booking_key", key)
    .maybeSingle();

  if (sErr) return null;
  if (!settings?.company_id) return null;

  const company_id = String((settings as any).company_id);

  // 2) company name
  const { data: c } = await supabaseServer
    .from("companies")
    .select("id,name")
    .eq("id", company_id)
    .maybeSingle();

  return {
    company_id,
    company_name: c?.name ?? null,
    branding_json: (settings as any).branding_json ?? {},
    brand_json: (settings as any).brand_json ?? {},
    tone_json: (settings as any).tone_json ?? {},
    public_booking_key: String((settings as any).public_booking_key || key),
  };
}