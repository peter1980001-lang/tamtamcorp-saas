"use client";

import { useMemo, useRef, useState } from "react";
import type { DetailResponse } from "./types";
import { Card, Button, UI } from "./ui";
import { fetchJson } from "./api";

function pick(branding: any, keys: string[]) {
  for (const k of keys) {
    const v = branding?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <input
          type="color"
          value={value || "#111111"}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: `1px solid ${UI.border}`,
            padding: 2,
            cursor: "pointer",
            background: "none",
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: UI.text2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
        <div style={{ fontSize: 13, color: UI.text, fontFamily: "ui-monospace, monospace", marginTop: 2 }}>{value || "#111111"}</div>
      </div>
    </div>
  );
}

function ThemeToggle({ value, onChange }: { value: "light" | "dark"; onChange: (v: "light" | "dark") => void }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: 4, background: UI.surface2, borderRadius: UI.radius, border: `1px solid ${UI.border}` }}>
      {(["light", "dark"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          style={{
            padding: "7px 16px",
            borderRadius: 8,
            border: "none",
            background: value === t ? UI.surface : "transparent",
            color: value === t ? UI.text : UI.text3,
            fontSize: 13,
            fontWeight: value === t ? 600 : 400,
            cursor: "pointer",
            boxShadow: value === t ? UI.shadow : "none",
            transition: "all 150ms",
            fontFamily: "var(--font-jakarta, ui-sans-serif)",
            textTransform: "capitalize",
          }}
        >
          {t === "light" ? "☀ Light" : "◐ Dark"}
        </button>
      ))}
    </div>
  );
}

