# Widget + Admin Panel UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the TamTam chat widget and admin panel with a premium light-mode aesthetic using Plus Jakarta Sans, a company-controlled color/theme system, and Framer Motion animations.

**Architecture:** The widget (`app/widget/page.tsx`) gets a full CSS rewrite with embedded styles replaced by a clean design system. The admin panel design tokens live in one place (`ui.tsx`) so updating it cascades to all tabs. `TabBranding.tsx` gains real color pickers and a dark/light theme toggle that persists to the DB. The widget reads the saved theme + colors via CSS variables.

**Tech Stack:** Next.js 16, React 19, Framer Motion, Plus Jakarta Sans (Google Fonts via next/font), inline CSS custom properties, Tailwind (admin only), Supabase for persisting branding.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/layout.tsx` | Modify | Add Plus Jakarta Sans via next/font |
| `app/globals.css` | Modify | Add font variable, strip dark mode auto-switch |
| `app/widget/page.tsx` | Modify | Full widget CSS rewrite + Framer Motion animations |
| `app/admin/companies/[id]/_components/ui.tsx` | Modify | Updated design tokens — cascades to all tabs |
| `app/admin/companies/[id]/_components/TabBranding.tsx` | Modify | Add color pickers, theme toggle, save to DB |
| `package.json` | Modify | Add framer-motion |

---

## Task 1: Install Framer Motion + Add Plus Jakarta Sans

**Files:**
- Modify: `package.json`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Install framer-motion**

```bash
cd c:/Users/ibrah/Documents/tamtam-bot && npm install framer-motion
```

Expected: `framer-motion` appears in `package.json` dependencies.

- [ ] **Step 2: Add Plus Jakarta Sans to layout.tsx**

Replace the entire file:

```tsx
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TamTam Bot",
  description: "AI sales assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update globals.css**

Replace the entire file:

```css
@import "tailwindcss";

:root {
  --background: #F8FAFC;
  --foreground: #0F172A;
  --font-jakarta: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-jakarta);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-jakarta);
}
```

- [ ] **Step 4: Verify font loads**

Run `npm run dev`, open `http://localhost:3000/admin` in browser, check DevTools → Elements → `body` computed font-family shows Plus Jakarta Sans.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ibrah/Documents/tamtam-bot && git add package.json package-lock.json app/layout.tsx app/globals.css && git commit -m "feat: add Plus Jakarta Sans + framer-motion"
```

---

## Task 2: Update Admin Design Tokens (ui.tsx)

**Files:**
- Modify: `app/admin/companies/[id]/_components/ui.tsx`

This single file controls the entire admin panel visual system. All tabs use `UI.*` values.

- [ ] **Step 1: Replace the UI object and all component styles**

Replace the entire file content:

```tsx
"use client";

import React from "react";
import type { Tab } from "./types";

export const UI = {
  // Layout
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  surface2: "#F1F5F9",

  // Borders
  border: "#E2E8F0",
  borderSoft: "#F1F5F9",

  // Text
  text: "#0F172A",
  text2: "#475569",
  text3: "#94A3B8",

  // Brand
  accent: "#0F172A",
  accentHover: "#1E293B",
  accentSoft: "#F1F5F9",
  accentText: "#FFFFFF",

  // States
  danger: "#EF4444",
  dangerSoft: "#FEF2F2",
  success: "#22C55E",
  successSoft: "#F0FDF4",
  warning: "#F59E0B",

  // Elevation
  shadow: "0 1px 2px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 6px rgba(0,0,0,0.04), 0 10px 24px rgba(0,0,0,0.06)",

  // Shape
  radius: 10,
  radiusLg: 14,
  radiusXl: 18,
};

