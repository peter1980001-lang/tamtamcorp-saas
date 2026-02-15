"use client";

import { useState } from "react";

type Props = {
  companyId: string;
};

type PlanKey = "starter" | "growth" | "pro";

export default function BillingActions({ companyId }: Props) {
  const [loading, setLoading] = useState<null | "trial" | "checkout" | "portal">(null);
  const [error, setError] = useState<string | null>(null);

  async function startTrial(days: number = 14, plan_key: string = "dev_test") {
    setError(null);
    setLoading("trial");
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/start-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, plan_key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "start_trial_failed");

      // keep user on billing tab and trigger refresh via URL
      window.location.href = `/admin/companies/${companyId}?tab=billing&trial=started`;
    } catch (e: any) {
      setError(e?.message ?? "start_trial_failed");
      setLoading(null);
    }
  }

  async function startCheckout(plan_key: PlanKey) {
    setError(null);
    setLoading("checkout");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, plan_key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "checkout_failed");
      if (!data?.url) throw new Error("missing_checkout_url");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message ?? "checkout_failed");
      setLoading(null);
    }
  }

  async function openPortal() {
    setError(null);
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "portal_failed");
      if (!data?.url) throw new Error("missing_portal_url");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message ?? "portal_failed");
      setLoading(null);
    }
  }

  const disabled = !!loading;

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      {/* Trial */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => startTrial(14, "dev_test")}
          disabled={disabled}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {loading === "trial" ? "Starting trial…" : "Start Trial (14 days)"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.7, display: "flex", alignItems: "center" }}>
          Sets <code>company_billing.status=trialing</code> without Stripe.
        </div>
      </div>

      {/* Checkout plans */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => startCheckout("starter")}
          disabled={disabled}
          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
        >
          {loading === "checkout" ? "Loading…" : "Subscribe (Starter)"}
        </button>

        <button
          onClick={() => startCheckout("growth")}
          disabled={disabled}
          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
        >
          {loading === "checkout" ? "Loading…" : "Subscribe (Growth)"}
        </button>

        <button
          onClick={() => startCheckout("pro")}
          disabled={disabled}
          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
        >
          {loading === "checkout" ? "Loading…" : "Subscribe (Pro)"}
        </button>
      </div>

      {/* Portal */}
      <div>
        <button
          onClick={openPortal}
          disabled={disabled}
          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
        >
          {loading === "portal" ? "Opening…" : "Manage Billing (Stripe Portal)"}
        </button>
      </div>

      {error ? <div style={{ color: "crimson", fontSize: 13 }}>{error}</div> : null}
    </div>
  );
}
