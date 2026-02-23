"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, UI } from "./ui";
import { fetchJson } from "./api";
import type { IntegrationProvider, IntegrationRow } from "./types";

const PROVIDERS: Array<{
  key: IntegrationProvider;
  label: string;
  subtitle: string;
}> = [
  { key: "google_calendar", label: "Google Calendar", subtitle: "Busy-time pull + enterprise sync (webhooks later)" },
  { key: "microsoft_calendar", label: "Microsoft Outlook / 365", subtitle: "Busy-time pull + enterprise sync (subscriptions later)" },
  { key: "hubspot", label: "HubSpot", subtitle: "CRM sync: leads → contacts/deals (logic later, OAuth now)" },
  { key: "calendly", label: "Calendly", subtitle: "Connect account (OAuth now). Optional mirror/sync later." },
];

function toneForStatus(s: string): "neutral" | "success" | "danger" | "info" {
  const v = String(s || "").toLowerCase();
  if (v === "connected") return "success";
  if (v === "revoked") return "neutral";
  if (v === "error") return "danger";
  return "info";
}

export default function TabIntegrations(props: { companyId: string; setToast: (s: string) => void }) {
  const { companyId, setToast } = props;

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const byProvider = useMemo(() => {
    const m = new Map<string, IntegrationRow>();
    for (const r of rows || []) m.set(String(r.provider), r);
    return m;
  }, [rows]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    setErr(null);
    try {
      const { ok, status, json } = await fetchJson(`/api/admin/companies/${companyId}/integrations`, { cache: "no-store" });
      if (!ok) {
        setRows([]);
        setErr(`HTTP ${status}: ${json?.error || "integrations_load_failed"}`);
        return;
      }
      setRows(Array.isArray(json?.integrations) ? json.integrations : []);
    } catch (e: any) {
      setRows([]);
      setErr(e?.message || "network_error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function disconnect(provider: IntegrationProvider) {
    if (!confirm(`Disconnect ${provider}?`)) return;
    try {
      const { ok, status, json } = await fetchJson(`/api/admin/companies/${companyId}/integrations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "disconnect", provider }),
      });
      if (!ok) {
        setToast(`Disconnect failed: HTTP ${status} ${json?.error || ""}`.trim());
        return;
      }
      setToast("Disconnected");
      void load();
    } catch (e: any) {
      setToast(e?.message || "disconnect_failed");
    }
  }

  function connect(provider: IntegrationProvider) {
    const url = `/api/admin/companies/${companyId}/integrations/${provider}/start`;
    window.location.href = url;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card
        title="Integrations"
        subtitle="Connect enterprise providers. OAuth is unified; advanced sync logic comes next (Google/Microsoft busy-time first)."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={load} variant="secondary" disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>
        }
      >
        {err ? (
          <div style={{ border: "1px solid #FECACA", background: "#FEF2F2", padding: 12, borderRadius: 14, color: "#991B1B", fontSize: 13.5 }}>
            {err}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          {PROVIDERS.map((p) => {
            const row = byProvider.get(p.key);
            const status = row?.status || "not_connected";
            const tone = status === "not_connected" ? "neutral" : toneForStatus(status);

            return (
              <div
                key={p.key}
                style={{
                  border: `1px solid ${UI.border}`,
                  borderRadius: 16,
                  padding: 12,
                  background: "#fff",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "grid", gap: 4, minWidth: 260 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 1000, color: UI.text }}>{p.label}</div>
                      <Badge text={status === "not_connected" ? "not connected" : String(status)} tone={tone as any} />
                    </div>
                    <div style={{ fontSize: 13, color: UI.text2, lineHeight: 1.45 }}>{p.subtitle}</div>
                    {row?.account_email ? <div style={{ fontSize: 12.5, color: UI.text3 }}>Account: {row.account_email}</div> : null}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {!row ? (
                      <Button onClick={() => connect(p.key)} variant="primary">
                        Connect
                      </Button>
                    ) : (
                      <>
                        <Button onClick={() => connect(p.key)} variant="secondary">
                          Reconnect
                        </Button>
                        <Button onClick={() => disconnect(p.key)} variant="danger">
                          Disconnect
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}