"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import BillingActions from "./_components/BillingActions";

type Company = { id: string; name: string; status: string; created_at: string };
type Keys = {
  company_id: string;
  public_key: string;
  secret_key: string;
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

type DetailResponse = { company: Company; keys: Keys | null; settings: Settings; admins?: AdminRow[] };

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

const tabs = ["overview", "keys", "domains", "limits", "admins", "embed", "billing", "test-chat", "knowledge", "leads"] as const;
type Tab = (typeof tabs)[number];

function Card(props: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
        boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
        <div style={{ fontWeight: 700 }}>{props.title}</div>
        {props.right}
      </div>
      {props.children}
    </div>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid #eee",
        background: "#fafafa",
        fontSize: 12,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      {text}
    </span>
  );
}

function mask(s: string) {
  if (!s) return "";
  if (s.length <= 10) return "********";
  return s.slice(0, 6) + "…" + s.slice(-4);
}

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

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [showSecret, setShowSecret] = useState(false);
  const [rotating, setRotating] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  // ===== Billing state =====
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  // ===== Domains edit state =====
  const [domainInput, setDomainInput] = useState("");
  const [domainDraft, setDomainDraft] = useState<string[]>([]);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainDirty, setDomainDirty] = useState(false);

  // ===== Limits edit state =====
  const [limitsText, setLimitsText] = useState<string>("{}");
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [limitsDirty, setLimitsDirty] = useState(false);

  // ===== Admins/Invites state =====
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminMutating, setAdminMutating] = useState<string | null>(null);

  const [inviteRole, setInviteRole] = useState("admin");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDays, setInviteDays] = useState(7);
  const [inviteCreating, setInviteCreating] = useState(false);

  // ===== Test Chat state =====
  const [testToken, setTestToken] = useState<string | null>(null);
  const [testConversationId, setTestConversationId] = useState<string | null>(null);
  const [testInput, setTestInput] = useState("Hello Nova");
  const [testLog, setTestLog] = useState<{ role: string; text: string }[]>([]);
  const [testSending, setTestSending] = useState(false);

  // ===== Knowledge state =====
  const [kbTitle, setKbTitle] = useState("Manual Admin Entry");
  const [kbText, setKbText] = useState("");
  const [kbIngesting, setKbIngesting] = useState(false);

  // ===== Website Import state (NEW) =====
  const [importUrl, setImportUrl] = useState("");
  const [importMaxPages, setImportMaxPages] = useState(5);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // ===== Leads state =====
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadBand, setLeadBand] = useState<"all" | "cold" | "warm" | "hot">("all");

  async function load() {
    if (!id) return;
    setLoading(true);

    const res = await fetch(`/api/admin/companies/${id}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setToast(json?.error || "company_load_failed");
      setData(null);
      setLoading(false);
      return;
    }

    setData(json);
    setAdmins(json?.admins ?? []);
    setLoading(false);
  }

  async function loadBilling() {
    if (!id) return;
    setBillingLoading(true);

    const res = await fetch(`/api/admin/companies/${id}/billing`, { cache: "no-store" });
    const json = await res.json().catch(() => null);

    setBillingLoading(false);

    if (!res.ok) {
      setToast(json?.error || "billing_load_failed");
      return;
    }

    setBillingInfo(json);
  }

  async function loadInvites() {
    if (!id) return;
    setAdminsLoading(true);
    const res = await fetch(`/api/admin/companies/${id}/invites`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setAdminsLoading(false);

    if (!res.ok) {
      setToast(json?.error || "invites_load_failed");
      return;
    }

    setAdmins(json.admins ?? []);
    setInvites(json.invites ?? []);
  }

  useEffect(() => {
    if (!id) return;

    const t = String(searchParams?.get("tab") || "").toLowerCase();
    if (t && (tabs as readonly string[]).includes(t)) setTab(t as any);

    load();

    const checkout = String(searchParams?.get("checkout") || "").toLowerCase();
    if (checkout === "success") {
      setToast("Checkout success — syncing billing…");
      setTimeout(() => {
        load();
        loadBilling();
        setToast("Billing refreshed");
      }, 1200);
    } else if (checkout === "cancel") {
      setToast("Checkout canceled");
    }

    const trial = String(searchParams?.get("trial") || "").toLowerCase();
    if (trial === "started") {
      setToast("Trial started");
      setTimeout(() => loadBilling(), 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams]);

  useEffect(() => {
    if (tab === "limits") {
      const current = data?.settings?.limits_json ?? {};
      setLimitsText(safeJsonStringify(current));
      setLimitsDirty(false);
    }

    if (tab === "billing") loadBilling();
    if (tab === "admins") loadInvites();
    if (tab === "leads") loadLeads();

    if (tab === "domains") {
      const current = data?.keys?.allowed_domains ?? [];
      setDomainDraft(current);
      setDomainInput("");
      setDomainDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== "domains") return;
    const current = data?.keys?.allowed_domains ?? [];
    setDomainDraft(current);
    setDomainDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.keys?.allowed_domains, tab]);

  useEffect(() => {
    if (tab !== "limits") return;
    const current = data?.settings?.limits_json ?? {};
    setLimitsText(safeJsonStringify(current));
    setLimitsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.settings?.limits_json, tab]);

  const embedSnippet = useMemo(() => {
    const pk = data?.keys?.public_key || "pk_xxx";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `<script src="${origin}/widget-loader.js" data-public-key="${pk}"></script>`;
  }, [data?.keys?.public_key]);

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

    if (!res.ok) {
      setToast(json?.error || "rotate_failed");
      return;
    }

    setToast("Keys rotated");
    await load();
  }

  function addDomainFromInput() {
    const raw = domainInput || "";
    const normalized = normalizeHost(raw);

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

    const payload = {
      allowed_domains: uniq(
        (domainDraft ?? [])
          .filter((x) => typeof x === "string")
          .map((x) => normalizeHost(x))
          .filter((x) => x.length > 0)
      ),
    };

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
      const link = inviteLink(inv.token);
      await navigator.clipboard.writeText(link);
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
    const res = await fetch(`/api/admin/companies/${id}/invites?invite_id=${encodeURIComponent(invite_id)}`, {
      method: "DELETE",
    });
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
    await load();
  }

  async function removeAdmin(user_id: string) {
    if (!id) return;
    setAdminMutating(user_id);

    const res = await fetch(`/api/admin/companies/${id}/admins?user_id=${encodeURIComponent(user_id)}`, {
      method: "DELETE",
    });

    const json = await res.json().catch(() => null);
    setAdminMutating(null);

    if (!res.ok) return setToast(json?.error || "admin_remove_failed");

    setToast("Admin removed");
    await load();
  }

  async function testGetToken() {
    const pk = data?.keys?.public_key;
    if (!pk) return setToast("No public key found. Rotate keys first.");

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

    const res = await fetch("/api/widget/conversation", {
      method: "POST",
      headers: { Authorization: `Bearer ${testToken}` },
    });

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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        conversation_id: testConversationId,
        message: testInput,
      }),
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
      body: JSON.stringify({
        company_id: id,
        title: kbTitle || "Manual Admin Entry",
        content: kbText,
      }),
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
      body: JSON.stringify({
        url: u,
        max_pages,
      }),
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

  async function loadLeads() {
    if (!id) return;
    setLeadsLoading(true);
    const res = await fetch(`/api/admin/companies/${id}/leads`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setLeadsLoading(false);

    if (!res.ok) return setToast(json?.error || "leads_failed");
    setLeads(json.leads ?? []);
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

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Company</div>
            <h1 style={{ fontSize: 28, margin: "4px 0 0" }}>{loading ? "Loading…" : data?.company?.name || "—"}</h1>

            {!loading && data?.company && (
              <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Chip text={`ID: ${data.company.id}`} />
                <Chip text={`Status: ${data.company.status}`} />
                <Chip text={`Created: ${new Date(data.company.created_at).toLocaleString()}`} />
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={load}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Refresh
            </button>

            <button
              onClick={rotateKeys}
              disabled={rotating}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {rotating ? "Rotating…" : "Rotate Keys"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 12px",
                borderRadius: 999,
                border: "1px solid " + (tab === t ? "#111" : "#ddd"),
                background: tab === t ? "#111" : "#fff",
                color: tab === t ? "#fff" : "#111",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          {loading || !data ? (
            <Card title="Loading">Fetching data…</Card>
          ) : (
            <>
              {tab === "overview" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <Card title="Quick Summary">
                    <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.8 }}>
                      <div>
                        <b>Public Key:</b> {data.keys?.public_key ?? "—"}
                      </div>
                      <div>
                        <b>Allowed Domains:</b> {(data.keys?.allowed_domains ?? []).length}
                      </div>
                      <div>
                        <b>Limits:</b> {Object.keys(data.settings?.limits_json ?? {}).length} keys
                      </div>
                      <div>
                        <b>Chat Mode:</b>{" "}
                        {data.settings?.branding_json?.chat?.mode ?? data.settings?.limits_json?.chat?.mode ?? "hybrid (default)"}
                      </div>
                    </div>
                  </Card>

                  <Card
                    title="Embed Snippet"
                    right={
                      <button
                        onClick={() => copy(embedSnippet)}
                        style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
                      >
                        Copy
                      </button>
                    }
                  >
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
                      {embedSnippet}
                    </pre>
                  </Card>
                </div>
              )}

              {tab === "keys" && (
                <Card
                  title="Keys"
                  right={
                    <button
                      onClick={() => setShowSecret((s) => !s)}
                      style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
                    >
                      {showSecret ? "Hide secret" : "Show secret"}
                    </button>
                  }
                >
                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Public Key</div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <code style={{ flex: 1, padding: 10, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>{data.keys?.public_key ?? "—"}</code>
                        <button onClick={() => copy(data.keys?.public_key ?? "")} style={{ border: "1px solid #ddd", background: "#fff", padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}>
                          Copy
                        </button>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Secret Key</div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <code style={{ flex: 1, padding: 10, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
                          {data.keys?.secret_key ? (showSecret ? data.keys.secret_key : mask(data.keys.secret_key)) : "—"}
                        </code>
                        <button onClick={() => copy(data.keys?.secret_key ?? "")} style={{ border: "1px solid #ddd", background: "#fff", padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}>
                          Copy
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.7 }}>Created: {data.keys?.created_at ? new Date(data.keys.created_at).toLocaleString() : "—"}</div>
                  </div>
                </Card>
              )}

              {/* Domains/Limits/Admins/Embed/Billing/Test-Chat unchanged in this file (kept as provided) */}
              {/* To keep this response compact, they are not duplicated here. */}

              {tab === "knowledge" && (
                <div style={{ display: "grid", gap: 14 }}>
                  <Card
                    title="Website Import"
                    right={
                      <button
                        onClick={() => {
                          setImportUrl("");
                          setImportMaxPages(5);
                          setImportResult(null);
                          setToast("Reset");
                        }}
                        disabled={importing}
                        style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
                      >
                        Reset
                      </button>
                    }
                  >
                    <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                      Import a website URL. We will crawl pages, extract sections, chunk, embed, and store structured metadata into <code>knowledge_chunks</code>.
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10 }}>
                        <input
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          placeholder="https://tamtamcorp.tech/leadgenerator"
                          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                        />
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={importMaxPages}
                          onChange={(e) => setImportMaxPages(Number(e.target.value || 5))}
                          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                          title="max pages"
                        />
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          onClick={importWebsite}
                          disabled={importing}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 12,
                            border: "1px solid #111",
                            background: "#111",
                            color: "#fff",
                            cursor: importing ? "not-allowed" : "pointer",
                          }}
                        >
                          {importing ? "Importing…" : "Import Website"}
                        </button>

                        <button
                          onClick={() => setTab("test-chat")}
                          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                        >
                          Go to Test-Chat →
                        </button>
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Tip: use a full URL including <code>https://</code>. <code>max_pages</code> is capped at 10.
                      </div>

                      {importResult ? (
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            fontSize: 12,
                            background: "#fafafa",
                            border: "1px solid #eee",
                            padding: 12,
                            borderRadius: 12,
                          }}
                        >
                          {safeJsonStringify(importResult)}
                        </pre>
                      ) : null}
                    </div>
                  </Card>

                  <Card
                    title="Manual Knowledge Ingest"
                    right={
                      <button onClick={() => setKbText("")} style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}>
                        Clear
                      </button>
                    }
                  >
                    <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                      Paste text from the company website / FAQ / brochure. We will chunk + embed into <code>knowledge_chunks</code>.
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Title (optional)</div>
                        <input value={kbTitle} onChange={(e) => setKbTitle(e.target.value)} placeholder="e.g. FAQ, About us, Pricing" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
                      </div>

                      <div>
                        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Content</div>
                        <textarea value={kbText} onChange={(e) => setKbText(e.target.value)} placeholder="Paste website text, FAQ, product descriptions..." style={{ width: "100%", minHeight: 220, padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button onClick={ingestKnowledge} disabled={kbIngesting} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}>
                          {kbIngesting ? "Embedding…" : "Add to Knowledge Base"}
                        </button>

                        <button onClick={() => setTab("test-chat")} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
                          Go to Test-Chat →
                        </button>
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Tip: after ingest, ask questions in Test-Chat. In knowledge-only mode, the bot will refuse answers not in the KB.
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Keep the rest of tabs as in your current file */}
            </>
          )}
        </div>

        {toast && (
          <div
            onClick={() => setToast(null)}
            style={{
              position: "fixed",
              right: 18,
              bottom: 18,
              background: "#111",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: 12,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
