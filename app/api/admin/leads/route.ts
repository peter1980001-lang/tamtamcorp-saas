export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

function q(req: Request, key: string) {
  const u = new URL(req.url);
  return (u.searchParams.get(key) || "").trim();
}

export async function GET(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const band = q(req, "band"); // hot|warm|cold
  const status = q(req, "status"); // new|contacted|closed
  const state = q(req, "state"); // discovery|qualifying|committed|handoff
  const search = q(req, "q"); // free text
  const limitRaw = q(req, "limit");

  const limit = Math.max(1, Math.min(500, Number(limitRaw || "200") || 200));

  // Supabase: join company name (requires FK company_leads.company_id -> companies.id)
  let query = supabaseServer
    .from("company_leads")
    .select(
      "id, company_id, conversation_id, lead_state, status, score_total, score_band, intent_score, name, email, phone, qualification_json, consents_json, tags, last_touch_at, created_at, updated_at, companies(name)"
    )
    .order("last_touch_at", { ascending: false })
    .limit(limit);

  if (band && ["hot", "warm", "cold"].includes(band)) query = query.eq("score_band", band);
  if (status && ["new", "contacted", "closed"].includes(status)) query = query.eq("status", status);
  if (state && ["discovery", "qualifying", "committed", "handoff"].includes(state)) query = query.eq("lead_state", state);

  // Simple search: we do ILIKE across a few fields.
  // NOTE: if you want faster/better search later -> add a denormalized search_text column + GIN index.
  if (search) {
    const s = search.replace(/[%_]/g, ""); // minimal sanitize for ilike
    query = query.or(
      [
        `name.ilike.%${s}%`,
        `email.ilike.%${s}%`,
        `phone.ilike.%${s}%`,
        `conversation_id.ilike.%${s}%`,
        // search inside qualification_json.use_case (jsonb -> text) using a cast via PostgREST is tricky.
        // for now: skip JSON search to keep it robust.
      ].join(",")
    );
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });

  // Normalize company name
  const leads = (data ?? []).map((l: any) => ({
    ...l,
    company_name: l.companies?.name ?? null,
    companies: undefined,
  }));

  return NextResponse.json({ leads });
}
