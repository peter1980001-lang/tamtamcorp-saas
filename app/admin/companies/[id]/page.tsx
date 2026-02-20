"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import BillingActions from "./_components/BillingActions";

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

const ALL_TABS = ["overview", "keys", "domains", "limits", "admins", "embed", "billing", "test-chat", "knowledge", "leads"] as const;
type Tab = (typeof ALL_TABS)[number];

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

function normalizeHost(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
}
function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}
function safeJsonStringify(v: any) {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "{}";
  }
}
function normalizeUrlInput(raw: string) {
  const t = String(raw || "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return "https://" + t.replace(/^\/+/, "");
}

function Card(props: { title?: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ background: UI.surface, border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, boxShadow: UI.shadow }}>
      {props.title || props.right ? (
        <div style={{ padding: "18px 18px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            {props.title ? <div style={{ fontWeight: 900, fontSize: 14, color: UI.text }}>{props.title}</div> : null}
            {props.subtitle ? <div style={{ marginTop: 4, fontSize: 12.5, color: UI.text2, lineHeight: 1.45 }}>{props.subtitle}</div> : null}
          </div>
          {props.right ? <div style={{ flex: "0 0 auto" }}>{props.right}</div> : null}
        </div>
      ) : null}
      <div style={{ padding: props.title || props.right ? "14px 18px 18px" : 18 }}>{props.children}</div>
    </div>
  );
}

function Button(props: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "secondary" | "danger" }) {
  const v = props.variant || "secondary";
  const styleMap: Record<string, React.CSSProperties> = {
    primary: { background: UI.accent, border: `1px solid ${UI.accent}`, color: "#fff" },
    secondary: { background: "#fff", border: `1px solid ${UI.border}`, color: UI.text },
    danger: { background: "#fff", border: "1px solid #FECACA", color: UI.danger },
  };
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        padding: "10px 12px",
        borderRadius: UI.radius,
        cursor: props.disabled ? "not-allowed" : "pointer",
        fontSize: 13.5,
        fontWeight: 900,
        opacity: props.disabled ? 0.6 : 1,
        ...styleMap[v],
      }}
    >
      {props.children}
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
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

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
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

