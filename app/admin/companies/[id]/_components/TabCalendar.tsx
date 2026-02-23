"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Divider, Input, UI } from "./ui";
import { fetchJson } from "./api";

type ApptRow = {
  id: string;
  company_id: string;
  start_at: string;
  end_at: string;
  status: "confirmed" | "pending" | "cancelled" | string;
  source: string;
  title: string | null;
  description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  conversation_id: string | null;
  company_lead_id: string | null;
  created_at: string;
};

function toneForStatus(status: string): "success" | "neutral" | "danger" | "info" {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed") return "success";
  if (s === "pending") return "info";
  if (s === "cancelled") return "danger";
  return "neutral";
}

function fmtLocal(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString();
}

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function icsEscape(s: string) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function toIcsUtc(dtIso: string) {
  const d = new Date(dtIso);
  // YYYYMMDDTHHMMSSZ
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

function downloadIcs(appt: ApptRow) {
  const uid = `${appt.id}@tamtamcorp`;
  const dtStart = toIcsUtc(appt.start_at);
  const dtEnd = toIcsUtc(appt.end_at);

  const summary = icsEscape(appt.title || "Appointment");
  const description = icsEscape(
    [
      appt.description || "",
      appt.contact_name ? `Contact: ${appt.contact_name}` : "",
      appt.contact_email ? `Email: ${appt.contact_email}` : "",
      appt.contact_phone ? `Phone: ${appt.contact_phone}` : "",
      appt.source ? `Source: ${appt.source}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  const now = new Date().toISOString();
  const dtStamp = toIcsUtc(now);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TamTam Corp//Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `appointment-${appt.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function TabCalendar(props: { companyId: string; setToast: (s: string) => void }) {
  const { companyId, setToast } = props;

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ApptRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [status, setStatus] = useState<"upcoming" | "all" | "confirmed" | "pending" | "cancelled">("upcoming");

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return toDateInputValue(d);
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return toDateInputValue(d);
  });

  function quickRange(kind: "today" | "7" | "30" | "all") {
    const now = new Date();
    if (kind === "today") {
      setFrom(toDateInputValue(now));
      setTo(toDateInputValue(now));
      return;
    }
    if (kind === "7") {
      setFrom(toDateInputValue(addDays(now, -2)));
      setTo(toDateInputValue(addDays(now, 7)));
      return;
    }
    if (kind === "30") {
      setFrom(toDateInputValue(addDays(now, -2)));
      setTo(toDateInputValue(addDays(now, 30)));
      return;
    }
    // all
    setFrom("");
    setTo("");
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("status", status);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    sp.set("limit", "150");
    return sp.toString();
  }, [status, from, to]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    setErr(null);
    try {
      const { ok, status: http, json } = await fetchJson(`/api/admin/companies/${companyId}/calendar?${query}`, {
        cache: "no-store",
      });

      if (!ok) {
        setRows([]);
        setErr(`HTTP ${http}: ${json?.error || "calendar_load_failed"}`);
        return;
      }
      setRows(Array.isArray(json?.appointments) ? (json.appointments as ApptRow[]) : []);
    } catch (e: any) {
      setRows([]);
      setErr(e?.message || "network_error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, query]);

  async function cancelAppointment(id: string) {
    if (!id) return;
    if (!confirm("Cancel this appointment?")) return;

    try {
      const { ok, status: http, json } = await fetchJson(`/api/admin/companies/${companyId}/calendar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel", appointment_id: id }),
      });

      if (!ok) {
        setToast(`Cancel failed: HTTP ${http} ${json?.error || ""}`.trim());
        return;
      }

      setToast("Appointment cancelled");
      void load();
    } catch (e: any) {
      setToast(e?.message || "cancel_failed");
    }
  }

function goToLeads(leadId?: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "leads");
  if (leadId) url.searchParams.set("lead_id", leadId);
  else url.searchParams.delete("lead_id");
  window.history.replaceState({}, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
}

  const stats = useMemo(() => {
    const total = rows.length;
    const confirmed = rows.filter((r) => String(r.status).toLowerCase() === "confirmed").length;
    const pending = rows.filter((r) => String(r.status).toLowerCase() === "pending").length;
    const cancelled = rows.filter((r) => String(r.status).toLowerCase() === "cancelled").length;
    return { total, confirmed, pending, cancelled };
  }, [rows]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card
        title="Calendar"
        subtitle="View and manage booked appointments. Use filters to narrow down upcoming or past bookings."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={load} variant="secondary" disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          {/* Quick ranges */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => quickRange("today")}>
              Today
            </Button>
            <Button variant="secondary" onClick={() => quickRange("7")}>
              Next 7 days
            </Button>
            <Button variant="secondary" onClick={() => quickRange("30")}>
              Next 30 days
            </Button>
            <Button variant="secondary" onClick={() => quickRange("all")}>
              All
            </Button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: UI.text2, marginBottom: 6 }}>Status</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: UI.radius,
                  border: `1px solid ${UI.border}`,
                  background: "#fff",
                  fontSize: 13.5,
                  fontWeight: 900,
                }}
              >
                <option value="upcoming">Upcoming</option>
                <option value="all">All</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: UI.text2, marginBottom: 6 }}>From</div>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>

            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: UI.text2, marginBottom: 6 }}>To</div>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <Badge text={`Total: ${stats.total}`} tone="neutral" />
              <Badge text={`Confirmed: ${stats.confirmed}`} tone="success" />
              <Badge text={`Pending: ${stats.pending}`} tone="info" />
              <Badge text={`Cancelled: ${stats.cancelled}`} tone="danger" />
            </div>
          </div>

          {err ? (
            <div style={{ border: "1px solid #FECACA", background: "#FEF2F2", padding: 12, borderRadius: 14, color: "#991B1B", fontSize: 13.5 }}>
              {err}
            </div>
          ) : null}

          <Divider />

          <div style={{ display: "grid", gap: 10 }}>
            {rows.length === 0 ? (
              <div style={{ color: UI.text2, fontSize: 13.5 }}>{loading ? "Loading…" : "No appointments found for this filter."}</div>
            ) : (
              rows.map((r) => {
                const s = String(r.status || "").toLowerCase();
                return (
                  <div
                    key={r.id}
                    style={{
                      border: `1px solid ${UI.border}`,
                      borderRadius: 16,
                      padding: 12,
                      background: "#fff",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <Badge text={s || "—"} tone={toneForStatus(s)} />
                        <div style={{ fontWeight: 1000, color: UI.text }}>
                          {r.title || "Appointment"}{" "}
                          <span style={{ fontWeight: 900, color: UI.text3 }}>•</span>{" "}
                          <span style={{ color: UI.text2, fontWeight: 900 }}>
                            {fmtLocal(r.start_at)} → {fmtLocal(r.end_at)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            downloadIcs(r);
                            setToast("ICS downloaded");
                          }}
                        >
                          ICS
                        </Button>

                        {r.company_lead_id ? (
                          <>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                navigator.clipboard.writeText(String(r.company_lead_id));
                                setToast("Lead ID copied");
                              }}
                            >
                              Copy Lead ID
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                navigator.clipboard.writeText(String(r.company_lead_id));
                                setToast("Lead ID copied — opening Leads tab");
                                goToLeads();
                              }}
                            >
                              Go to Leads
                            </Button>
                          </>
                        ) : null}

                        {s !== "cancelled" ? (
                          <Button variant="danger" onClick={() => cancelAppointment(r.id)}>
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 13.5, color: UI.text2 }}>
                      <div>
                        <span style={{ fontWeight: 950, color: UI.text }}>Contact:</span>{" "}
                        {r.contact_name || "—"}{" "}
                        {r.contact_email ? <span style={{ color: UI.text2 }}>• {r.contact_email}</span> : null}
                        {r.contact_phone ? <span style={{ color: UI.text2 }}>• {r.contact_phone}</span> : null}
                      </div>

                      <div>
                        <span style={{ fontWeight: 950, color: UI.text }}>Source:</span> {r.source || "—"}
                        {r.conversation_id ? <span style={{ color: UI.text2 }}> • conversation: {String(r.conversation_id).slice(0, 8)}…</span> : null}
                      </div>

                      {r.description ? (
                        <div style={{ color: UI.text2, lineHeight: 1.45 }}>
                          <span style={{ fontWeight: 950, color: UI.text }}>Notes:</span> {r.description}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}