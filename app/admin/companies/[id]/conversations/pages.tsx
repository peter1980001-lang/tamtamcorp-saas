"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type LeadSnap = {
  score_total: number;
  score_band: "cold" | "warm" | "hot";
  lead_state: string;
  status: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

type ConvRow = {
  id: string;
  created_at: string;
  last_message_at: string | null;
  lead: LeadSnap | null;
};

function Chip({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid #eee",
        background: "#fafafa",
        fontSize: 12,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      {text}
    </span>
  );
}

export default function ConversationsPage() {
  const params = useParams<{ id: string }>();
  const companyId = params?.id;

  const [rows, setRows] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    const res = await fetch(`/api/admin/companies/${companyId}/conversations`);
    const json = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setToast((json && (json.error || json.details)) || "load_failed");
      return;
    }

    setRows((json?.conversations ?? []) as ConvRow[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.id.toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Company Conversations</div>
            <h1 style={{ fontSize: 28, margin: "4px 0 0" }}>Conversations</h1>
            <div style={{ marginTop: 8 }}>
              <Chip text={`Company: ${companyId}`} />
              <Chip text={`Count: ${rows.length}`} />
            </div>
          </div>

          <button
            onClick={load}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by conversation id..."
            style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ padding: 16, background: "#fff", borderRadius: 16, border: "1px solid #eee" }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 16, background: "#fff", borderRadius: 16, border: "1px solid #eee" }}>No conversations.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {filtered.map((c) => {
                const lead = c.lead;
                const label =
                  lead?.score_band === "hot" ? "hot" : lead?.score_band === "warm" ? "warm" : lead?.score_band === "cold" ? "cold" : "none";

                return (
                  <a
                    key={c.id}
                    href={`/admin/companies/${companyId}/conversations/${c.id}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      background: "#fff",
                      border: "1px solid #eee",
                      borderRadius: 16,
                      padding: 14,
                      display: "block",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{c.id}</div>
                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
                          <div>Created: {new Date(c.created_at).toLocaleString()}</div>
                          <div>Last message: {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : "-"}</div>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-block",
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: "1px solid #111",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {label}
                        </div>
                        {lead && (
                          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, lineHeight: 1.6 }}>
                            <div>
                              Score: <b>{lead.score_total}</b>
                            </div>
                            <div>
                              State: <b>{lead.lead_state}</b>
                            </div>
                            <div>
                              Status: <b>{lead.status}</b>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {toast && (
          <div
            onClick={() => setToast(null)}
            style={{
              position: "fixed",
              right: 18,
              bottom: 18,
              background: "#111",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: 12,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
