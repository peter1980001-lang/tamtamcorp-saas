"use client";

import { useEffect, useMemo, useState } from "react";

type InboxLead = {
  id: string;
  company_id: string;
  company_name: string | null;
  conversation_id: string;

  lead_state: string;
  status: string;

  score_total: number;
  intent_score: number;
  score_band: "cold" | "warm" | "hot";

  name: string | null;
  email: string | null;
  phone: string | null;

  qualification_json: any;
  consents_json: any;

  last_touch_at: string;
  created_at: string;
};

function Card(props: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 16, background: "#fff", boxShadow: "0 1px 0 rgba(0,0,0,0.03)" }}>
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
    <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: 999, border: "1px solid #eee", background: "#fafafa", fontSize: 12, marginRight: 8, marginBottom: 8 }}>
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

export default function GlobalInboxPage() {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [items, setItems] = useState<InboxLead[]>([]);

  const [band, setBand] = useState<"all" | "hot" | "warm" | "cold">("all");
  const [status, setStatus] = useState<"all" | "new" | "contacted" | "closed">("all");
  const [state, setState] = useState<"all" | "discovery" | "qualifying" | "committed" | "handoff">("all");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);

    const params = new URLSearchParams();
    if (band !== "all") params.set("band", band);
    if (status !== "all") params.set("status", status);
    if (state !== "all") params.set("state", state);
    if (q.trim()) params.set("q", q.trim());
    params.set("limit", "200");

    const res = await fetch(`/api/admin/leads?${params.toString()}`);
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setToast(json.error || "load_failed");
      return;
    }
    setItems(json.leads || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c: any = { hot: 0, warm: 0, cold: 0, new: 0, contacted: 0, closed: 0 };
    for (const l of items) {
      c[l.score_band] = (c[l.score_band] || 0) + 1;
      c[l.status] = (c[l.status] || 0) + 1;
    }
    return c as { hot: number; warm: number; cold: number; new: number; contacted: number; closed: number };
  }, [items]);

  function openLead(l: InboxLead) {
    // Reuse your existing per-company lead viewer URL pattern:
    // /admin/companies/[id]/leads (and you already click lead id there)
    // Best: link directly to conversation viewer once you have that path stable.
    window.location.href = `/admin/companies/${l.company_id}/leads?open=${encodeURIComponent(l.id)}`;
  }

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

          <button onClick={load} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name/email/phone/conversation_id..."
            style={{ flex: 1, minWidth: 280, padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
          />
          <button onClick={load} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}>
            Search
          </button>

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

          <select value={state} onChange={(e) => setState(e.target.value as any)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}>
            <option value="all">All states</option>
            <option value="discovery">discovery</option>
            <option value="qualifying">qualifying</option>
            <option value="committed">committed</option>
            <option value="handoff">handoff</option>
          </select>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
          {loading ? (
            <Card title="Loading">Fetching global inbox...</Card>
          ) : items.length === 0 ? (
            <Card title="Empty Inbox">No leads found yet.</Card>
          ) : (
            items.map((l) => {
              const useCase = (l.qualification_json || {}).use_case || "-";
              const timeline = (l.qualification_json || {}).timeline || "unknown";
              return (
                <Card
                  key={l.id}
                  title={`${(l.company_name || "Company").toString()} | ${l.score_band.toUpperCase()} ${l.score_total}`}
                  right={<span style={{ padding: "6px 10px", borderRadius: 999, ...pill(l.score_band) }}>{l.score_band}</span>}
                >
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Chip text={`State: ${l.lead_state}`} />
                      <Chip text={`Status: ${l.status}`} />
                      <Chip text={`Created: ${new Date(l.created_at).toLocaleString()}`} />
                      <Chip text={`Last: ${new Date(l.last_touch_at).toLocaleString()}`} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
                        <div><b>Name:</b> {l.name || "-"}</div>
                        <div><b>Email:</b> {l.email || "-"}</div>
                        <div><b>Phone:</b> {l.phone || "-"}</div>
                        <div><b>Conversation:</b> <code>{l.conversation_id}</code></div>
                      </div>

                      <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
                        <div><b>use_case:</b> {useCase}</div>
                        <div><b>timeline:</b> {timeline}</div>
                        <div><b>intent:</b> {l.intent_score}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        onClick={() => openLead(l)}
                        style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}
                      >
                        Open
                      </button>

                      <a
                        href={`/admin/companies/${l.company_id}`}
                        style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer", textDecoration: "none", color: "#111" }}
                      >
                        Company
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
            style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", padding: "10px 14px", borderRadius: 999, fontSize: 13 }}
            onClick={() => setToast(null)}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
