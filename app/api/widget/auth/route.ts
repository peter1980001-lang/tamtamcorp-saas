export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/adminGuard";

function normalizeHost(input: string) {
  const s = String(input || "").trim();
  if (!s) return "";
  return s
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "") // keep only host[:port]
    .toLowerCase();
}

function getHost(req: Request) {
  // Prefer Origin; fallback to Referer (Safari/iframe cases)
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";

  const h1 = normalizeHost(origin);
  if (h1) return h1;

  const h2 = normalizeHost(referer);
  if (h2) return h2;

  return "";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const public_key = String(body?.public_key || "").trim();

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

  // Owner bypass (admin test convenience)
  let isOwner = false;
  try {
    const auth = await requireOwner();
    isOwner = !!auth?.ok;
  } catch {
    isOwner = false;
  }

  if (!isOwner) {
    const host = getHost(req);
    if (!host) {
      return NextResponse.json({ error: "missing_origin" }, { status: 400 });
    }

    const allowed = (keyRow.allowed_domains || [])
      .map((d: any) => String(d || "").trim().toLowerCase())
      .filter(Boolean);

    // 🔒 SaaS default: empty allowlist = block
    if (allowed.length === 0) {
      return NextResponse.json({ error: "domain_not_configured", host }, { status: 403 });
    }

    if (!allowed.includes(host)) {
      return NextResponse.json({ error: "domain_not_allowed", host }, { status: 403 });
    }
  }

  // ✅ Short-lived token
  const token = jwt.sign(
    { company_id: keyRow.company_id, public_key },
    process.env.WIDGET_JWT_SECRET!,
    { expiresIn: "20m" }
  );

  return NextResponse.json({ token, company_id: keyRow.company_id });
}
