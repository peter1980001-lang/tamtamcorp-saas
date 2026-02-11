import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

function genKey(prefix: "pk" | "sk") {
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}

export async function POST(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const name = String(body.name).trim();
  const status = (body.status ? String(body.status) : "active") as string;

  const allowed_domains = Array.isArray(body.allowed_domains)
    ? body.allowed_domains.map((d: any) => String(d).trim()).filter(Boolean)
    : [];

  // 1) create company
  const { data: company, error: cErr } = await supabaseServer
    .from("companies")
    .insert({ name, status })
    .select("id,name,status,created_at")
    .single();

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const company_id = company.id;

  // 2) create settings (optional fields)
  const { error: sErr } = await supabaseServer.from("company_settings").insert({
    company_id,
    limits_json: body.limits_json ?? {},
    branding_json: body.branding_json ?? {},
  });

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // 3) create keys
  const public_key = genKey("pk");
  const secret_key = genKey("sk");

  const { error: kErr } = await supabaseServer.from("company_keys").insert({
    company_id,
    public_key,
    secret_key,
    allowed_domains,
  });

  if (kErr) return NextResponse.json({ error: kErr.message }, { status: 500 });

  return NextResponse.json({
    company,
    keys: { public_key, secret_key },
  });
}
