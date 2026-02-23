"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Divider, Input, UI } from "./ui";
import { fetchJson } from "./api";

/* -------------------- TYPES -------------------- */

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

type Slot = {
  start_at: string;
  end_at: string;
};

/* -------------------- HELPERS -------------------- */

function fmtLocal(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString();
}

function toneForStatus(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed") return "success";
  if (s === "pending") return "info";
  if (s === "cancelled") return "danger";
  return "neutral";
}

/* -------------------- COMPONENT -------------------- */

export default function TabCalendar({
  companyId,
  setToast,
}: {
  companyId: string;
  setToast: (s: string) => void;
}) {
  const [rows, setRows] = useState<ApptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* ----------- RESCHEDULE STATE ----------- */

  const [rsOpen, setRsOpen] = useState(false);
  const [rsRow, setRsRow] = useState<ApptRow | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [rsLoading, setRsLoading] = useState(false);
  const [rsSaving, setRsSaving] = useState(false);

  /* -------------------- LOAD APPOINTMENTS -------------------- */

  async function load() {
    if (!companyId) return;
    setLoading(true);
    setErr(null);

    try {
      const { ok, json } = await fetchJson(
        `/api/admin/companies/${companyId}/calendar?status=upcoming&limit=200`,
        { cache: "no-store" }
      );

      if (!ok) {
        setErr(json?.error || "calendar_load_failed");
        return;
      }

      setRows(json?.appointments || []);
    } catch (e: any) {
      setErr(e?.message || "network_error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [companyId]);

  /* -------------------- LOAD SLOTS -------------------- */

  async function loadSlots(appointment: ApptRow) {
    setRsLoading(true);
    setSlots([]);
    setSelectedSlot(null);

    try {
      const { ok, json } = await fetchJson(
        `/api/admin/companies/${companyId}/availability`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            exclude_appointment_id: appointment.id,
            limit: 24,
          }),
        }
      );

      if (!ok) {
        setToast("Slot loading failed");
        return;
      }

      setSlots(json?.slots || []);
    } catch (e: any) {
      setToast(e?.message || "slot_error");
    } finally {
      setRsLoading(false);
    }
  }

  function openReschedule(row: ApptRow) {
    setRsRow(row);
    setRsOpen(true);
    void loadSlots(row);
  }

  /* -------------------- SUBMIT RESCHEDULE -------------------- */

  async function submitReschedule() {
    if (!rsRow || !selectedSlot) return;

    setRsSaving(true);

    try {
      const { ok, json } = await fetchJson(
        `/api/admin/companies/${companyId}/calendar`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "reschedule",
            appointment_id: rsRow.id,
            new_start_at: selectedSlot.start_at,
            new_end_at: selectedSlot.end_at,
          }),
        }
      );

      if (!ok) {
        setToast(json?.message || "reschedule_failed");
        return;
      }

      setToast("Rescheduled ✅");
      setRsOpen(false);
      setRsRow(null);
      setSelectedSlot(null);
      void load();
    } catch (e: any) {
      setToast(e?.message || "reschedule_failed");
    } finally {
      setRsSaving(false);
    }
  }

  /* -------------------- RENDER -------------------- */

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* ---------------- RESCHEDULE MODAL ---------------- */}
      {rsOpen && rsRow ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 600,
              background: "#fff",
              borderRadius: 16,
              padding: 16,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ fontWeight: 1000 }}>
              Reschedule: {rsRow.title || "Appointment"}
            </div>

            <div style={{ fontSize: 13, color: "#666" }}>
              Current: {fmtLocal(rsRow.start_at)}
            </div>

            {rsLoading ? (
              <div>Loading available slots…</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {slots.length === 0 && (
                  <div style={{ color: "#888" }}>
                    No available slots found.
                  </div>
                )}

                {slots.map((slot) => {
                  const selected =
                    selectedSlot?.start_at === slot.start_at;

                  return (
                    <button
                      key={slot.start_at}
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: selected
                          ? "2px solid #111"
                          : "1px solid #ddd",
                        background: selected ? "#f5f5f5" : "#fff",
                        textAlign: "left",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {fmtLocal(slot.start_at)}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <Button
                variant="secondary"
                onClick={() => setRsOpen(false)}
                disabled={rsSaving}
              >
                Cancel
              </Button>

              <Button
                onClick={submitReschedule}
                disabled={!selectedSlot || rsSaving}
              >
                {rsSaving ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------- CALENDAR LIST ---------------- */}
      <Card title="Upcoming Appointments">
        {loading && <div>Loading…</div>}
        {err && <div style={{ color: "red" }}>{err}</div>}

        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((r) => {
            const s = String(r.status || "").toLowerCase();
            return (
              <div
                key={r.id}
                style={{
                  border: "1px solid #eee",
                  padding: 12,
                  borderRadius: 12,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", gap: 10 }}>
                  <Badge text={s} tone={toneForStatus(s)} />
                  <div style={{ fontWeight: 800 }}>
                    {r.title || "Appointment"}
                  </div>
                </div>

                <div style={{ fontSize: 13 }}>
                  {fmtLocal(r.start_at)} → {fmtLocal(r.end_at)}
                </div>

                {s !== "cancelled" && (
                  <Button
                    variant="secondary"
                    onClick={() => openReschedule(r)}
                  >
                    Reschedule
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}