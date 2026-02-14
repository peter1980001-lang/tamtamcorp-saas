"use client";

import { useState } from "react";

type Props = {
  companyId: string;
};

export default function BillingActions({ companyId }: Props) {
  const [loading, setLoading] = useState<null | "checkout" | "portal">(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan_key: "starter" | "growth" | "pro") {
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

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => startCheckout("starter")}
          disabled={!!loading}
          style={{ padding: "10px 14px", borderRadius: 10 }}
        >
          {loading === "checkout" ? "Loading..." : "Start Trial / Subscribe (Starter)"}
        </button>

        <button
          onClick={() => startCheckout("growth")}
          disabled={!!loading}
          style={{ padding: "10px 14px", borderRadius: 10 }}
        >
          {loading === "checkout" ? "Loading..." : "Start Trial / Subscribe (Growth)"}
        </button>

        <button
          onClick={() => startCheckout("pro")}
          disabled={!!loading}
          style={{ padding: "10px 14px", borderRadius: 10 }}
        >
          {loading === "checkout" ? "Loading..." : "Start Trial / Subscribe (Pro)"}
        </button>
      </div>

      <div>
        <button
          onClick={openPortal}
          disabled={!!loading}
          style={{ padding: "10px 14px", borderRadius: 10 }}
        >
          {loading === "portal" ? "Loading..." : "Manage Billing (Stripe Portal)"}
        </button>
      </div>

      {error ? (
        <div style={{ color: "crimson", fontSize: 14 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
