// app/api/widget/availability/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkBillingGate } from "@/lib/billingGate";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function asIso(d: Date) {
  return d.toISOString();
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Convert a "local time in tz" into a UTC Date.
 * This uses an Intl-based offset correction (works without external libs).
 */
function zonedTimeToUtc(params: { year: number; month: number; day: number; hour: number; minute: number }, timeZone: string) {
  const approxUtc = new Date(Date.UTC(params.year, params.month - 1, params.day, params.hour, params.minute, 0));
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(approxUtc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");

  const asIfLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const intended = Date.UTC(params.year, params.month - 1, params.day, params.hour, params.minute, 0);

  // Difference between what approxUtc represents in tz and what we intended -> correct it
  const diffMs = asIfLocal - intended;
  return new Date(approxUtc.getTime() - diffMs);
}

function getTzParts(d: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  // weekday mapping
  const wd = get("weekday"); // "Mon", "Tue", ...
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = map[wd] ?? 0;

  return { year, month, day, hour, minute, weekday };
}

function addDaysLocal(date: { year: number; month: number; day: number }, days: number) {
  // Safe local-date add using UTC noon anchor
  const anchor = new Date(Date.UTC(date.year, date.month - 1, date.day, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return { year: anchor.getUTCFullYear(), month: anchor.getUTCMonth() + 1, day: anchor.getUTCDate() };
}

type Settings = {
  timezone: string;
  booking_duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
};

async function loadSettings(company_id: string): Promise<Settings> {
  const { data } = await supabaseServer
    .from("company_calendar_settings")
    .select("timezone, booking_duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_days_ahead")
    .eq("company_id", company_id)
    .maybeSingle();

  return {
    timezone: String(data?.timezone || "UTC"),
    booking_duration_minutes: clampInt(data?.booking_duration_minutes, 5, 480, 30),
    buffer_before_minutes: clampInt(data?.buffer_before_minutes, 0, 240, 0),
    buffer_after_minutes: clampInt(data?.buffer_after_minutes, 0, 240, 0),
    min_notice_minutes: clampInt(data?.min_notice_minutes, 0, 43200, 60),
    max_days_ahead: clampInt(data?.max_days_ahead, 1, 365, 30),
  };
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

  const company_id = String(payload.company_id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company" }, { status: 401 });

  const bill = await checkBillingGate(company_id);
  if (!bill.ok) return NextResponse.json({ error: bill.code }, { status: 402 });

  const body = await req.json().catch(() => null);

  const duration_minutes = clampInt(body?.duration_minutes, 5, 240, 0); // 0 = default
  const step_minutes = clampInt(body?.step_minutes, 5, 60, 15);
  const limit = clampInt(body?.limit, 1, 50, 12);

  const settings = await loadSettings(company_id);
  const tz = settings.timezone;

  const duration = duration_minutes > 0 ? duration_minutes : settings.booking_duration_minutes;

  // Time range
  const now = new Date();
  const minStart = new Date(now.getTime() + settings.min_notice_minutes * 60_000);
  const maxEnd = new Date(now.getTime() + settings.max_days_ahead * 24 * 60 * 60_000);

  // Load weekly rules
  const { data: rules, error: rErr } = await supabaseServer
    .from("company_availability_rules")
    .select("weekday,start_time,end_time,is_active")
    .eq("company_id", company_id)
    .eq("is_active", true);

  if (rErr) return NextResponse.json({ error: "rules_load_failed" }, { status: 500 });
  const activeRules = (rules || []) as Array<{ weekday: number; start_time: string; end_time: string; is_active: boolean }>;

  // Load exceptions in date span (local date range)
  const localNow = getTzParts(now, tz);
  const localStartDate = { year: localNow.year, month: localNow.month, day: localNow.day };

  // We'll query exceptions by date range in UTC-derived local range
  // Build local end date by adding max_days_ahead
  const localEndDate = addDaysLocal(localStartDate, settings.max_days_ahead);

  const startIso = `${String(localStartDate.year).padStart(4, "0")}-${String(localStartDate.month).padStart(2, "0")}-${String(
    localStartDate.day
  ).padStart(2, "0")}`;
  const endIso = `${String(localEndDate.year).padStart(4, "0")}-${String(localEndDate.month).padStart(2, "0")}-${String(localEndDate.day).padStart(
    2,
    "0"
  )}`;

  const { data: exceptions, error: eErr } = await supabaseServer
    .from("company_availability_exceptions")
    .select("day,is_closed,start_time,end_time")
    .eq("company_id", company_id)
    .gte("day", startIso)
    .lte("day", endIso);

  if (eErr) return NextResponse.json({ error: "exceptions_load_failed" }, { status: 500 });

  const exceptionByDay = new Map<string, { is_closed: boolean; start_time: string | null; end_time: string | null }>();
  for (const ex of exceptions || []) {
    exceptionByDay.set(String((ex as any).day), {
      is_closed: Boolean((ex as any).is_closed),
      start_time: (ex as any).start_time ?? null,
      end_time: (ex as any).end_time ?? null,
    });
  }

  // Load busy appointments + holds in UTC range
  const { data: appts, error: aErr } = await supabaseServer
    .from("company_appointments")
    .select("start_at,end_at,status")
    .eq("company_id", company_id)
    .neq("status", "cancelled")
    .gte("start_at", asIso(new Date(minStart.getTime() - 24 * 60 * 60_000)))
    .lte("start_at", asIso(maxEnd));

  if (aErr) return NextResponse.json({ error: "appointments_load_failed" }, { status: 500 });

  const { data: holds, error: hErr } = await supabaseServer
    .from("company_appointment_holds")
    .select("start_at,end_at,expires_at")
    .eq("company_id", company_id)
    .gt("expires_at", asIso(now))
    .gte("start_at", asIso(new Date(minStart.getTime() - 24 * 60 * 60_000)))
    .lte("start_at", asIso(maxEnd));

  if (hErr) return NextResponse.json({ error: "holds_load_failed" }, { status: 500 });

  const busy: Array<{ start: Date; end: Date }> = [];

  const expandBefore = settings.buffer_before_minutes * 60_000;
  const expandAfter = settings.buffer_after_minutes * 60_000;

  for (const a of appts || []) {
    const s = new Date(String((a as any).start_at));
    const e = new Date(String((a as any).end_at));
    busy.push({ start: new Date(s.getTime() - expandBefore), end: new Date(e.getTime() + expandAfter) });
  }

  for (const ho of holds || []) {
    const s = new Date(String((ho as any).start_at));
    const e = new Date(String((ho as any).end_at));
    busy.push({ start: new Date(s.getTime() - expandBefore), end: new Date(e.getTime() + expandAfter) });
  }

  // Generate next slots
  const results: Array<{ start_at: string; end_at: string }> = [];

  // Iterate local days (0..max_days_ahead)
  for (let dayOffset = 0; dayOffset <= settings.max_days_ahead && results.length < limit; dayOffset++) {
    const d = addDaysLocal(localStartDate, dayOffset);
    const dayStr = `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

    // Determine weekday in tz using local noon anchor
    const noonUtc = zonedTimeToUtc({ year: d.year, month: d.month, day: d.day, hour: 12, minute: 0 }, tz);
    const wd = getTzParts(noonUtc, tz).weekday;

    // Determine windows: either exception override, or weekly rules
    const ex = exceptionByDay.get(dayStr);

    let windows: Array<{ startH: number; startM: number; endH: number; endM: number }> = [];

    if (ex) {
      if (ex.is_closed) {
        windows = [];
      } else {
        const [sh, sm] = String(ex.start_time).split(":").map((x) => Number(x));
        const [eh, em] = String(ex.end_time).split(":").map((x) => Number(x));
        windows = [{ startH: sh, startM: sm, endH: eh, endM: em }];
      }
    } else {
      const dayRules = activeRules.filter((r) => Number(r.weekday) === wd);
      for (const r of dayRules) {
        const [sh, sm] = String(r.start_time).split(":").map((x) => Number(x));
        const [eh, em] = String(r.end_time).split(":").map((x) => Number(x));
        windows.push({ startH: sh, startM: sm, endH: eh, endM: em });
      }
    }

    if (!windows.length) continue;

    for (const w of windows) {
      // Generate slots within window
      // slotStart from w.start to w.end-duration
      const windowStartUtc = zonedTimeToUtc({ year: d.year, month: d.month, day: d.day, hour: w.startH, minute: w.startM }, tz);
      const windowEndUtc = zonedTimeToUtc({ year: d.year, month: d.month, day: d.day, hour: w.endH, minute: w.endM }, tz);

      const latestStart = new Date(windowEndUtc.getTime() - duration * 60_000);

      for (
        let cur = new Date(windowStartUtc.getTime());
        cur <= latestStart && results.length < limit;
        cur = new Date(cur.getTime() + step_minutes * 60_000)
      ) {
        const slotStart = cur;
        const slotEnd = new Date(cur.getTime() + duration * 60_000);

        if (slotStart < minStart) continue;
        if (slotEnd > maxEnd) continue;

        // Busy check
        let ok = true;
        for (const b of busy) {
          if (intervalsOverlap(slotStart, slotEnd, b.start, b.end)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        results.push({ start_at: asIso(slotStart), end_at: asIso(slotEnd) });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    company_id,
    timezone: tz,
    duration_minutes: duration,
    step_minutes,
    slots: results,
  });
}