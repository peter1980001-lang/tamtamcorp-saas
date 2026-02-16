"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };

function getParam(name: string) {
  const url = new URL(window.location.href);
  return String(url.searchParams.get(name) || "").trim();
}

function storageKey(pk: string) {
  return `tamtam_widget_conv_${pk}`;
}

export default function WidgetPage() {
  const [publicKey, setPublicKey] = useState("");
  const [token, setToken] = useState<string>("");
  const [conversationId, setConversationId] = useState<string>("");
  const [bootError, setBootError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", text: "Hi! How can I help?" }]);
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => !!token && !!conversationId && !chatBusy && input.trim().length > 0, [token, conversationId, chatBusy, input]);

  useEffect(() => {
    // auto-scroll
    if (!chatBoxRef.current) return;
    chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [messages]);

  async function bootstrap(pk: string) {
    setBootError(null);

    if (!pk) {
      setBootError("missing_client_public_key");
      return;
    }

    // 1) Auth (Widget JWT)
    const authRes = await fetch("/api/widget/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // IMPORTANT: your backend expects public_key
      body: JSON.stringify({ public_key: pk }),
      cache: "no-store",
    });

    const authJson = await authRes.json().catch(() => null);

    if (!authRes.ok) {
      setToken("");
      setConversationId("");
      setBootError(String(authJson?.error || "widget_auth_failed"));
      return;
    }

    const t = String(authJson?.token || "").trim();
    if (!t) {
      setBootError("missing_widget_token");
      return;
    }
    setToken(t);

    // 2) Conversation (try reuse from localStorage)
    const cached = (() => {
      try {
        return localStorage.getItem(storageKey(pk)) || "";
      } catch {
        return "";
      }
    })();

    if (cached) {
      setConversationId(cached);
      return;
    }

    const convRes = await fetch("/api/widget/conversation", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });

    const convJson = await convRes.json().catch(() => null);

    if (!convRes.ok) {
      setConversationId("");
      setBootError(String(convJson?.error || "conversation_failed"));
      return;
    }

    const cid = String(convJson?.conversation?.id || "").trim();
    if (!cid) {
      setBootError("missing_conversation_id");
      return;
    }

    setConversationId(cid);
    try {
      localStorage.setItem(storageKey(pk), cid);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const pk = getParam("client"); // loader uses ?client=pk_...
    setPublicKey(pk);
    bootstrap(pk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage() {
    if (!token || !conversationId || chatBusy) return;

    const userMsg = input.trim();
    if (!userMsg) return;

    setChatBusy(true);
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");

    try {
      const res = await fetch("/api/widget/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: userMsg,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const err = String(json?.error || "chat_failed");
        setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${err}` }]);
        return;
      }

      const reply = String(json?.reply || "").trim() || "…";
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Network error. Please try again." }]);
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 420 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>TamTam Widget</div>

      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10, lineHeight: 1.5 }}>
        <div>client: <code>{publicKey || "-"}</code></div>
        <div>token: {token ? "✅" : "❌"} · conversation: {conversationId ? "✅" : "❌"} · status: {chatBusy ? "thinking…" : "ready"}</div>
        {bootError ? (
          <div style={{ marginTop: 6, color: "#b00020" }}>
            boot error: <code>{bootError}</code>
          </div>
        ) : null}
      </div>

      <div
        ref={chatBoxRef}
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          height: 300,
          overflow: "auto",
          background: "#fff",
        }}
      >
        {messages.map((m, idx) => (
          <div key={idx} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{m.role}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={token && conversationId ? "Type..." : "Loading..."}
          disabled={!token || !conversationId || chatBusy}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!canSend}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            opacity: canSend ? 1 : 0.55,
            cursor: canSend ? "pointer" : "not-allowed",
          }}
        >
          Send
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
        (MVP debug info shown — we remove this after customer test is stable.)
      </div>
    </div>
  );
}
