"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Msg = { id: string; role: string; content: string; created_at: string };
type Lead = {
  id: string;
  lead_state: string;
  status: string;
  score_total: number;
  score_band: string;
  intent_score: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  qualification_json: any;
  consents_json: any;
  last_touch_at: string;
  created_at: string;
};

export default function ConversationDetailPage() {
  const params = useParams<{ id: string; conversationId: string }>();
  const id = params?.id;
  const conversationId = params?.conversationId;

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    if (!id || !conversationId) return;
    setLoading(true);
    const res = await fetch(`/api/admin/companies/${id}/conversations/${conversationId}`);
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setToast(json.error || "load_failed");
      return;
    }

    setLead(json.lead || null);
    setMessages(json.messages || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, conversationId]);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Conversation</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{conversationId}</div>
          </div>
          <button
            onClick={load}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
          >
            Refresh
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ border: "1px solid #eee", borderRadius: 16, background: "#fff", padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Qualification Snapshot</div>
            {loading ? (
              <div style={{ opacity: 0.7 }}>Loading…</div>
            ) : !lead ? (
              <div style={{ opacity: 0.7 }}>No lead record yet.</div>
            ) : (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
                {JSON.stringify(
                  {
                    band: lead.score_band,
                    score_total: lead.score_total,
                    intent_score: lead.intent_score,
                    lead_state: lead.lead_state,
                    status: lead.status,
                    contact: { name: lead.name, email: lead.email, phone: lead.phone },
                    qualification_json: lead.qualification_json,
                  },
                  null,
                  2
                )}
              </pre>
            )}
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 16, background: "#fff", padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>DSGVO / Consent Snapshot</div>
            {loading ? (
              <div style={{ opacity: 0.7 }}>Loading…</div>
            ) : (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
                {JSON.stringify(lead?.consents_json || {}, null, 2)}
              </pre>
            )}
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
              Prinzip: Datensparsamkeit + Art. 6(1)(b) fuer vorvertragliche Anfrage. Marketing/WhatsApp ggf. separate Einwilligung.
            </div>
          </div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 16, background: "#fff", padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Messages</div>

          {loading ? (
            <div style={{ opacity: 0.7 }}>Loading…</div>
          ) : messages.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No messages.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {messages.map((m) => (
                <div key={m.id} style={{ padding: 12, borderRadius: 14, border: "1px solid #eee", background: m.role === "user" ? "#fff" : "#fafafa" }}>
                  <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>
                    {m.role} · {new Date(m.created_at).toLocaleString()}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{m.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {toast && (
          <div
            style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", padding: "10px 14px", borderRadius: 999, fontSize: 13 }}
            onClick={() => setToast(null)}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
