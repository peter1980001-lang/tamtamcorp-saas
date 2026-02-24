// lib/integrations/calendarBusy.ts
export const runtime = "nodejs";

import { supabaseServer } from "@/lib/supabaseServer";
import { PROVIDERS, type ProviderKey } from "@/lib/integrations/providers";

export type BusyBlock = { start: Date; end: Date };

export type ExternalBusyResult = {
  blocks: BusyBlock[];
  warning: boolean; // true if at least one provider failed (fail-open)
  sources: Array<"google_calendar" | "microsoft_calendar">;
};

function isExpiredSoon(iso: string | null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t < Date.now() + 60_000; // refresh 1 min early
}

async function refreshToken(provider: ProviderKey, refresh_token: string) {
  const cfg = PROVIDERS[provider];

  const client_id = process.env[cfg.clientIdEnv] || "";
  const client_secret = process.env[cfg.clientSecretEnv] || "";
  if (!client_id || !client_secret) throw new Error("missing_oauth_env");

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refresh_token);
  body.set("client_id", client_id);
  body.set("client_secret", client_secret);

  // MS Graph token refresh is happier with scopes present
  if (provider === "microsoft_calendar") {
    body.set("scope", PROVIDERS.microsoft_calendar.scopes.join(" "));
  }

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.access_token) {
    throw new Error(`refresh_failed:${res.status}:${json?.error || json?.message || "unknown"}`);
  }

  const expires_in = Number(json.expires_in || 0);
  const token_expires_at = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

  return {
    access_token: String(json.access_token),
    token_expires_at,
    // some providers may rotate refresh tokens
    refresh_token: json.refresh_token ? String(json.refresh_token) : null,
    raw: json,
  };
}

async function ensureFreshRow(row: any) {
  if (!isExpiredSoon(row.token_expires_at)) return row;
  if (!row.refresh_token) return row;

  const provider = row.provider as ProviderKey;
  const r = await refreshToken(provider, String(row.refresh_token));

  await supabaseServer
    .from("company_integrations")
    .update({
      access_token: r.access_token,
      token_expires_at: r.token_expires_at,
      refresh_token: r.refresh_token ?? row.refresh_token,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  return {
    ...row,
    access_token: r.access_token,
    token_expires_at: r.token_expires_at,
    refresh_token: r.refresh_token ?? row.refresh_token,
  };
}

async function fetchGoogleBusy(access_token: string, timeMin: string, timeMax: string): Promise<BusyBlock[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`google_freebusy_failed:${res.status}:${json?.error?.message || json?.error || "unknown"}`);

  const busy = json?.calendars?.primary?.busy || [];
  return busy
    .map((b: any) => ({ start: new Date(b.start), end: new Date(b.end) }))
    .filter((x: BusyBlock) => Number.isFinite(x.start.getTime()) && Number.isFinite(x.end.getTime()) && x.start < x.end);
}

async function msGetMe(access_token: string): Promise<{ mail: string | null; userPrincipalName: string | null }> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`ms_me_failed:${res.status}`);
  return {
    mail: json?.mail ? String(json.mail) : null,
    userPrincipalName: json?.userPrincipalName ? String(json.userPrincipalName) : null,
  };
}

async function fetchMicrosoftBusy(access_token: string, timeMinIso: string, timeMaxIso: string): Promise<BusyBlock[]> {
  // getSchedule expects schedules like user mail/UPN, not "me"
  const me = await msGetMe(access_token);
  const scheduleId = me.mail || me.userPrincipalName;
  if (!scheduleId) throw new Error("ms_missing_schedule_id");

  const res = await fetch("https://graph.microsoft.com/v1.0/me/calendar/getSchedule", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      schedules: [scheduleId],
      startTime: { dateTime: timeMinIso, timeZone: "UTC" },
      endTime: { dateTime: timeMaxIso, timeZone: "UTC" },
      availabilityViewInterval: 30,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`ms_getschedule_failed:${res.status}:${json?.error?.message || "unknown"}`);

  const items = json?.value?.[0]?.scheduleItems || [];
  return items
    .map((i: any) => ({
      start: new Date(i?.start?.dateTime),
      end: new Date(i?.end?.dateTime),
    }))
    .filter((x: BusyBlock) => Number.isFinite(x.start.getTime()) && Number.isFinite(x.end.getTime()) && x.start < x.end);
}

/**
 * Fail-open by design:
 * - if provider fails, returns warning=true but still returns blocks from others
 */
export async function getExternalBusyBlocks(
  company_id: string,
  rangeStartIso: string,
  rangeEndIso: string
): Promise<ExternalBusyResult> {
  const { data, error } = await supabaseServer
    .from("company_integrations")
    .select("id,company_id,provider,status,access_token,refresh_token,token_expires_at,provider_meta,updated_at")
    .eq("company_id", company_id)
    .eq("status", "connected")
    .in("provider", ["google_calendar", "microsoft_calendar"]);

  if (error) return { blocks: [], warning: true, sources: [] };
  if (!data?.length) return { blocks: [], warning: false, sources: [] };

  const blocks: BusyBlock[] = [];
  let warning = false;

  const sourcesSet = new Set<"google_calendar" | "microsoft_calendar">();

  for (const row of data) {
    const provider = row.provider as "google_calendar" | "microsoft_calendar";
    try {
      const fresh = await ensureFreshRow(row);
      const token = String(fresh.access_token || "");
      if (!token) continue;

      if (provider === "google_calendar") {
        const b = await fetchGoogleBusy(token, rangeStartIso, rangeEndIso);
        blocks.push(...b);
        sourcesSet.add("google_calendar");
      } else if (provider === "microsoft_calendar") {
        const b = await fetchMicrosoftBusy(token, rangeStartIso, rangeEndIso);
        blocks.push(...b);
        sourcesSet.add("microsoft_calendar");
      }
    } catch {
      warning = true;
    }
  }

  return {
    blocks,
    warning,
    sources: Array.from(sourcesSet),
  };
}