function CodeBox({ text }: { text: string }) {
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

function TabsBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: Tab; label: string }[];
  active: Tab;
  onSelect: (t: Tab) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: 6,
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
            onClick={() => onSelect(t.key)}
            style={{
              padding: "9px 12px",
              borderRadius: 999,
              border: `1px solid ${isActive ? "#DBEAFE" : "transparent"}`,
              background: isActive ? UI.accentSoft : "transparent",
              color: isActive ? "#1D4ED8" : UI.text2,
              fontSize: 13,
              fontWeight: isActive ? 900 : 800,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [rotating, setRotating] = useState(false);

  // Domains
  const [domainInput, setDomainInput] = useState("");
  const [domainDraft, setDomainDraft] = useState<string[]>([]);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainDirty, setDomainDirty] = useState(false);

  // Limits (owner only)
  const [limitsText, setLimitsText] = useState<string>("{}");
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [limitsDirty, setLimitsDirty] = useState(false);

  // Admins/Invites
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminMutating, setAdminMutating] = useState<string | null>(null);

  const [inviteRole, setInviteRole] = useState("admin");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDays, setInviteDays] = useState(7);
  const [inviteCreating, setInviteCreating] = useState(false);

  // Billing
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  // Test Chat
  const [testToken, setTestToken] = useState<string | null>(null);
  const [testConversationId, setTestConversationId] = useState<string | null>(null);
  const [testInput, setTestInput] = useState("Hello Nova");
  const [testLog, setTestLog] = useState<{ role: string; text: string }[]>([]);
  const [testSending, setTestSending] = useState(false);

  // Knowledge
  const [kbTitle, setKbTitle] = useState("Manual Admin Entry");
  const [kbText, setKbText] = useState("");
  const [kbIngesting, setKbIngesting] = useState(false);

  // Website Import
  const [importUrl, setImportUrl] = useState("");
  const [importMaxPages, setImportMaxPages] = useState(5);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Leads
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadBand, setLeadBand] = useState<"all" | "cold" | "warm" | "hot">("all");

  const basePath = useMemo(() => `/admin/companies/${id || ""}`, [id]);

  const [cachedRole, setCachedRole] = useState<DetailResponse["my_role"]>(() => {
    if (typeof window === "undefined") return undefined;
    const v = window.sessionStorage.getItem(`role:${id || ""}`) as any;
    return v === "owner" || v === "admin" || v === "viewer" ? v : undefined;
  });

  const myRole = (data?.my_role ?? cachedRole) as DetailResponse["my_role"];
  const isOwner = myRole === "owner";

  const visibleTabs = useMemo(() => {
    const owner = isOwner === true;
    return [
      { key: "overview" as Tab, label: "Overview" },
      { key: "keys" as Tab, label: "Keys" },
      { key: "domains" as Tab, label: "Domains" },
      ...(owner ? [{ key: "limits" as Tab, label: "Limits" }] : []),
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
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `<script src="${origin}/widget-loader.js" data-public-key="${pk}"></script>`;
  }, [data?.keys?.public_key]);

  async function load() {
    if (!id) return;
    setLoading(true);
    setLoadError(null);

    try {
      const res = await fetch(`/api/admin/companies/${id}`, { cache: "no-store" });
      const text = await res.text();
      const json = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { raw: text };
        }
      })();

      if (!res.ok) {
        setData(null);
        setAdmins([]);
        setLoadError(`HTTP ${res.status}: ${json?.error || json?.raw || "company_load_failed"}`);
        return;
      }

      setData(json);
      setAdmins(json?.admins ?? []);

      const role = json?.my_role;
      if (role === "owner" || role === "admin" || role === "viewer") {
        setCachedRole(role);
        if (typeof window !== "undefined") window.sessionStorage.setItem(`role:${id}`, role);
      }
    } catch (e: any) {
      setData(null);
      setAdmins([]);
      setLoadError(e?.message || "network_error");
    } finally {
      setLoading(false);
    }
  }

  async function loadBilling() {
    if (!id) return;
    setBillingLoading(true);
    const res = await fetch(`/api/admin/companies/${id}/billing`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setBillingLoading(false);
    if (!res.ok) return setToast(json?.error || "billing_load_failed");
    setBillingInfo(json);
  }

  async function loadInvites() {
    if (!id) return;
    setAdminsLoading(true);
    const res = await fetch(`/api/admin/companies/${id}/invites`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setAdminsLoading(false);
    if (!res.ok) return setToast(json?.error || "invites_load_failed");
    setAdmins(json.admins ?? []);
    setInvites(json.invites ?? []);
  }

  async function loadLeads() {
    if (!id) return;
    setLeadsLoading(true);
    const res = await fetch(`/api/admin/companies/${id}/leads`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setLeadsLoading(false);
    if (!res.ok) return setToast(json?.error || "leads_failed");
    setLeads(json.leads ?? []);
  }

  useEffect(() => {
    if (!id) return;

    const t = String(searchParams?.get("tab") || "overview").toLowerCase();
    const next = (ALL_TABS as readonly string[]).includes(t) ? (t as Tab) : "overview";
    const guarded = next === "limits" && myRole && myRole !== "owner" ? "overview" : next;
    setTab(guarded);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams]);

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (tab === "billing") loadBilling();
    if (tab === "admins") loadInvites();
    if (tab === "leads") loadLeads();

    if (tab === "domains") {
      const current = data?.keys?.allowed_domains ?? [];
      setDomainDraft(current);
      setDomainInput("");
      setDomainDirty(false);
    }

    if (tab === "limits") {
      const current = data?.settings?.limits_json ?? {};
      setLimitsText(safeJsonStringify(current));
      setLimitsDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function goTab(t: Tab) {
    const guarded = t === "limits" && myRole && myRole !== "owner" ? "overview" : t;
    setTab(guarded);
    const url = guarded === "overview" ? basePath : `${basePath}?tab=${encodeURIComponent(guarded)}`;
    router.replace(url, { scroll: false });
  }

  async function copy(text: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setToast("Copied");
  }

  async function rotateKeys() {
    if (!id) return;
    setRotating(true);
    const res = await fetch(`/api/admin/companies/${id}/rotate-keys`, { method: "POST" });
    const json = await res.json().catch(() => null);
    setRotating(false);
    if (!res.ok) return setToast(json?.error || "rotate_failed");
    setToast("Keys rotated");
    await load();
  }

  function addDomainFromInput() {
    const normalized = normalizeHost(domainInput || "");
    if (!normalized) return setToast("Enter a domain");
    if (/\s/.test(normalized) || normalized.includes("/") || normalized.includes("http")) return setToast("Invalid domain");
    setDomainDraft((prev) => uniq([...prev, normalized]));
    setDomainInput("");
    setDomainDirty(true);
  }

  function removeDomain(d: string) {
    setDomainDraft((prev) => prev.filter((x) => x !== d));
    setDomainDirty(true);
  }

  async function saveDomains() {
    if (!id) return;
    setDomainSaving(true);
    const payload = { allowed_domains: uniq(domainDraft.map((x) => normalizeHost(x)).filter(Boolean)) };

    const res = await fetch(`/api/admin/companies/${id}/domains`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    setDomainSaving(false);
    if (!res.ok) return setToast(json?.error || "domains_save_failed");

    const updatedKeys: Keys | null = json?.keys ?? null;
    if (updatedKeys) setData((prev) => (prev ? { ...prev, keys: updatedKeys } : prev));

    setDomainDirty(false);
    setToast("Domains saved");
  }

  async function saveLimits() {
    if (!id) return;
    if (!isOwner) return setToast("Not allowed");

    let parsed: any = null;
    try {
      parsed = JSON.parse(limitsText || "{}");
    } catch {
      return setToast("Limits JSON invalid");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return setToast("Limits must be a JSON object");

    setLimitsSaving(true);
    const res = await fetch(`/api/admin/companies/${id}/limits`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limits_text: limitsText }),
    });

    const json = await res.json().catch(() => null);
    setLimitsSaving(false);
    if (!res.ok) return setToast(json?.error || "limits_save_failed");

    const updatedSettings: Settings | null = json?.settings ?? null;
    if (updatedSettings) setData((prev) => (prev ? { ...prev, settings: updatedSettings } : prev));
    setLimitsDirty(false);
    setToast("Limits saved");
  }

  function inviteLink(token: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/invite?token=${encodeURIComponent(token)}`;
  }

  async function createInvite() {
    if (!id) return;
    setInviteCreating(true);

    const allowedInviteRole = isOwner ? inviteRole : inviteRole === "owner" ? "admin" : inviteRole;

    const res = await fetch(`/api/admin/companies/${id}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: allowedInviteRole,
        email: inviteEmail.trim() || null,
        expires_days: inviteDays,
      }),
    });

    const json = await res.json().catch(() => null);
    setInviteCreating(false);
    if (!res.ok) return setToast(json?.error || "invite_create_failed");

    const inv: InviteRow | null = json?.invite ?? null;
    if (inv) {
      setInvites((prev) => [inv, ...prev]);
      await navigator.clipboard.writeText(inviteLink(inv.token));
      setToast("Invite created + link copied");
    } else {
      setToast("Invite created");
    }

    await loadInvites();
    setInviteEmail("");
    setInviteRole("admin");
    setInviteDays(7);
  }

  async function revokeInvite(invite_id: string) {
    if (!id) return;
    const res = await fetch(`/api/admin/companies/${id}/invites?invite_id=${encodeURIComponent(invite_id)}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setToast(json?.error || "invite_revoke_failed");
    setInvites((prev) => prev.map((x) => (x.id === invite_id ? { ...x, status: "revoked" } : x)));
    setToast("Invite revoked");
  }

  async function setAdminRole(user_id: string, role: string) {
    if (!id) return;
    if (!isOwner && role === "owner") return setToast("Not allowed");
    setAdminMutating(user_id);

    const res = await fetch(`/api/admin/companies/${id}/admins`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, role }),
    });

    const json = await res.json().catch(() => null);
    setAdminMutating(null);
    if (!res.ok) return setToast(json?.error || "admin_role_update_failed");

    setToast("Role updated");
    await loadInvites();
  }

  async function removeAdmin(user_id: string) {
    if (!id) return;
    setAdminMutating(user_id);

    const res = await fetch(`/api/admin/companies/${id}/admins?user_id=${encodeURIComponent(user_id)}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    setAdminMutating(null);
    if (!res.ok) return setToast(json?.error || "admin_remove_failed");

    setToast("Admin removed");
    await loadInvites();
  }

  async function testGetToken() {
    const pk = data?.keys?.public_key;
    if (!pk) return setToast("No public key found.");
    const res = await fetch("/api/widget/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: pk }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setToast(json?.error || "token_failed");
    setTestToken(json.token);
    setToast("Token received");
  }

  async function testStartConversation() {
    if (!testToken) return setToast("Missing token → click Get Token");
    const res = await fetch("/api/widget/conversation", { method: "POST", headers: { Authorization: `Bearer ${testToken}` } });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setToast(json?.error || "conversation_failed");
    setTestConversationId(json.conversation.id);
    setTestLog([]);
    setToast("Conversation started");
  }

  async function testSend() {
    if (!testToken) return setToast("Missing token → click Get Token");
    if (!testConversationId) return setToast("Missing conversation → click Start Conversation");
    if (!testInput.trim()) return;

    setTestSending(true);
    setTestLog((l) => [...l, { role: "user", text: testInput }]);

    const res = await fetch("/api/widget/message", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${testToken}` },
      body: JSON.stringify({ conversation_id: testConversationId, message: testInput }),
    });

    const json = await res.json().catch(() => null);
    setTestSending(false);
    if (!res.ok) {
      setToast(json?.error || "chat_failed");
      setTestLog((l) => [...l, { role: "error", text: JSON.stringify(json) }]);
      return;
    }

    setTestLog((l) => [...l, { role: "assistant", text: json.reply || "" }]);
    setTestInput("");
  }

  async function ingestKnowledge() {
    if (!id) return setToast("Missing company id");
    if (!kbText.trim()) return setToast("Paste some text first");

    setKbIngesting(true);
    const res = await fetch("/api/admin/knowledge/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: id, title: kbTitle || "Manual Admin Entry", content: kbText }),
    });

    const json = await res.json().catch(() => null);
    setKbIngesting(false);
    if (!res.ok) return setToast(json?.error || "ingest_failed");

    setToast(`Inserted ${json.chunks ?? json.inserted_chunks ?? "?"} chunks`);
    setKbText("");
  }

  async function importWebsite() {
    if (!id) return setToast("Missing company id");
    const u = normalizeUrlInput(importUrl);
    if (!u) return setToast("Enter a website URL");

    const pages = Number(importMaxPages || 5);
    const max_pages = Math.max(1, Math.min(10, Math.floor(pages)));

    setImporting(true);
    setImportResult(null);

    const res = await fetch(`/api/admin/companies/${id}/import/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: u, max_pages }),
    });

    const json = await res.json().catch(() => null);
    setImporting(false);

    if (!res.ok) {
      setToast(json?.error || "website_import_failed");
      setImportResult(json);
      return;
    }

    setImportResult(json);
    setToast(`Imported: ${json?.chunksInserted ?? 0} chunks`);
  }

  const filteredLeads = useMemo(() => {
    const q = leadQuery.trim().toLowerCase();
    return leads.filter((l) => {
      if (leadBand !== "all" && l.score_band !== leadBand) return false;
      if (!q) return true;
      const hay = [l.name || "", l.email || "", l.phone || "", l.status || "", l.lead_state || "", l.score_band || "", JSON.stringify(l.qualification_json || {})]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leads, leadQuery, leadBand]);

  const billingSummary = useMemo(() => {
    const status = billingInfo?.billing?.status || billingInfo?.status || "—";
    const planName = billingInfo?.plan?.name || billingInfo?.billing?.plan_key || billingInfo?.plan_key || "—";
    const end = billingInfo?.billing?.current_period_end || billingInfo?.current_period_end || null;
    return { status, planName, periodEnd: end ? new Date(end).toLocaleString() : null };
  }, [billingInfo]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {!loading && data ? <TabsBar tabs={visibleTabs} active={tab} onSelect={goTab} /> : null}

      {loadError ? (
        <Card title="Load failed" subtitle="The company detail endpoint returned an error.">
          <div style={{ color: "#B91C1C", fontSize: 13.5, lineHeight: 1.5 }}>{loadError}</div>
        </Card>
      ) : null}

      {loading || !data ? (
        <Card title="Loading" subtitle="Fetching company data…">
          Please wait…
        </Card>
      ) : (
        <>
          {tab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card title="Setup" subtitle="Your widget setup at a glance.">
                <div style={{ fontSize: 13.5, color: UI.text, lineHeight: 1.9 }}>
                  <div>
                    <b>Widget status:</b> Ready
                  </div>
                  <div>
                    <b>Allowed domains:</b> {(data.keys?.allowed_domains ?? []).length}
                  </div>
                  <div>
                    <b>Chat mode:</b> {data.settings?.branding_json?.chat?.mode ?? data.settings?.limits_json?.chat?.mode ?? "hybrid"}
                  </div>
                </div>
              </Card>

              <Card title="Embed Snippet" subtitle="Copy & paste this snippet into your website." right={<Button onClick={() => copy(embedSnippet)}>Copy</Button>}>
                <CodeBox text={embedSnippet} />
              </Card>
            </div>
          )}

          {tab === "keys" && (
            <Card
              title="API Keys"
              subtitle="Public key is used in the embed snippet. Secret key is hidden for customers."
              right={
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button onClick={load} variant="secondary">
                    Refresh
                  </Button>
                  <Button onClick={rotateKeys} disabled={rotating} variant="primary">
                    {rotating ? "Rotating…" : "Rotate Keys"}
                  </Button>
                </div>
              }
            >
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Public Key</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <code style={{ flex: 1, padding: 12, borderRadius: UI.radius, border: `1px solid ${UI.border}`, background: UI.surface2, fontSize: 12.5 }}>
                      {data.keys?.public_key ?? "—"}
                    </code>
                    <Button onClick={() => copy(data.keys?.public_key ?? "")}>Copy</Button>
                  </div>
                </div>

                <div style={{ fontSize: 12.5, color: UI.text2 }}>Secret Key is currently hidden for customers.</div>
              </div>
            </Card>
          )}

          {tab === "domains" && (
            <Card title="Allowed Domains" subtitle="Only these websites can load your widget.">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
                  <Input value={domainInput} onChange={(e) => setDomainInput(e.target.value)} placeholder="example.com" />
                  <Button onClick={addDomainFromInput} variant="secondary">
                    Add
                  </Button>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {domainDraft.map((d) => (
                    <button
                      key={d}
                      onClick={() => removeDomain(d)}
                      style={{
                        border: `1px solid ${UI.border}`,
                        background: UI.surface2,
                        borderRadius: 999,
                        padding: "7px 10px",
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                      title="Click to remove"
                    >
                      {d} ✕
                    </button>
                  ))}
                  {domainDraft.length === 0 ? <div style={{ color: UI.text2, fontSize: 13 }}>No domains yet.</div> : null}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <Button onClick={saveDomains} disabled={!domainDirty || domainSaving} variant="primary">
                    {domainSaving ? "Saving…" : "Save domains"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {tab === "limits" &&
            (!isOwner ? (
              <Card title="Not available" subtitle="This section is only available for the owner.">
                —
              </Card>
            ) : (
              <Card title="Limits" subtitle="Owner-only limits config.">
                <div style={{ display: "grid", gap: 12 }}>
                  <Textarea
                    value={limitsText}
                    onChange={(e) => {
                      setLimitsText(e.target.value);
                      setLimitsDirty(true);
                    }}
                    style={{ minHeight: 260, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5 }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <Button onClick={saveLimits} disabled={!limitsDirty || limitsSaving} variant="primary">
                      {limitsSaving ? "Saving…" : "Save limits"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

          {tab === "admins" && (
            <div style={{ display: "grid", gap: 14 }}>
              <Card title="Team Members" subtitle="Manage admins and viewers." right={<Button onClick={loadInvites} disabled={adminsLoading}>Refresh</Button>}>
                {adminsLoading ? (
                  <div style={{ color: UI.text2 }}>Loading…</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {admins.map((a) => (
                      <div
                        key={a.user_id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 160px 120px",
                          gap: 10,
                          alignItems: "center",
                          border: `1px solid ${UI.border}`,
                          borderRadius: UI.radius,
                          padding: 12,
                          background: "#fff",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900 }}>{a.email || a.user_id}</div>
                          <div style={{ fontSize: 12.5, color: UI.text2 }}>Role: {a.role}</div>
                        </div>

                        <select
                          value={a.role}
                          onChange={(e) => setAdminRole(a.user_id, e.target.value)}
                          disabled={adminMutating === a.user_id}
                          style={{ padding: "10px 12px", borderRadius: UI.radius, border: `1px solid ${UI.border}`, background: "#fff", fontSize: 13.5 }}
                        >
                          <option value="admin">admin</option>
                          <option value="viewer">viewer</option>
                          {isOwner ? <option value="owner">owner</option> : null}
                        </select>

                        <Button onClick={() => removeAdmin(a.user_id)} disabled={adminMutating === a.user_id} variant="danger">
                          Remove
                        </Button>
                      </div>
                    ))}
                    {admins.length === 0 ? <div style={{ color: UI.text2 }}>No team members found.</div> : null}
                  </div>
                )}
              </Card>

              <Card title="Invite" subtitle="Invite a new team member by link (copied automatically).">
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 140px 140px", gap: 10 }}>
                    <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email (optional)" />
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ padding: "11px 12px", borderRadius: UI.radius, border: `1px solid ${UI.border}`, background: "#fff" }}>
                      <option value="admin">admin</option>
                      <option value="viewer">viewer</option>
                      {isOwner ? <option value="owner">owner</option> : null}
                    </select>
                    <Input type="number" min={1} max={30} value={inviteDays} onChange={(e) => setInviteDays(Number(e.target.value || 7))} />
                    <Button onClick={createInvite} disabled={inviteCreating} variant="primary">
                      {inviteCreating ? "Creating…" : "Create Invite"}
                    </Button>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {invites.map((inv) => (
                      <div
                        key={inv.id}
                        style={{
                          border: `1px solid ${UI.border}`,
                          borderRadius: UI.radius,
                          padding: 12,
                          background: "#fff",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900 }}>{inv.email || "(no email)"}</div>
                          <div style={{ fontSize: 12.5, color: UI.text2 }}>
                            Role: {inv.role} · Status: {inv.status} · Expires: {new Date(inv.expires_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <Button onClick={() => copy(inviteLink(inv.token))}>Copy link</Button>
                          <Button onClick={() => revokeInvite(inv.id)} variant="danger" disabled={inv.status === "revoked"}>
                            Revoke
                          </Button>
                        </div>
                      </div>
                    ))}
                    {invites.length === 0 ? <div style={{ color: UI.text2 }}>No invites.</div> : null}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {tab === "embed" && (
            <Card title="Embed" subtitle="Copy & paste this snippet into your website." right={<Button onClick={() => copy(embedSnippet)}>Copy</Button>}>
              <CodeBox text={embedSnippet} />
            </Card>
          )}

          {tab === "billing" && (
            <Card title="Billing" subtitle="Manage your plan and subscription." right={<Button onClick={loadBilling} disabled={billingLoading}>Refresh</Button>}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radius, padding: 12, background: "#fff" }}>
                    <div style={{ fontSize: 12.5, color: UI.text2 }}>Status</div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>{billingSummary.status}</div>
                  </div>

                  <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radius, padding: 12, background: "#fff" }}>
                    <div style={{ fontSize: 12.5, color: UI.text2 }}>Plan</div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>{billingSummary.planName}</div>
                  </div>

                  <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radius, padding: 12, background: "#fff" }}>
                    <div style={{ fontSize: 12.5, color: UI.text2 }}>Renews</div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>{billingSummary.periodEnd || "—"}</div>
                  </div>
                </div>

                <div style={{ marginTop: 4 }}>
                  <BillingActions companyId={id as string} />
                </div>
              </div>
            </Card>
          )}

          {tab === "test-chat" && (
            <Card title="Test Chat" subtitle="Test the widget auth + conversation + message flow.">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <Button onClick={testGetToken} variant="secondary">
                  Get Token
                </Button>
                <Button onClick={testStartConversation} variant="secondary">
                  Start Conversation
                </Button>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10 }}>
                  <Input value={testInput} onChange={(e) => setTestInput(e.target.value)} placeholder="Type a message…" />
                  <Button onClick={testSend} disabled={testSending} variant="primary">
                    {testSending ? "Sending…" : "Send"}
                  </Button>
                </div>

                <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radius, padding: 12, background: UI.surface2, minHeight: 220 }}>
                  {testLog.length === 0 ? (
                    <div style={{ color: UI.text2, fontSize: 13.5 }}>No messages yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {testLog.map((m, idx) => (
                        <div key={idx} style={{ fontSize: 13.5 }}>
                          <b style={{ color: m.role === "assistant" ? "#1D4ED8" : m.role === "error" ? UI.danger : UI.text }}>{m.role}:</b>{" "}
                          <span style={{ color: UI.text }}>{m.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {tab === "knowledge" && (
            <div style={{ display: "grid", gap: 14 }}>
              <Card title="Website Import" subtitle="Import website content into knowledge base.">
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10 }}>
                    <Input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://example.com" />
                    <Input type="number" min={1} max={10} value={importMaxPages} onChange={(e) => setImportMaxPages(Number(e.target.value || 5))} />
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button onClick={importWebsite} disabled={importing} variant="primary">
                      {importing ? "Importing…" : "Import Website"}
                    </Button>
                    <Button
                      onClick={() => {
                        setImportResult(null);
                        setImportUrl("");
                        setImportMaxPages(5);
                      }}
                      variant="secondary"
                    >
                      Reset
                    </Button>
                  </div>

                  {importResult ? <CodeBox text={safeJsonStringify(importResult)} /> : null}
                </div>
              </Card>

              <Card title="Manual Knowledge Ingest" subtitle="Paste text to ingest into knowledge base.">
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Title</div>
                    <Input value={kbTitle} onChange={(e) => setKbTitle(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Content</div>
                    <Textarea value={kbText} onChange={(e) => setKbText(e.target.value)} style={{ minHeight: 220 }} />
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button onClick={ingestKnowledge} disabled={kbIngesting} variant="primary">
                      {kbIngesting ? "Embedding…" : "Add to Knowledge Base"}
                    </Button>
                    <Button onClick={() => setKbText("")} variant="secondary">
                      Clear
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {tab === "leads" && (
            <Card title="Leads" subtitle="Search and filter leads for this company.">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 140px", gap: 10 }}>
                  <Input value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Search name, email, phone, tags…" />
                  <select value={leadBand} onChange={(e) => setLeadBand(e.target.value as any)} style={{ padding: "11px 12px", borderRadius: UI.radius, border: `1px solid ${UI.border}`, background: "#fff" }}>
                    <option value="all">all</option>
                    <option value="cold">cold</option>
                    <option value="warm">warm</option>
                    <option value="hot">hot</option>
                  </select>
                  <Button onClick={loadLeads} disabled={leadsLoading} variant="secondary">
                    {leadsLoading ? "Loading…" : "Refresh"}
                  </Button>
                </div>

                <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radius, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", background: UI.surface2, padding: "10px 12px", fontSize: 12.5, color: UI.text2, fontWeight: 900 }}>
                    <div>Lead</div>
                    <div>Band</div>
                    <div>Score</div>
                    <div>Updated</div>
                  </div>

                  {filteredLeads.length === 0 ? (
                    <div style={{ padding: 12, color: UI.text2 }}>No leads.</div>
                  ) : (
                    filteredLeads.map((l) => (
                      <div key={l.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "10px 12px", borderTop: `1px solid ${UI.border}` }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>{l.name || "(unknown)"}</div>
                          <div style={{ fontSize: 12.5, color: UI.text2 }}>{l.email || l.phone || l.id}</div>
                        </div>
                        <div style={{ textTransform: "uppercase", fontSize: 12.5, color: UI.text2 }}>{l.score_band}</div>
                        <div style={{ fontWeight: 900 }}>{l.score_total}</div>
                        <div style={{ fontSize: 12.5, color: UI.text2 }}>{new Date(l.updated_at).toLocaleDateString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          )}
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
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 2 }}>Notice</div>
          <div style={{ color: UI.text2 }}>{toast}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: UI.text3 }}>Click to dismiss</div>
        </div>
      )}
    </div>
  );
}