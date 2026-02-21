export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const band = (url.searchParams.get("band") || "all").trim(); // all|cold|warm|hot
  const status = (url.searchParams.get("status") || "all").trim(); // all|new|contacted|closed
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 200)));

  // Basic query
  let query = supabaseServer
    .from("company_leads")
    .select(
      "id, company_id, conversation_id, lead_state, status, name, email, phone, qualification_json, consents_json, intent_score, score_total, score_band, tags, last_touch_at, created_at, updated_at"
    )
    .order("last_touch_at", { ascending: false })
    .limit(limit);

  if (band !== "all") query = query.eq("score_band", band);
  if (status !== "all") query = query.eq("status", status);

  // Search across name/email/phone + use_case in qualification_json
  if (q) {
    const like = `%${q}%`;
    // NOTE: ilike on jsonb path is not available directly; we search use_case via ->> in a filter string:
    query = query.or(
      [
        `name.ilike.${like}`,
        `email.ilike.${like}`,
        `phone.ilike.${like}`,
        `conversation_id.ilike.${like}`,
        // jsonb text extraction (works in PostgREST):
        `qualification_json->>use_case.ilike.${like}`,
      ].join(",")
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ leads: data ?? [] });
}
