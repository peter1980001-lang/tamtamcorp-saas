export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireOwnerOrAdmin } from "@/lib/rbac";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const rbac = await requireOwnerOrAdmin();
  if (!rbac.ok) return NextResponse.json({ error: rbac.error }, { status: rbac.status });

  // Owner: alle companies, Admin: nur erlaubte companies
  let q = supabaseServer
    .from("company_leads")
    .select(
      "id, company_id, conversation_id, score_total, score_band, lead_state, status, email, phone, last_touch_at, created_at, qualification_json"
    )
    .order("last_touch_at", { ascending: false })
    .limit(300);

  if (rbac.role === "admin") {
    q = q.in("company_id", rbac.company_ids);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ leads: data ?? [] });
}
