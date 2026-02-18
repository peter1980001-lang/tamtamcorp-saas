"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


type Msg = { role: "user" | "assistant"; text: string };

type Branding = {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  logo_url?: string | null;
  company_name?: string | null;
  greeting?: string | null;
};

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

function safeCssColor(v: any) {
  const s = String(v || "").trim();
  if (!s) return "";
  // allow #RGB/#RRGGBB/#RRGGBBAA or rgb/rgba/hsl/hsla or css var
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\(/i.test(s)) return s;
  if (/^var\(--[a-z0-9\-_]+\)$/i.test(s)) return s;
  return "";
}

function applyBrandingCSS(branding: Branding) {
  const root = document.documentElement;

  // TamTam default theme
  const defaults = {
    primary: "#111111",
    secondary: "#ffffff",
    accent: "#F5C400", // subtle TamTam yellow
  };

  const primary = safeCssColor(branding.primary) || defaults.primary;
  const secondary = safeCssColor(branding.secondary) || defaults.secondary;
  const accent = safeCssColor(branding.accent) || defaults.accent;

  root.style.setProperty("--tt-primary", primary);
  root.style.setProperty("--tt-secondary", secondary);
  root.style.setProperty("--tt-accent", accent);

  // derived
  root.style.setProperty("--tt-bg", secondary);
  root.style.setProperty("--tt-fg", primary);
  root.style.setProperty("--tt-border", "rgba(17,17,17,0.15)");
  root.style.setProperty("--tt-muted", "rgba(17,17,17,0.65)");
  root.style.setProperty("--tt-panel", "#ffffff");
  root.style.setProperty("--tt-user", primary);
  root.style.setProperty("--tt-user-text", "#ffffff");
  root.style.setProperty("--tt-assistant", "rgba(17,17,17,0.06)");
  root.style.setProperty("--tt-assistant-text", primary);
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

  // theming
  const [branding, setBranding] = useState<Branding>({
    primary: null,
    secondary: null,
    accent: null,
    logo_url: null,
    company_name: null,
    greeting: null,
  });
  const [themeReady, setThemeReady] = useState(false);

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

    // default theme immediately (prevents flash)
    applyBrandingCSS({});
    setThemeReady(true);

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

        const t = String(authJson?.token || "");
        setToken(t);

        // bootstrap theming
        try {
          const b = await fetch("/api/widget/bootstrap", {
            method: "GET",
            headers: { Authorization: `Bearer ${t}` },
          });
          const bJson = await b.json().catch(() => null);
          if (b.ok) {
            const br = (bJson?.branding || {}) as Branding;
            setBranding(br);

            applyBrandingCSS(br);

            // greeting override (if provided)
            const greet = String(br?.greeting || "").trim();
            const name = String(br?.company_name || "").trim();

            if (greet) {
              setMessages([{ role: "assistant", text: greet }]);
            } else if (name) {
              setMessages([{ role: "assistant", text: `Hi! Welcome to ${name}. How can I help?` }]);
            }
          }
        } catch {
          // ignore bootstrap errors, keep default theme
        }

        setStatus("conversation");

        const conv = await fetch("/api/widget/conversation", {
          method: "POST",
          headers: { Authorization: `Bearer ${t}` },
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

  const title = useMemo(() => {
    const name = String(branding.company_name || "").trim();
    return name ? name : "TamTam Widget";
  }, [branding.company_name]);

  return (
    <div
      style={{
        fontFamily: "system-ui",
        padding: 14,
        maxWidth: 420,
        background: "var(--tt-bg)",
        color: "var(--tt-fg)",
      }}
    >
      <style>{`
        :root{
          --tt-primary:#111;
          --tt-secondary:#fff;
          --tt-accent:#F5C400;
          --tt-bg:var(--tt-secondary);
          --tt-fg:var(--tt-primary);
          --tt-border:rgba(17,17,17,0.15);
          --tt-muted:rgba(17,17,17,0.65);
          --tt-panel:#fff;
          --tt-user:var(--tt-primary);
          --tt-user-text:#fff;
          --tt-assistant:rgba(17,17,17,0.06);
          --tt-assistant-text:var(--tt-primary);
        }
        .tt-card{
          border:1px solid var(--tt-border);
          border-radius:14px;
          background:var(--tt-panel);
        }
        .tt-header{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          margin-bottom:10px;
        }
        .tt-brand{
          display:flex;
          align-items:center;
          gap:10px;
          min-width:0;
        }
        .tt-logo{
          width:28px;height:28px;border-radius:8px;
          border:1px solid var(--tt-border);
          object-fit:cover;
          background:#fff;
          flex:0 0 auto;
        }
        .tt-title{
          font-weight:800;
          line-height:1.1;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
          max-width:260px;
        }
        .tt-badge{
          font-size:12px;
          padding:4px 8px;
          border-radius:999px;
          border:1px solid var(--tt-border);
          color:var(--tt-muted);
          background:rgba(255,255,255,0.6);
        }
        .tt-chat{
          height:300px;
          overflow:auto;
          padding:12px;
        }
        .tt-row{
          display:flex;
          margin-bottom:10px;
        }
        .tt-row.user{ justify-content:flex-end; }
        .tt-row.assistant{ justify-content:flex-start; }

        .tt-bubble{
          max-width:80%;
          padding:10px 12px;
          border-radius:14px;
          white-space:pre-wrap;
          line-height:1.35;
          border:1px solid transparent;
        }
        .tt-bubble.user{
          background:var(--tt-user);
          color:var(--tt-user-text);
          border-color:rgba(255,255,255,0.12);
          border-top-right-radius:6px;
        }
        .tt-bubble.assistant{
          background:var(--tt-assistant);
          color:var(--tt-assistant-text);
          border-color:rgba(17,17,17,0.08);
          border-top-left-radius:6px;
        }

        .tt-composer{
          display:flex;
          gap:8px;
          margin-top:10px;
        }
        .tt-input{
          flex:1;
          padding:10px 12px;
          border-radius:12px;
          border:1px solid var(--tt-border);
          background:#fff;
          color:var(--tt-fg);
          outline:none;
        }
        .tt-input:focus{
          border-color: color-mix(in srgb, var(--tt-accent) 55%, #111 45%);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--tt-accent) 25%, transparent 75%);
        }
        .tt-btn{
          padding:10px 14px;
          border-radius:12px;
          border:1px solid var(--tt-primary);
          background:var(--tt-primary);
          color:#fff;
          cursor:pointer;
        }
        .tt-btn:disabled{
          opacity:0.55;
          cursor:not-allowed;
        }
        .tt-btn.secondary{
          border:1px solid var(--tt-border);
          background:#fff;
          color:var(--tt-fg);
        }

        .tt-lead{
          margin-top:10px;
          padding:12px;
        }
        .tt-lead h3{
          margin:0 0 8px 0;
          font-size:14px;
        }
        .tt-help{
          font-size:12px;
          color:var(--tt-muted);
          margin-top:8px;
        }
        .tt-grid{
          display:grid;
          gap:8px;
        }
        .tt-textarea{
          padding:10px 12px;
          border-radius:12px;
          border:1px solid var(--tt-border);
          background:#fff;
          color:var(--tt-fg);
          min-height:78px;
          resize:vertical;
          outline:none;
        }
        .tt-textarea:focus{
          border-color: color-mix(in srgb, var(--tt-accent) 55%, #111 45%);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--tt-accent) 25%, transparent 75%);
        }
        .tt-divider{
          height:1px;
          background:var(--tt-border);
          margin:10px 0;
        }
      `}</style>

      <div className="tt-header">
        <div className="tt-brand">
          {branding.logo_url ? <img className="tt-logo" src={branding.logo_url} alt="logo" /> : <div className="tt-logo" />}
          <div className="tt-title">{title}</div>
        </div>

        <div className="tt-badge">{status === "ready" ? (lang === "de" ? "Online" : "Online") : status}</div>
      </div>

      <div className="tt-card">
        <div ref={boxRef} className="tt-chat">
          {messages.map((m, idx) => (
            <div key={idx} className={`tt-row ${m.role}`}>
              <div className={`tt-bubble ${m.role}`}>
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      a: ({ node, ...props }) => (
        <a
          {...props}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--tt-accent)",
            textDecoration: "underline",
            fontWeight: 600,
          }}
        />
      ),
    }}
  >
    {m.text}
  </ReactMarkdown>
</div>

            </div>
          ))}
        </div>
      </div>

      <div className="tt-composer">
        <input
          className="tt-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={status === "ready" ? (lang === "de" ? "Schreiben..." : "Type...") : "Loading..."}
          disabled={status !== "ready" || busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button className="tt-btn" onClick={send} disabled={!canSend}>
          {busy ? "…" : lang === "de" ? "Senden" : "Send"}
        </button>
      </div>

      {leadMode && (
        <div className="tt-card tt-lead">
          <h3>{lang === "de" ? "Kontakt" : "Contact"}</h3>
          {leadPrompt ? <div style={{ fontSize: 13, color: "var(--tt-muted)", marginBottom: 10 }}>{leadPrompt}</div> : null}

          <div className="tt-grid">
            <input className="tt-input" value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder={lang === "de" ? "Name (optional)" : "Name (optional)"} />
            <input className="tt-input" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder={lang === "de" ? "E-Mail (optional)" : "Email (optional)"} />
            <input className="tt-input" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder={lang === "de" ? "Telefon (optional)" : "Phone (optional)"} />

            <textarea className="tt-textarea" value={leadIntent} onChange={(e) => setLeadIntent(e.target.value)} placeholder={lang === "de" ? "Worum geht es? (optional)" : "What do you need? (optional)"} />
            <input className="tt-input" value={leadBudget} onChange={(e) => setLeadBudget(e.target.value)} placeholder={lang === "de" ? "Budget (optional)" : "Budget (optional)"} />
            <input className="tt-input" value={leadTimeline} onChange={(e) => setLeadTimeline(e.target.value)} placeholder={lang === "de" ? "Zeitrahmen (optional)" : "Timeline (optional)"} />

            <div style={{ display: "flex", gap: 8 }}>
              <button className="tt-btn" onClick={submitLead} disabled={leadSubmitting}>
                {leadSubmitting ? "…" : lang === "de" ? "Absenden" : "Submit"}
              </button>

              <button className="tt-btn secondary" onClick={() => setLeadMode(false)} disabled={leadSubmitting}>
                {lang === "de" ? "Schließen" : "Close"}
              </button>
            </div>

            <div className="tt-help">{lang === "de" ? "Mindestens E-Mail oder Telefon angeben." : "Provide at least email or phone."}</div>
          </div>
        </div>
      )}

      {/* tiny footer accent line */}
      <div style={{ marginTop: 10, height: 3, borderRadius: 999, background: "var(--tt-accent)", opacity: 0.9 }} />
    </div>
  );
}
