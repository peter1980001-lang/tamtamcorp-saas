import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

function normalizeHost(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: company_id } = await context.params;

  await requireCompanyAccess(company_id);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const raw = body?.allowed_domains;

  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { error: "allowed_domains_required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const normalized = uniq(
    raw
      .filter((x: any) => typeof x === "string")
      .map((x: string) => normalizeHost(x))
      .filter((x: string) => x.length > 0)
  );

  for (const d of normalized) {
    if (/\s/.test(d) || d.includes("/") || d.includes("http")) {
      return NextResponse.json(
        { error: "invalid_domain", domain: d },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }
  }

  const { data: updated, error: uErr } = await supabaseServer
    .from("company_keys")
    .update({ allowed_domains: normalized })
    .eq("company_id", company_id)
    .select("company_id, public_key, secret_key, allowed_domains, created_at, updated_at")
    .single();

  if (uErr) {
    return NextResponse.json(
      { error: "db_update_failed", details: uErr.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, keys: updated },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
