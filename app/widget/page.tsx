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

type Slot = { start_at: string; end_at: string };

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
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\(/i.test(s)) return s;
  if (/^var\(--[a-z0-9\-_]+\)$/i.test(s)) return s;
  return "";
}

function safePublicLogoUrl(url: any) {
  const s = String(url || "").trim();
  if (!s) return null;
  if (s.startsWith("http://")) return "https://" + s.slice("http://".length);
  return s;
}

function applyBrandingCSS(branding: Branding) {
  const root = document.documentElement;

  const defaults = {
    primary: "#111111",
    secondary: "#ffffff",
    accent: "#111111",
  };

  const primary = safeCssColor(branding.primary) || defaults.primary;
  const secondary = safeCssColor(branding.secondary) || defaults.secondary;
  const accent = safeCssColor(branding.accent) || defaults.accent;

  root.style.setProperty("--tt-primary", primary);
  root.style.setProperty("--tt-secondary", secondary);
  root.style.setProperty("--tt-accent", accent);
  root.style.setProperty("--tt-bg", "transparent");
  root.style.setProperty("--tt-fg", primary);
  root.style.setProperty("--tt-muted", "rgba(17,17,17,0.58)");
}

function formatSlot(iso: string, timeZone: string) {
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
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

  const [branding, setBranding] = useState<Branding>({
    primary: null,
    secondary: null,
    accent: null,
    logo_url: null,
    company_name: null,
    greeting: null,
  });

  const [leadMode, setLeadMode] = useState(false);
  const [leadPrompt, setLeadPrompt] = useState<string>("");
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadIntent, setLeadIntent] = useState("");
  const [leadBudget, setLeadBudget] = useState("");
  const [leadTimeline, setLeadTimeline] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  const [bookingMode, setBookingMode] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotTimezone, setSlotTimezone] = useState("UTC");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [holdToken, setHoldToken] = useState("");
  const [holdExpiresAt, setHoldExpiresAt] = useState("");
  const [bookingName, setBookingName] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = useMemo(
    () => !!token && !!conversationId && !busy && input.trim().length > 0 && status === "ready",
    [token, conversationId, busy, input, status]
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    const pk = String(url.searchParams.get("public_key") || "").trim();
    const s = String(url.searchParams.get("site") || window.location.origin).trim();

    setPublicKey(pk);
    setSite(s);

    applyBrandingCSS({});
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
          body: JSON.stringify({ public_key: publicKey, site: hostOnly(site) }),
        });

        const authJson = await auth.json().catch(() => null);
        if (!auth.ok) {
          setStatus(`auth_error:${authJson?.error || auth.status}`);
          return;
        }

        const t = String(authJson?.token || "");
        setToken(t);

        try {
          const b = await fetch("/api/widget/bootstrap", {
            method: "POST",
            headers: { Authorization: `Bearer ${t}` },
          });
          const bJson = await b.json().catch(() => null);
          if (b.ok) {
            const br = (bJson?.branding || {}) as Branding;
            const normalized = { ...br, logo_url: safePublicLogoUrl(br.logo_url) };
            setBranding(normalized);
            applyBrandingCSS(normalized);

            const greet = String(normalized?.greeting || "").trim();
            const name = String(normalized?.company_name || "").trim();

            if (greet) setMessages([{ role: "assistant", text: greet }]);
            else if (name) setMessages([{ role: "assistant", text: `Hi! Welcome to ${name}. How can I help?` }]);
          }
        } catch {}

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
        setTimeout(() => inputRef.current?.focus(), 50);
      } catch (e: any) {
        setStatus(`boot_error:${e?.message || "unknown"}`);
      }
    })();
  }, [publicKey, site]);

  useEffect(() => {
    if (!boxRef.current) return;
    boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages, leadMode, busy, bookingMode, slots, selectedSlot]);

  async function loadSlots() {
    if (!token) return;
    setSlotLoading(true);
    setBookingMode(true);
    setSlots([]);
    setSelectedSlot(null);
    setHoldToken("");
    setHoldExpiresAt("");

    try {
      const res = await fetch("/api/widget/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ limit: 8 }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: lang === "de" ? "Ich konnte gerade keine freien Termine laden." : "I couldn't load available slots right now.",
          },
        ]);
        setBookingMode(false);
        return;
      }

      setSlotTimezone(String(json?.timezone || "UTC"));
      setSlots(Array.isArray(json?.slots) ? json.slots : []);
      if (!json?.slots?.length) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: lang === "de" ? "Aktuell sehe ich keine freien Termine im angefragten Zeitraum." : "I don't see any open slots in the requested range right now.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: lang === "de" ? "Fehler beim Laden der Termine." : "Error while loading slots.",
        },
      ]);
      setBookingMode(false);
    } finally {
      setSlotLoading(false);
    }
  }

  async function holdSlot(slot: Slot) {
    if (!token || !conversationId) return;

    try {
      const res = await fetch("/api/widget/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversation_id: conversationId,
          start_at: slot.start_at,
          end_at: slot.end_at,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text:
              lang === "de"
                ? "Dieser Termin ist gerade nicht mehr verfügbar. Ich lade neue Optionen."
                : "That slot is no longer available. I'll load fresh options.",
          },
        ]);
        await loadSlots();
        return;
      }

      setSelectedSlot(slot);
      setHoldToken(String(json?.hold_token || ""));
      setHoldExpiresAt(String(json?.expires_at || ""));
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: lang === "de" ? "Fehler beim Reservieren des Termins." : "Error while reserving the slot.",
        },
      ]);
    }
  }

  async function confirmBooking() {
    if (!token || !conversationId || !holdToken || bookingSubmitting) return;

    const name = bookingName.trim();
    const email = bookingEmail.trim().toLowerCase();
    const phone = bookingPhone.trim();

    if (!email && !phone) {
      alert(lang === "de" ? "Bitte gib E-Mail oder Telefonnummer an." : "Please provide at least email or phone.");
      return;
    }
    if (email && !isValidEmail(email)) {
      alert(lang === "de" ? "Bitte gib eine gültige E-Mail ein." : "Please enter a valid email.");
      return;
    }

    setBookingSubmitting(true);

    try {
      const res = await fetch("/api/widget/book", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          hold_token: holdToken,
          conversation_id: conversationId,
          contact_name: name || null,
          contact_email: email || null,
          contact_phone: phone || null,
          title: "Widget appointment",
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text:
              lang === "de"
                ? `Termin konnte nicht bestätigt werden: ${json?.error || res.status}`
                : `Could not confirm the appointment: ${json?.error || res.status}`,
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            lang === "de"
              ? "Perfekt — dein Termin wurde bestätigt. Wir melden uns bei Bedarf mit weiteren Details."
              : "Perfect — your appointment is confirmed. We’ll follow up with any needed details.",
        },
      ]);

      setBookingMode(false);
      setSlots([]);
      setSelectedSlot(null);
      setHoldToken("");
      setHoldExpiresAt("");
      setBookingName("");
      setBookingEmail("");
      setBookingPhone("");
    } finally {
      setBookingSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function send() {
    if (!canSend) return;

    const text = input.trim();
    setInput("");
    setBusy(true);

    // Add user message + empty assistant placeholder immediately
    setMessages((prev) => [...prev, { role: "user", text }, { role: "assistant", text: "" }]);

    try {
      const res = await fetch("/api/widget/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversation_id: conversationId, message: text }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", text: `Error: ${json?.error || res.status}` },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let seenDone = false;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });

        // SSE events are delimited by double newlines
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";

        for (const event of events) {
          const lines = event.split("\n");
          for (const line of lines) {
            if (line === "event: done") {
              seenDone = true;
            } else if (line.startsWith("data: ")) {
              const raw = line.slice(6);
              if (seenDone) {
                // Final metadata event
                try {
                  const meta = JSON.parse(raw);
                  const act = String(meta.action || "reply");
                  if (act === "show_slots") {
                    setLeadMode(false);
                    loadSlots();
                  } else if (act === "capture_contact" || act === "handoff" || meta.need_lead_capture) {
                    setLeadPrompt(String(meta.lead_prompt || ""));
                    setLeadMode(true);
                  }
                } catch {}
                break outer;
              } else {
                // Streaming text chunk — JSON-encoded to preserve newlines safely
                try {
                  const chunk: string = JSON.parse(raw);
                  setMessages((prev) => {
                    const copy = [...prev];
                    const last = copy[copy.length - 1];
                    if (last?.role === "assistant") {
                      copy[copy.length - 1] = { role: "assistant", text: last.text + chunk };
                    }
                    return copy;
                  });
                } catch {}
              }
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        // Replace empty placeholder with error, or leave partial reply as-is
        if (last?.role === "assistant" && !last.text) {
          return [
            ...prev.slice(0, -1),
            { role: "assistant", text: lang === "de" ? "Netzwerkfehler. Bitte erneut versuchen." : "Network error. Please try again." },
          ];
        }
        return prev;
      });
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const title = useMemo(() => {
    const name = String(branding.company_name || "").trim();
    return name ? name : "TamTam";
  }, [branding.company_name]);

  const initials = useMemo(() => {
    const name = String(branding.company_name || "TamTam").trim();
    const parts = name.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || "T";
    const b = parts[1]?.[0] || parts[0]?.[1] || "T";
    return (a + b).toUpperCase();
  }, [branding.company_name]);

  const statusLabel = useMemo(() => {
    if (status === "ready") return lang === "de" ? "Online" : "Online";
    if (status === "booting") return lang === "de" ? "Startet…" : "Starting…";
    if (status === "auth") return lang === "de" ? "Verbindet…" : "Connecting…";
    if (status === "conversation") return lang === "de" ? "Initialisiert…" : "Initializing…";
    if (status.startsWith("auth_error")) return lang === "de" ? "Auth Fehler" : "Auth error";
    if (status.startsWith("conversation_error")) return lang === "de" ? "Fehler" : "Error";
    if (status.startsWith("boot_error")) return lang === "de" ? "Fehler" : "Error";
    return status;
  }, [status, lang]);

  return (
    <div
      className="tt-page"
      style={{
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
        padding: 14,
        maxWidth: 420,
        background: "transparent",
        color: "var(--tt-fg)",
      }}
    >
      <style>{`
:root{
  --tt-primary:#111;
  --tt-secondary:#fff;
  --tt-accent:#111;

  --tt-bg: transparent;
  --tt-fg: var(--tt-primary);

  --tt-border: rgba(255,255,255,0.42);
  --tt-border-soft: rgba(0,0,0,0.06);

  --tt-muted: rgba(17,17,17,0.58);

  --tt-glass: rgba(255,255,255,0.52);
  --tt-glass-strong: rgba(255,255,255,0.62);
}

.tt-card{
  border: 1px solid var(--tt-border);
  border-radius: 26px;
  background: var(--tt-glass);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.75);
  overflow: hidden;
}

.tt-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding: 14px 14px 12px 14px;
  background: rgba(255,255,255,0.26);
  border-bottom: 1px solid var(--tt-border-soft);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.tt-brand{
  display:flex;
  align-items:center;
  gap:10px;
  min-width:0;
}

.tt-logo{
  width:30px;height:30px;border-radius:12px;
  border:1px solid rgba(0,0,0,0.08);
  object-fit:cover;
  background: rgba(255,255,255,0.75);
  flex:0 0 auto;
}
.tt-logoFallback{
  width:30px;height:30px;border-radius:12px;
  border:1px solid rgba(0,0,0,0.08);
  background: rgba(255,255,255,0.75);
  display:flex;align-items:center;justify-content:center;
  font-weight:900;font-size:12px;color:#111;
  flex:0 0 auto;
}

.tt-titleWrap{ min-width:0; display:flex; flex-direction:column; gap:2px; }
.tt-title{ font-weight:900; font-size:14px; line-height:1.15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:240px; }
.tt-sub{ font-size:12px; color: var(--tt-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:240px; }

.tt-badge{
  font-size:12px;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid rgba(0,0,0,0.08);
  color: var(--tt-muted);
  background: rgba(255,255,255,0.60);
  display:flex;
  align-items:center;
  gap:8px;
}

.tt-dot{
  width:8px;height:8px;border-radius:999px;
  background:#111;
  box-shadow: 0 0 0 3px rgba(0,0,0,0.08);
}

.tt-shell{ height: 100%; display:flex; flex-direction:column; }
.tt-chat{ flex:1; min-height:0; overflow:auto; padding:16px; background: transparent; }

.tt-row{ display:flex; margin-bottom:10px; }
.tt-row.user{ justify-content:flex-end; }
.tt-row.assistant{ justify-content:flex-start; }

.tt-bubble{
  max-width:82%;
  padding:10px 12px;
  border-radius:18px;
  white-space:pre-wrap;
  line-height:1.38;
  font-size:14px;
  border:1px solid transparent;
}
.tt-bubble.user{
  background:#111;
  color:#fff;
  border-color: rgba(255,255,255,0.12);
  border-radius:18px 18px 8px 18px;
}
.tt-bubble.assistant{
  background: rgba(255,255,255,0.70);
  border:1px solid rgba(0,0,0,0.06);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color:#111;
  border-radius:18px 18px 18px 8px;
}

.tt-divider{ height:1px; background: rgba(0,0,0,0.06); }

.tt-composer{
  display:flex;
  gap:10px;
  padding:12px;
  background: rgba(255,255,255,0.26);
  border-top:1px solid rgba(0,0,0,0.06);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.tt-input, .tt-textarea{
  flex:1;
  padding:10px 12px;
  border-radius:16px;
  border:1px solid rgba(0,0,0,0.10);
  background: rgba(255,255,255,0.62);
  color:#111;
  outline:none;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.tt-textarea{ min-height:42px; resize:none; line-height:1.3; }

.tt-input:focus, .tt-textarea:focus{
  border-color: rgba(0,0,0,0.18);
  box-shadow: 0 0 0 2px rgba(0,0,0,0.08);
}

.tt-btn{
  padding:10px 14px;
  border-radius:16px;
  border:1px solid rgba(0,0,0,0.10);
  background: rgba(255,255,255,0.62);
  color:#111;
  cursor:pointer;
  font-weight:800;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.tt-btn:disabled{ opacity:0.55; cursor:not-allowed; }
.tt-btn.secondary{
  border:1px solid rgba(0,0,0,0.08);
  background: rgba(255,255,255,0.45);
  color:#111;
}

.tt-lead{ margin-top:12px; padding:14px; border-radius:22px; }
.tt-grid{ display:grid; gap:8px; }
.tt-leadPrompt{ font-size:13px; color: var(--tt-muted); margin-bottom:10px; line-height:1.35; }
.tt-rowBtns{ display:flex; gap:10px; flex-wrap: wrap; }
.tt-help{ font-size:12px; color: var(--tt-muted); margin-top:8px; }

.tt-slots{
  margin-top:12px;
  padding:14px;
  border-radius:22px;
}
.tt-slotGrid{
  display:grid;
  gap:8px;
  margin-top:12px;
}
.tt-slotBtn{
  width:100%;
  text-align:left;
  padding:10px 12px;
  border-radius:16px;
  border:1px solid rgba(0,0,0,0.08);
  background: rgba(255,255,255,0.70);
  cursor:pointer;
  font-weight:700;
}
.tt-slotBtn.active{
  background:#111;
  color:#fff;
}
.tt-mini{
  font-size:12px;
  color: var(--tt-muted);
}
      `}</style>

      <div className="tt-card tt-shell">
        <div className="tt-header">
          <div className="tt-brand">
            {branding.logo_url ? (
              <img className="tt-logo" src={String(branding.logo_url)} alt="logo" />
            ) : (
              <div className="tt-logoFallback" aria-hidden="true">
                {initials}
              </div>
            )}

            <div className="tt-titleWrap">
              <div className="tt-title">{title}</div>
              <div className="tt-sub">{lang === "de" ? "Schnelle Hilfe & Anfrage" : "Quick help & inquiry"}</div>
            </div>
          </div>

          <div className="tt-badge" title={status}>
            <span className="tt-dot" aria-hidden="true" />
            <span>{statusLabel}</span>
          </div>
        </div>

        <div ref={boxRef} className="tt-chat">
          {messages.map((m, idx) => (
            <div key={idx} className={`tt-row ${m.role}`}>
              <div className={`tt-bubble ${m.role}`}>
                {m.role === "assistant" && m.text === "" ? (
                  <span style={{ opacity: 0.45, letterSpacing: 2 }}>● ● ●</span>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ node: _node, ...props }: any) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#111", textDecoration: "underline", fontWeight: 700 }}
                        />
                      ),
                      ul: ({ node: _node, ...props }: any) => <ul {...props} style={{ paddingLeft: 18, margin: "8px 0" }} />,
                      ol: ({ node: _node, ...props }: any) => <ol {...props} style={{ paddingLeft: 18, margin: "8px 0" }} />,
                      li: ({ node: _node, ...props }: any) => <li {...props} style={{ margin: "4px 0" }} />,
                      code: ({ node: _node, ...props }: any) => (
                        <code
                          {...props}
                          style={{
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            fontSize: 13,
                            background: "rgba(17,17,17,0.06)",
                            padding: "2px 6px",
                            borderRadius: 8,
                          }}
                        />
                      ),
                    }}
                  >
                    {m.text}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="tt-divider" />

        <div className="tt-composer">
          <textarea
            ref={inputRef}
            className="tt-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              status === "ready"
                ? lang === "de"
                  ? "Schreibe hier…"
                  : "Type here…"
                : lang === "de"
                ? "Wird geladen…"
                : "Loading…"
            }
            disabled={status !== "ready" || busy}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            aria-label={lang === "de" ? "Nachricht" : "Message"}
          />

          <button className="tt-btn" onClick={send} disabled={!canSend}>
            {busy ? "…" : lang === "de" ? "Senden" : "Send"}
          </button>
        </div>
      </div>

      {bookingMode && (
        <div className="tt-card tt-slots">
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 900 }}>
            {lang === "de" ? "Termine" : "Appointments"}
          </h3>

          {!selectedSlot ? (
            <>
              <div className="tt-mini">
                {slotLoading
                  ? lang === "de"
                    ? "Lade freie Termine…"
                    : "Loading available slots…"
                  : lang === "de"
                  ? "Wähle einen freien Termin aus."
                  : "Choose an available slot."}
              </div>

              <div className="tt-slotGrid">
                {slots.map((slot) => (
                  <button
                    key={slot.start_at}
                    type="button"
                    className="tt-slotBtn"
                    onClick={() => holdSlot(slot)}
                    disabled={slotLoading}
                  >
                    {formatSlot(slot.start_at, slotTimezone)}
                  </button>
                ))}
              </div>

              {!slotLoading && slots.length === 0 ? (
                <div className="tt-help">
                  {lang === "de" ? "Keine freien Termine gefunden." : "No open slots found."}
                </div>
              ) : null}

              <div className="tt-rowBtns" style={{ marginTop: 12 }}>
                <button className="tt-btn secondary" onClick={() => setBookingMode(false)}>
                  {lang === "de" ? "Schließen" : "Close"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="tt-leadPrompt">
                {lang === "de"
                  ? `Reserviert bis ${holdExpiresAt ? new Date(holdExpiresAt).toLocaleTimeString() : ""}: ${formatSlot(selectedSlot.start_at, slotTimezone)}`
                  : `Reserved until ${holdExpiresAt ? new Date(holdExpiresAt).toLocaleTimeString() : ""}: ${formatSlot(selectedSlot.start_at, slotTimezone)}`}
              </div>

              <div className="tt-grid">
                <input className="tt-input" value={bookingName} onChange={(e) => setBookingName(e.target.value)} placeholder={lang === "de" ? "Name (optional)" : "Name (optional)"} />
                <input className="tt-input" value={bookingEmail} onChange={(e) => setBookingEmail(e.target.value)} placeholder={lang === "de" ? "E-Mail (optional)" : "Email (optional)"} />
                <input className="tt-input" value={bookingPhone} onChange={(e) => setBookingPhone(e.target.value)} placeholder={lang === "de" ? "Telefon (optional)" : "Phone (optional)"} />

                <div className="tt-rowBtns">
                  <button className="tt-btn" onClick={confirmBooking} disabled={bookingSubmitting}>
                    {bookingSubmitting ? "…" : lang === "de" ? "Termin bestätigen" : "Confirm appointment"}
                  </button>

                  <button
                    className="tt-btn secondary"
                    onClick={() => {
                      setSelectedSlot(null);
                      setHoldToken("");
                      setHoldExpiresAt("");
                    }}
                    disabled={bookingSubmitting}
                  >
                    {lang === "de" ? "Anderen Slot wählen" : "Choose another slot"}
                  </button>
                </div>

                <div className="tt-help">{lang === "de" ? "Mindestens E-Mail oder Telefon angeben." : "Provide at least email or phone."}</div>
              </div>
            </>
          )}
        </div>
      )}

      {leadMode && (
        <div className="tt-card tt-lead">
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 900 }}>{lang === "de" ? "Kontakt" : "Contact"}</h3>

          {leadPrompt ? <div className="tt-leadPrompt">{leadPrompt}</div> : null}

          <div className="tt-grid">
            <input className="tt-input" value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder={lang === "de" ? "Name (optional)" : "Name (optional)"} />
            <input className="tt-input" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder={lang === "de" ? "E-Mail (optional)" : "Email (optional)"} />
            <input className="tt-input" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder={lang === "de" ? "Telefon (optional)" : "Phone (optional)"} />

            <textarea className="tt-textarea" value={leadIntent} onChange={(e) => setLeadIntent(e.target.value)} placeholder={lang === "de" ? "Worum geht es? (optional)" : "What do you need? (optional)"} />
            <input className="tt-input" value={leadBudget} onChange={(e) => setLeadBudget(e.target.value)} placeholder={lang === "de" ? "Budget (optional)" : "Budget (optional)"} />
            <input className="tt-input" value={leadTimeline} onChange={(e) => setLeadTimeline(e.target.value)} placeholder={lang === "de" ? "Zeitrahmen (optional)" : "Timeline (optional)"} />

            <div className="tt-rowBtns">
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
    </div>
  );
}