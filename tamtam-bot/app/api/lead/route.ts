import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabaseServer";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const match = h.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

  let payload: any;
  try {
    payload = jwt.verify(token, process.env.WIDGET_JWT_SECRET!);
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const company_id = payload.company_id as string;
  if (!company_id) return NextResponse.json({ error: "missing_company" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const name = (body.name as string) || null;
  const email = (body.email as string) || null;
  const phone = (body.phone as string) || null;
  const note = (body.note as string) || null;
  const conversation_id = (body.conversation_id as string) || null;

  if (!email && !phone) {
    return NextResponse.json({ error: "email_or_phone_required" }, { status: 400 });
  }

  const { error } = await supabaseServer.from("leads").insert({
    company_id,
    conversation_id,
    name,
    email,
    phone,
    note,
  });

  if (error) return NextResponse.json({ error: "db_insert_failed", details: error }, { status: 500 });

  return NextResponse.json({ ok: true });
}
