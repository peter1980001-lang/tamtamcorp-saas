"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

const UI = {
  surface: "#FFFFFF",
  border: "#E5E7EB",
  shadow: "0 1px 0 rgba(16,24,40,0.03), 0 1px 2px rgba(16,24,40,0.04)",
  text2: "#6B7280",
  accentSoft: "#EEF2FF",
};

const tabs = [
  ["overview", "Overview"],
  ["keys", "Keys"],
  ["domains", "Domains"],
  ["limits", "Limits"],
  ["admins", "Admins"],
  ["embed", "Embed"],
  ["billing", "Billing"],
  ["test-chat", "Test-Chat"],
  ["knowledge", "Knowledge"],
  ["leads", "Leads"],
] as const;

export default function CompanyTabs() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const sp = useSearchParams();
  const active = (sp.get("tab") || "overview").toLowerCase();

  const base = `/admin/companies/${id}`;

  return (
    <div
      style={{
        marginTop: 18,
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: 6,
        border: `1px solid ${UI.border}`,
        background: UI.surface,
        borderRadius: 16,
        boxShadow: UI.shadow,
      }}
    >
      {tabs.map(([key, label]) => {
        const isActive = active === key || (key === "overview" && (active === "" || active === "overview"));
        const href = key === "overview" ? base : `${base}?tab=${encodeURIComponent(key)}`;

        return (
          <Link
            key={key}
            href={href}
            style={{
              padding: "9px 12px",
              borderRadius: 999,
              border: `1px solid ${isActive ? "#DBEAFE" : "transparent"}`,
              background: isActive ? UI.accentSoft : "transparent",
              color: isActive ? "#1D4ED8" : UI.text2,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: isActive ? 800 : 700,
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
