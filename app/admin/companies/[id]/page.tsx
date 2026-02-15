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

const tabs = ["overview", "keys", "domains", "limits", "embed", "billing", "test-chat", "knowledge", "leads"] as const;
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

function fmt(dt?: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function badge(text: string, bg: string, fg: string) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        background: bg,
        color: fg,
        border: "1px solid rgba(0,0,0,0.06)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function ScoreBadge({ band, total }: { band: LeadRow["score_band"]; total: number }) {
  if (band === "hot") return badge(`hot ${total}`, "#111", "#fff");
  if (band === "warm") return badge(`warm ${total}`, "#f3f4f6", "#111");
  return badge(`cold ${total}`, "#fafafa", "#111");
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

  // Billing state
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  // Test Chat state
  const [testToken, setTestToken] = useState<string | null>(null);
  const [testConversationId, setTestConversationId] = useState<string | null>(null);
  const [testInput, setTestInput] = useState("Hello Nova");
  const [testLog, setTestLog] = useState<{ role: string; text: string }[]>([]);
  const [testSending, setTestSending] = useState(false);

  // Knowledge state
  const [kbTitle, setKbTitle] = useState("Manual Admin Entry");
  const [kbText, setKbText] = useState("");
  const [kbIngesting, setKbIngesting] = useState(false);

  // Leads state
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadBand, setLeadBand] = useState<"all" | "cold" | "warm" | "hot">("all");
  const [leadOpenId, setLeadOpenId] = useState<string | null>(null);
  const [leadSaving, setLeadSaving] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/admin/companies/${id}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  async function loadBilling() {
    if (!id) return;
    setBillingLoading(true);
    const res = await fetch(`/api/admin/companies/${id}/billing`);
    const json = await res.json();
    setBillingLoading(false);

    if (!res.ok) {
      setToast(json.error || "billing_load_failed");
      return;
    }

    setBillingInfo(json);
  }

  useEffect(() => {
    if (!id) return;

    const t = String(searchParams?.get("tab") || "").toLowerCase();
    if (t && (tabs as readonly string[]).includes(t)) {
      setTab(t as any);
    }

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
      setToast("Trial started — refreshing billing…");
      setTimeout(() => {
        loadBilling();
        setToast("Billing refreshed");
      }, 600);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams]);

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
    const json = await res.json();
    setRotating(false);

    if (!res.ok) {
      setToast(json.error || "rotate_failed");
      return;
    }

    setToast("Keys rotated");
    await load();
  }

  // Test Chat actions
  async function testGetToken() {
    const pk = data?.keys?.public_key;
    if (!pk) return setToast("No public key found. Rotate keys first.");

    const res = await fetch("/api/widget/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: pk }),
    });

    const json = await res.json();
    if (!res.ok) {
      setToast(json.error || "token_failed");
      return;
    }

    setTestToken(json.token);
    setToast("Token received");
  }

  async function testStartConversation() {
    if (!testToken) return setToast("Missing token → click Get Token");

    const res = await fetch("/api/widget/conversation", {
      method: "POST",
      headers: { Authorization: `Bearer ${testToken}` },
    });

    const json = await res.json();
    if (!res.ok) {
      setToast(json.error || "conversation_failed");
      return;
    }

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

    const res = await fetch("/api/chat", {
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

    const json = await res.json();
    setTestSending(false);

    if (!res.ok) {
      setToast(json.error || "chat_failed");
      setTestLog((l) => [...l, { role: "error", text: JSON.stringify(json) }]);
      return;
    }

    setTestLog((l) => [...l, { role: "assistant", text: json.reply || "" }]);
    setTestInput("");
  }

  // Knowledge actions
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

    const json = await res.json();
    setKbIngesting(false);

    if (!res.ok) {
      setToast(json.error || "ingest_failed");
      return;
    }

    setToast(`Inserted ${json.chunks} chunks`);
    setKbText("");
  }

  // Leads actions
  async function loadLeads() {
    if (!id) return;
    setLeadsLoading(true);
    const res = await fetch(`/api/admin/companies/${id}/leads`);
    const json = await res.json();
    setLeadsLoading(false);

    if (!res.ok) {
      setToast(json.error || "leads_failed");
      return;
    }

    setLeads(json.leads ?? []);
  }

  async function updateLead(lead_id: string, patch: { status?: string; lead_state?: string }) {
    if (!id) return;
    setLeadSaving(lead_id);
    const res = await fetch(`/api/admin/companies/${id}/leads`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id, ...patch }),
    });
    const json = await res.json();
    setLeadSaving(null);

    if (!res.ok) {
      setToast(json.error || "lead_update_failed");
      return;
    }

    const updated: LeadRow = json.lead;
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setToast("Lead updated");
  }

  useEffect(() => {
    if (tab === "leads") loadLeads();
    if (tab === "billing") loadBilling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
        {/* Header */}
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

        {/* Tabs */}
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

        {/* Body */}
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
                        <code style={{ flex: 1, padding: 10, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
                          {data.keys?.public_key ?? "—"}
                        </code>
                        <button
                          onClick={() => copy(data.keys?.public_key ?? "")}
                          style={{ border: "1px solid #ddd", background: "#fff", padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}
                        >
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
                        <button
                          onClick={() => copy(data.keys?.secret_key ?? "")}
                          style={{ border: "1px solid #ddd", background: "#fff", padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.7 }}>Created: {data.keys?.created_at ? new Date(data.keys.created_at).toLocaleString() : "—"}</div>
                  </div>
                </Card>
              )}

              {tab === "domains" && (
                <Card title="Allowed Domains">
                  <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                    Stored in <code>company_keys.allowed_domains</code>.
                  </div>
                  <div>
                    {(data.keys?.allowed_domains ?? []).length === 0 ? (
                      <div style={{ opacity: 0.7 }}>No domains set.</div>
                    ) : (
                      (data.keys?.allowed_domains ?? []).map((d) => <Chip key={d} text={d} />)
                    )}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>(Editing UI is next – for now set via DB.)</div>
                </Card>
              )}

              {tab === "limits" && (
                <Card title="Limits">
                  <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                    Stored in <code>company_settings.limits_json</code>.
                  </div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
                    {JSON.stringify(data.settings?.limits_json ?? {}, null, 2)}
                  </pre>
                </Card>
              )}

              {tab === "embed" && (
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
                  <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>Put this script on the client website. It loads the floating iframe widget.</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
                    {embedSnippet}
                  </pre>
                </Card>
              )}

              {/* BILLING TAB */}
              {tab === "billing" && (
                <Card
                  title="Billing"
                  right={
                    <button
                      onClick={loadBilling}
                      style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
                    >
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
                        <div>
                          <b>Status:</b> {billingInfo.billing.status || "—"}{" "}
                          {billingInfo.paying_status ? badge("paying", "#111", "#fff") : badge("not paying", "#fafafa", "#111")}
                        </div>
                        <div>
                          <b>Chat:</b>{" "}
                          {billingInfo.chat_enabled ? badge("enabled", "#111", "#fff") : badge("disabled", "#fafafa", "#111")}{" "}
                          <span style={{ fontSize: 12, opacity: 0.7 }}>
                            (feature: {billingInfo.chat_feature_enabled ? "on" : "off"})
                          </span>
                        </div>
                        <div>
                          <b>Plan:</b> {billingInfo.billing.plan_key || billingInfo.plan?.plan_key || "—"}
                          {billingInfo.plan?.name ? ` (${billingInfo.plan.name})` : ""}
                        </div>
                        <div>
                          <b>Price ID:</b> {billingInfo.billing.stripe_price_id || billingInfo.plan?.stripe_price_id || "—"}
                        </div>
                        <div>
                          <b>Current period end:</b>{" "}
                          {billingInfo.billing.current_period_end ? new Date(billingInfo.billing.current_period_end).toLocaleString() : "—"}
                        </div>
                        <div>
                          <b>Stripe Customer:</b> {billingInfo.billing.stripe_customer_id ? "set" : "—"}
                        </div>
                        <div>
                          <b>Stripe Subscription:</b> {billingInfo.billing.stripe_subscription_id ? "set" : "—"}
                        </div>

                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed #eee" }}>
                          <b>Rate limits (effective):</b>{" "}
                          {billingInfo.effective_rate_limits ? (
                            <span>
                              {billingInfo.effective_rate_limits.per_minute}/min &nbsp;·&nbsp; {billingInfo.effective_rate_limits.per_day}/day
                            </span>
                          ) : (
                            "—"
                          )}
                          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                            Company config: {billingInfo.company_rate_limits?.per_minute ?? "—"}/min · {billingInfo.company_rate_limits?.per_day ?? "—"}/day
                            {"  "} | Plan cap:{" "}
                            {billingInfo.plan_rate_limits?.per_minute ? `${billingInfo.plan_rate_limits.per_minute}/min` : "—"} ·{" "}
                            {billingInfo.plan_rate_limits?.per_day ? `${billingInfo.plan_rate_limits.per_day}/day` : "—"}
                          </div>
                        </div>

                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          Updated: {billingInfo.billing.updated_at ? new Date(billingInfo.billing.updated_at).toLocaleString() : "—"}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                      After Checkout completes, Stripe Webhooks will update <code>company_billing</code> automatically.
                    </div>
                  </div>
                </Card>
              )}

              {tab === "test-chat" && (
                <Card title="Test Chat">
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    <button
                      onClick={testGetToken}
                      style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}
                    >
                      Get Token
                    </button>
                    <button
                      onClick={testStartConversation}
                      style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                    >
                      Start Conversation
                    </button>
                    <button
                      onClick={() => setTestLog([])}
                      style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                    >
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
                      <button
                        onClick={testSend}
                        disabled={testSending}
                        style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}
                      >
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
                    <button
                      onClick={() => setKbText("")}
                      style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
                    >
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
                      <input
                        value={kbTitle}
                        onChange={(e) => setKbTitle(e.target.value)}
                        placeholder="e.g. FAQ, About us, Pricing"
                        style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Content</div>
                      <textarea
                        value={kbText}
                        onChange={(e) => setKbText(e.target.value)}
                        placeholder="Paste website text, FAQ, product descriptions..."
                        style={{ width: "100%", minHeight: 220, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        onClick={ingestKnowledge}
                        disabled={kbIngesting}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 12,
                          border: "1px solid #111",
                          background: "#111",
                          color: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        {kbIngesting ? "Embedding…" : "Add to Knowledge Base"}
                      </button>

                      <button
                        onClick={() => setTab("test-chat")}
                        style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                      >
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
                <Card
                  title="Leads Dashboard"
                  right={
                    <button
                      onClick={loadLeads}
                      style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
                    >
                      Refresh
                    </button>
                  }
                >
                  <div style={{ opacity: 0.75 }}>Leads UI unverändert – bleibt wie bei dir im Projekt.</div>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Toast */}
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
