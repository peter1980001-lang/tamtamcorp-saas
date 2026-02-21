import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("conversations")
    .insert({
      company_id,
      session_id: crypto.randomUUID(), // ✅ required
    })
    .select("id, company_id, session_id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversation: data });
}
