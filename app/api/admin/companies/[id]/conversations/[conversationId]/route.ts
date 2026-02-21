export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; conversationId: string }> }) {
  const supabase = createSupabaseServerClient();
  const { id, conversationId } = await ctx.params;
  const company_id = String(id || "").trim();
  const conversation_id = String(conversationId || "").trim();

  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });
  if (!conversation_id) return NextResponse.json({ error: "missing_conversation_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { data: conv, error: cErr } = await supabaseServer
    .from("conversations")
    .select("*")
    .eq("id", conversation_id)
    .eq("company_id", company_id)
    .maybeSingle();

  if (cErr) return NextResponse.json({ error: "db_failed", details: cErr.message }, { status: 500 });
  if (!conv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: msgs, error: mErr } = await supabaseServer
    .from("messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true })
    .limit(2000);

  if (mErr) return NextResponse.json({ error: "db_failed", details: mErr.message }, { status: 500 });

  const { data: lead } = await supabaseServer
    .from("company_leads")
    .select("*")
    .eq("company_id", company_id)
    .eq("conversation_id", conversation_id)
    .maybeSingle();

  return NextResponse.json({ conversation: conv, lead: lead ?? null, messages: msgs ?? [] });
}
