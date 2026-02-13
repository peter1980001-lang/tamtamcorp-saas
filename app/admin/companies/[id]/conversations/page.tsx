"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ConversationRow = {
  id: string;
  created_at: string;
  last_message_at: string | null;
  lead: {
    score_total: number;
    score_band: "cold" | "warm" | "hot";
    lead_state: string;
    status: string;
    email: string | null;
    phone: string | null;
    created_at: string;
  } | null;
};

function Card(props: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
        boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
        <div style={{ fontWeight: 700 }}>{props.title}</div>
        {props.right}
      </div>
      {props.children}
    </div>
  );
}

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

function pill(band?: string) {
  const bg = band === "hot" ? "#111" : band === "warm" ? "#fff" : "#fafafa";
  const color = band === "hot" ? "#fff" : "#111";
  const border = band === "warm" ? "1px solid #111" : "1px solid #eee";
  return { background: bg, color, border };
}

export default function CompanyConversationsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/admin/companies/${id}/conversations`);
    const json = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setToast((json && (json.error || json.details)) || "load_failed");
      return;
    }

    setRows(json?.conversations || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const counts = useMemo(() => {
    const c = { hot: 0, warm: 0, cold: 0, withLead: 0 };
    for (const r of rows) {
      if (r.lead?.score_band) (c as any)[r.lead.score_band] += 1;
      if (r.lead) c.withLead += 1;
    }
    return c;
  }, [rows]);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Company</div>
            <h1 style={{ fontSize: 28, margin: "4px 0 0" }}>Conversations</h1>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Chip text={`With lead: ${counts.withLead}`} />
              <Chip text={`Hot: ${counts.hot}`} />
              <Chip text={`Warm: ${counts.warm}`} />
              <Chip text={`Cold: ${counts.cold}`} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => router.push(`/admin/companies/${id}/leads`)}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
            >
              Leads
            </button>

            <button
              onClick={load}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
          {loading ? (
            <Card title="Loading">Fetching conversations...</Card>
          ) : rows.length === 0 ? (
            <Card title="No Conversations">No conversations found.</Card>
          ) : (
            rows.map((r) => (
              <Card
                key={r.id}
                title={r.id}
                right={
                  r.lead ? (
                    <span style={{ padding: "6px 10px", borderRadius: 999, ...pill(r.lead.score_band) }}>
                      {r.lead.score_band} {r.lead.score_total}
                    </span>
                  ) : (
                    <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #eee", background: "#fafafa", fontSize: 12 }}>
                      no lead
                    </span>
                  )
                }
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Chip text={`Created: ${new Date(r.created_at).toLocaleString()}`} />
                    <Chip text={`Last msg: ${r.last_message_at ? new Date(r.last_message_at).toLocaleString() : "-"}`} />
                    {r.lead && <Chip text={`State: ${r.lead.lead_state}`} />}
                    {r.lead && <Chip text={`Status: ${r.lead.status}`} />}
                  </div>

                  {r.lead && (
                    <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
                      <div>
                        <b>Email:</b> {r.lead.email || "-"}
                      </div>
                      <div>
                        <b>Phone:</b> {r.lead.phone || "-"}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => router.push(`/admin/companies/${id}/conversations/${r.id}`)}
                      style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}
                    >
                      Open
                    </button>

                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(r.id);
                        setToast("Copied");
                      }}
                      style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                    >
                      Copy conversation id
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {toast && (
          <div
            style={{
              position: "fixed",
              bottom: 18,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#111",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 999,
              fontSize: 13,
              cursor: "pointer",
            }}
            onClick={() => setToast(null)}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
