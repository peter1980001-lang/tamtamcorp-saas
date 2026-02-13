export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  // Get conversations
  const { data: convs, error: cErr } = await supabaseServer
    .from("conversations")
    .select("id, company_id, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(300);

  if (cErr) return NextResponse.json({ error: "db_failed", details: cErr.message }, { status: 500 });

  const ids = (convs ?? []).map((c) => c.id);
  if (ids.length === 0) return NextResponse.json({ conversations: [] });

  // Fetch latest message timestamp per conversation (simple, robust approach)
  const { data: msgs, error: mErr } = await supabaseServer
    .from("messages")
    .select("conversation_id, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (mErr) return NextResponse.json({ error: "db_failed", details: mErr.message }, { status: 500 });

  const lastByConv: Record<string, string> = {};
  for (const m of msgs ?? []) {
    const cid = String((m as any).conversation_id);
    if (!lastByConv[cid]) lastByConv[cid] = String((m as any).created_at);
  }

  // Attach lead snapshot (if exists) per conversation
  const { data: leads, error: lErr } = await supabaseServer
    .from("company_leads")
    .select("conversation_id, score_total, score_band, lead_state, status, email, phone, created_at")
    .eq("company_id", company_id)
    .in("conversation_id", ids);

  if (lErr) return NextResponse.json({ error: "db_failed", details: lErr.message }, { status: 500 });

  const leadByConv: Record<string, any> = {};
  for (const l of leads ?? []) leadByConv[String((l as any).conversation_id)] = l;

  const out = (convs ?? []).map((c: any) => ({
    id: c.id,
    created_at: c.created_at,
    last_message_at: lastByConv[String(c.id)] ?? null,
    lead: leadByConv[String(c.id)] ?? null,
  }));

  return NextResponse.json({ conversations: out });
}
