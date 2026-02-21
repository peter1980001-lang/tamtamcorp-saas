"use client";

import { useEffect, useMemo, useState } from "react";
import BillingActions from "../_components/BillingActions";
import { Card, Button, UI } from "./ui";
import { fetchJson } from "./api";

export default function TabBilling(props: { companyId: string; setToast: (s: string) => void }) {
  const { companyId, setToast } = props;

  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function loadBilling() {
    setLoading(true);
    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/billing`, { cache: "no-store" as any });
    setLoading(false);
    if (!ok) return setToast(json?.error || "billing_load_failed");
    setBillingInfo(json);
  }

  useEffect(() => {
    void loadBilling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const status = billingInfo?.billing?.status || billingInfo?.status || "—";
    const planName = billingInfo?.plan?.name || billingInfo?.billing?.plan_key || billingInfo?.plan_key || "—";
    const end = billingInfo?.billing?.current_period_end || billingInfo?.current_period_end || null;
    return { status, planName, periodEnd: end ? new Date(end).toLocaleString() : null };
  }, [billingInfo]);

  return (
    <Card title="Billing" subtitle="Manage your subscription." right={<Button onClick={loadBilling} disabled={loading} variant="secondary">{loading ? "Loading…" : "Refresh"}</Button>}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 12, background: "#fff" }}>
            <div style={{ fontSize: 12.5, color: UI.text2 }}>Status</div>
            <div style={{ fontWeight: 1000, marginTop: 6 }}>{summary.status}</div>
          </div>
          <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 12, background: "#fff" }}>
            <div style={{ fontSize: 12.5, color: UI.text2 }}>Plan</div>
            <div style={{ fontWeight: 1000, marginTop: 6 }}>{summary.planName}</div>
          </div>
          <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 12, background: "#fff" }}>
            <div style={{ fontSize: 12.5, color: UI.text2 }}>Renews</div>
            <div style={{ fontWeight: 1000, marginTop: 6 }}>{summary.periodEnd || "—"}</div>
          </div>
        </div>

        <div style={{ marginTop: 4 }}>
          <BillingActions companyId={companyId as any} />
        </div>
      </div>
    </Card>
  );
}