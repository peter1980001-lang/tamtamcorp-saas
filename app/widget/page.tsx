"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };

function hostOnly(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function WidgetPage() {
  const [publicKey, setPublicKey] = useState("");
  const [site, setSite] = useState("");

  const [token, setToken] = useState<string>("");
  const [conversationId, setConversationId] = useState<string>("");
  const [status, setStatus] = useState<string>("booting");
  const [lang, setLang] = useState<"de" | "en">("en");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // lead capture
  const [leadMode, setLeadMode] = useState(false);
  const [leadPrompt, setLeadPrompt] = useState<string>("");
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadIntent, setLeadIntent] = useState("");
  const [leadBudget, setLeadBudget] = useState("");
  const [leadTimeline, setLeadTimeline] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const canSend = useMemo(
    () => !!token && !!conversationId && !busy && input.trim().length > 0,
    [token, conversationId, busy, input]
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    const pk = String(url.searchParams.get("public_key") || "").trim();
    const s = String(url.searchParams.get("site") || window.location.origin).trim();

    setPublicKey(pk);
    setSite(s);

    setMessages([{ role: "assistant", text: "Hi! How can I help?" }]);
  }, []);

  useEffect(() => {
    if (!publicKey) return;

    (async () => {
      try {
        setStatus("auth");

        const auth = await fetch("/api/widget/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_key: publicKey,
            site: hostOnly(site),
          }),
        });

        const authJson = await auth.json().catch(() => null);
        if (!auth.ok) {
          setStatus(`auth_error:${authJson?.error || auth.status}`);
          return;
        }

        setToken(String(authJson?.token || ""));
        setStatus("conversation");

        const conv = await fetch("/api/widget/conversation", {
          method: "POST",
          headers: { Authorization: `Bearer ${authJson.token}` },
        });

        const convJson = await conv.json().catch(() => null);
        if (!conv.ok) {
          setStatus(`conversation_error:${convJson?.error || conv.status}`);
          return;
        }

        setConversationId(String(convJson?.conversation?.id || ""));
        setStatus("ready");
      } catch (e: any) {
        setStatus(`boot_error:${e?.message || "unknown"}`);
      }
    })();
  }, [publicKey, site]);

  useEffect(() => {
    if (!boxRef.current) return;
    boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages, leadMode]);

  async function send() {
    if (!canSend) return;

    const text = input.trim();
    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", text }]);

    try {
      const res = await fetch("/api/widget/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: text,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${json?.error || res.status}` }]);
        return;
      }

      const reply = String(json?.reply || "");
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);

      const hdrLang = String(res.headers.get("x-tamtam-lang") || "").toLowerCase();
      if (hdrLang === "de" || hdrLang === "en") setLang(hdrLang as any);

      if (json?.need_lead_capture) {
        setLeadPrompt(String(json?.lead_prompt || ""));
        setLeadMode(true);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Network error. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  async function submitLead() {
    if (!token || !conversationId || leadSubmitting) return;

    const name = leadName.trim();
    const email = leadEmail.trim().toLowerCase();
    const phone = leadPhone.trim();

    if (!email && !phone) {
      alert(lang === "de" ? "Bitte gib E-Mail oder Telefonnummer an." : "Please provide at least email or phone.");
      return;
    }
    if (email && !isValidEmail(email)) {
      alert(lang === "de" ? "Bitte gib eine gültige E-Mail ein." : "Please enter a valid email.");
      return;
    }

    setLeadSubmitting(true);

    try {
      const res = await fetch("/api/widget/lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          name: name || null,
          email: email || null,
          phone: phone || null,
          intent: leadIntent.trim() || null,
          budget: leadBudget.trim() || null,
          timeline: leadTimeline.trim() || null,
          consent_privacy: true,
          consent_marketing: false,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        alert(`${lang === "de" ? "Fehler" : "Error"}: ${json?.error || res.status}`);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: lang === "de" ? "Danke! Wir melden uns zeitnah bei dir." : "Thanks! We’ll get back to you shortly." },
      ]);

      setLeadMode(false);
      setLeadPrompt("");
      setLeadName("");
      setLeadEmail("");
      setLeadPhone("");
      setLeadIntent("");
      setLeadBudget("");
      setLeadTimeline("");
    } finally {
      setLeadSubmitting(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 420 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>TamTam Widget</div>

      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
        status: {status} · lang: {lang} · token: {token ? "✅" : "❌"} · conversation: {conversationId ? "✅" : "❌"}
      </div>

      <div
        ref={boxRef}
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          height: 280,
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
          placeholder={status === "ready" ? (lang === "de" ? "Schreiben..." : "Type...") : "Loading..."}
          disabled={status !== "ready" || busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        />
        <button
          onClick={send}
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
          {busy ? "…" : lang === "de" ? "Senden" : "Send"}
        </button>
      </div>

      {leadMode && (
        <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{lang === "de" ? "Kontakt" : "Contact"}</div>
          {leadPrompt ? <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>{leadPrompt}</div> : null}

          <div style={{ display: "grid", gap: 8 }}>
            <input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder={lang === "de" ? "Name (optional)" : "Name (optional)"} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
            <input value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder={lang === "de" ? "E-Mail (optional)" : "Email (optional)"} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
            <input value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder={lang === "de" ? "Telefon (optional)" : "Phone (optional)"} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />

            <textarea value={leadIntent} onChange={(e) => setLeadIntent(e.target.value)} placeholder={lang === "de" ? "Worum geht es? (optional)" : "What do you need? (optional)"} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", minHeight: 70 }} />
            <input value={leadBudget} onChange={(e) => setLeadBudget(e.target.value)} placeholder={lang === "de" ? "Budget (optional)" : "Budget (optional)"} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
            <input value={leadTimeline} onChange={(e) => setLeadTimeline(e.target.value)} placeholder={lang === "de" ? "Zeitrahmen (optional)" : "Timeline (optional)"} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />

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
                  cursor: leadSubmitting ? "not-allowed" : "pointer",
                  opacity: leadSubmitting ? 0.7 : 1,
                }}
              >
                {leadSubmitting ? "…" : lang === "de" ? "Absenden" : "Submit"}
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
                {lang === "de" ? "Schließen" : "Close"}
              </button>
            </div>

            <div style={{ fontSize: 12, opacity: 0.65 }}>
              {lang === "de" ? "Mindestens E-Mail oder Telefon angeben." : "Provide at least email or phone."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
