// app/admin/companies/[id]/_components/UsageDashboard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Button } from "./ui";

type SeriesPoint = { day: string; chats: number; leads: number; qualified: number };

export type AnalyticsResponse = {
  company_id: string;
  generated_at: string;
  kpis: {
    chats_7d: number;
    chats_14d: number;
    chats_30d: number;

    leads_7d: number;
    leads_14d: number;
    leads_30d: number;

    qualified_7d: number;
    qualified_14d: number;
    qualified_30d: number;

    lead_per_chat_30d_pct: number;
    qualified_per_lead_30d_pct: number;
  };
  trends: {
    chats_7d_pct_change: number;
    leads_7d_pct_change: number;
    qualified_7d_pct_change: number;
  };
  series_14d: SeriesPoint[];
};

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat().format(n);
}
function fmtRate(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}
function fmtTrend(n: number) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(0)}%`;
}

function Sparkline({ values }: { values: number[] }) {
  const w = 140;
  const h = 34;
  const pad = 3;

  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);

  const points = values
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
      const y = pad + ((max - v) * (h - pad * 2)) / Math.max(1e-9, max - min);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ color: "#111" }}>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}

function KpiCard(props: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: string;
  spark?: number[];
}) {
  return (
    <Card title={props.title} subtitle={props.subtitle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{props.value}</div>
          {props.trend ? <div style={{ marginTop: 4, fontSize: 12.5, color: "#555" }}>vs prev 7d: {props.trend}</div> : null}
        </div>
        {props.spark ? (
          <div style={{ opacity: 0.9, marginTop: 2 }}>
            <Sparkline values={props.spark} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default function UsageDashboard(props: { companyId: string; setToast?: (s: string) => void }) {
  const { companyId, setToast } = props;
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/analytics`, { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`analytics_failed_${res.status}${t ? `: ${t}` : ""}`);
      }
      const json = (await res.json()) as AnalyticsResponse;
      setData(json);
      if (setToast) setToast("Analytics updated");
    } catch (e: any) {
      setErr(e?.message || "analytics_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const sparkChats = useMemo(() => data?.series_14d.map((x) => x.chats) || [], [data]);
  const sparkLeads = useMemo(() => data?.series_14d.map((x) => x.leads) || [], [data]);
  const sparkQualified = useMemo(() => data?.series_14d.map((x) => x.qualified) || [], [data]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Usage & Analytics</div>
          <div style={{ marginTop: 2, fontSize: 13, color: "#666" }}>Chats, leads and conversion trends (last 30 days).</div>
        </div>
        <Button onClick={load} variant="secondary">
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card title="Loading" subtitle="Fetching analytics…">
          <div style={{ fontSize: 13.5, color: "#666" }}>Please wait.</div>
        </Card>
      ) : err ? (
        <Card title="Analytics error" subtitle="Could not load analytics.">
          <div style={{ fontSize: 12.5, color: "#a00", whiteSpace: "pre-wrap" }}>{err}</div>
        </Card>
      ) : !data ? (
        <Card title="No data" subtitle="Nothing to show yet." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
            <KpiCard
              title="Chats (7d)"
              value={fmtNum(data.kpis.chats_7d)}
              subtitle={`30d: ${fmtNum(data.kpis.chats_30d)}`}
              trend={fmtTrend(data.trends.chats_7d_pct_change)}
              spark={sparkChats}
            />
            <KpiCard
              title="Leads (7d)"
              value={fmtNum(data.kpis.leads_7d)}
              subtitle={`30d: ${fmtNum(data.kpis.leads_30d)}`}
              trend={fmtTrend(data.trends.leads_7d_pct_change)}
              spark={sparkLeads}
            />
            <KpiCard
              title="Qualified (7d)"
              value={fmtNum(data.kpis.qualified_7d)}
              subtitle={`30d: ${fmtNum(data.kpis.qualified_30d)}`}
              trend={fmtTrend(data.trends.qualified_7d_pct_change)}
              spark={sparkQualified}
            />
            <KpiCard
              title="Conversion (30d)"
              value={fmtRate(data.kpis.qualified_per_lead_30d_pct)}
              subtitle={`Lead/Chat (30d): ${fmtRate(data.kpis.lead_per_chat_30d_pct)}`}
            />
          </div>

          <Card
            title="Daily breakdown (14d)"
            subtitle={`Updated: ${new Date(data.generated_at).toLocaleString()}`}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 720 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                    <th style={{ padding: "8px 6px" }}>Day</th>
                    <th style={{ padding: "8px 6px" }}>Chats</th>
                    <th style={{ padding: "8px 6px" }}>Leads</th>
                    <th style={{ padding: "8px 6px" }}>Qualified</th>
                    <th style={{ padding: "8px 6px" }}>Qualified/Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {data.series_14d.map((row) => {
                    const rate = row.leads > 0 ? (row.qualified / row.leads) * 100 : 0;
                    return (
                      <tr key={row.day} style={{ borderBottom: "1px solid #f2f2f2" }}>
                        <td style={{ padding: "8px 6px", fontWeight: 600 }}>{row.day}</td>
                        <td style={{ padding: "8px 6px" }}>{fmtNum(row.chats)}</td>
                        <td style={{ padding: "8px 6px" }}>{fmtNum(row.leads)}</td>
                        <td style={{ padding: "8px 6px" }}>{fmtNum(row.qualified)}</td>
                        <td style={{ padding: "8px 6px" }}>{fmtRate(rate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#666" }}>
              “Qualified” is derived from <code>qualification_json</code> (qualified/status/stage). We can align it 1:1 to your scoring rules anytime.
            </div>
          </Card>
        </>
      )}
    </div>
  );
}