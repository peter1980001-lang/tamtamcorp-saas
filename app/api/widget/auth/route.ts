import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const public_key = String(body?.public_key || "");

  if (!public_key.startsWith("pk_")) {
    return NextResponse.json({ error: "invalid_public_key" }, { status: 400 });
  }

  const { data: keyRow, error } = await supabaseServer
    .from("company_keys")
    .select("company_id, allowed_domains")
    .eq("public_key", public_key)
    .maybeSingle();

  if (error || !keyRow) {
    return NextResponse.json({ error: "unknown_key" }, { status: 404 });
  }

  // OPTIONAL allowlist check (for real sites; localhost ok if included)
  const origin = req.headers.get("origin") || "";
  const host = origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const allowed = (keyRow.allowed_domains || []).map((d: string) => d.toLowerCase());

  if (allowed.length > 0 && host) {
    const ok = allowed.includes(host.toLowerCase());
    if (!ok) return NextResponse.json({ error: "domain_not_allowed", host }, { status: 403 });
  }

  const token = jwt.sign(
    { company_id: keyRow.company_id, public_key },
    process.env.WIDGET_JWT_SECRET!,
    { expiresIn: "12h" }
  );

  return NextResponse.json({ token, company_id: keyRow.company_id });
}
