// app/api/book/[public_key]/company/route.ts
export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { resolveCompanyByPublicKey } from "@/lib/publicBooking";
import { getBookingEntitlement } from "@/lib/bookingEntitlement";

export async function GET(req: NextRequest, context: { params: Promise<{ public_key: string }> }) {
  const { public_key } = await context.params;

  const company = await resolveCompanyByPublicKey(public_key);
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ent = await getBookingEntitlement(company.company_id);

  return NextResponse.json({
    ok: true,
    company: {
      company_id: company.company_id,
      company_name: company.company_name,
      branding_json: company.branding_json,
      public_booking_key: company.public_booking_key,
    },
    entitlement: {
      plan_key: ent.plan_key,
      status: (ent as any).status ?? null,
      trial_active: ent.trial_active,
      trial_ends_at: (ent as any).current_period_end ?? null,
      can_view: ent.can_view,
      can_hold: ent.can_hold,
      can_book: ent.can_book,
      reason: ent.reason ?? null,
    },
  });
}