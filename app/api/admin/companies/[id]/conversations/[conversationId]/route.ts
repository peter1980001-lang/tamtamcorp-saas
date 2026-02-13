export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; conversationId: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { id, conversationId } = await ctx.params;

  const company_id = String(id || "").trim();
  const conversation_id = String(conversationId || "").trim();

  if (!company_id || !conversation_id) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  // 1) Load conversation (must belong to company)
  const { data: conversation, error: cErr } = await supabaseServer
    .from("conversations")
    .select("id, company_id, created_at")
    .eq("id", conversation_id)
    .maybeSingle();

  if (cErr) return NextResponse.json({ error: "db_conversation_failed", details: cErr.message }, { status: 500 });
  if (!conversation) return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  if (String(conversation.company_id) !== company_id) {
    return NextResponse.json({ error: "conversation_company_mismatch" }, { status: 403 });
  }

  // 2) Load messages
  const { data: messages, error: mErr } = await supabaseServer
    .from("messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true });

  if (mErr) return NextResponse.json({ error: "db_messages_failed", details: mErr.message }, { status: 500 });

  // 3) Load lead (optional)
  const { data: lead, error: lErr } = await supabaseServer
    .from("company_leads")
    .select(
      "id, company_id, conversation_id, channel, source, lead_state, status, name, email, phone, qualification_json, consents_json, intent_score, score_total, score_band, tags, last_touch_at, created_at, updated_at"
    )
    .eq("company_id", company_id)
    .eq("conversation_id", conversation_id)
    .maybeSingle();

  if (lErr) return NextResponse.json({ error: "db_lead_failed", details: lErr.message }, { status: 500 });

  return NextResponse.json({
    conversation,
    lead: lead ?? null,
    messages: messages ?? [],
  });
}
