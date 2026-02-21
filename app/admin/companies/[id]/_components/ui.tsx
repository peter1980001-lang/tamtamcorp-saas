"use client";

import React from "react";
import type { Tab } from "./types";

export const UI = {
  bg: "#F6F7FB",
  surface: "#FFFFFF",
  surface2: "#FBFBFC",
  border: "#E6E8EF",
  borderSoft: "#EEF0F6",
  text: "#0B1220",
  text2: "#4B5563",
  text3: "#9CA3AF",
  accent: "#2563EB",
  accentSoft: "#EEF2FF",
  danger: "#DC2626",
  success: "#16A34A",
  radius: 12,
  radiusLg: 18,
  shadow: "0 1px 0 rgba(16,24,40,0.03), 0 8px 24px rgba(16,24,40,0.06)",
};

export function Badge({ text, tone }: { text: string; tone?: "neutral" | "success" | "danger" | "info" }) {
  const t = tone || "neutral";
  const map: Record<string, React.CSSProperties> = {
    neutral: { background: "#F3F4F6", border: "1px solid #E5E7EB", color: "#374151" },
    success: { background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46" },
    danger: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" },
    info: { background: "#EEF2FF", border: "1px solid #C7D2FE", color: "#1D4ED8" },
  };
  return <span style={{ padding: "6px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 900, ...map[t] }}>{text}</span>;
}

export function Divider() {
  return <div style={{ height: 1, background: UI.borderSoft, margin: "14px 0" }} />;
}

export function Card(props: { title?: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ background: UI.surface, border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, boxShadow: UI.shadow }}>
      {props.title || props.right ? (
        <div style={{ padding: "18px 18px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            {props.title ? <div style={{ fontWeight: 1000, fontSize: 14.5, color: UI.text }}>{props.title}</div> : null}
            {props.subtitle ? <div style={{ marginTop: 6, fontSize: 12.8, color: UI.text2, lineHeight: 1.45 }}>{props.subtitle}</div> : null}
          </div>
          {props.right ? <div style={{ flex: "0 0 auto" }}>{props.right}</div> : null}
        </div>
      ) : null}
      <div style={{ padding: props.title || props.right ? "14px 18px 18px" : 18 }}>{props.children}</div>
    </div>
  );
}

export function Button(props: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "secondary" | "danger" }) {
  const v = props.variant || "secondary";
  const styleMap: Record<string, React.CSSProperties> = {
    primary: { background: UI.accent, border: `1px solid ${UI.accent}`, color: "#fff" },
    secondary: { background: "#fff", border: `1px solid ${UI.border}`, color: UI.text },
    danger: { background: "#fff", border: "1px solid #FECACA", color: UI.danger },
  };
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        padding: "10px 12px",
        borderRadius: UI.radius,
        cursor: props.disabled ? "not-allowed" : "pointer",
        fontSize: 13.5,
        fontWeight: 950,
        opacity: props.disabled ? 0.6 : 1,
        ...styleMap[v],
      }}
    >
      {props.children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "11px 12px",
        borderRadius: UI.radius,
        border: `1px solid ${UI.border}`,
        background: "#fff",
        fontSize: 13.5,
        outline: "none",
        ...(props.style || {}),
      }}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        padding: "11px 12px",
        borderRadius: UI.radius,
        border: `1px solid ${UI.border}`,
        background: "#fff",
        fontSize: 13.5,
        outline: "none",
        lineHeight: 1.5,
        ...(props.style || {}),
      }}
    />
  );
}

export function CodeBox({ text }: { text: string }) {
  return (
    <pre
      style={{
        margin: 0,
        whiteSpace: "pre-wrap",
        fontSize: 12.5,
        background: UI.surface2,
        border: `1px solid ${UI.borderSoft}`,
        padding: 12,
        borderRadius: UI.radius,
        color: UI.text,
        lineHeight: 1.5,
      }}
    >
      {text}
    </pre>
  );
}

export function Modal(props: { title: string; children: React.ReactNode; onClose: () => void; right?: React.ReactNode }) {
  return (
    <div onClick={props.onClose} style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.35)", display: "grid", placeItems: "center", padding: 18, zIndex: 1000 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(980px, 100%)", background: "#fff", border: `1px solid ${UI.border}`, borderRadius: 18, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}
      >
        <div style={{ padding: 16, borderBottom: `1px solid ${UI.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 1000 }}>{props.title}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {props.right}
            <Button onClick={props.onClose} variant="secondary">
              Close
            </Button>
          </div>
        </div>
        <div style={{ padding: 16 }}>{props.children}</div>
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
    <div style={{ position: "sticky", top: 0, zIndex: 20, paddingTop: 10, background: `linear-gradient(to bottom, ${UI.bg} 0%, rgba(246,247,251,0.85) 60%, rgba(246,247,251,0) 100%)` }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8, border: `1px solid ${UI.border}`, background: UI.surface, borderRadius: UI.radiusLg, boxShadow: UI.shadow }}>
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              title={t.hint || ""}
              style={{
                padding: "10px 12px",
                borderRadius: 999,
                border: `1px solid ${isActive ? "#C7D2FE" : "transparent"}`,
                background: isActive ? UI.accentSoft : "transparent",
                color: isActive ? "#1D4ED8" : UI.text2,
                fontSize: 13,
                fontWeight: isActive ? 1000 : 850,
                cursor: "pointer",
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