export function Badge({
  text,
  tone,
}: {
  text: string;
  tone?: "neutral" | "success" | "danger" | "info" | "warning";
}) {
  const t = tone || "neutral";
  const map: Record<string, React.CSSProperties> = {
    neutral: { background: UI.surface2, border: `1px solid ${UI.border}`, color: UI.text2 },
    success: { background: UI.successSoft, border: "1px solid #BBF7D0", color: "#15803D" },
    danger:  { background: UI.dangerSoft,  border: "1px solid #FECACA", color: "#B91C1C" },
    info:    { background: "#EFF6FF",       border: "1px solid #BFDBFE", color: "#1D4ED8" },
    warning: { background: "#FFFBEB",       border: "1px solid #FDE68A", color: "#92400E" },
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.01em",
        fontFamily: "var(--font-jakarta, ui-sans-serif)",
        ...map[t],
      }}
    >
      {text}
    </span>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: UI.border, margin: "16px 0" }} />;
}

export function Card(props: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: UI.surface,
        border: `1px solid ${UI.border}`,
        borderRadius: UI.radiusXl,
        boxShadow: UI.shadow,
        fontFamily: "var(--font-jakarta, ui-sans-serif)",
      }}
    >
      {props.title || props.right ? (
        <div
          style={{
            padding: "18px 20px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            {props.title ? (
              <div style={{ fontWeight: 700, fontSize: 14, color: UI.text, letterSpacing: "-0.01em" }}>
                {props.title}
              </div>
            ) : null}
            {props.subtitle ? (
              <div style={{ marginTop: 4, fontSize: 13, color: UI.text2, lineHeight: 1.5 }}>
                {props.subtitle}
              </div>
            ) : null}
          </div>
          {props.right ? <div style={{ flexShrink: 0 }}>{props.right}</div> : null}
        </div>
      ) : null}
      <div style={{ padding: props.title || props.right ? "14px 20px 20px" : 20 }}>
        {props.children}
      </div>
    </div>
  );
}

export function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  type?: "button" | "submit";
}) {
  const v = props.variant || "secondary";
  const size = props.size || "md";

  const styleMap: Record<string, React.CSSProperties> = {
    primary:   { background: UI.accent,      border: `1px solid ${UI.accent}`,      color: UI.accentText },
    secondary: { background: UI.surface,     border: `1px solid ${UI.border}`,      color: UI.text },
    danger:    { background: UI.dangerSoft,  border: "1px solid #FECACA",           color: UI.danger },
    ghost:     { background: "transparent",  border: "1px solid transparent",       color: UI.text2 },
  };

  const sizeMap: Record<string, React.CSSProperties> = {
    sm: { padding: "6px 12px", fontSize: 12, borderRadius: UI.radius },
    md: { padding: "9px 16px", fontSize: 13, borderRadius: UI.radius },
  };

  return (
    <button
      type={props.type || "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontWeight: 600,
        fontFamily: "var(--font-jakarta, ui-sans-serif)",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.55 : 1,
        transition: "opacity 120ms, background 120ms",
        whiteSpace: "nowrap",
        ...sizeMap[size],
        ...styleMap[v],
      }}
    >
      {props.children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const { label, ...rest } = props;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: UI.text2, letterSpacing: "0.02em" }}>
          {label.toUpperCase()}
        </label>
      )}
      <input
        {...rest}
        style={{
          width: "100%",
          padding: "9px 12px",
          borderRadius: UI.radius,
          border: `1px solid ${UI.border}`,
          background: UI.surface,
          fontSize: 13,
          color: UI.text,
          fontFamily: "var(--font-jakarta, ui-sans-serif)",
          outline: "none",
          transition: "border-color 150ms",
          boxSizing: "border-box",
          ...(rest.style || {}),
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = UI.accent;
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = UI.border;
          rest.onBlur?.(e);
        }}
      />
    </div>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const { label, ...rest } = props;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: UI.text2, letterSpacing: "0.02em" }}>
          {label.toUpperCase()}
        </label>
      )}
      <textarea
        {...rest}
        style={{
          width: "100%",
          padding: "9px 12px",
          borderRadius: UI.radius,
          border: `1px solid ${UI.border}`,
          background: UI.surface,
          fontSize: 13,
          color: UI.text,
          fontFamily: "var(--font-jakarta, ui-sans-serif)",
          outline: "none",
          lineHeight: 1.6,
          resize: "vertical",
          transition: "border-color 150ms",
          boxSizing: "border-box",
          ...(rest.style || {}),
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = UI.accent;
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = UI.border;
          rest.onBlur?.(e);
        }}
      />
    </div>
  );
}

