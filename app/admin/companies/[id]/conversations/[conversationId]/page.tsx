"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Msg = { id: string; role: "user" | "assistant" | string; content: string; created_at: string };

type Lead = {
  id: string;
  lead_state: string;
  status: string;
  score_total: number;
  score_band: string;
  intent_score: number;
  email: string | null;
  phone: string | null;
  qualification_json: any;
  consents_json: any;
  created_at: string;
  last_touch_at: string;
};

type ApiResp = {
  conversation: { id: string; company_id: string; created_at: string };
  lead: Lead | null;
  messages: Msg[];
};

function Card(props: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 16, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 800 }}>{props.title}</div>
        {props.right}
      </div>
      {props.children}
    </div>
  );
}

export default function ConversationDetailPage() {
  const params = useParams<{ id: string; conversationId: string }>();
  const companyId = params?.id;
  const conversationId = params?.conversationId;

  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    if (!companyId || !conversationId) return;
    setLoading(true);
    const res = await fetch(`/api/admin/companies/${companyId}/conversations/${conversationId}`);
    const json = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setToast((json && (json.error || json.details)) || "load_failed");
      return;
    }

    setData(json as ApiResp);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, conversationId]);

  const transcript = useMemo(() => {
    const msgs = data?.messages ?? [];
    return msgs
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");
  }, [data]);

  async function copy(text: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setToast("copied");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Conversation Viewer</div>
            <h1 style={{ fontSize: 26, margin: "4px 0 0" }}>{conversationId}</h1>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Company: {companyId}</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <a
              href={`/admin/companies/${companyId}/conversations`}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#fff",
                textDecoration: "none",
                color: "#111",
              }}
            >
              Back
            </a>
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
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
          {loading || !data ? (
            <Card title="Loading">Loading...</Card>
          ) : (
            <>
              <Card
                title="Quick Actions"
                right={
                  <button
                    onClick={() => copy(transcript)}
                    style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
                  >
                    Copy transcript
                  </button>
                }
              >
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => copy(conversationId)}
                    style={{ border: "1px solid #ddd", background: "#fff", padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}
                  >
                    Copy conversation id
                  </button>
                  {data.lead?.id && (
                    <button
                      onClick={() => copy(data.lead!.id)}
                      style={{ border: "1px solid #ddd", background: "#fff", padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}
                    >
                      Copy lead id
                    </button>
                  )}
                </div>
              </Card>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Card title="Lead Snapshot">
                  {data.lead ? (
                    <div style={{ fontSize: 13, lineHeight: 1.8, opacity: 0.9 }}>
                      <div>
                        Band: <b>{data.lead.score_band}</b> | Score: <b>{data.lead.score_total}</b> | Intent: <b>{data.lead.intent_score}</b>
                      </div>
                      <div>
                        State: <b>{data.lead.lead_state}</b> | Status: <b>{data.lead.status}</b>
                      </div>
                      <div>Email: {data.lead.email || "-"}</div>
                      <div>Phone: {data.lead.phone || "-"}</div>
                      <div>Last touch: {data.lead.last_touch_at ? new Date(data.lead.last_touch_at).toLocaleString() : "-"}</div>
                    </div>
                  ) : (
                    <div style={{ opacity: 0.7 }}>No lead linked to this conversation.</div>
                  )}
                </Card>

                <Card title="DSGVO / Consent JSON">
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      fontSize: 12,
                      background: "#fafafa",
                      border: "1px solid #eee",
                      padding: 12,
                      borderRadius: 12,
                      maxHeight: 260,
                      overflow: "auto",
                    }}
                  >
                    {JSON.stringify(data.lead?.consents_json ?? {}, null, 2)}
                  </pre>
                </Card>
              </div>

              <Card title="Qualification JSON">
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontSize: 12,
                    background: "#fafafa",
                    border: "1px solid #eee",
                    padding: 12,
                    borderRadius: 12,
                    maxHeight: 320,
                    overflow: "auto",
                  }}
                >
                  {JSON.stringify(data.lead?.qualification_json ?? {}, null, 2)}
                </pre>
              </Card>

              <Card title={`Messages (${data.messages.length})`}>
                <div style={{ display: "grid", gap: 10 }}>
                  {data.messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 14,
                        padding: 12,
                        background: m.role === "user" ? "#fff" : "#fafafa",
                      }}
                    >
                      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6 }}>
                        {m.role} · {new Date(m.created_at).toLocaleString()}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.55 }}>{m.content}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
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
