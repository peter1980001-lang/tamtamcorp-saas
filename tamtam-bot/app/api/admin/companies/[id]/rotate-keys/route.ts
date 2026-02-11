import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

function genKey(prefix: "pk" | "sk") {
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  // Next 16 can deliver params async in some contexts → handle both
  const params = "then" in (ctx.params as any) ? await (ctx.params as Promise<{ id: string }>) : (ctx.params as { id: string });
  const company_id = String(params.id || "").trim();

  if (!company_id) {
    return NextResponse.json({ error: "missing_company_id" }, { status: 400 });
  }

  const public_key = genKey("pk");
  const secret_key = genKey("sk");

  // If row exists, update. If not, insert.
  const { data: existing, error: eErr } = await supabaseServer
    .from("company_keys")
    .select("company_id")
    .eq("company_id", company_id)
    .maybeSingle();

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });

  const { error } = existing
    ? await supabaseServer
        .from("company_keys")
        .update({ public_key, secret_key })
        .eq("company_id", company_id)
    : await supabaseServer
        .from("company_keys")
        .insert({
          company_id,
          public_key,
          secret_key,
          allowed_domains: [],
        });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, public_key, secret_key });
}
