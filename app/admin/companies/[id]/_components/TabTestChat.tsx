"use client";

import { useEffect, useRef, useState } from "react";
import { UI, Button } from "./ui";
import type { DetailResponse } from "./types";
import { safeJsonParse } from "./api";

type Msg = { role: "user" | "assistant"; text: string };

export default function TabTestChat(props: {
  companyId: string;
  data: DetailResponse;
  setToast: (s: string) => void;
}) {
  const { companyId, data, setToast } = props;

  const publicKey = String(data.keys?.public_key || "").trim();

  const [token, setToken] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Test chat ready. Ask something to verify knowledge chunks." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  async function ensureToken() {
    if (token) return token;

    const res = await fetch(`/api/admin/companies/${companyId}/widget-token`, { cache: "no-store" });
    const raw = await res.text();
    const json = safeJsonParse(raw);

    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

    const t = String((json as any)?.token || (json as any)?.widget_token || "").trim();
    if (!t) throw new Error("missing_token_field");

    setToken(t);
    return t;
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text }]);

    try {
      const t = await ensureToken();

      // Only one call: widget message
      const res = await fetch(`/api/widget/message`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({
          // keep conversation if server returned one
          conversation_id: conversationId,
          // send multiple common field names to avoid schema mismatch
          message: text,
          text,
          content: text,
          public_key: publicKey || undefined,
        }),
      });

      const raw = await res.text();
      const json = safeJsonParse(raw);

      if (!res.ok) {
        setMsgs((m) => [...m, { role: "assistant", text: `Error: ${json?.error || `HTTP ${res.status}`}` }]);
        return;
      }

      const answer =
        String((json as any)?.answer || (json as any)?.text || (json as any)?.message || (json as any)?.output_text || "").trim();

      const newCid =
        String((json as any)?.conversation_id || (json as any)?.conversation?.id || "").trim();

      if (newCid) setConversationId(newCid);

      setMsgs((m) => [...m, { role: "assistant", text: answer || "OK" }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", text: `Error: ${e?.message || "failed"}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, boxShadow: UI.shadow, padding: 16 }}>
      <div style={{ fontWeight: 1100, marginBottom: 6 }}>Test Chat</div>
      <div style={{ color: UI.text2, fontSize: 13.5, lineHeight: 1.5 }}>
        Admins can test how the bot responds to knowledge chunks here.
      </div>

      <div
        ref={listRef}
        style={{
          marginTop: 12,
          border: `1px solid ${UI.border}`,
          borderRadius: 14,
          padding: 12,
          height: 360,
          overflow: "auto",
          background: "#fff",
        }}
      >
        {msgs.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div
              style={{
                maxWidth: "82%",
                padding: "10px 12px",
                borderRadius: 14,
                border: `1px solid ${UI.border}`,
                background: m.role === "user" ? "#111827" : "#fff",
                color: m.role === "user" ? "#fff" : UI.text,
                fontSize: 13.5,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy ? <div style={{ color: UI.text2, fontSize: 13.5 }}>Thinking…</div> : null}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask something…"
          style={{
            flex: "1 1 320px",
            padding: "10px 12px",
            borderRadius: 12,
            border: `1px solid ${UI.border}`,
            outline: "none",
            fontSize: 13.5,
          }}
        />
        <Button onClick={() => void send()} variant="primary" disabled={busy || !input.trim()}>
          Send
        </Button>
        <Button
          onClick={() => {
            setMsgs([{ role: "assistant", text: "New test session. Ask something to verify knowledge chunks." }]);
            setConversationId(null);
            setToast("Reset chat");
          }}
          variant="secondary"
          disabled={busy}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}