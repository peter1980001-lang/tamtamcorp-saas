// app/admin/companies/[id]/layout.tsx

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const UI = {
  bg: "#F6F7F9",
  surface: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  text2: "#6B7280",
  text3: "#9CA3AF",
  accent: "#3B82F6",
  accentSoft: "#EEF2FF",
  radius: 12,
  radiusLg: 16,
  shadow: "0 1px 0 rgba(16,24,40,0.03), 0 1px 2px rgba(16,24,40,0.04)",
  font: 'system-ui, -apple-system, Segoe UI, Roboto, Inter, "Helvetica Neue", Arial',
};

function tabLabel(seg: string) {
  switch (seg) {
    case "":
      return "Overview";
    case "keys":
      return "API Keys";
    case "billing":
      return "Billing";
    case "conversations":
      return "Conversations";
    case "leads":
      return "Leads";
    default:
      return seg;
  }
}

export default function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const router = useRouter();
  const { id } = params;

  const [companyName, setCompanyName] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompany() {
      const res = await fetch(`/api/admin/companies/${id}`);
      const json = await res.json().catch(() => null);
      if (res.ok && json?.company) {
        setCompanyName(json.company.name);
        setStatus(json.company.status);
        setCreatedAt(json.company.created_at);
      }
    }
    loadCompany();
  }, [id]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const base = `/admin/companies/${id}`;
  const tabs = ["", "keys", "billing", "conversations", "leads"] as const;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: UI.bg,
        fontFamily: UI.font,
        color: UI.text,
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 22px 64px" }}>
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: UI.text3, fontWeight: 650 }}>
              Admin / Companies / <span style={{ color: UI.text2 }}>{companyName || id}</span>
            </div>

            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
              <h1 style={{ fontSize: 28, margin: 0 }}>
                {companyName || "Company"}
              </h1>

              {status && (
                <span
                  style={{
                    display: "inline-flex",
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: "#F9FAFB",
                    border: `1px solid ${UI.border}`,
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "capitalize",
                    color: UI.text2,
                  }}
                >
                  {status}
                </span>
              )}
            </div>

            {createdAt && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: UI.text2 }}>
                Created: {new Date(createdAt).toLocaleString()}
              </div>
            )}
          </div>

          {/* RIGHT ACTIONS */}
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              href="/admin/companies"
              style={{
                padding: "10px 12px",
                borderRadius: UI.radius,
                border: `1px solid ${UI.border}`,
                background: "#fff",
                fontSize: 13.5,
                fontWeight: 600,
                color: UI.text,
                textDecoration: "none",
              }}
            >
              Back
            </Link>

            <button
              onClick={handleLogout}
              style={{
                padding: "10px 12px",
                borderRadius: UI.radius,
                border: `1px solid ${UI.border}`,
                background: "#fff",
                fontSize: 13.5,
                fontWeight: 600,
                color: UI.text,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 8,
            padding: 6,
            border: `1px solid ${UI.border}`,
            background: UI.surface,
            borderRadius: UI.radiusLg,
            boxShadow: UI.shadow,
            flexWrap: "wrap",
          }}
        >
          {tabs.map((seg) => {
            const href = seg ? `${base}/${seg}` : base;
            return (
              <Link
                key={seg || "overview"}
                href={href}
                style={{
                  padding: "9px 14px",
                  borderRadius: 999,
                  background: "#fff",
                  border: `1px solid ${UI.border}`,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  color: UI.text2,
                }}
              >
                {tabLabel(seg)}
              </Link>
            );
          })}
        </div>

        {/* PAGE CONTENT */}
        <div style={{ marginTop: 24 }}>{children}</div>
      </div>
    </div>
  );
}
