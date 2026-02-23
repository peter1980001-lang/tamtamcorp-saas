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

type LeadRow = {
  id: string;
  company_id: string;
  conversation_id: string;
  channel: string | null;
  source: string | null;
  lead_state: string;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  intent_score: number;
  score_total: number;
  score_band: string;
  tags: string[];
  admin_notes: string | null;
  lead_preview?: string | null;
  lead_summary?: string | null;
  last_touch_at: string | null;
  created_at: string;
  updated_at: string;
};

type Slot = { start_at: string; end_at: string };

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
      appt.status ? `Status: ${appt.status}` : "",
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

  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [publicErr, setPublicErr] = useState<string | null>(null);

  // Leads cache
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadById, setLeadById] = useState<Map<string, LeadRow>>(new Map());

  // Slot-based reschedule modal state
  const [rsOpen, setRsOpen] = useState(false);
  const [rsRow, setRsRow] = useState<ApptRow | null>(null);
  const [rsSlots, setRsSlots] = useState<Slot[]>([]);
  const [rsSelected, setRsSelected] = useState<Slot | null>(null);
  const [rsLoading, setRsLoading] = useState(false);
  const [rsSaving, setRsSaving] = useState(false);

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
      const appts = Array.isArray(json?.appointments) ? (json.appointments as ApptRow[]) : [];
      setRows(appts);
    } catch (e: any) {
      setRows([]);
      setErr(e?.message || "network_error");
    } finally {
      setLoading(false);
    }
  }

  async function loadPublicLink() {
    if (!companyId) return;
    setPublicErr(null);
    try {
      const { ok, status: http, json } = await fetchJson(`/api/admin/companies/${companyId}/public-booking`, {
        cache: "no-store",
      });
      if (!ok) {
        setPublicLink(null);
        setPublicKey(null);
        setPublicErr(`HTTP ${http}: ${json?.error || "public_booking_load_failed"}`);
        return;
      }
      setPublicLink(String(json?.link || ""));
      setPublicKey(String(json?.public_booking_key || ""));
    } catch (e: any) {
      setPublicErr(e?.message || "public_booking_load_failed");
    }
  }

  async function loadLeadsIfNeeded() {
    if (!companyId) return;
    // If there are no rows, don't waste time loading leads
    if (rows.length === 0) {
      setLeadById(new Map());
      return;
    }

    setLeadsLoading(true);
    try {
      const { ok, status: http, json } = await fetchJson(`/api/admin/companies/${companyId}/leads`, { cache: "no-store" });
      if (!ok) {
        // not fatal for calendar
        setToast(`Leads load failed: HTTP ${http} ${json?.error || ""}`.trim());
        setLeadById(new Map());
        return;
      }
      const leads = Array.isArray(json?.leads) ? (json.leads as LeadRow[]) : [];
      const m = new Map<string, LeadRow>();
      for (const l of leads) m.set(String(l.id), l);
      setLeadById(m);
    } catch (e: any) {
      setLeadById(new Map());
    } finally {
      setLeadsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadPublicLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, query]);

  // Auto-refresh appointments every 60s
  useEffect(() => {
    if (!companyId) return;
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, query]);

  // Load leads whenever rows change (so we can render preview)
  useEffect(() => {
    void loadLeadsIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, rows.length]);

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

  function downloadRangeIcs() {
    const sp = new URLSearchParams();
    if (from) sp.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) sp.set("to", new Date(`${to}T23:59:59`).toISOString());
    if (status && status !== "all" && status !== "upcoming") sp.set("status", status);
    const url = `/api/admin/companies/${companyId}/calendar/ics?${sp.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setToast("ICS export opened");
  }

  // --- Slot-based reschedule ---

  async function openReschedule(row: ApptRow) {
    setRsRow(row);
    setRsOpen(true);
    setRsSlots([]);
    setRsSelected(null);

    setRsLoading(true);
    try {
      const { ok, status: http, json } = await fetchJson(`/api/admin/companies/${companyId}/availability`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exclude_appointment_id: row.id,
          limit: 24,
        }),
      });

      if (!ok) {
        setToast(`Slots load failed: HTTP ${http} ${json?.error || ""}`.trim());
        setRsSlots([]);
        return;
      }

      setRsSlots(Array.isArray(json?.slots) ? (json.slots as Slot[]) : []);
    } catch (e: any) {
      setToast(e?.message || "slots_load_failed");
      setRsSlots([]);
    } finally {
      setRsLoading(false);
    }
  }

  async function submitReschedule() {
    if (!rsRow || !rsSelected) return;

    setRsSaving(true);
    try {
      const { ok, status: http, json } = await fetchJson(`/api/admin/companies/${companyId}/calendar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          appointment_id: rsRow.id,
          new_start_at: rsSelected.start_at,
          new_end_at: rsSelected.end_at,
        }),
      });

      if (!ok) {
        setToast(`Reschedule failed: HTTP ${http} ${json?.message || json?.error || ""}`.trim());
        return;
      }

      setToast("Rescheduled ✅");
      setRsOpen(false);
      setRsRow(null);
      setRsSelected(null);
      setRsSlots([]);
      void load();
    } catch (e: any) {
      setToast(e?.message || "reschedule_failed");
    } finally {
      setRsSaving(false);
    }
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
      {/* Reschedule modal (slot-based) */}
      {rsOpen && rsRow ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => {
            if (!rsSaving) {
              setRsOpen(false);
              setRsRow(null);
              setRsSlots([]);
              setRsSelected(null);
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 680,
              background: "#fff",
              borderRadius: 16,
              border: `1px solid ${UI.border}`,
              padding: 14,
              display: "grid",
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 1000, color: UI.text }}>Reschedule</div>
              <Button
                variant="secondary"
                disabled={rsSaving}
                onClick={() => {
                  setRsOpen(false);
                  setRsRow(null);
                  setRsSlots([]);
                  setRsSelected(null);
                }}
              >
                Close
              </Button>
            </div>

            <div style={{ color: UI.text2, fontSize: 13.5, lineHeight: 1.45 }}>
              <div>
                <span style={{ fontWeight: 950, color: UI.text }}>Current:</span> {fmtLocal(rsRow.start_at)} →{" "}
                {fmtLocal(rsRow.end_at)}
              </div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontWeight: 950, color: UI.text }}>Pick a slot:</span>
              </div>
            </div>

            {rsLoading ? (
              <div style={{ color: UI.text2, fontSize: 13.5 }}>Loading available slots…</div>
            ) : rsSlots.length === 0 ? (
              <div style={{ color: UI.text2, fontSize: 13.5 }}>
                No slots available in the configured window (rules/exceptions/busy blocks).
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8, maxHeight: 360, overflow: "auto", paddingRight: 4 }}>
                {rsSlots.map((s) => {
                  const selected = rsSelected?.start_at === s.start_at;
                  return (
                    <button
                      key={s.start_at}
                      type="button"
                      onClick={() => setRsSelected(s)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: `1px solid ${selected ? "#C7D2FE" : UI.border}`,
                        background: selected ? UI.accentSoft : "#fff",
                        color: selected ? "#1D4ED8" : UI.text,
                        fontSize: 13.5,
                        fontWeight: selected ? 1000 : 900,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {fmtLocal(s.start_at)}
                      <span style={{ color: UI.text3, fontWeight: 850 }}> {"  "}→{"  "}</span>
                      <span style={{ color: UI.text2, fontWeight: 900 }}>{fmtLocal(s.end_at)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Button
                variant="secondary"
                disabled={rsSaving}
                onClick={() => {
                  setRsOpen(false);
                  setRsRow(null);
                  setRsSlots([]);
                  setRsSelected(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={submitReschedule} disabled={rsSaving || !rsSelected}>
                {rsSaving ? "Saving…" : "Confirm reschedule"}
              </Button>
            </div>

            <div style={{ fontSize: 12, color: UI.text3 }}>
              Slot list is generated from your rules + exceptions + busy blocks + holds + buffers.
            </div>
          </div>
        </div>
      ) : null}

      <Card
        title="Calendar"
        subtitle="View and manage booked appointments. Includes lead preview + deep link to Leads."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={load} variant="secondary" disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          {/* Public booking link + ICS export */}
          <div
            style={{
              border: `1px solid ${UI.border}`,
              borderRadius: 16,
              padding: 12,
              background: "#fff",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 1000, color: UI.text }}>Public booking page</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={loadPublicLink}>
                  Reload link
                </Button>
                <Button variant="secondary" onClick={downloadRangeIcs}>
                  Download ICS (range)
                </Button>
              </div>
            </div>

            {publicErr ? (
              <div style={{ border: "1px solid #FECACA", background: "#FEF2F2", padding: 10, borderRadius: 12, color: "#991B1B", fontSize: 13.5 }}>
                {publicErr}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ fontSize: 12.5, fontWeight: 900, color: UI.text2, marginBottom: 6 }}>Link</div>
                <div
                  style={{
                    padding: "11px 12px",
                    borderRadius: UI.radius,
                    border: `1px solid ${UI.border}`,
                    background: "#fff",
                    fontSize: 13,
                    color: UI.text2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={publicLink || ""}
                >
                  {publicLink || "—"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <Button
                  variant="secondary"
                  disabled={!publicLink}
                  onClick={() => {
                    if (!publicLink) return;
                    navigator.clipboard.writeText(publicLink);
                    setToast("Public booking link copied");
                  }}
                >
                  Copy link
                </Button>

                <Button
                  variant="secondary"
                  disabled={!publicLink}
                  onClick={() => {
                    if (!publicLink) return;
                    window.open(publicLink, "_blank", "noopener,noreferrer");
                  }}
                >
                  Open
                </Button>

                <Button
                  variant="secondary"
                  disabled={!publicLink}
                  onClick={() => {
                    if (!publicLink) return;
                    const text = `Book an appointment here: ${publicLink}`;
                    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
                    window.open(wa, "_blank", "noopener,noreferrer");
                  }}
                >
                  Share WhatsApp
                </Button>

                <Button
                  variant="secondary"
                  disabled={!publicKey}
                  onClick={() => {
                    if (!publicKey) return;
                    navigator.clipboard.writeText(publicKey);
                    setToast("Public booking key copied");
                  }}
                >
                  Copy key
                </Button>
              </div>
            </div>
          </div>

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
              {leadsLoading ? <Badge text="Leads: loading…" tone="info" /> : null}
            </div>
          </div>

          {err ? (
            <div style={{ border: "1px solid #FECACA", background: "#FEF2F2", padding: 12, borderRadius: 14, color: "#991B1B", fontSize: 13.5 }}>
              {err}
            </div>
          ) : null}

          <Divider />

          {/* Empty state */}
          {rows.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${UI.border}`,
                borderRadius: 16,
                padding: 18,
                background: "#fff",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 1000, color: UI.text }}>No appointments in this range</div>
              <div style={{ color: UI.text2, fontSize: 13.5, lineHeight: 1.5 }}>
                Try widening the date range, switching status to <b>All</b>, or share your public booking link to generate meetings.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <Button variant="secondary" onClick={() => quickRange("30")}>
                  Show next 30 days
                </Button>
                <Button variant="secondary" onClick={() => setStatus("all")}>
                  Show all statuses
                </Button>
              </div>
            </div>
          ) : null}

          {/* Appointments */}
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => {
              const s = String(r.status || "").toLowerCase();
              const lead = r.company_lead_id ? leadById.get(String(r.company_lead_id)) : undefined;

              const leadTitle =
                (lead?.name && lead.name.trim()) ||
                (lead?.email && lead.email.trim()) ||
                (lead?.phone && lead.phone.trim()) ||
                (r.contact_name && r.contact_name.trim()) ||
                (r.contact_email && r.contact_email.trim()) ||
                "Lead";

              const preview =
                String(lead?.lead_preview || "").trim() ||
                String(lead?.lead_summary || "").trim() ||
                String(lead?.admin_notes || "").trim() ||
                String(r.description || "").trim() ||
                "";

              const scoreBand = String(lead?.score_band || "").trim();
              const scoreTotal = typeof lead?.score_total === "number" ? lead.score_total : null;

              return (
                <div
                  key={r.id}
                  style={{
                    border: `1px solid ${UI.border}`,
                    borderRadius: 16,
                    padding: 12,
                    background: "#fff",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <Badge text={s || "—"} tone={toneForStatus(s)} />

                      {scoreBand ? (
                        <Badge
                          text={scoreTotal !== null ? `${scoreBand.toUpperCase()} • ${scoreTotal}` : scoreBand.toUpperCase()}
                          tone={scoreBand === "hot" ? "danger" : scoreBand === "warm" ? "info" : "neutral"}
                        />
                      ) : null}

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

                      {s !== "cancelled" ? (
                        <Button variant="secondary" onClick={() => void openReschedule(r)}>
                          Reschedule
                        </Button>
                      ) : null}

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
                              setToast("Opening Leads tab");
                              goToLeads(r.company_lead_id);
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

                  {/* Lead preview block */}
                  <div
                    style={{
                      border: `1px solid ${UI.borderSoft}`,
                      borderRadius: 14,
                      padding: 12,
                      background: UI.surface2,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ fontWeight: 1000, color: UI.text }}>Lead Preview</div>
                      <div style={{ color: UI.text3, fontSize: 12.5, fontWeight: 900 }}>
                        {lead ? `State: ${lead.lead_state || "—"} • Status: ${lead.status || "—"}` : "Loading lead…"}
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 13.5, color: UI.text2 }}>
                      <div>
                        <span style={{ fontWeight: 950, color: UI.text }}>Lead:</span> {leadTitle}
                        {lead?.email ? <span style={{ color: UI.text2 }}> • {lead.email}</span> : r.contact_email ? <span> • {r.contact_email}</span> : null}
                        {lead?.phone ? <span style={{ color: UI.text2 }}> • {lead.phone}</span> : r.contact_phone ? <span> • {r.contact_phone}</span> : null}
                      </div>

                      <div>
                        <span style={{ fontWeight: 950, color: UI.text }}>Source:</span> {r.source || "—"}
                        {lead?.source ? <span style={{ color: UI.text2 }}> • lead source: {lead.source}</span> : null}
                        {r.conversation_id ? <span style={{ color: UI.text2 }}> • conversation: {String(r.conversation_id).slice(0, 8)}…</span> : null}
                      </div>

                      {preview ? (
                        <div style={{ color: UI.text2, lineHeight: 1.55 }}>
                          <span style={{ fontWeight: 950, color: UI.text }}>Preview:</span> {preview}
                        </div>
                      ) : (
                        <div style={{ color: UI.text3, fontSize: 13.5 }}>
                          No lead preview text yet (lead_preview/lead_summary/admin_notes empty).
                        </div>
                      )}

                      {Array.isArray(lead?.tags) && lead!.tags.length > 0 ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                          {lead!.tags.slice(0, 8).map((t) => (
                            <span
                              key={t}
                              style={{
                                padding: "5px 8px",
                                borderRadius: 999,
                                border: `1px solid ${UI.border}`,
                                background: "#fff",
                                fontSize: 12,
                                fontWeight: 900,
                                color: UI.text2,
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}