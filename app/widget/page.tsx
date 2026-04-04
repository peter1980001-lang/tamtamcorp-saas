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
  widget_theme?: "light" | "dark" | null;
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
  const isDark = branding.widget_theme === "dark";

  const primary = safeCssColor(branding.primary) || "#111111";
  const accent  = safeCssColor(branding.accent)  || primary;

  // Core brand
  root.style.setProperty("--tt-primary", primary);
  root.style.setProperty("--tt-accent",  accent);

  // Theme-dependent values
  root.style.setProperty("--tt-bg",           isDark ? "#0F0F0F" : "#FFFFFF");
  root.style.setProperty("--tt-header-border",isDark ? "#1E1E1E" : "#F0F0F0");
  root.style.setProperty("--tt-msg-bg",       isDark ? "#1A1A1A" : "#F4F4F5");
  root.style.setProperty("--tt-msg-text",     isDark ? "#FFFFFF" : "#0F172A");
  root.style.setProperty("--tt-input-bg",     isDark ? "#111111" : "#F8F8F8");
  root.style.setProperty("--tt-input-border", isDark ? "#2A2A2A" : "#E4E4E7");
  root.style.setProperty("--tt-muted",        isDark ? "rgba(255,255,255,0.45)" : "rgba(15,23,42,0.45)");
  root.style.setProperty("--tt-placeholder",  isDark ? "rgba(255,255,255,0.3)"  : "rgba(15,23,42,0.3)");
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
    const vn = String(url.searchParams.get("visitor_name") || "").trim();

    setPublicKey(pk);
    setSite(s);
    if (vn) setLeadName(vn);

    applyBrandingCSS({});
    const greeting = vn ? `Welcome back, ${vn}! How can I help you today?` : "Hi! How can I help?";
    setMessages([{ role: "assistant", text: greeting }]);
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
            const rawTheme = String((br as any).widget_theme || "light");
            const typedBr: Branding = {
              ...br,
              widget_theme: rawTheme === "dark" ? "dark" : "light",
              logo_url: safePublicLogoUrl(br.logo_url),
            };
            setBranding(typedBr);
            applyBrandingCSS(typedBr);

            const greet = String(typedBr?.greeting || "").trim();
            const companyName = String(typedBr?.company_name || "").trim();
            const url = new URL(window.location.href);
            const visitorName = String(url.searchParams.get("visitor_name") || "").trim();

            if (visitorName) {
              const base = greet || (companyName ? `Welcome to ${companyName}!` : "Welcome back!");
              setMessages([{ role: "assistant", text: `${base} Great to see you again, ${visitorName}. How can I help?` }]);
            } else if (greet) {
              setMessages([{ role: "assistant", text: greet }]);
            } else if (companyName) {
              setMessages([{ role: "assistant", text: `Hi! Welcome to ${companyName}. How can I help?` }]);
            }
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

      // Persist name for returning visitor greeting
      if (name) {
        try { localStorage.setItem("tt_visitor_name", name); } catch (e) {}
      }

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
    <div className="tt-page">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

:root {
  --tt-primary: #111111;
  --tt-accent: #111111;
  --tt-bg: #FFFFFF;
  --tt-header-border: #F0F0F0;
  --tt-msg-bg: #F4F4F5;
  --tt-msg-text: #0F172A;
  --tt-input-bg: #F8F8F8;
  --tt-input-border: #E4E4E7;
  --tt-muted: rgba(15,23,42,0.45);
  --tt-placeholder: rgba(15,23,42,0.3);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

.tt-page {
  font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
  background: var(--tt-bg);
  color: var(--tt-msg-text);
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ─────────────────────────────────── */
.tt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--tt-header-border);
  flex-shrink: 0;
  background: var(--tt-bg);
}

.tt-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.tt-avatar {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: var(--tt-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.tt-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tt-titleWrap {
  min-width: 0;
}

.tt-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--tt-msg-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}

.tt-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--tt-muted);
  font-weight: 500;
}

.tt-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #22C55E;
  flex-shrink: 0;
}

.tt-dot--error { background: #EF4444; }

/* ── Chat messages ───────────────────────────── */
.tt-chat {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scroll-behavior: smooth;
}

.tt-chat::-webkit-scrollbar { width: 0; }

.tt-row {
  display: flex;
  max-width: 100%;
}

.tt-row--user {
  justify-content: flex-end;
}

.tt-row--assistant {
  justify-content: flex-start;
}

.tt-bubble {
  max-width: 82%;
  padding: 10px 13px;
  font-size: 13.5px;
  line-height: 1.55;
  word-break: break-word;
}

.tt-bubble--assistant {
  background: var(--tt-msg-bg);
  color: var(--tt-msg-text);
  border-radius: 4px 16px 16px 16px;
}

.tt-bubble--user {
  background: var(--tt-primary);
  color: #fff;
  border-radius: 16px 4px 16px 16px;
}

/* markdown inside bubbles */
.tt-bubble p { margin: 0 0 6px; }
.tt-bubble p:last-child { margin-bottom: 0; }
.tt-bubble ul, .tt-bubble ol { padding-left: 18px; margin: 4px 0; }
.tt-bubble li { margin: 2px 0; }
.tt-bubble strong { font-weight: 700; }
.tt-bubble a { color: inherit; text-decoration: underline; }
.tt-bubble code {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  background: rgba(0,0,0,0.08);
  padding: 1px 5px;
  border-radius: 4px;
}

/* ── Typing indicator ────────────────────────── */
.tt-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
}

