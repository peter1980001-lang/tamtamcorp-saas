"use client";

import { useEffect, useMemo, useState } from "react";

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
  last_touch_at: string;
  created_at: string;
  updated_at: string;
  companies?: { id: string; name: string } | null;
};

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

function pill(band: string) {
  const bg = band === "hot" ? "#111" : band === "warm" ? "#fff" : "#fafafa";
  const color = band === "hot" ? "#fff" : "#111";
  const border = band === "warm" ? "1px solid #111" : "1px solid #eee";
  return { background: bg, color, border };
}

export default function AdminInboxPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [band, setBand] = useState<"all" | "cold" | "warm" | "hot">("all");
  const [status, setStatus] = useState<"all" | "new" | "contacted" | "closed">("all");
  const [leadState, setLeadState] = useState<"all" | "discovery" | "qualifying" | "committed" | "handoff">("all");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("band", band);
    params.set("status", status);
    params.set("lead_state", leadState);
    if (q.trim()) params.set("q", q.trim());
    params.set("limit", "200");

    const res = await fetch(`/api/admin/inbox/leads?${params.toString()}`);
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setToast(json.error || "load_failed");
      return;
    }
    setLeads(json.leads || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band, status, leadState]);

  const counts = useMemo(() => {
    const c: any = { cold: 0, warm: 0, hot: 0, new: 0, contacted: 0, closed: 0 };
    for (const l of leads) {
      c[l.score_band] = (c[l.score_band] || 0) + 1;
      c[l.status] = (c[l.status] || 0) + 1;
    }
    return c as { cold: number; warm: number; hot: number; new: number; contacted: number; closed: number };
  }, [leads]);

  async function updateLead(lead_id: string, patch: { status?: string; lead_state?: string }) {
    const res = await fetch(`/api/admin/inbox/leads`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id, ...patch }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast(json.error || "update_failed");
      return;
    }

    setLeads((prev) => prev.map((x) => (x.id === lead_id ? { ...(x as any), ...(json.lead as any) } : x)));
    setToast("Saved");
  }

  const list = useMemo(() => {
    if (!q.trim()) return leads;
    const s = q.trim().toLowerCase();
    return leads.filter((l) => {
      const companyName = String(l.companies?.name || "").toLowerCase();
      const useCase = String(l.qualification_json?.use_case || "").toLowerCase();
      const email = String(l.email || "").toLowerCase();
      const phone = String(l.phone || "").toLowerCase();
      const name = String(l.name || "").toLowerCase();
      const cid = String(l.conversation_id || "").toLowerCase();
      return (
        companyName.includes(s) ||
        useCase.includes(s) ||
        email.includes(s) ||
        phone.includes(s) ||
        name.includes(s) ||
        cid.includes(s)
      );
    });
  }, [leads, q]);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Admin</div>
            <h1 style={{ fontSize: 28, margin: "4px 0 0" }}>Global Inbox</h1>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Chip text={`Hot: ${counts.hot}`} />
              <Chip text={`Warm: ${counts.warm}`} />
              <Chip text={`Cold: ${counts.cold}`} />
              <Chip text={`New: ${counts.new}`} />
              <Chip text={`Contacted: ${counts.contacted}`} />
              <Chip text={`Closed: ${counts.closed}`} />
            </div>
          </div>

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
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name/email/phone/company/use_case/conversation..."
            style={{ flex: 1, minWidth: 280, padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
          />

          <select value={band} onChange={(e) => setBand(e.target.value as any)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}>
            <option value="all">All bands</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}>
            <option value="all">All status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>

          <select value={leadState} onChange={(e) => setLeadState(e.target.value as any)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}>
            <option value="all">All states</option>
            <option value="discovery">discovery</option>
            <option value="qualifying">qualifying</option>
            <option value="committed">committed</option>
            <option value="handoff">handoff</option>
          </select>

          <button
            onClick={load}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
          {loading ? (
            <Card title="Loading">Fetching leads...</Card>
          ) : list.length === 0 ? (
            <Card title="No Leads">No leads found.</Card>
          ) : (
            list.map((l) => {
              const companyName = l.companies?.name || l.company_id;
              const useCase = l.qualification_json?.use_case || "-";
              const timeline = l.qualification_json?.timeline || "unknown";
              const action = l.qualification_json?.requested_action || "none";

              const openHref = `/admin/companies/${l.company_id}/conversations/${l.conversation_id}`;

              return (
                <Card
                  key={l.id}
                  title={`${companyName} | ${l.score_band.toUpperCase()} ${l.score_total}`}
                  right={
                    <span style={{ padding: "6px 10px", borderRadius: 999, ...pill(l.score_band) }}>{l.score_band}</span>
                  }
                >
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Chip text={`State: ${l.lead_state}`} />
                      <Chip text={`Status: ${l.status}`} />
                      <Chip text={`Created: ${new Date(l.created_at).toLocaleString()}`} />
                      <Chip text={`Last touch: ${new Date(l.last_touch_at).toLocaleString()}`} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.7 }}>
                        <div><b>Name:</b> {l.name || "-"}</div>
                        <div><b>Email:</b> {l.email || "-"}</div>
                        <div><b>Phone:</b> {l.phone || "-"}</div>
                        <div><b>Conversation:</b> <code>{l.conversation_id}</code></div>
                      </div>

                      <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.7 }}>
                        <div><b>use_case:</b> {useCase}</div>
                        <div><b>timeline:</b> {timeline}</div>
                        <div><b>action:</b> {action}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <select
                        value={l.status}
                        onChange={(e) => updateLead(l.id, { status: e.target.value })}
                        style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
                      >
                        <option value="new">new</option>
                        <option value="contacted">contacted</option>
                        <option value="closed">closed</option>
                      </select>

                      <select
                        value={l.lead_state}
                        onChange={(e) => updateLead(l.id, { lead_state: e.target.value })}
                        style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
                      >
                        <option value="discovery">discovery</option>
                        <option value="qualifying">qualifying</option>
                        <option value="committed">committed</option>
                        <option value="handoff">handoff</option>
                      </select>

                      <a
                        href={openHref}
                        style={{
                          marginLeft: "auto",
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #111",
                          background: "#fff",
                          color: "#111",
                          textDecoration: "none",
                          display: "inline-block",
                        }}
                      >
                        Open conversation
                      </a>
                    </div>

                    <details>
                      <summary style={{ cursor: "pointer", fontSize: 13, opacity: 0.8 }}>Show qualification and consents</summary>
                      <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 12, background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 12 }}>
                        {JSON.stringify({ qualification_json: l.qualification_json, consents_json: l.consents_json, tags: l.tags }, null, 2)}
                      </pre>
                    </details>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {toast && (
          <div
            style={{
              position: "fixed",
              bottom: 18,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#111",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 999,
              fontSize: 13,
              cursor: "pointer",
            }}
            onClick={() => setToast(null)}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
