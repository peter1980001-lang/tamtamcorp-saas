export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

function asDateIso(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function esc(s: any) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const company_id = String(id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const from = url.searchParams.get("from"); // ISO
  const to = url.searchParams.get("to"); // ISO
  const status = url.searchParams.get("status"); // optional: confirmed/pending/cancelled

  const q = supabaseServer
    .from("company_appointments")
    .select("id,start_at,end_at,status,title,description,contact_name,contact_email,contact_phone,source")
    .eq("company_id", company_id)
    .order("start_at", { ascending: true });

  if (from) q.gte("start_at", from);
  if (to) q.lte("start_at", to);
  if (status) q.eq("status", status);

  const { data: appts, error } = await q;
  if (error) return NextResponse.json({ error: "appointments_load_failed" }, { status: 500 });

  const now = new Date();
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//TamTam//Booking//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  for (const a of appts || []) {
    const start = new Date(String((a as any).start_at));
    const end = new Date(String((a as any).end_at));
    const uid = `${String((a as any).id)}@tamtam`;
    const dtstamp = asDateIso(now);

    const summary = esc((a as any).title || "Appointment");
    const descr = esc(
      [
        (a as any).description ? String((a as any).description) : "",
        (a as any).contact_name ? `Name: ${(a as any).contact_name}` : "",
        (a as any).contact_email ? `Email: ${(a as any).contact_email}` : "",
        (a as any).contact_phone ? `Phone: ${(a as any).contact_phone}` : "",
        (a as any).source ? `Source: ${(a as any).source}` : "",
        (a as any).status ? `Status: ${(a as any).status}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${asDateIso(start)}`);
    lines.push(`DTEND:${asDateIso(end)}`);
    lines.push(`SUMMARY:${summary}`);
    if (descr) lines.push(`DESCRIPTION:${descr}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const ics = lines.join("\r\n");
  const filename = `tamtam-company-${company_id}-calendar.ics`;

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}