.tt-typing span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--tt-muted);
  animation: tt-bounce 1.2s ease-in-out infinite;
}

.tt-typing span:nth-child(2) { animation-delay: 0.2s; }
.tt-typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes tt-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30%            { transform: translateY(-5px); }
}

/* ── Composer ────────────────────────────────── */
.tt-divider {
  height: 1px;
  background: var(--tt-header-border);
  flex-shrink: 0;
}

.tt-composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 14px;
  background: var(--tt-bg);
  flex-shrink: 0;
}

.tt-textarea {
  flex: 1;
  background: var(--tt-input-bg);
  border: 1px solid var(--tt-input-border);
  border-radius: 14px;
  padding: 10px 13px;
  font-size: 13.5px;
  font-family: inherit;
  color: var(--tt-msg-text);
  resize: none;
  outline: none;
  min-height: 42px;
  max-height: 120px;
  line-height: 1.5;
  transition: border-color 150ms;
}

.tt-textarea::placeholder { color: var(--tt-placeholder); }
.tt-textarea:focus { border-color: var(--tt-primary); }

.tt-btn {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--tt-primary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 120ms;
}

.tt-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tt-btn:not(:disabled):hover { opacity: 0.85; }

.tt-btn svg { width: 16px; height: 16px; }

/* ── Lead form ───────────────────────────────── */
.tt-lead {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
}

.tt-leadHeader {
  padding: 14px 16px 10px;
  font-weight: 600;
  font-size: 13.5px;
  color: var(--tt-msg-text);
  border-bottom: 1px solid var(--tt-header-border);
}

.tt-leadPrompt {
  padding: 10px 16px;
  font-size: 13px;
  color: var(--tt-muted);
  line-height: 1.5;
}

.tt-leadBody {
  padding: 0 16px 14px;
  display: grid;
  gap: 10px;
  overflow-y: auto;
  flex: 1;
}

.tt-leadBody::-webkit-scrollbar { width: 0; }

.tt-field {
  display: grid;
  gap: 5px;
}

.tt-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--tt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tt-input {
  width: 100%;
  background: var(--tt-input-bg);
  border: 1px solid var(--tt-input-border);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13.5px;
  font-family: inherit;
  color: var(--tt-msg-text);
  outline: none;
  transition: border-color 150ms;
}

.tt-input:focus { border-color: var(--tt-primary); }
.tt-input::placeholder { color: var(--tt-placeholder); }

.tt-leadActions {
  display: flex;
  gap: 8px;
  padding: 0 16px 14px;
  flex-shrink: 0;
}

.tt-leadSubmit {
  flex: 1;
  background: var(--tt-primary);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 11px;
  font-size: 13.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 120ms;
}

.tt-leadSubmit:disabled { opacity: 0.5; cursor: not-allowed; }
.tt-leadSubmit:not(:disabled):hover { opacity: 0.85; }

.tt-leadCancel {
  background: var(--tt-input-bg);
  color: var(--tt-muted);
  border: 1px solid var(--tt-input-border);
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 13.5px;
  font-family: inherit;
  cursor: pointer;
}

/* ── Booking slots ───────────────────────────── */
.tt-slots {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tt-slotsHeader {
  padding: 14px 16px 10px;
  font-weight: 600;
  font-size: 13.5px;
  color: var(--tt-msg-text);
  border-bottom: 1px solid var(--tt-header-border);
}

.tt-slotsBody {
  padding: 12px 16px;
  overflow-y: auto;
  flex: 1;
}

.tt-slotsBody::-webkit-scrollbar { width: 0; }

.tt-slotGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.tt-slotBtn {
  background: var(--tt-input-bg);
  border: 1px solid var(--tt-input-border);
  border-radius: 10px;
  padding: 9px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--tt-msg-text);
  cursor: pointer;
  text-align: center;
  line-height: 1.4;
  transition: border-color 150ms, background 150ms;
  font-weight: 500;
}

.tt-slotBtn:hover {
  border-color: var(--tt-primary);
  background: var(--tt-msg-bg);
}

/* ── Misc ─────────────────────────────────────── */
.tt-powered {
  text-align: center;
  padding: 6px;
  font-size: 10.5px;
  color: var(--tt-muted);
  opacity: 0.5;
}

