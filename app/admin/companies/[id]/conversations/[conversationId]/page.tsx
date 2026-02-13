"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Msg = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
};

type Lead = {
  id: string;
  company_id: string;
  conversation_id: string;
  lead_state: string;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  score_band: "cold" | "warm" | "hot";
  score_total: number;
  intent_score: number;
  qualification_json: any;
  consents_json: any;
  created_at: string;
  updated_at: string;
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

export default function ConversationDetailPage() {
  const params = useParams<{ id: string; conversationId: string }>();
  const router = useRouter();

  const companyId = params?.id;
  const conversationId = params?.conversationId;

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);
  const [conversationCreatedAt, setConversationCreatedAt] = useState<string | null>(null);

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

    setLead(json.lead || null);
    setMessages(json.messages || []);
    setConversationCreatedAt(json.conversation?.created_at || null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, conversationId]);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Conversation</div>
            <h1 style={{ fontSize: 20, margin: "6px 0 0", fontFamily: "monospace" }}>{conversationId}</h1>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              Created: {conversationCreatedAt ? new Date(conversationCreatedAt).toLocaleString() : "-"} | Messages: {messages.length}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => router.push(`/admin/companies/${companyId}/conversations`)}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
            >
              Back
            </button>

            <button
              onClick={load}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
            >
              Refresh
            </button>

            <button
              onClick={async () => {
                await navigator.clipboard.writeText(conversationId || "");
                setToast("Copied");
              }}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}
            >
              Copy conversation id
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
          <Card title="Lead / Snapshot">
            {loading ? (
              <div style={{ opacity: 0.7 }}>Loading...</div>
            ) : !lead ? (
              <div style={{ opacity: 0.7 }}>No lead record for this conversation yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #eee", background: "#fafafa", fontSize: 12 }}>
                    {lead.score_band} {lead.score_total} | intent {lead.intent_score}
                  </span>
                  <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #eee", background: "#fafafa", fontSize: 12 }}>
                    state: {lead.lead_state}
                  </span>
                  <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #eee", background: "#fafafa", fontSize: 12 }}>
                    status: {lead.status}
                  </span>
                </div>

                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  <div><b>Name:</b> {lead.name || "-"}</div>
                  <div><b>Email:</b> {lead.email || "-"}</div>
                  <div><b>Phone:</b> {lead.phone || "-"}</div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Qualification JSON</div>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
                      {JSON.stringify(lead.qualification_json || {}, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>DSGVO / Consent snapshot</div>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
                      {JSON.stringify(lead.consents_json || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card title="Messages">
            {loading ? (
              <div style={{ opacity: 0.7 }}>Loading...</div>
            ) : messages.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No messages.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {messages.map((m) => (
                  <div key={m.id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{m.role}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{new Date(m.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>{m.content}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
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
