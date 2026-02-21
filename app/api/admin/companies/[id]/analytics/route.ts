// app/api/admin/companies/[id]/analytics/route.ts
export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

function toISO(d: Date) {
  return d.toISOString();
}

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function daysRangeUTC(daysBack: number) {
  const today = startOfDayUTC(new Date());
  const start = addDaysUTC(today, -(daysBack - 1));
  const out: string[] = [];
  for (let i = 0; i < daysBack; i++) {
    const cur = addDaysUTC(start, i);
    out.push(cur.toISOString().slice(0, 10));
  }
  return out;
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function isQualified(q: any) {
  if (!q) return false;
  if (q.qualified === true) return true;
  const s = String(q.status || q.stage || "").toLowerCase();
  return s === "qualified" || s === "hot" || s === "won";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;

  // ✅ Auth: owner OR mapped company_admin
  const gate = await requireCompanyAccess(companyId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const today0 = startOfDayUTC(new Date());
  const since7 = addDaysUTC(today0, -6);
  const since14 = addDaysUTC(today0, -13);
  const since30 = addDaysUTC(today0, -29);

  // -----------------------
  // Conversations (30d)
  // -----------------------
  const { data: conv30, error: convErr } = await supabaseServer
    .from("conversations")
    .select("id, created_at")
    .eq("company_id", companyId)
    .gte("created_at", toISO(since30))
    .order("created_at", { ascending: true });

  if (convErr) {
    return NextResponse.json(
      { error: "conversations_fetch_failed", details: convErr.message },
      { status: 500 }
    );
  }

  // -----------------------
  // Leads (30d)
  // -----------------------
  const { data: leads30, error: leadsErr } = await supabaseServer
    .from("company_leads")
    .select("id, created_at, qualification_json")
    .eq("company_id", companyId)
    .gte("created_at", toISO(since30))
    .order("created_at", { ascending: true });

  if (leadsErr) {
    return NextResponse.json(
      { error: "leads_fetch_failed", details: leadsErr.message },
      { status: 500 }
    );
  }

  const conv30Arr = conv30 || [];
  const leads30Arr = leads30 || [];

  const conv7 = conv30Arr.filter((c) => new Date(c.created_at) >= since7).length;
  const conv14 = conv30Arr.filter((c) => new Date(c.created_at) >= since14).length;
  const conv30Count = conv30Arr.length;

  const leads7 = leads30Arr.filter((l) => new Date(l.created_at) >= since7).length;
  const leads14 = leads30Arr.filter((l) => new Date(l.created_at) >= since14).length;
  const leads30Count = leads30Arr.length;

  const qualified30 = leads30Arr.filter((l) => isQualified((l as any).qualification_json)).length;
  const qualified7 = leads30Arr.filter(
    (l) => new Date(l.created_at) >= since7 && isQualified((l as any).qualification_json)
  ).length;
  const qualified14 = leads30Arr.filter(
    (l) => new Date(l.created_at) >= since14 && isQualified((l as any).qualification_json)
  ).length;

  const leadPerChat30 = conv30Count > 0 ? (leads30Count / conv30Count) * 100 : 0;
  const qualPerLead30 = leads30Count > 0 ? (qualified30 / leads30Count) * 100 : 0;

  const prev7Start = addDaysUTC(since7, -7);
  const prev7End = addDaysUTC(since7, -1);

  const convPrev7 = conv30Arr.filter((c) => {
    const t = new Date(c.created_at);
    return t >= prev7Start && t <= prev7End;
  }).length;

  const leadsPrev7 = leads30Arr.filter((l) => {
    const t = new Date(l.created_at);
    return t >= prev7Start && t <= prev7End;
  }).length;

  const qualifiedPrev7 = leads30Arr.filter((l) => {
    const t = new Date(l.created_at);
    return t >= prev7Start && t <= prev7End && isQualified((l as any).qualification_json);
  }).length;

  // -----------------------
  // 14-day series
  // -----------------------
  const days = daysRangeUTC(14);
  const map = new Map<string, { chats: number; leads: number; qualified: number }>();
  for (const d of days) map.set(d, { chats: 0, leads: 0, qualified: 0 });

  for (const c of conv30Arr) {
    const day = new Date(c.created_at).toISOString().slice(0, 10);
    if (map.has(day)) map.get(day)!.chats += 1;
  }

  for (const l of leads30Arr) {
    const day = new Date(l.created_at).toISOString().slice(0, 10);
    if (map.has(day)) {
      map.get(day)!.leads += 1;
      if (isQualified((l as any).qualification_json)) map.get(day)!.qualified += 1;
    }
  }

  const series_14d = days.map((d) => ({ day: d, ...map.get(d)! }));

  return NextResponse.json({
    company_id: companyId,
    generated_at: new Date().toISOString(),
    kpis: {
      chats_7d: conv7,
      chats_14d: conv14,
      chats_30d: conv30Count,
      leads_7d: leads7,
      leads_14d: leads14,
      leads_30d: leads30Count,
      qualified_7d: qualified7,
      qualified_14d: qualified14,
      qualified_30d: qualified30,
      lead_per_chat_30d_pct: leadPerChat30,
      qualified_per_lead_30d_pct: qualPerLead30,
    },
    trends: {
      chats_7d_pct_change: pctChange(conv7, convPrev7),
      leads_7d_pct_change: pctChange(leads7, leadsPrev7),
      qualified_7d_pct_change: pctChange(qualified7, qualifiedPrev7),
    },
    series_14d,
  });
}