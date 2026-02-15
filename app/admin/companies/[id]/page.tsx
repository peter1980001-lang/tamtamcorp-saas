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
type DetailResponse = { company: Company; keys: Keys | null; settings: Settings };

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

type AdminRow = {
  id: string;
  company_id: string;
  user_id: string;
  role: string;
  created_at: string;
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

const tabs = [
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
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
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

  async function loadAdminsAndInvites() {
    if (!id) return;
    setAdminsLoading(true);
    const res = await fetch(`/api/admin/companies/${id}/invites`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setAdminsLoading(false);

    if (!res.ok) {
      setToast(json?.error || "admins_invites_load_failed");
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

  // ✅ When switching tabs, reload/prepare as needed
  useEffect(() => {
    if (tab === "limits") {
      const current = data?.settings?.limits_json ?? {};
      setLimitsText(safeJsonStringify(current));
      setLimitsDirty(false);
    }

    if (tab === "billing") loadBilling();
    if (tab === "admins") loadAdminsAndInvites();
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

    setToast(`Inserted ${json.chunks} chunks`);
    setKbText("");
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

              {tab === "domains" && (
                <Card
                  title="Allowed Domains"
                  right={
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        onClick={() => {
                          const current = data.keys?.allowed_domains ?? [];
                          setDomainDraft(current);
                          setDomainInput("");
                          setDomainDirty(false);
                          setToast("Reset");
                        }}
                        disabled={domainSaving}
                        style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
                      >
                        Reset
                      </button>
                      <button
                        onClick={saveDomains}
                        disabled={domainSaving || !domainDirty}
                        style={{
                          border: "1px solid #111",
                          background: domainSaving || !domainDirty ? "#444" : "#111",
                          color: "#fff",
                          padding: "8px 10px",
                          borderRadius: 10,
                          cursor: domainSaving || !domainDirty ? "not-allowed" : "pointer",
                        }}
                      >
                        {domainSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  }
                >
                  <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                    Stored in <code>company_keys.allowed_domains</code>. Host-only, no protocol, no path.
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    <input
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      placeholder="e.g. tamtamcorp-saas-pcwl.vercel.app"
                      style={{ flex: 1, minWidth: 280, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addDomainFromInput();
                      }}
                    />
                    <button onClick={addDomainFromInput} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}>
                      Add
                    </button>
                  </div>

                  <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.7 }}>
                    Example: <code>tamtamcorp-saas-pcwl.vercel.app</code> — do not include <code>https://</code> or slashes.
                  </div>

                  <div>
                    {domainDraft.length === 0 ? (
                      <div style={{ opacity: 0.7 }}>No domains set.</div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {domainDraft.map((d) => (
                          <span
                            key={d}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 10px",
                              borderRadius: 999,
                              border: "1px solid #eee",
                              background: "#fafafa",
                              fontSize: 12,
                              marginRight: 8,
                              marginBottom: 8,
                            }}
                          >
                            <span>{d}</span>
                            <button onClick={() => removeDomain(d)} style={{ border: "1px solid #ddd", background: "#fff", padding: "2px 8px", borderRadius: 999, cursor: "pointer", fontSize: 12 }}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                    Status: {domainDirty ? <span style={{ fontWeight: 700 }}>Unsaved changes</span> : <span>Saved</span>}
                  </div>
                </Card>
              )}

              {tab === "limits" && (
                <Card
                  title="Limits"
                  right={
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        onClick={() => {
                          const current = data.settings?.limits_json ?? {};
                          setLimitsText(safeJsonStringify(current));
                          setLimitsDirty(false);
                          setToast("Reset");
                        }}
                        disabled={limitsSaving}
                        style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
                      >
                        Reset
                      </button>
                      <button
                        onClick={saveLimits}
                        disabled={limitsSaving || !limitsDirty}
                        style={{
                          border: "1px solid #111",
                          background: limitsSaving || !limitsDirty ? "#444" : "#111",
                          color: "#fff",
                          padding: "8px 10px",
                          borderRadius: 10,
                          cursor: limitsSaving || !limitsDirty ? "not-allowed" : "pointer",
                        }}
                      >
                        {limitsSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  }
                >
                  <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                    Stored in <code>company_settings.limits_json</code>. Edit JSON and save.
                  </div>
                  <textarea
                    value={limitsText}
                    onChange={(e) => {
                      setLimitsText(e.target.value);
                      setLimitsDirty(true);
                    }}
                    spellCheck={false}
                    style={{
                      width: "100%",
                      minHeight: 260,
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: 12,
                      background: "#fafafa",
                    }}
                  />
                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                    Status: {limitsDirty ? <span style={{ fontWeight: 700 }}>Unsaved changes</span> : <span>Saved</span>}
                  </div>
                </Card>
              )}

              {tab === "admins" && (
                <div style={{ display: "grid", gap: 14 }}>
                  <Card
                    title="Create Invite"
                    right={
                      <button
                        onClick={loadAdminsAndInvites}
                        style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
                      >
                        Refresh
                      </button>
                    }
                  >
                    <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                      Create an invite link and share it. (MVP: link is copied automatically.)
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 140px", gap: 10 }}>
                        <input
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="Target email (optional)"
                          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                        />
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
                        >
                          <option value="admin">admin</option>
                          <option value="member">member</option>
                          <option value="viewer">viewer</option>
                        </select>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={inviteDays}
                          onChange={(e) => setInviteDays(Number(e.target.value || 7))}
                          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                          title="Expires in days"
                        />
                      </div>

                      <button
                        onClick={createInvite}
                        disabled={inviteCreating}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 12,
                          border: "1px solid #111",
                          background: "#111",
                          color: "#fff",
                          cursor: inviteCreating ? "not-allowed" : "pointer",
                          width: "fit-content",
                        }}
                      >
                        {inviteCreating ? "Creating…" : "Create Invite + Copy Link"}
                      </button>

                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Accept URL: <code>/invite?token=...</code> (User must be logged in.)
                      </div>
                    </div>
                  </Card>

                  <Card title="Company Admins">
                    {adminsLoading ? (
                      <div style={{ opacity: 0.75 }}>Loading…</div>
                    ) : admins.length === 0 ? (
                      <div style={{ opacity: 0.75 }}>No admins found.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {admins.map((a) => (
                          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: 10, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
                            <div style={{ fontSize: 13 }}>
                              <div><b>User:</b> <code>{a.user_id}</code></div>
                              <div style={{ opacity: 0.8 }}><b>Role:</b> {a.role}</div>
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.7, whiteSpace: "nowrap" }}>
                              {a.created_at ? new Date(a.created_at).toLocaleString() : "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card title="Invites">
                    {adminsLoading ? (
                      <div style={{ opacity: 0.75 }}>Loading…</div>
                    ) : invites.length === 0 ? (
                      <div style={{ opacity: 0.75 }}>No invites yet.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {invites.map((i) => {
                          const link = inviteLink(i.token);
                          const expired = new Date(i.expires_at).getTime() < Date.now();
                          return (
                            <div key={i.id} style={{ padding: 10, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                                <div style={{ fontSize: 13 }}>
                                  <div><b>Status:</b> {i.status}{expired && i.status === "pending" ? " (expired)" : ""}</div>
                                  <div style={{ opacity: 0.85 }}><b>Role:</b> {i.role} {i.email ? ` · ${i.email}` : ""}</div>
                                  <div style={{ opacity: 0.75, fontSize: 12 }}>
                                    Expires: {i.expires_at ? new Date(i.expires_at).toLocaleString() : "—"}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button
                                    onClick={() => copy(link)}
                                    style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
                                  >
                                    Copy Link
                                  </button>
                                  <button
                                    onClick={() => revokeInvite(i.id)}
                                    disabled={i.status !== "pending"}
                                    style={{
                                      border: "1px solid #ddd",
                                      background: i.status === "pending" ? "#fff" : "#eee",
                                      padding: "8px 10px",
                                      borderRadius: 10,
                                      cursor: i.status === "pending" ? "pointer" : "not-allowed",
                                    }}
                                  >
                                    Revoke
                                  </button>
                                </div>
                              </div>
                              <div style={{ marginTop: 8, fontSize: 12 }}>
                                <code style={{ wordBreak: "break-all" }}>{link}</code>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {tab === "embed" && (
                <Card
                  title="Embed Snippet"
                  right={
                    <button onClick={() => copy(embedSnippet)} style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}>
                      Copy
                    </button>
                  }
                >
                  <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                    Put this script on the client website. It loads the floating iframe widget.
                  </div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
                    {embedSnippet}
                  </pre>
                </Card>
              )}

              {tab === "billing" && (
                <Card
                  title="Billing"
                  right={
                    <button onClick={loadBilling} style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}>
                      Refresh billing
                    </button>
                  }
                >
                  <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                    Start a subscription (Checkout) or manage the current subscription (Customer Portal).
                  </div>
                  <BillingActions companyId={id as string} />
                  <div style={{ marginTop: 14, borderTop: "1px solid #eee", paddingTop: 14 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Current Billing Status</div>

                    {billingLoading ? (
                      <div style={{ opacity: 0.75 }}>Loading billing…</div>
                    ) : !billingInfo?.billing ? (
                      <div style={{ opacity: 0.75 }}>
                        No billing row yet. After first Checkout, Stripe webhook will create/update <code>company_billing</code>.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                        <div><b>Status:</b> {billingInfo.billing.status || "—"}</div>
                        <div><b>Plan:</b> {billingInfo.billing.plan_key || billingInfo.plan?.plan_key || "—"}{billingInfo.plan?.name ? ` (${billingInfo.plan.name})` : ""}</div>
                        <div><b>Price ID:</b> {billingInfo.billing.stripe_price_id || billingInfo.plan?.stripe_price_id || "—"}</div>
                        <div><b>Current period end:</b> {billingInfo.billing.current_period_end ? new Date(billingInfo.billing.current_period_end).toLocaleString() : "—"}</div>
                        <div><b>Stripe Customer:</b> {billingInfo.billing.stripe_customer_id ? "set" : "—"}</div>
                        <div><b>Stripe Subscription:</b> {billingInfo.billing.stripe_subscription_id ? "set" : "—"}</div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {tab === "test-chat" && (
                <Card title="Test Chat">
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    <button onClick={testGetToken} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}>
                      Get Token
                    </button>
                    <button onClick={testStartConversation} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
                      Start Conversation
                    </button>
                    <button onClick={() => setTestLog([])} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
                      Clear Log
                    </button>
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10, lineHeight: 1.6 }}>
                    <div>Token: {testToken ? "set" : "—"}</div>
                    <div>Conversation: {testConversationId ?? "—"}</div>
                  </div>

                  <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 12, background: "#fafafa" }}>
                    <div style={{ maxHeight: 260, overflow: "auto", padding: 8 }}>
                      {testLog.length === 0 ? (
                        <div style={{ opacity: 0.65, fontSize: 13 }}>No messages yet. Get token → start conversation → send.</div>
                      ) : (
                        testLog.map((m, idx) => (
                          <div key={idx} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{m.role}</div>
                            <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{m.text}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                      <input
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        placeholder="Type a message…"
                        style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") testSend();
                        }}
                      />
                      <button onClick={testSend} disabled={testSending} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}>
                        {testSending ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </div>
                </Card>
              )}

              {tab === "knowledge" && (
                <Card
                  title="Knowledge Ingest"
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
              )}

              {tab === "leads" && (
                <Card title="Leads Dashboard">
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    <input
                      value={leadQuery}
                      onChange={(e) => setLeadQuery(e.target.value)}
                      placeholder="Search…"
                      style={{ flex: 1, minWidth: 240, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                    />
                    <select
                      value={leadBand}
                      onChange={(e) => setLeadBand(e.target.value as any)}
                      style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
                    >
                      <option value="all">all</option>
                      <option value="cold">cold</option>
                      <option value="warm">warm</option>
                      <option value="hot">hot</option>
                    </select>
                    <button onClick={loadLeads} disabled={leadsLoading} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
                      {leadsLoading ? "Loading…" : "Refresh"}
                    </button>
                  </div>

                  {leadsLoading ? (
                    <div style={{ opacity: 0.75 }}>Loading…</div>
                  ) : filteredLeads.length === 0 ? (
                    <div style={{ opacity: 0.75 }}>No leads.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {filteredLeads.map((l) => (
                        <div key={l.id} style={{ padding: 10, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontSize: 13 }}>
                              <div style={{ fontWeight: 700 }}>{l.name || l.email || l.phone || "Lead"}</div>
                              <div style={{ opacity: 0.8 }}>{l.score_band} · {l.score_total}</div>
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.7, whiteSpace: "nowrap" }}>
                              {l.created_at ? new Date(l.created_at).toLocaleString() : "—"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
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
