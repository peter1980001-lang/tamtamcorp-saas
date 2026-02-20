"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
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

type KnowledgeChunkRow = {
  id: string;
  company_id: string;
  title: string;
  content: string;
  source_ref: string | null;
  metadata: any;
  created_at: string;
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
      type="button"
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
  onChange,
}: {
  tabs: { key: Tab; label: string }[];
  active: Tab;
  onChange: (next: Tab) => void;
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
            type="button"
            onClick={() => onChange(t.key)}
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

/** -------------------- Knowledge: manual pages types -------------------- */
type KbPage = { url: string; title: string; text: string; captured_at: string };
type BrandHints = { primary: string | null; accent: string | null; logo_url: string | null };

function Modal(props: { title: string; children: React.ReactNode; onClose: () => void; right?: React.ReactNode }) {
  return (
    <div
      onClick={props.onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.35)",
        display: "grid",
        placeItems: "center",
        padding: 18,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(980px, 100%)",
          background: "#fff",
          border: `1px solid ${UI.border}`,
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 16, borderBottom: `1px solid ${UI.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 900 }}>{props.title}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {props.right}
            <Button onClick={props.onClose} variant="secondary">Close</Button>
          </div>
        </div>
        <div style={{ padding: 16 }}>{props.children}</div>
      </div>
    </div>
  );
}

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
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

  // Knowledge (manual text)
  const [kbTitle, setKbTitle] = useState("Manual Admin Entry");
  const [kbText, setKbText] = useState("");
  const [kbIngesting, setKbIngesting] = useState(false);

  // Knowledge (manual pages -> audit ingest)
  const [kbPages, setKbPages] = useState<KbPage[]>([]);
  const [kbPageUrl, setKbPageUrl] = useState("");
  const [kbPageTitle, setKbPageTitle] = useState("");
  const [kbPageText, setKbPageText] = useState("");
  const [kbAuditRunning, setKbAuditRunning] = useState(false);
  const [kbAuditResult, setKbAuditResult] = useState<any>(null);
  const [kbPersistProfile, setKbPersistProfile] = useState(true);

  // Fetch Page helper
  const [kbFetching, setKbFetching] = useState(false);
  const [kbFetchResult, setKbFetchResult] = useState<any>(null);

  // Brand hints (from fetch-page)
  const [kbBrandHints, setKbBrandHints] = useState<BrandHints | null>(null);

  // Knowledge manager
  const [kbChunks, setKbChunks] = useState<KnowledgeChunkRow[]>([]);
  const [kbChunksLoading, setKbChunksLoading] = useState(false);
  const [kbChunksQuery, setKbChunksQuery] = useState("");
  const [kbChunksLimit, setKbChunksLimit] = useState(80);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<KnowledgeChunkRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Leads
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadBand, setLeadBand] = useState<"all" | "cold" | "warm" | "hot">("all");

  const myRole = data?.my_role ?? "admin";
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

  const allowedTabsSet = useMemo(() => new Set(visibleTabs.map((t) => t.key)), [visibleTabs]);

  // URL -> tab
  useEffect(() => {
    if (!id) return;
    const raw = String(searchParams?.get("tab") || "overview").toLowerCase();
    const candidate = (ALL_TABS as readonly string[]).includes(raw) ? (raw as Tab) : "overview";
    const next = allowedTabsSet.has(candidate) ? candidate : "overview";
    setTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams, allowedTabsSet]);

  // Load company
  useEffect(() => {
    if (!id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function setTabAndUrl(next: Tab) {
    const safeNext = allowedTabsSet.has(next) ? next : "overview";
    setTab(safeNext);

    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (safeNext === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", safeNext);
    window.history.replaceState({}, "", url.toString());
  }

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

  async function loadKnowledgeChunks() {
    if (!id) return;
    setKbChunksLoading(true);
    const qs = new URLSearchParams({
      company_id: String(id),
      q: kbChunksQuery || "",
      limit: String(kbChunksLimit || 80),
    }).toString();

    const res = await fetch(`/api/admin/knowledge/chunks?${qs}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setKbChunksLoading(false);
    if (!res.ok) return setToast(json?.error || "chunks_load_failed");
    setKbChunks(json?.chunks ?? []);
  }

  // Tab-specific loads
  useEffect(() => {
    if (tab === "billing") void loadBilling();
    if (tab === "admins") void loadInvites();
    if (tab === "leads") void loadLeads();
    if (tab === "knowledge") void loadKnowledgeChunks();

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

    const res = await fetch(`/api/admin/companies/${id}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: inviteRole,
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
    await loadKnowledgeChunks();
  }

  /** -------------------- Knowledge: Fetch Page + Pages list + Generate -------------------- */
  async function fetchPageIntoForm() {
    if (!id) return setToast("Missing company id");
    const u = normalizeUrlInput(kbPageUrl);
    if (!u) return setToast("Enter a page URL");

    setKbFetching(true);
    setKbFetchResult(null);

    const res = await fetch("/api/admin/knowledge/fetch-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: u }),
    });

    const json = await res.json().catch(() => null);
    setKbFetching(false);
    setKbFetchResult(json);

    if (!res.ok) return setToast(json?.error || "fetch_page_failed");

    setKbPageUrl(u);
    setKbPageTitle(String(json?.title || "").trim());
    setKbPageText(String(json?.text || "").trim());

    setKbBrandHints({
      primary: json?.colors?.primary_color_guess ?? null,
      accent: json?.colors?.accent_color_guess ?? null,
      logo_url: json?.colors?.logo_url ?? null,
    });

    setToast("Page fetched. Now click Add Page.");
  }

  function addKbPage() {
    const u = normalizeUrlInput(kbPageUrl);
    if (!u) return setToast("URL missing");
    if (!kbPageText.trim()) return setToast("Text missing (click Fetch Page or paste full text)");

    const page: KbPage = {
      url: u,
      title: (kbPageTitle || "Untitled").trim(),
      text: kbPageText,
      captured_at: new Date().toISOString(),
    };

    setKbPages((prev) => {
      if (prev.some((p) => p.url === u)) return prev;
      return [page, ...prev];
    });

    setKbPageUrl("");
    setKbPageTitle("");
    setKbPageText("");
    setToast("Page added");
  }

  function removeKbPage(url: string) {
    setKbPages((prev) => prev.filter((p) => p.url !== url));
  }

  async function generateKbFromPages() {
    if (!id) return setToast("Missing company id");
    if (kbPages.length === 0) return setToast("Add at least one page first");

    setKbAuditRunning(true);
    setKbAuditResult(null);

    const payload = {
      company_id: id,
      website_url: kbPages[0]?.url || null,
      persist_profile: kbPersistProfile,
      brand_hints: kbBrandHints
        ? {
            primary_color_guess: kbBrandHints.primary,
            accent_color_guess: kbBrandHints.accent,
            logo_url: kbBrandHints.logo_url,
          }
        : null,
      pages: kbPages.map((p) => ({ url: p.url, title: p.title, text: p.text, captured_at: p.captured_at })),
    };

    const res = await fetch("/api/admin/knowledge/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    setKbAuditRunning(false);
    setKbAuditResult(json);

    if (!res.ok) return setToast(json?.error || "knowledge_pages_ingest_failed");
    setToast(`Inserted ${json.inserted_chunks ?? json.chunks ?? "?"} chunks`);
    await loadKnowledgeChunks();
  }

  function openEdit(row: KnowledgeChunkRow) {
    setEditRow(row);
    setEditTitle(row.title || "");
    setEditContent(row.content || "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editRow) return;
    setEditSaving(true);

    const res = await fetch("/api/admin/knowledge/chunks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: id, id: editRow.id, title: editTitle, content: editContent }),
    });

    const json = await res.json().catch(() => null);
    setEditSaving(false);
    if (!res.ok) return setToast(json?.error || "chunk_update_failed");

    setToast("Chunk updated");
    setEditOpen(false);
    setEditRow(null);
    await loadKnowledgeChunks();
  }

  async function deleteChunk(row: KnowledgeChunkRow) {
    const ok = window.confirm("Delete this knowledge chunk? This cannot be undone.");
    if (!ok) return;

    const res = await fetch(`/api/admin/knowledge/chunks/delete?id=${encodeURIComponent(row.id)}&company_id=${encodeURIComponent(String(id))}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setToast(json?.error || "chunk_delete_failed");

    setToast("Chunk deleted");
    await loadKnowledgeChunks();
  }

  const filteredLeads = useMemo(() => {
    const q = leadQuery.trim().toLowerCase();
    return leads.filter((l) => {
      if (leadBand !== "all" && l.score_band !== leadBand) return false;
      if (!q) return true;
      const hay = [
        l.name || "",
        l.email || "",
        l.phone || "",
        l.status || "",
        l.lead_state || "",
        l.score_band || "",
        JSON.stringify(l.qualification_json || {}),
      ]
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
      <TabsBar tabs={visibleTabs} active={tab} onChange={setTabAndUrl} />

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
                    <b>Chat mode:</b>{" "}
                    {data.settings?.branding_json?.chat?.mode ?? data.settings?.limits_json?.chat?.mode ?? "hybrid"}
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
                  <Button onClick={() => load()} variant="secondary">
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
                      type="button"
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
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      style={{ padding: "11px 12px", borderRadius: UI.radius, border: `1px solid ${UI.border}`, background: "#fff" }}
                    >
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
                  <BillingActions companyId={id as any} />
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
                          <b style={{ color: m.role === "assistant" ? "#1D4ED8" : m.role === "error" ? UI.danger : UI.text }}>
                            {m.role}:
                          </b>{" "}
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
              {/* Manual Pages -> Generate */}
              <Card
                title="Manual Pages → Audit → Knowledge"
                subtitle="URL rein → Fetch Page holt Text + Farb-Hints → Add Page → Generate Knowledge."
                right={
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: UI.text2 }}>
                      <input type="checkbox" checked={kbPersistProfile} onChange={(e) => setKbPersistProfile(e.target.checked)} />
                      Save inferred profile/branding
                    </label>
                    <Button onClick={generateKbFromPages} disabled={kbAuditRunning || kbPages.length === 0} variant="primary">
                      {kbAuditRunning ? "Generating…" : "Generate Knowledge"}
                    </Button>
                  </div>
                }
              >
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 10 }}>
                    <Input value={kbPageUrl} onChange={(e) => setKbPageUrl(e.target.value)} placeholder="https://tamtamcorp.tech/leadgenerator" />
                    <Input value={kbPageTitle} onChange={(e) => setKbPageTitle(e.target.value)} placeholder="Title (optional)" />
                    <Button onClick={fetchPageIntoForm} disabled={kbFetching} variant="secondary">
                      {kbFetching ? "Fetching…" : "Fetch Page"}
                    </Button>
                  </div>

                  <Textarea value={kbPageText} onChange={(e) => setKbPageText(e.target.value)} placeholder="Page text will appear here…" style={{ minHeight: 180 }} />

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button onClick={addKbPage} variant="secondary">Add Page</Button>
                    <Button
                      onClick={() => {
                        setKbPages([]);
                        setKbAuditResult(null);
                        setKbFetchResult(null);
                        setKbBrandHints(null);
                        setKbPageUrl("");
                        setKbPageTitle("");
                        setKbPageText("");
                      }}
                      variant="secondary"
                    >
                      Clear
                    </Button>
                  </div>

                  {kbBrandHints ? (
                    <div style={{ fontSize: 12.5, color: UI.text2 }}>
                      Brand hints: <b>primary</b> {kbBrandHints.primary || "—"} · <b>accent</b> {kbBrandHints.accent || "—"}
                    </div>
                  ) : null}

                  {kbFetchResult ? <CodeBox text={safeJsonStringify(kbFetchResult)} /> : null}

                  <div style={{ display: "grid", gap: 10 }}>
                    {kbPages.length === 0 ? (
                      <div style={{ color: UI.text2, fontSize: 13.5 }}>No pages added yet.</div>
                    ) : (
                      kbPages.map((p) => (
                        <div
                          key={p.url}
                          style={{
                            border: `1px solid ${UI.border}`,
                            borderRadius: UI.radius,
                            padding: 12,
                            background: "#fff",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                            <div style={{ fontSize: 12.5, color: UI.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.url} · {p.text.length.toLocaleString()} chars
                            </div>
                          </div>
                          <Button onClick={() => removeKbPage(p.url)} variant="danger">Remove</Button>
                        </div>
                      ))
                    )}
                  </div>

                  {kbAuditResult ? <CodeBox text={safeJsonStringify(kbAuditResult)} /> : null}
                </div>
              </Card>

              {/* Knowledge Chunks Manager */}
              <Card
                title="Knowledge Chunks Manager"
                subtitle="View, search, edit, and delete knowledge chunks for this company."
                right={
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button onClick={loadKnowledgeChunks} disabled={kbChunksLoading} variant="secondary">
                      {kbChunksLoading ? "Loading…" : "Refresh"}
                    </Button>
                  </div>
                }
              >
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 140px", gap: 10 }}>
                    <Input value={kbChunksQuery} onChange={(e) => setKbChunksQuery(e.target.value)} placeholder="Search title, content, source…" />
                    <Input
                      type="number"
                      min={10}
                      max={200}
                      value={kbChunksLimit}
                      onChange={(e) => setKbChunksLimit(Number(e.target.value || 80))}
                    />
                    <Button onClick={loadKnowledgeChunks} disabled={kbChunksLoading} variant="primary">
                      Apply
                    </Button>
                  </div>

                  <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radius, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px", background: UI.surface2, padding: "10px 12px", fontSize: 12.5, color: UI.text2, fontWeight: 900 }}>
                      <div>Title</div>
                      <div>Type</div>
                      <div>Confidence</div>
                      <div>Actions</div>
                    </div>

                    {kbChunks.length === 0 ? (
                      <div style={{ padding: 12, color: UI.text2 }}>No chunks found.</div>
                    ) : (
                      kbChunks.map((c) => {
                        const type = String(c?.metadata?.type || "—");
                        const conf = String(c?.metadata?.confidence || "—");
                        return (
                          <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px", padding: "10px 12px", borderTop: `1px solid ${UI.border}`, gap: 10, alignItems: "center" }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                              <div style={{ fontSize: 12.5, color: UI.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {(c.source_ref || "—")} · {new Date(c.created_at).toLocaleString()}
                              </div>
                            </div>
                            <div style={{ fontSize: 12.5, color: UI.text2, textTransform: "uppercase" }}>{type}</div>
                            <div style={{ fontSize: 12.5, color: UI.text2, textTransform: "uppercase" }}>{conf}</div>
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => openEdit(c)}
                                style={{
                                  border: `1px solid ${UI.border}`,
                                  background: "#fff",
                                  borderRadius: 999,
                                  padding: "7px 10px",
                                  fontSize: 12.5,
                                  cursor: "pointer",
                                  fontWeight: 900,
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteChunk(c)}
                                style={{
                                  border: "1px solid #FECACA",
                                  background: "#fff",
                                  color: UI.danger,
                                  borderRadius: 999,
                                  padding: "7px 10px",
                                  fontSize: 12.5,
                                  cursor: "pointer",
                                  fontWeight: 900,
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </Card>

              {/* Manual Knowledge Ingest */}
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
                    <Button onClick={() => setKbText("")} variant="secondary">Clear</Button>
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
                  <select
                    value={leadBand}
                    onChange={(e) => setLeadBand(e.target.value as any)}
                    style={{ padding: "11px 12px", borderRadius: UI.radius, border: `1px solid ${UI.border}`, background: "#fff" }}
                  >
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

      {editOpen && editRow ? (
        <Modal
          title="Edit Knowledge Chunk"
          onClose={() => {
            setEditOpen(false);
            setEditRow(null);
          }}
          right={
            <Button onClick={saveEdit} disabled={editSaving} variant="primary">
              {editSaving ? "Saving…" : "Save"}
            </Button>
          }
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Title</div>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, color: UI.text2, marginBottom: 6 }}>Content</div>
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ minHeight: 320 }} />
            </div>
            <div style={{ fontSize: 12.5, color: UI.text3 }}>
              Note: Embeddings are not re-generated on edit yet. If you want perfect retrieval, we can re-embed on save.
            </div>
          </div>
        </Modal>
      ) : null}

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