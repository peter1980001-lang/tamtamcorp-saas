"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { UI, TabsBar, Button, Badge } from "./_components/ui";
import type { DetailResponse, Tab } from "./_components/types";
import { safeJsonParse } from "./_components/api";

import TabDashboard from "./_components/TabDashboard";
import TabBranding from "./_components/TabBranding";
import TabKnowledge from "./_components/TabKnowledge";
import TabLeads from "./_components/TabLeads";
import TabCalendar from "./_components/TabCalendar";
import TabTeam from "./_components/TabTeam";
import TabBilling from "./_components/TabBilling";
import TabSettings from "./_components/TabSettings";

import TabKeys from "./_components/TabKeys";
import TabLimits from "./_components/TabLimits";
import TabDomains from "./_components/TabDomains";
import TabEmbed from "./_components/TabEmbed";
import TabTestChat from "./_components/TabTestChat";
import TabIntegrations from "./_components/TabIntegrations";

const BASE_TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "branding", label: "Branding" },
  { key: "knowledge", label: "Knowledge" },
  { key: "leads", label: "Leads" },
  { key: "calendar", label: "Calendar" },
  { key: "team", label: "Team" },
  { key: "billing", label: "Billing" },
  { key: "settings", label: "Settings" },
{ key: "integrations", label: "Integrations" },
];

// Visible for owner + admins (simple: they can test bot vs knowledge)
const SHARED_TOOL_TABS: { key: Tab; label: string }[] = [
  { key: "test-chat", label: "Test Chat" },
];

// Owner-only management tabs
const OWNER_TABS: { key: Tab; label: string }[] = [
  { key: "keys", label: "Keys" },
  { key: "limits", label: "Limits" },
  { key: "domains", label: "Domains" },
  { key: "embed", label: "Embed" },
];

