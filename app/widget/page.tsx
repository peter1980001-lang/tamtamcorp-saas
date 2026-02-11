"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function WidgetPage() {
  const [client, setClient] = useState("");
  const [token, setToken] = useState("");
  const [greeting, setGreeting] = useState("Loading...");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  // Lead capture
  const [leadMode, setLeadMode] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  const [chatBusy, setChatBusy] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => !!token && !chatBusy && input.trim().length > 0, [token, chatBusy, input]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const c = url.searchParams.get("client") || "";
    setClient(c);

    (async () => {
      // bootstrap
      const boot = await fetch(`/api/bootstrap?client=${encodeURIComponent(c)}`);
      const bootJson = await boot.json().catch(() => ({}));
      const greet = bootJson?.brand?.greeting || "Hi! How can I help?";
      setGreeting(greet);
      setMessages([{ role: "assistant", text: greet }]);

      // auth token
      const auth = await fetch(`/api/widget/auth?client=${encodeURIComponent(c)}`);
      const authJson = await auth.json().catch(() => ({}));
      setToken(authJson?.token || "");
    })();
  }, []);

  useEffect(() => {
    // auto-scroll
    if (!chatBoxRef.current) return;
    chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [messages, leadMode]);

  async function sendMessage() {
    if (!token || chatBusy) return;
    const userMsg = input.trim();
    if (!userMsg) return;

    setChatBusy(true);
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: "demo", message: userMsg }),
      });

      const json = await res.json().catch(() => ({}));
      const answerText = (json?.answer as string) || "Sorry — something went wrong.";

      setMessages((prev) => [...prev, { role: "assistant", text: answerText }]);

      // Trigger lead capture if fallback appears
      if (answerText.toLowerCase().includes("leave your contact")) {
        setLeadMode(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Network error. Please try again." },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  async function submitLead() {
    if (!token || leadSubmitting) return;

    const name = leadName.trim() || null;
    const emailRaw = leadEmail.trim();
    const phoneRaw = leadPhone.trim();

    if (!emailRaw && !phoneRaw) {
      alert("Please provide at least an email or phone number.");
      return;
    }

    if (emailRaw && !isValidEmail(emailRaw)) {
      alert("Please enter a valid email address.");
      return;
    }

    setLeadSubmitting(true);

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          email: emailRaw || null,
          phone: phoneRaw || null,
          note: "Lead captured from widget",
        }),
      });

      const j = await res.json().catch(() => ({}));

      if (j?.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Thanks! We will contact you shortly." },
        ]);
        setLeadMode(false);
        setLeadName("");
        setLeadEmail("");
        setLeadPhone("");
      } else if (j?.error === "email_or_phone_required") {
        alert("Please provide at least an email or phone number.");
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Could not submit. Please try again." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Network error. Please try again." },
      ]);
    } finally {
      setLeadSubmitting(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 420 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>TamTam Widget (MVP)</div>

      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
        client: {client || "-"} | token: {token ? "✅" : "❌"} | status:{" "}
        {chatBusy ? "thinking..." : "ready"}
      </div>

      <div
        ref={chatBoxRef}
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          height: 260,
          overflow: "auto",
          background: "#fff",
        }}
      >
        {messages.map((m, idx) => (
          <div key={idx} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{m.role}</div>
            <div>{m.text}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={token ? "Type..." : "Loading..."}
          disabled={!token || chatBusy}
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

      {leadMode && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Leave your contact</div>

          <input
            value={leadName}
            onChange={(e) => setLeadName(e.target.value)}
            placeholder="Name (optional)"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              marginBottom: 8,
            }}
          />

          <input
            value={leadEmail}
            onChange={(e) => setLeadEmail(e.target.value)}
            placeholder="Email (optional)"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              marginBottom: 8,
            }}
          />

          <input
            value={leadPhone}
            onChange={(e) => setLeadPhone(e.target.value)}
            placeholder="Phone (optional)"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              marginBottom: 8,
            }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={submitLead}
              disabled={leadSubmitting}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                opacity: leadSubmitting ? 0.7 : 1,
                cursor: leadSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {leadSubmitting ? "Submitting..." : "Submit"}
            </button>

            <button
              onClick={() => setLeadMode(false)}
              disabled={leadSubmitting}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                color: "#111",
                cursor: leadSubmitting ? "not-allowed" : "pointer",
              }}
            >
              Close
            </button>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
            Provide at least email or phone.
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        Greeting: {greeting}
      </div>
    </div>
  );
}
