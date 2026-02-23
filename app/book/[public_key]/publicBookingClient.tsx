"use client";

import { useEffect, useState } from "react";

type Slot = {
  start_at: string;
  end_at: string;
};

export default function PublicBookingClient({ publicKey }: { publicKey: string }) {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [locked, setLocked] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const [selected, setSelected] = useState<Slot | null>(null);
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  // Load availability
  useEffect(() => {
    let dead = false;

    (async () => {
      try {
        const res = await fetch(`/api/book/${publicKey}/availability`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ limit: 12 }),
        });

        const data = await res.json();
        if (!dead) {
          setSlots(data.slots || []);
          setLocked(Boolean(data.locked));
          setReason(data.reason || null);
        }
      } catch (e: any) {
        if (!dead) setError("Failed to load availability.");
      } finally {
        if (!dead) setLoading(false);
      }
    })();

    return () => {
      dead = true;
    };
  }, [publicKey]);

  async function handleHold(slot: Slot) {
    setError(null);
    setHoldToken(null);
    setSelected(slot);

    try {
      const res = await fetch(`/api/book/${publicKey}/hold`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          start_at: slot.start_at,
          end_at: slot.end_at,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Hold failed");

      setHoldToken(data.hold_token);
    } catch (e: any) {
      setError(e.message || "Hold failed");
    }
  }

  async function handleBook() {
    if (!holdToken) return;
    setBooking(true);
    setError(null);

    try {
      const res = await fetch(`/api/book/${publicKey}/book`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hold_token: holdToken }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Booking failed");

      alert("Appointment confirmed ✅");
      setHoldToken(null);
      setSelected(null);
    } catch (e: any) {
      setError(e.message || "Booking failed");
    } finally {
      setBooking(false);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) return <div>Loading available slots…</div>;

  return (
    <div style={{ marginTop: 20 }}>
      {locked && (
        <div
          style={{
            background: "#fff4d6",
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          <strong>Booking currently locked.</strong>
          <div style={{ opacity: 0.8 }}>{reason || "Upgrade to Pro to enable booking."}</div>
        </div>
      )}

      {error && (
        <div style={{ color: "crimson", marginBottom: 10 }}>
          {error}
        </div>
      )}

      {!slots.length && <div>No available slots.</div>}

      <div style={{ display: "grid", gap: 10 }}>
        {slots.map((slot, i) => (
          <button
            key={i}
            onClick={() => handleHold(slot)}
            style={{
              padding: 12,
              borderRadius: 8,
              border: "1px solid #ddd",
              cursor: "pointer",
              background:
                selected?.start_at === slot.start_at ? "#000" : "#fff",
              color:
                selected?.start_at === slot.start_at ? "#fff" : "#000",
            }}
          >
            {formatDate(slot.start_at)}
          </button>
        ))}
      </div>

      {holdToken && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={handleBook}
            disabled={booking}
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#000",
              color: "#fff",
              width: "100%",
            }}
          >
            {booking ? "Booking…" : "Confirm appointment"}
          </button>
        </div>
      )}
    </div>
  );
}