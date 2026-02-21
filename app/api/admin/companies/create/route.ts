import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireOwner } from "@/lib/adminGuard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

function genKey(prefix: "pk" | "sk") {
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}

// "localhost:3000, example.com"  -> ["localhost:3000","example.com"]
function parseAllowedDomains(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((d) => String(d).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export async function POST(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  if (!body?.name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const name = String(body.name).trim();
  const status = (body.status ? String(body.status) : "active") as string;

  // IMPORTANT: your UI sends a comma-separated string, so we parse BOTH string and array
  const allowed_domains = parseAllowedDomains(body.allowed_domains);

  // 1) create company
  const { data: company, error: cErr } = await supabaseServer
    .from("companies")
    .insert({ name, status })
    .select("id,name,status,created_at")
    .single();

  if (cErr || !company?.id) {
    return NextResponse.json({ error: cErr?.message ?? "create_company_failed" }, { status: 500 });
  }

  const company_id = company.id;

  // 2) create settings (IDEMPOTENT: if it already exists, update instead of crashing)
  const { error: sErr } = await supabaseServer
    .from("company_settings")
    .upsert(
      {
        company_id,
        limits_json: body.limits_json ?? {},
        branding_json: body.branding_json ?? {},
      },
      { onConflict: "company_id" }
    );

  if (sErr) {
    // cleanup: delete the company we just created to avoid half-created tenants
    await supabase.from("companies").delete().eq("id", company_id);
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  // 3) create keys (IDEMPOTENT too)
  // If the request is sent twice, this avoids "duplicate key" errors.
  const public_key = genKey("pk");
  const secret_key = genKey("sk");

  const { error: kErr } = await supabaseServer
    .from("company_keys")
    .upsert(
      {
        company_id,
        public_key,
        secret_key,
        allowed_domains,
      },
      { onConflict: "company_id" }
    );

  if (kErr) {
    // cleanup: remove created company + settings if keys fail
    await supabase.from("company_settings").delete().eq("company_id", company_id);
    await supabase.from("companies").delete().eq("id", company_id);
    return NextResponse.json({ error: kErr.message }, { status: 500 });
  }

  return NextResponse.json({
    company,
    keys: { public_key, secret_key },
  });
}
