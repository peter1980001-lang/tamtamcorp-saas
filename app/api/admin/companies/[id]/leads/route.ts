import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("company_leads")
    .select(
      "id, company_id, conversation_id, channel, source, lead_state, status, name, email, phone, qualification_json, consents_json, intent_score, score_total, score_band, tags, last_touch_at, created_at, updated_at"
    )
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });

  return NextResponse.json({ leads: data ?? [] });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const lead_id = String(body?.lead_id || "").trim();
  const status = body?.status ? String(body.status).trim() : null;
  const lead_state = body?.lead_state ? String(body.lead_state).trim() : null;

  if (!lead_id) return NextResponse.json({ error: "missing_lead_id" }, { status: 400 });

  const update: Record<string, any> = {};
  if (status) update.status = status;
  if (lead_state) update.lead_state = lead_state;
  update.last_touch_at = new Date().toISOString();

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("company_leads")
    .update(update)
    .eq("id", lead_id)
    .eq("company_id", company_id)
    .select(
      "id, company_id, conversation_id, channel, source, lead_state, status, name, email, phone, qualification_json, consents_json, intent_score, score_total, score_band, tags, last_touch_at, created_at, updated_at"
    )
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_update_failed", details: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "lead_not_found" }, { status: 404 });

  return NextResponse.json({ lead: data });
}