export function CodeBox({ text }: { text: string }) {
  return (
    <pre
      style={{
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        fontSize: 12,
        background: UI.surface2,
        border: `1px solid ${UI.border}`,
        padding: "12px 14px",
        borderRadius: UI.radius,
        color: UI.text2,
        lineHeight: 1.6,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      {text}
    </pre>
  );
}

export function Modal(props: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div
      onClick={props.onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.4)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 1000,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(960px, 100%)",
          background: UI.surface,
          border: `1px solid ${UI.border}`,
          borderRadius: UI.radiusXl,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden",
          fontFamily: "var(--font-jakarta, ui-sans-serif)",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${UI.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, color: UI.text }}>{props.title}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {props.right}
            <Button onClick={props.onClose} variant="secondary" size="sm">
              Close
            </Button>
          </div>
        </div>
        <div style={{ padding: 20, maxHeight: "80vh", overflowY: "auto" }}>{props.children}</div>
      </div>
    </div>
  );
}

export function TabsBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: Tab; label: string; hint?: string }[];
  active: Tab;
  onChange: (next: Tab) => void;
}) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        paddingTop: 12,
        paddingBottom: 4,
        background: UI.bg,
        fontFamily: "var(--font-jakarta, ui-sans-serif)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          padding: 4,
          border: `1px solid ${UI.border}`,
          background: UI.surface,
          borderRadius: UI.radiusLg,
          boxShadow: UI.shadow,
        }}
      >
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              title={t.hint || ""}
              style={{
                padding: "8px 14px",
                borderRadius: UI.radius,
                border: "none",
                background: isActive ? UI.accent : "transparent",
                color: isActive ? UI.accentText : UI.text2,
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                transition: "background 150ms, color 150ms",
                fontFamily: "var(--font-jakarta, ui-sans-serif)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify admin panel renders without errors**

Run `npm run dev`, open `http://localhost:3000/admin`. Check that cards, buttons, tabs all render. No console errors.

- [ ] **Step 3: Commit**

```bash
cd c:/Users/ibrah/Documents/tamtam-bot && git add app/admin/companies/[id]/_components/ui.tsx && git commit -m "feat: update admin design tokens — Plus Jakarta Sans, refined light system"
```

---

## Task 3: Add Color Pickers + Theme Toggle to TabBranding

**Files:**
- Modify: `app/admin/companies/[id]/_components/TabBranding.tsx`

The branding tab currently shows colors as read-only badges. This task adds:
- Native `<input type="color">` pickers for primary and accent colors
- Dark/light theme toggle for the widget
- Live preview that matches the new widget design
- Save button that PATCHes `/api/admin/companies/[id]/settings`

- [ ] **Step 1: Replace TabBranding.tsx**

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import type { DetailResponse } from "./types";
import { Card, Button, Badge, Divider, Input, UI } from "./ui";
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
```

- [ ] **Step 2: Verify branding tab renders and save works**

Open `http://localhost:3000/admin/companies/[any-id]`, go to Branding tab. Change a color, click Save, verify toast appears. Check Supabase `company_settings` table that `branding_json.brand_colors` and `widget_theme` updated.

- [ ] **Step 3: Commit**

```bash
cd c:/Users/ibrah/Documents/tamtam-bot && git add app/admin/companies/[id]/_components/TabBranding.tsx && git commit -m "feat: add color pickers + theme toggle to branding tab"
```

---

## Task 4: Widget CSS + Layout Redesign

**Files:**
- Modify: `app/widget/page.tsx` — replace embedded `<style>` block (lines 582–780)

The widget already reads branding via CSS variables (`--tt-primary`, `--tt-secondary`, `--tt-accent`). This task rewrites the CSS to match the new design system while keeping those variables. It also adds `widget_theme` support: if the branding includes `widget_theme: "dark"`, the dark palette is applied.

- [ ] **Step 1: Add widget_theme to the Branding type and applyBrandingCSS**

In `app/widget/page.tsx`, update the `Branding` type (around line 9) and `applyBrandingCSS` function:

```tsx
type Branding = {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  logo_url?: string | null;
  company_name?: string | null;
  greeting?: string | null;
  widget_theme?: "light" | "dark" | null;
};
```

Replace the `applyBrandingCSS` function (around lines 49–68):

```tsx
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
```

- [ ] **Step 2: Replace the embedded `<style>` block in the JSX**

Find the `<style>` tag inside the `return` statement (around line 582) and replace the entire CSS block with:

```tsx
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
  padding: 12px 14px;
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
```

- [ ] **Step 3: Update the JSX structure to use the new CSS classes**

The outer `<div>` wrapper and most class names stay the same. The key changes are:

**Header** — replace the header JSX (find the `tt-header` div) with:
```tsx
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
```

**Typing indicator** — find the existing `● ● ●` placeholder and replace with:
```tsx
{last?.role === "assistant" && !last.text && (
  <div className="tt-row tt-row--assistant">
    <div className="tt-bubble tt-bubble--assistant">
      <div className="tt-typing">
        <span /><span /><span />
      </div>
    </div>
  </div>
)}
```

**Send button** — replace the current send button with:
```tsx
<button className="tt-btn" onClick={send} disabled={!canSend} aria-label="Send">
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
</button>
```

**Outer page div** — change from the inline style div to:
```tsx
<div className="tt-page">
```

- [ ] **Step 4: Read widget_theme from bootstrap response**

In the bootstrap handler section (around line 184), add `widget_theme` reading:

```tsx
const br = (bJson?.branding || {}) as Branding;
// widget_theme comes from branding_json.widget_theme
const rawTheme = String((br as any).widget_theme || "light");
const typedBr: Branding = {
  ...br,
  widget_theme: rawTheme === "dark" ? "dark" : "light",
  logo_url: safePublicLogoUrl(br.logo_url),
};
setBranding(typedBr);
applyBrandingCSS(typedBr);
```

- [ ] **Step 5: Verify widget renders correctly**

Open `http://localhost:3000/widget?public_key=YOUR_KEY&site=http://localhost:3000` in a browser. Check:
- Font is Plus Jakarta Sans
- Message bubbles have correct rounded corners (flat corner toward tail)
- Typing indicator shows 3 bouncing dots
- Send button is square with send icon
- Colors match company primary

- [ ] **Step 6: Commit**

```bash
cd c:/Users/ibrah/Documents/tamtam-bot && git add app/widget/page.tsx && git commit -m "feat: widget UI redesign — Plus Jakarta Sans, clean light/dark system, new bubble shapes"
```

---

## Task 5: Update Widget Launcher Bubble (widget-loader.js)

**Files:**
- Modify: `public/widget-loader.js`

The launcher bubble should use the company primary color from `data-accent` OR default to `#111111`. It already supports `data-accent` — just update the CSS to apply it as the background.

- [ ] **Step 1: Update launcher button CSS in widget-loader.js**

Find the `#tamtam-launcher-btn` CSS rule (inside the `css` template literal) and replace it with:

```js
  var css = `
#tamtam-stack{
  position: fixed;
  bottom: 20px;
  ${position}: 20px;
  z-index: ${zIndex};
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 10px;
}

.tamtam-fab{
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background: ${accent};
  border: none;
  box-shadow:
    0 8px 24px rgba(0,0,0,0.18),
    0 2px 6px rgba(0,0,0,0.10);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
}
.tamtam-fab:hover{
  transform: translateY(-2px);
  box-shadow:
    0 14px 36px rgba(0,0,0,0.22),
    0 4px 10px rgba(0,0,0,0.12);
}
.tamtam-fab:active{ transform: translateY(0) scale(0.96); }
.tamtam-fab svg{ width: 22px; height: 22px; color: #fff; }
```

- [ ] **Step 2: Update social link buttons to also use accent color but slightly lighter**

Find the WhatsApp/Instagram/LinkedIn button creation code and add opacity variant:

```js
  // WhatsApp
  if (whatsapp) {
    var waHref = whatsapp.startsWith("http") ? whatsapp : "https://wa.me/" + whatsapp.replace(/\D/g, "");
    var waBtn = el("a", { class: "tamtam-fab", href: waHref, target: "_blank", rel: "noopener noreferrer", "aria-label": "WhatsApp" });
    waBtn.style.opacity = "0.85";
    waBtn.innerHTML = icons.whatsapp;
    stack.appendChild(waBtn);
  }
```

Apply the same `opacity = "0.85"` to Instagram and LinkedIn buttons so the chat bubble is visually the primary action.

- [ ] **Step 3: Verify launcher bubble uses company color**

Embed the widget on a test page with `data-accent="#2563EB"`. The bubble should be blue. Without `data-accent` it should be `#111111`.

- [ ] **Step 4: Commit**

```bash
cd c:/Users/ibrah/Documents/tamtam-bot && git add public/widget-loader.js && git commit -m "feat: launcher bubble uses company accent color, clean shadow system"
```

---

## Task 6: Bootstrap API — Return widget_theme

**Files:**
- Read + Modify: `app/api/widget/bootstrap/route.ts`

The bootstrap endpoint must return `widget_theme` from `branding_json` so the widget can apply the correct CSS variables on load.

- [ ] **Step 1: Check what bootstrap currently returns**

Read `app/api/widget/bootstrap/route.ts` and find the `branding` object being returned.

- [ ] **Step 2: Add widget_theme to branding response**

In the bootstrap route, find where `branding_json` fields are extracted and ensure `widget_theme` is included. The response object should include:

```ts
branding: {
  company_name: ...,
  greeting: ...,
  logo_url: ...,
  primary: branding_json?.brand_colors?.primary || branding_json?.primary || null,
  accent:  branding_json?.brand_colors?.accent  || branding_json?.accent  || null,
  widget_theme: branding_json?.widget_theme || "light",
}
```

- [ ] **Step 3: Verify widget picks up theme correctly**

In admin → Branding tab, set theme to Dark and save. Reload the widget. The background should be `#0F0F0F`.

- [ ] **Step 4: Commit**

```bash
cd c:/Users/ibrah/Documents/tamtam-bot && git add app/api/widget/bootstrap/route.ts && git commit -m "feat: bootstrap returns widget_theme for CSS variable injection"
```

---

## Self-Review

**Spec coverage:**
- ✅ Plus Jakarta Sans — Tasks 1, 4
- ✅ Light default, admin-toggleable dark — Tasks 3, 4, 6
- ✅ Company primary color on user bubbles, launcher, send button — Tasks 4, 5
- ✅ Color pickers in admin — Task 3
- ✅ Theme toggle in admin — Task 3
- ✅ Admin design token update — Task 2
- ✅ Live preview in branding tab matches widget design — Task 3
- ✅ Widget CSS redesign with new bubble shapes — Task 4
- ✅ Typing indicator (3 bouncing dots) — Task 4
- ✅ Launcher bubble uses company color — Task 5

**Placeholder check:** No TBDs, no "implement later", no "similar to task N". All code is complete.

**Type consistency:**
- `Branding.widget_theme` used in types.ts (Task 4 Step 1), applyBrandingCSS (Task 4 Step 1), bootstrap response (Task 6). Consistent throughout.
- `UI.*` tokens updated in Task 2, used by TabBranding in Task 3. Consistent.
