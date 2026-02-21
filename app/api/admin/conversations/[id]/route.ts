export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { id } = await ctx.params;
  const conversation_id = String(id || "").trim();
  if (!conversation_id) return NextResponse.json({ error: "missing_conversation_id" }, { status: 400 });

  const { data: conv, error: convErr } = await supabaseServer
    .from("conversations")
    .select("id, company_id, created_at")
    .eq("id", conversation_id)
    .maybeSingle();

  if (convErr) return NextResponse.json({ error: "db_conv_failed", details: convErr.message }, { status: 500 });
  if (!conv) return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });

  const { data: msgs, error: msgErr } = await supabaseServer
    .from("messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true });

  if (msgErr) return NextResponse.json({ error: "db_messages_failed", details: msgErr.message }, { status: 500 });

  const { data: lead, error: leadErr } = await supabaseServer
    .from("company_leads")
    .select(
      "id, company_id, conversation_id, lead_state, status, name, email, phone, score_total, score_band, intent_score, qualification_json, consents_json, created_at, updated_at, last_touch_at"
    )
    .eq("conversation_id", conversation_id)
    .eq("company_id", conv.company_id)
    .maybeSingle();

  if (leadErr) {
    // Lead ist optional -> niemals hart failen
  }

  return NextResponse.json({
    conversation: conv,
    messages: msgs ?? [],
    lead: lead ?? null,
  });
}
