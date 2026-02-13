"use client";

import { useEffect, useMemo, useState } from "react";

type Lead = {
  id: string;
  company_id: string;
  conversation_id: string;

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

function bandPill(band: string) {
  const bg = band === "hot" ? "#111" : band === "warm" ? "#fff" : "#fafafa";
  const color = band === "hot" ? "#fff" : "#111";
  const border = band === "warm" ? "1px solid #111" : "1px solid #eee";
  return { background: bg, color, border };
}

function fmt(dt: string | null | undefined) {
  if (!dt) return "-";
  const t = new Date(dt);
  if (Number.isNaN(t.getTime())) return "-";
  return t.toLocaleString();
}

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

export default function GlobalInboxPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [band, setBand] = useState<"all" | "cold" | "warm" | "hot">("all");
  const [status, setStatus] = useState<"all" | "new" | "contacted" | "closed">("all");
  const [limit, setLimit] = useState(300);

  async function load() {
    setLoading(true);

    const params = new URLSearchParams();
    const qTrim = q.trim();
    if (qTrim) params.set("q", qTrim);
    params.set("band", band);
    params.set("status", status);
    params.set("limit", String(limit));

    const res = await fetch(`/api/admin/leads?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setToast(json.error || "load_failed");
      return;
    }

    setLeads(Array.isArray(json.leads) ? json.leads : []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c: any = { cold: 0, warm: 0, hot: 0, new: 0, contacted: 0, closed: 0 };
    for (const l of leads) {
      c[l.score_band] = (c[l.score_band] || 0) + 1;
      c[l.status] = (c[l.status] || 0) + 1;
    }
    return c as { cold: number; warm: number; hot: number; new: number; contacted: number; closed: number };
  }, [leads]);

  const sortedLeads = useMemo(() => {
    // Already should come sorted by API, but keep UI stable: last_touch desc
    return [...leads].sort((a, b) => {
      const ta = new Date(a.last_touch_at || a.updated_at || a.created_at).getTime();
      const tb = new Date(b.last_touch_at || b.updated_at || b.created_at).getTime();
      return tb - ta;
    });
  }, [leads]);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Owner</div>
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
              whiteSpace: "nowrap",
            }}
          >
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
            placeholder="Search name/email/phone/conversation/use_case..."
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              width: 520,
              maxWidth: "100%",
            }}
          />

          <select
            value={band}
            onChange={(e) => setBand(e.target.value as any)}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
          >
            <option value="all">All bands</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
          >
            <option value="all">All status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
          >
            <option value="50">Limit 50</option>
            <option value="100">Limit 100</option>
            <option value="300">Limit 300</option>
            <option value="500">Limit 500</option>
          </select>

          <button
            onClick={load}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
          >
            Apply
          </button>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {loading ? (
            <Card title="Loading">Fetching leads...</Card>
          ) : sortedLeads.length === 0 ? (
            <Card title="No leads">No leads found.</Card>
          ) : (
            sortedLeads.map((l) => {
              const qj = l.qualification_json || {};
              const useCase = safeStr(qj.use_case) || "-";
              const timeline = safeStr(qj.timeline) || "unknown";
              const action = safeStr(qj.requested_action) || "unknown";
              const role = safeStr(qj.role) || "unknown";
              const budget = safeStr(qj.budget_band) || "unknown";

              return (
                <Card
                  key={l.id}
                  title={`${l.score_band.toUpperCase()} | Score ${l.score_total} | Intent ${l.intent_score}`}
                  right={
                    <span style={{ padding: "6px 10px", borderRadius: 999, ...bandPill(l.score_band) }}>
                      {l.score_band}
                    </span>
                  }
                >
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Chip text={`Company: ${l.company_id}`} />
                      <Chip text={`State: ${l.lead_state}`} />
                      <Chip text={`Status: ${l.status}`} />
                      <Chip text={`Last touch: ${fmt(l.last_touch_at)}`} />
                    </div>

                    <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.6 }}>
                      <div>
                        <b>Use case:</b> {useCase}
                      </div>
                      <div>
                        <b>Signals:</b> timeline: {timeline} · action: {action} · role: {role} · budget: {budget}
                      </div>
                      <div>
                        <b>Contact:</b> {(l.email || "-") + " / " + (l.phone || "-")}
                      </div>
                      <div style={{ opacity: 0.75, marginTop: 6 }}>
                        <b>Conversation:</b> <code>{l.conversation_id}</code>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <a
                        href={`/admin/companies/${l.company_id}/conversations/${l.conversation_id}`}
                        style={{
                          display: "inline-block",
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          background: "#fff",
                          textDecoration: "none",
                          color: "#111",
                        }}
                      >
                        Open conversation
                      </a>

                      <a
                        href={`/admin/companies/${l.company_id}/leads`}
                        style={{
                          display: "inline-block",
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #ddd",
                          background: "#fff",
                          textDecoration: "none",
                          color: "#111",
                        }}
                      >
                        Company leads
                      </a>
                    </div>
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
