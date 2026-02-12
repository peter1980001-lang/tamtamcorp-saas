"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Lead = {
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

export default function CompanyLeadsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [filterBand, setFilterBand] = useState<"all" | "cold" | "warm" | "hot">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "new" | "contacted" | "closed">("all");

  async function load() {
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/admin/companies/${id}/leads`);
    const json = await res.json();
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
  }, [id]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filterBand !== "all" && l.score_band !== filterBand) return false;
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      return true;
    });
  }, [leads, filterBand, filterStatus]);

  const counts = useMemo(() => {
    const c: any = { cold: 0, warm: 0, hot: 0, new: 0, contacted: 0, closed: 0 };
    for (const l of leads) {
      c[l.score_band] = (c[l.score_band] || 0) + 1;
      c[l.status] = (c[l.status] || 0) + 1;
    }
    return c as { cold: number; warm: number; hot: number; new: number; contacted: number; closed: number };
  }, [leads]);

  async function updateLead(lead_id: string, patch: { status?: string; lead_state?: string }) {
    if (!id) return;

    const res = await fetch(`/api/admin/companies/${id}/leads`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id, ...patch }),
    });

    const json = await res.json();

    if (!res.ok) {
      setToast(json.error || "update_failed");
      return;
    }

    setLeads((prev) => prev.map((x) => (x.id === lead_id ? json.lead : x)));
    setToast("Saved");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Company Leads</div>
            <h1 style={{ fontSize: 28, margin: "4px 0 0" }}>Leads</h1>
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
          <select
            value={filterBand}
            onChange={(e) => setFilterBand(e.target.value as any)}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
          >
            <option value="all">All bands</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
          >
            <option value="all">All status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
          {loading ? (
            <Card title="Loading">Fetching leads...</Card>
          ) : filtered.length === 0 ? (
            <Card title="No Leads">No leads found for this company yet.</Card>
          ) : (
            filtered.map((l) => (
              <Card
                key={l.id}
                title={`${l.score_band.toUpperCase()} | Score ${l.score_total} | Intent ${l.intent_score}`}
                right={
                  <span style={{ padding: "6px 10px", borderRadius: 999, ...pill(l.score_band) }}>
                    {l.score_band}
                  </span>
                }
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Chip text={`State: ${l.lead_state}`} />
                    <Chip text={`Status: ${l.status}`} />
                    <Chip text={`Channel: ${l.channel || "widget"}`} />
                    <Chip text={`Created: ${new Date(l.created_at).toLocaleString()}`} />
                  </div>

                  <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
                    <div>
                      <b>Name:</b> {l.name || "-"}
                    </div>
                    <div>
                      <b>Email:</b> {l.email || "-"}
                    </div>
                    <div>
                      <b>Phone:</b> {l.phone || "-"}
                    </div>
                    <div>
                      <b>Conversation:</b> <code>{l.conversation_id}</code>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
                  </div>

                  <details>
                    <summary style={{ cursor: "pointer", fontSize: 13, opacity: 0.8 }}>
                      Show qualification and consents
                    </summary>
                    <pre
                      style={{
                        marginTop: 10,
                        whiteSpace: "pre-wrap",
                        fontSize: 12,
                        background: "#fafafa",
                        border: "1px solid #eee",
                        padding: 12,
                        borderRadius: 12,
                      }}
                    >
                      {JSON.stringify(
                        { qualification_json: l.qualification_json, consents_json: l.consents_json, tags: l.tags },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                </div>
              </Card>
            ))
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