export default function TabBranding(props: {
  companyId: string;
  data: DetailResponse;
  setData: (updater: any) => void;
  setToast: (s: string) => void;
}) {
  const { companyId, data, setData, setToast } = props;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const branding = useMemo(() => (data?.settings?.branding_json || {}) as any, [data?.settings?.branding_json]);
  const companyName = useMemo(() => pick(branding, ["company_name"]) || String(data?.company?.name || "").trim() || "Company", [branding, data?.company?.name]);
  const greeting = useMemo(() => pick(branding, ["greeting"]), [branding]);
  const logoUrl = useMemo(() => pick(branding, ["logo_url", "logoUrl"]), [branding]);

  const [primary, setPrimary] = useState(pick(branding?.brand_colors, ["primary"]) || pick(branding, ["primary"]) || "#111111");
  const [accent, setAccent] = useState(pick(branding?.brand_colors, ["accent"]) || pick(branding, ["accent"]) || "#111111");
  const [theme, setTheme] = useState<"light" | "dark">((branding?.widget_theme as "light" | "dark") || "light");

  async function uploadLogo(file: File) {
    if (!companyId) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/logo`, { method: "POST", body: fd });
      if (!ok) { setUploadErr(String(json?.error || "upload_failed")); return; }
      const nextLogoUrl = String(json?.logo_url || "");
      setData((prev: DetailResponse | null) => {
        if (!prev) return prev;
        const b = prev.settings?.branding_json || {};
        return { ...prev, settings: { ...prev.settings, branding_json: { ...b, logo_url: nextLogoUrl } } };
      });
      setToast("Logo updated");
    } finally {
      setUploading(false);
    }
  }

  async function saveBranding() {
    if (!companyId) return;
    setSaving(true);
    try {
      const b = { ...(data?.settings?.branding_json || {}), brand_colors: { primary, accent }, widget_theme: theme };
      const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branding_json: b }),
      });
      if (!ok) { setToast(`Error: ${json?.error || "save failed"}`); return; }
      setData((prev: DetailResponse | null) => {
        if (!prev) return prev;
        return { ...prev, settings: { ...prev.settings, branding_json: b } };
      });
      setToast("Branding saved");
    } finally {
      setSaving(false);
    }
  }

  // Live preview colors
  const isDark = theme === "dark";
  const previewBg = isDark ? "#0F0F0F" : "#FFFFFF";
  const previewBubbleBg = isDark ? "#1A1A1A" : "#F4F4F5";
  const previewBubbleText = isDark ? "#FFFFFF" : "#0F172A";
  const previewInputBg = isDark ? "#111111" : "#F8F8F8";
  const previewInputBorder = isDark ? "#2A2A2A" : "#E4E4E7";
  const previewHeaderBorder = isDark ? "#1E1E1E" : "#F0F0F0";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, alignItems: "start" }}>
      {/* Left: Settings */}
      <div style={{ display: "grid", gap: 16 }}>
        <Card title="Logo" subtitle="Shown in the widget header.">
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                border: `1px solid ${UI.border}`,
                background: UI.surface2,
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              {logoUrl
                ? <img src={logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontWeight: 700, color: UI.text2, fontSize: 20 }}>{companyName.slice(0, 1).toUpperCase()}</span>
              }
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.currentTarget.value = ""; }}
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} variant="secondary">
                {uploading ? "Uploading…" : "Upload logo"}
              </Button>
              {uploadErr && <div style={{ fontSize: 12, color: UI.danger }}>{uploadErr}</div>}
              <div style={{ fontSize: 12, color: UI.text3 }}>PNG · JPG · WEBP · SVG · max 2 MB</div>
            </div>
          </div>
        </Card>

        <Card title="Brand Colors" subtitle="Used for the widget launcher, user message bubbles, and send button.">
          <div style={{ display: "grid", gap: 16 }}>
            <ColorPicker label="Primary" value={primary} onChange={setPrimary} />
            <ColorPicker label="Accent" value={accent} onChange={setAccent} />
          </div>
        </Card>

        <Card title="Widget Theme" subtitle="Choose the base appearance of the chat window.">
          <ThemeToggle value={theme} onChange={setTheme} />
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: UI.text2, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Company name</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: UI.text }}>{companyName}</div>
            <div style={{ fontSize: 12, color: UI.text3, marginTop: 4 }}>Edit in Settings tab.</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: UI.text2, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Greeting</div>
            <div style={{ fontSize: 13, color: UI.text }}>{greeting || <span style={{ color: UI.text3 }}>Default greeting</span>}</div>
            <div style={{ fontSize: 12, color: UI.text3, marginTop: 4 }}>Edit in Settings tab.</div>
          </div>
        </div>

        <Button onClick={saveBranding} disabled={saving} variant="primary">
          {saving ? "Saving…" : "Save branding"}
        </Button>
      </div>

      {/* Right: Live Preview */}
      <Card title="Live Preview" subtitle="Updates as you change colors and theme.">
        <div
          style={{
            border: `1px solid ${UI.border}`,
            borderRadius: 18,
            overflow: "hidden",
            background: previewBg,
            transition: "background 300ms",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: `1px solid ${previewHeaderBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              background: previewBg,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: primary,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {logoUrl
                  ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : companyName.slice(0, 2).toUpperCase()
                }
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, color: previewBubbleText, whiteSpace: "nowrap" }}>{companyName}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: 999, background: "#22C55E" }} />
              <span style={{ fontSize: 11, color: previewBubbleText, opacity: 0.6 }}>Online</span>
            </div>
          </div>

          {/* Messages */}
          <div style={{ padding: "14px 14px 10px", display: "grid", gap: 8 }}>
            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "80%",
                background: previewBubbleBg,
                borderRadius: "4px 16px 16px 16px",
                padding: "9px 12px",
                fontSize: 13,
                color: previewBubbleText,
                lineHeight: 1.5,
              }}
            >
              {greeting || `Hi! Welcome to ${companyName}. How can I help?`}
            </div>

            <div
              style={{
                alignSelf: "flex-end",
                maxWidth: "80%",
                background: primary,
                borderRadius: "16px 4px 16px 16px",
                padding: "9px 12px",
                fontSize: 13,
                color: "#fff",
                lineHeight: 1.5,
                marginLeft: "auto",
              }}
            >
              I'm interested, tell me more.
            </div>

            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "80%",
                background: previewBubbleBg,
                borderRadius: "4px 16px 16px 16px",
                padding: "9px 12px",
                fontSize: 13,
                color: previewBubbleText,
                lineHeight: 1.5,
              }}
            >
              Of course! I can arrange a quick call or capture your details.
            </div>
          </div>

          {/* Composer */}
          <div
            style={{
              padding: "10px 14px 14px",
              display: "flex",
              gap: 8,
              alignItems: "center",
              borderTop: `1px solid ${previewHeaderBorder}`,
              background: previewBg,
              marginTop: 4,
            }}
          >
            <div
              style={{
                flex: 1,
                background: previewInputBg,
                border: `1px solid ${previewInputBorder}`,
                borderRadius: 12,
                padding: "9px 12px",
                fontSize: 13,
                color: previewBubbleText,
                opacity: 0.5,
              }}
            >
              Type a message…
            </div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: primary,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Launcher bubble preview */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: primary,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M7 7h10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M10 7v10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M14 7v10" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.85"/>
            </svg>
          </div>
          <div style={{ fontSize: 12, color: UI.text3 }}>Launcher bubble preview</div>
        </div>
      </Card>
    </div>
  );
}