const ALL_TABS: Tab[] = [
  "dashboard",
  "branding",
  "knowledge",
  "leads",
  "calendar",
  "team",
  "billing",
  "settings",
  "keys",
  "limits",
  "domains",
  "embed",
  "test-chat",
"integrations",
];

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const myRole = data?.my_role ?? "admin";
  const isOwner = myRole === "owner";

  const visibleTabs = useMemo(() => {
    // Insert test-chat next to Leads (so admins can always find it)
    const idx = BASE_TABS.findIndex((t) => t.key === "leads");
    const basePlusTest = [...BASE_TABS.slice(0, idx), ...SHARED_TOOL_TABS, ...BASE_TABS.slice(idx)];

    if (!isOwner) return basePlusTest;

    // Owner management tools placed before Leads (after test-chat)
    return [...BASE_TABS.slice(0, idx), ...SHARED_TOOL_TABS, ...OWNER_TABS, ...BASE_TABS.slice(idx)];
  }, [isOwner]);

  const allowedTabsSet = useMemo(() => new Set(visibleTabs.map((t) => t.key)), [visibleTabs]);

  useEffect(() => {
    if (!id) return;
    const raw = String(searchParams?.get("tab") || "dashboard").toLowerCase();
    const candidate: Tab = (ALL_TABS as unknown as string[]).includes(raw) ? (raw as Tab) : "dashboard";

    const firstAllowed = (visibleTabs[0]?.key || "dashboard") as Tab;
    setTab(allowedTabsSet.has(candidate) ? candidate : firstAllowed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams, allowedTabsSet, visibleTabs]);

  function setTabAndUrl(next: Tab) {
    const firstAllowed = (visibleTabs[0]?.key || "dashboard") as Tab;
    const safeNext = allowedTabsSet.has(next) ? next : firstAllowed;

    setTab(safeNext);

    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (safeNext === "dashboard") url.searchParams.delete("tab");
    else url.searchParams.set("tab", safeNext);
    window.history.replaceState({}, "", url.toString());
  }

  async function load() {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/companies/${id}`, { cache: "no-store" });
      const text = await res.text();
      const json = safeJsonParse(text);

      if (!res.ok) {
        setData(null);
        setLoadError(`HTTP ${res.status}: ${json?.error || json?.raw || "company_load_failed"}`);
        return;
      }
      setData(json as DetailResponse);
    } catch (e: any) {
      setData(null);
      setLoadError(e?.message || "network_error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const companyName = useMemo(() => {
    const b = (data?.settings?.branding_json || {}) as any;
    const fromBranding = String(b?.company_name || "").trim();
    return fromBranding || String(data?.company?.name || "").trim() || "Company";
  }, [data?.settings?.branding_json, data?.company?.name]);

  const logoUrl = useMemo(() => {
    const b = (data?.settings?.branding_json || {}) as any;
    return String(b?.logo_url || b?.logoUrl || "").trim();
  }, [data?.settings?.branding_json]);

  const statusBadge = useMemo(() => {
    const s = String(data?.company?.status || "").toLowerCase();
    if (s === "active") return <Badge text="Active" tone="success" />;
    if (s) return <Badge text={s} tone="neutral" />;
    return <Badge text="—" tone="neutral" />;
  }, [data?.company?.status]);

  function goBack() {
    window.location.href = "/admin/companies";
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <div style={{ background: UI.bg, minHeight: "100vh", padding: "18px 14px 60px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 14 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                border: `1px solid ${UI.border}`,
                background: "#fff",
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontWeight: 1000, color: UI.text2 }}>{companyName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 1100, fontSize: 18, color: UI.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 520 }}>
                  {companyName}
                </div>
                {statusBadge}
              </div>
              <div style={{ marginTop: 4, fontSize: 12.5, color: UI.text2 }}>
                {myRole === "owner" ? "Owner access" : myRole === "admin" ? "Admin access" : "Viewer access"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {isOwner ? (
              <Button onClick={goBack} variant="secondary">
                Back
              </Button>
            ) : null}

            <Button onClick={load} variant="secondary">
              Refresh
            </Button>

            <Button onClick={logout} variant="secondary">
              Logout
            </Button>
          </div>
        </div>

        <TabsBar tabs={visibleTabs} active={tab} onChange={setTabAndUrl} />

        {loadError ? (
          <div style={{ background: "#fff", border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, boxShadow: UI.shadow, padding: 16 }}>
            <div style={{ fontWeight: 1000, marginBottom: 6 }}>Load failed</div>
            <div style={{ color: "#B91C1C", fontSize: 13.5, lineHeight: 1.5 }}>{loadError}</div>
          </div>
        ) : null}

        {loading || !data ? (
          <div style={{ background: "#fff", border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, boxShadow: UI.shadow, padding: 16 }}>
            Loading…
          </div>
        ) : (
          <>
            {tab === "dashboard" && <TabDashboard companyId={id!} data={data} setToast={setToast} />}
            {tab === "branding" && <TabBranding companyId={id!} data={data} setData={setData} setToast={setToast} />}
            {tab === "knowledge" && <TabKnowledge companyId={id!} data={data} setData={setData} isOwner={isOwner} setToast={setToast} />}
            {tab === "leads" && <TabLeads companyId={id!} setToast={setToast} />}
            {tab === "calendar" && <TabCalendar companyId={id!} setToast={setToast} />}
            {tab === "team" && <TabTeam companyId={id!} isOwner={isOwner} setToast={setToast} />}
            {tab === "billing" && <TabBilling companyId={id!} setToast={setToast} />}
            {tab === "settings" && <TabSettings companyId={id!} data={data} isOwner={isOwner} setData={setData} setToast={setToast} />}
{tab === "integrations" && <TabIntegrations companyId={id!} setToast={setToast} />}

            {/* Shared test chat for owner + admins */}
            {tab === "test-chat" && <TabTestChat companyId={id!} data={data} setToast={setToast} />}

            {/* Owner-only management tabs */}
            {isOwner && tab === "keys" && <TabKeys companyId={id!} data={data} reload={load} setToast={setToast} />}
            {isOwner && tab === "limits" && <TabLimits companyId={id!} data={data} reload={load} setToast={setToast} />}
            {isOwner && tab === "domains" && <TabDomains companyId={id!} data={data} reload={load} setToast={setToast} />}
            {isOwner && tab === "embed" && <TabEmbed companyId={id!} data={data} setToast={setToast} />}
          </>
        )}

        {toast && (
          <div
            onClick={() => setToast(null)}
            style={{
              position: "fixed",
              right: 18,
              bottom: 18,
              background: "#fff",
              color: UI.text,
              padding: "12px 14px",
              borderRadius: 16,
              border: `1px solid ${UI.border}`,
              boxShadow: UI.shadow,
              cursor: "pointer",
              fontSize: 13.5,
              maxWidth: 360,
              zIndex: 9999,
            }}
          >
            <div style={{ fontWeight: 1000, marginBottom: 2 }}>Notice</div>
            <div style={{ color: UI.text2 }}>{toast}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: UI.text3 }}>Click to dismiss</div>
          </div>
        )}
      </div>
    </div>
  );
}