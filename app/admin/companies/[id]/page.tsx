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
import TabTeam from "./_components/TabTeam";
import TabBilling from "./_components/TabBilling";
import TabSettings from "./_components/TabSettings";

const OWNER_ONLY_TABS: Tab[] = ["test-chat", "embed", "domains", "keys", "limits"];

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
    const base: { key: Tab; label: string }[] = [
      { key: "dashboard", label: "Dashboard" },
      { key: "branding", label: "Branding" },
      { key: "knowledge", label: "Knowledge" },
      { key: "leads", label: "Leads" },
      { key: "team", label: "Team" },
      { key: "billing", label: "Billing" },
      { key: "settings", label: "Settings" },
    ];

    if (!isOwner) return base;

    const ownerExtras: { key: Tab; label: string }[] = [
      { key: "keys", label: "Keys" },
      { key: "limits", label: "Limits" },
      { key: "domains", label: "Domains" },
      { key: "embed", label: "Embed" },
      { key: "test-chat", label: "Test Chat" },
    ];

    // place owner tools between Knowledge and Leads (nice spot)
    const idx = base.findIndex((t) => t.key === "leads");
    return [...base.slice(0, idx), ...ownerExtras, ...base.slice(idx)];
  }, [isOwner]);

  const allowedTabsSet = useMemo(() => new Set(visibleTabs.map((t) => t.key)), [visibleTabs]);

  // URL -> tab (no “dashboard fallback”; always first visible tab)
  useEffect(() => {
    if (!id) return;

    const raw = String(searchParams?.get("tab") || "").toLowerCase();
    const candidate = (raw || "dashboard") as Tab;

    const firstAllowed = (visibleTabs[0]?.key || "dashboard") as Tab;

    // If admin tries to deep-link an owner tab, it's simply not allowed.
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

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    } finally {
      window.location.href = "/login";
    }
  }

  function goBack() {
    window.location.href = "/admin/companies";
  }

  const ownerToolsCard = (title: string, desc: string) => (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${UI.border}`,
        borderRadius: UI.radiusLg,
        boxShadow: UI.shadow,
        padding: 16,
      }}
    >
      <div style={{ fontWeight: 1100, marginBottom: 6 }}>{title}</div>
      <div style={{ color: UI.text2, fontSize: 13.5, lineHeight: 1.5 }}>{desc}</div>
      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button onClick={() => setToast("Owner tools tab is wired. Plug in the component when ready.")} variant="secondary">
          Ok
        </Button>
      </div>
    </div>
  );

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
                <div
                  style={{
                    fontWeight: 1100,
                    fontSize: 18,
                    color: UI.text,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 520,
                  }}
                >
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
            {/* Back only for owner */}
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
            {tab === "team" && <TabTeam companyId={id!} isOwner={isOwner} setToast={setToast} />}
            {tab === "billing" && <TabBilling companyId={id!} setToast={setToast} />}
            {tab === "settings" && <TabSettings companyId={id!} data={data} isOwner={isOwner} setData={setData} setToast={setToast} />}

            {/* Owner-only tabs - never rendered for admins */}
            {isOwner && tab === "keys" && ownerToolsCard("Keys", "Owner-only: manage API keys & secrets for this company.")}
            {isOwner && tab === "limits" && ownerToolsCard("Limits", "Owner-only: manage plan limits / entitlements for this company.")}
            {isOwner && tab === "domains" && ownerToolsCard("Domains", "Owner-only: manage allowed domains / widget origin allowlist.")}
            {isOwner && tab === "embed" && ownerToolsCard("Embed", "Owner-only: embed code + widget configuration preview.")}
            {isOwner && tab === "test-chat" && ownerToolsCard("Test Chat", "Owner-only: internal chat sandbox to test prompts & knowledge retrieval.")}
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