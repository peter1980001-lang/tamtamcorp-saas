export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

function genKey(prefix: "pk" | "sk") {
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}

function maskSecret(s: string) {
  if (!s) return "";
  if (s.length <= 10) return "********";
  return s.slice(0, 6) + "…" + s.slice(-4);
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const company_id = String(id || "").trim();
  if (!company_id)
    return NextResponse.json({ ok: false, error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok)
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: auth.status });

  const public_key = genKey("pk");
  const secret_key = genKey("sk");

  const { data, error } = await supabaseServer
    .from("company_keys")
    .update({
      public_key,
      secret_key,
      created_at: new Date().toISOString(),
    })
    .eq("company_id", company_id)
    .select("public_key, secret_key, created_at")
    .maybeSingle();

  if (error)
    return NextResponse.json(
      { ok: false, error: "db_failed", details: error.message },
      { status: 500 }
    );

  return NextResponse.json({
    ok: true,
    public_key: data?.public_key ?? public_key,
    secret_key: data?.secret_key ?? secret_key,
    secret_key_masked: maskSecret(data?.secret_key ?? secret_key),
    keys_rotated_at: data?.created_at ?? new Date().toISOString(),
  });
}
