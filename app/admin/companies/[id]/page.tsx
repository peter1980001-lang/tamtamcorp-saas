"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import BillingActions from "./_components/BillingActions";

/* ===========================
   TYPES
=========================== */

type Company = { id: string; name: string; status: string; created_at: string };

type Keys = {
  company_id: string;
  public_key: string;
  secret_key: string | null;
  allowed_domains: string[];
  created_at: string;
};

type Settings = { company_id: string; limits_json: any; branding_json: any };

type AdminRow = {
  id: string;
  company_id: string;
  user_id: string;
  email?: string | null;
  role: string;
  created_at: string;
};

type InviteRow = {
  id: string;
  company_id: string;
  token: string;
  email: string | null;
  role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  updated_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_by: string | null;
};

type DetailResponse = {
  company: Company;
  keys: Keys | null;
  settings: Settings;
  admins?: AdminRow[];
  my_role?: "owner" | "admin" | "viewer";
};

type LeadRow = {
  id: string;
  company_id: string;
  conversation_id: string;
  channel: string | null;
  source: string | null;
  lead_state: string;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  qualification_json: any;
  consents_json: any;
  intent_score: number;
  score_total: number;
  score_band: "cold" | "warm" | "hot";
  tags: string[];
  last_touch_at: string | null;
  created_at: string;
  updated_at: string;
};

const ALL_TABS = [
  "overview",
  "keys",
  "domains",
  "limits",
  "admins",
  "embed",
  "billing",
  "test-chat",
  "knowledge",
  "leads",
] as const;

type Tab = (typeof ALL_TABS)[number];

/* ===========================
   UI
=========================== */

const UI = {
  surface: "#FFFFFF",
  surface2: "#FBFBFC",
  border: "#E5E7EB",
  borderSoft: "#ECEEF2",
  text: "#111827",
  text2: "#6B7280",
  text3: "#9CA3AF",
  accent: "#3B82F6",
  accentSoft: "#EEF2FF",
  danger: "#DC2626",
  radius: 12,
  radiusLg: 16,
  shadow: "0 1px 0 rgba(16,24,40,0.03), 0 1px 2px rgba(16,24,40,0.04)",
};

/* ===========================
   COMPONENT
=========================== */

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);

  const myRole = data?.my_role ?? null;
  const isOwner = myRole === "owner";

  const visibleTabs = useMemo(() => {
    return [
      { key: "overview" as Tab, label: "Overview" },
      { key: "keys" as Tab, label: "Keys" },
      { key: "domains" as Tab, label: "Domains" },
      ...(isOwner ? [{ key: "limits" as Tab, label: "Limits" }] : []),
      { key: "admins" as Tab, label: "Admins" },
      { key: "embed" as Tab, label: "Embed" },
      { key: "billing" as Tab, label: "Billing" },
      { key: "test-chat" as Tab, label: "Test-Chat" },
      { key: "knowledge" as Tab, label: "Knowledge" },
      { key: "leads" as Tab, label: "Leads" },
    ];
  }, [isOwner]);

  const embedSnippet = useMemo(() => {
    const pk = data?.keys?.public_key || "pk_xxx";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `<script src="${origin}/widget-loader.js" data-public-key="${pk}"></script>`;
  }, [data?.keys?.public_key]);

  async function load() {
    if (!id) return;
    setLoading(true);
    setLoadError(null);

    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setLoadError(json?.error || "company_load_failed");
        setData(null);
        return;
      }

      setData(json);
    } catch (e: any) {
      setLoadError(e?.message || "network_error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadBilling() {
    if (!id) return;
    const res = await fetch(`/api/admin/companies/${id}/billing`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return;
    setBillingInfo(json);
  }

  /* ===========================
     FIXED EFFECT
  =========================== */

  useEffect(() => {
    if (!id) return;

    const t = String(
      searchParams?.get("tab") || "overview"
    ).toLowerCase();

    const next = (ALL_TABS as readonly string[]).includes(t)
      ? (t as Tab)
      : "overview";

    setTab(next);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (tab === "billing") loadBilling();
  }, [tab]);

  /* ===========================
     RENDER
  =========================== */

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {data && (
        <div>
          {visibleTabs.map((t) => (
            <a
              key={t.key}
              href={
                t.key === "overview"
                  ? `/admin/companies/${id}`
                  : `/admin/companies/${id}?tab=${t.key}`
              }
              style={{
                marginRight: 12,
                fontWeight: tab === t.key ? 900 : 600,
              }}
            >
              {t.label}
            </a>
          ))}
        </div>
      )}

      {loading && <div>Loading…</div>}

      {loadError && (
        <div style={{ color: "red" }}>{loadError}</div>
      )}

      {data && tab === "overview" && (
        <div>
          <div>
            <b>Allowed domains:</b>{" "}
            {data.keys?.allowed_domains?.length ?? 0}
          </div>
          <div style={{ marginTop: 16 }}>
            <pre>{embedSnippet}</pre>
          </div>
        </div>
      )}

      {data && tab === "keys" && (
        <div>
          <div>
            <b>Public Key:</b> {data.keys?.public_key}
          </div>
          <div style={{ marginTop: 8 }}>
            Secret Key hidden for customers
          </div>
        </div>
      )}

      {data && tab === "billing" && (
        <div>
          <div>Status: {billingInfo?.status ?? "—"}</div>
          <div>Plan: {billingInfo?.plan_key ?? "—"}</div>
          <BillingActions companyId={id as any} />
        </div>
      )}

      {toast && (
        <div
          onClick={() => setToast(null)}
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            background: "#fff",
            padding: 12,
            border: `1px solid ${UI.border}`,
            cursor: "pointer",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}