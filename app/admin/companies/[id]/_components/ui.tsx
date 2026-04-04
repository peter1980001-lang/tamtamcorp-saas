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
