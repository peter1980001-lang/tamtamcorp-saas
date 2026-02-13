"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Msg = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | string;
  content: string;
  created_at: string;
};

type Conv = {
  id: string;
  company_id: string;
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
  score_total: number;
  score_band: "cold" | "warm" | "hot";
  intent_score: number;
  qualification_json: any;
  consents_json: any;
  created_at: string;
  updated_at: string;
  last_touch_at: string | null;
};

type ApiResponse = {
  conversation: Conv;
  messages: Msg[];
  lead: Lead | null;
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

function fmt(dt?: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function badge(text: string, bg: string, fg: string) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        background: bg,
        color: fg,
        border: "1px solid rgba(0,0,0,0.06)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function ScoreBadge({ band, total }: { band: "cold" | "warm" | "hot"; total: number }) {
  if (band === "hot") return badge(`hot ${total}`, "#111", "#fff");
  if (band === "warm") return badge(`warm ${total}`, "#f3f4f6", "#111");
  return badge(`cold ${total}`, "#fafafa", "#111");
}

export default function AdminConversationViewerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [filter, setFilter] = useState<"all" | "user" | "assistant">("all");
  const [q, setQ] = useState("");

  async function load() {
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/admin/conversations/${id}`);
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setToast(json.error || "load_failed");
      return;
    }
    setData(json);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const messages = useMemo(() => {
    const all = data?.messages ?? [];
    const qq = q.trim().toLowerCase();

    return all.filter((m) => {
      if (filter !== "all" && m.role !== filter) return false;
      if (!qq) return true;
      return (m.content || "").toLowerCase().includes(qq);
    });
  }, [data?.messages, filter, q]);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setToast("Copied");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24, display: "grid", gap: 14 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Conversation</div>
            <h1 style={{ fontSize: 24, margin: "4px 0 0" }}>{loading ? "Loading…" : data?.conversation?.id || "—"}</h1>
            {!loading && data?.conversation && (
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, opacity: 0.8 }}>
                {badge(`company: ${data.conversation.company_id}`, "#fff", "#111")}
                {badge(`created: ${fmt(data.conversation.created_at)}`, "#fff", "#111")}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => router.push(`/admin/companies/${data?.conversation?.company_id}`)}
              disabled={!data?.conversation?.company_id}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
            >
              Back to Company
            </button>

            <button
              onClick={load}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
            >
              Refresh
            </button>

            <button
              onClick={() => copy(String(data?.conversation?.id || ""))}
              disabled={!data?.conversation?.id}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}
            >
              Copy ID
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
          {/* Messages */}
          <Card
            title="Messages"
            right={
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
                >
                  <option value="all">All</option>
                  <option value="user">User</option>
                  <option value="assistant">Assistant</option>
                </select>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search text…"
                  style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd", background: "#fff", width: 220 }}
                />
              </div>
            }
          >
            {loading ? (
              <div style={{ opacity: 0.75 }}>Loading…</div>
            ) : messages.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No messages.</div>
            ) : (
              <div style={{ display: "grid", gap: 10, maxHeight: "70vh", overflow: "auto", paddingRight: 6 }}>
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  const isAssistant = m.role === "assistant";
                  return (
                    <div
                      key={m.id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 14,
                        padding: 12,
                        background: isUser ? "#ffffff" : isAssistant ? "#fcfcfd" : "#fafafa",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {badge(m.role, isUser ? "#111" : "#f3f4f6", isUser ? "#fff" : "#111")}
                          <span style={{ fontSize: 12, opacity: 0.7 }}>{fmt(m.created_at)}</span>
                        </div>
                        <button
                          onClick={() => copy(m.content || "")}
                          style={{ border: "1px solid #ddd", background: "#fff", padding: "6px 10px", borderRadius: 10, cursor: "pointer", fontSize: 12 }}
                        >
                          Copy
                        </button>
                      </div>

                      <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>{m.content}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Lead panel */}
          <Card title="Lead Snapshot">
            {!data?.lead ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>No lead linked to this conversation.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <ScoreBadge band={data.lead.score_band} total={data.lead.score_total} />
                  {badge(`state: ${data.lead.lead_state}`, "#fff", "#111")}
                  {badge(`status: ${data.lead.status}`, "#fff", "#111")}
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fafafa" }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Contact</div>
                  <div style={{ fontSize: 13 }}>
                    <div>
                      <b>Name:</b> {data.lead.name || "—"}
                    </div>
                    <div>
                      <b>Email:</b> {data.lead.email || "—"}
                    </div>
                    <div>
                      <b>Phone:</b> {data.lead.phone || "—"}
                    </div>
                  </div>
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Qualification</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, background: "#fafafa", border: "1px solid #eee", padding: 10, borderRadius: 12 }}>
                    {JSON.stringify(data.lead.qualification_json ?? {}, null, 2)}
                  </pre>
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Consents</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, background: "#fafafa", border: "1px solid #eee", padding: 10, borderRadius: 12 }}>
                    {JSON.stringify(data.lead.consents_json ?? {}, null, 2)}
                  </pre>
                </div>

                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  <div>Created: {fmt(data.lead.created_at)}</div>
                  <div>Updated: {fmt(data.lead.updated_at)}</div>
                  <div>Last touch: {fmt(data.lead.last_touch_at)}</div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Toast */}
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
