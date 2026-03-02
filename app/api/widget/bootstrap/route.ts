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
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .toLowerCase();
}

function getHostFromHeaders(req: Request) {
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

  const public_key = String(body?.public_key || body?.client || "").trim();
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

  let isOwner = false;
  try {
    const auth = await requireOwner();
    isOwner = !!auth?.ok;
  } catch {
    isOwner = false;
  }

  if (!isOwner) {
    const siteHost = normalizeHost(body?.site || "");
    const headerHost = getHostFromHeaders(req);
    const host = siteHost || headerHost;

    if (!host) {
      return NextResponse.json({ error: "missing_origin" }, { status: 400 });
    }

    const allowed = (keyRow.allowed_domains || [])
      .map((d: any) => String(d || "").trim().toLowerCase())
      .filter(Boolean);

    if (allowed.length === 0) {
      return NextResponse.json({ error: "domain_not_configured", host }, { status: 403 });
    }

    if (!allowed.includes(host)) {
      return NextResponse.json({ error: "domain_not_allowed", host }, { status: 403 });
    }
  }

  if (!process.env.WIDGET_JWT_SECRET) {
    return NextResponse.json({ error: "missing_widget_jwt_secret" }, { status: 500 });
  }

  const token = jwt.sign({ company_id: keyRow.company_id, public_key }, process.env.WIDGET_JWT_SECRET!, {
    expiresIn: "20m",
  });

  return NextResponse.json({ token, company_id: keyRow.company_id });
}