@media (max-width: 400px) {
  .tt-bubble { max-width: 90%; }
  .tt-slotGrid { grid-template-columns: 1fr; }
}
      `}</style>

      <div className="tt-header">
          <div className="tt-brand">
            <div className="tt-avatar">
              {branding.logo_url
                ? <img src={branding.logo_url} alt={title} />
                : initials}
            </div>
            <div className="tt-titleWrap">
              <div className="tt-title">{title}</div>
            </div>
          </div>
          <div className="tt-badge">
            <div className={`tt-dot${status.startsWith("auth_error") || status.startsWith("boot_error") ? " tt-dot--error" : ""}`} />
            {statusLabel}
          </div>
        </div>

        <div ref={boxRef} className="tt-chat">
          {messages.map((m, idx) => (
            m.role === "assistant" && m.text === "" ? (
              <div key={idx} className="tt-row tt-row--assistant">
                <div className="tt-bubble tt-bubble--assistant">
                  <div className="tt-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            ) : (
            <div key={idx} className={`tt-row tt-row--${m.role}`}>
              <div className={`tt-bubble tt-bubble--${m.role}`}>
                {(
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
          )))}
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

          <button className="tt-btn" onClick={send} disabled={!canSend} aria-label="Send">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

      {bookingMode && (
        <div className="tt-slots">
          <div className="tt-slotsHeader">
            {lang === "de" ? "Termine" : "Appointments"}
          </div>

          <div className="tt-slotsBody">
          {!selectedSlot ? (
            <>
              <div className="tt-leadPrompt">
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
                <div className="tt-leadPrompt">
                  {lang === "de" ? "Keine freien Termine gefunden." : "No open slots found."}
                </div>
              ) : null}

              <div className="tt-leadActions" style={{ marginTop: 12 }}>
                <button className="tt-leadCancel" onClick={() => setBookingMode(false)}>
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

              <div className="tt-leadBody">
                <input className="tt-input" value={bookingName} onChange={(e) => setBookingName(e.target.value)} placeholder={lang === "de" ? "Name (optional)" : "Name (optional)"} />
                <input className="tt-input" value={bookingEmail} onChange={(e) => setBookingEmail(e.target.value)} placeholder={lang === "de" ? "E-Mail (optional)" : "Email (optional)"} />
                <input className="tt-input" value={bookingPhone} onChange={(e) => setBookingPhone(e.target.value)} placeholder={lang === "de" ? "Telefon (optional)" : "Phone (optional)"} />
              </div>

              <div className="tt-leadActions">
                <button className="tt-leadSubmit" onClick={confirmBooking} disabled={bookingSubmitting}>
                  {bookingSubmitting ? "…" : lang === "de" ? "Termin bestätigen" : "Confirm appointment"}
                </button>

                <button
                  className="tt-leadCancel"
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
            </>
          )}
          </div>
        </div>
      )}

      {leadMode && (
        <div className="tt-lead">
          <div className="tt-leadHeader">{lang === "de" ? "Kontakt" : "Contact"}</div>

          {leadPrompt ? <div className="tt-leadPrompt">{leadPrompt}</div> : null}

          <div className="tt-leadBody">
            <div className="tt-field">
              <label className="tt-label">{lang === "de" ? "Name" : "Name"}</label>
              <input className="tt-input" value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder={lang === "de" ? "Name (optional)" : "Name (optional)"} />
            </div>
            <div className="tt-field">
              <label className="tt-label">{lang === "de" ? "E-Mail" : "Email"}</label>
              <input className="tt-input" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder={lang === "de" ? "E-Mail (optional)" : "Email (optional)"} />
            </div>
            <div className="tt-field">
              <label className="tt-label">{lang === "de" ? "Telefon" : "Phone"}</label>
              <input className="tt-input" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder={lang === "de" ? "Telefon (optional)" : "Phone (optional)"} />
            </div>
            <div className="tt-field">
              <label className="tt-label">{lang === "de" ? "Anliegen" : "Need"}</label>
              <textarea className="tt-textarea" value={leadIntent} onChange={(e) => setLeadIntent(e.target.value)} placeholder={lang === "de" ? "Worum geht es? (optional)" : "What do you need? (optional)"} />
            </div>
            <div className="tt-field">
              <label className="tt-label">{lang === "de" ? "Budget" : "Budget"}</label>
              <input className="tt-input" value={leadBudget} onChange={(e) => setLeadBudget(e.target.value)} placeholder={lang === "de" ? "Budget (optional)" : "Budget (optional)"} />
            </div>
            <div className="tt-field">
              <label className="tt-label">{lang === "de" ? "Zeitrahmen" : "Timeline"}</label>
              <input className="tt-input" value={leadTimeline} onChange={(e) => setLeadTimeline(e.target.value)} placeholder={lang === "de" ? "Zeitrahmen (optional)" : "Timeline (optional)"} />
            </div>
          </div>

          <div className="tt-leadActions">
            <button className="tt-leadSubmit" onClick={submitLead} disabled={leadSubmitting}>
              {leadSubmitting ? (lang === "de" ? "Wird gesendet…" : "Sending…") : (lang === "de" ? "Absenden" : "Submit")}
            </button>
            <button className="tt-leadCancel" onClick={() => setLeadMode(false)}>
              {lang === "de" ? "Abbrechen" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}