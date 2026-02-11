"use client";

import { useMemo, useState } from "react";

type BillingPlan = {
  plan_key: string;
  name: string;
  stripe_price_id: string | null;
  entitlements_json: any;
  is_active: boolean;
};

type BillingStatus = {
  status: string;
  plan_key: string | null;
  stripe_price_id: string | null;
  current_period_end: string | null;
};

export default function BillingClient(props: {
  companyId: string;
  plans: BillingPlan[];
  billing: BillingStatus | null;
}) {
  const { companyId, plans, billing } = props;

  const activePlanKey = billing?.plan_key ?? null;
  const status = billing?.status ?? "none";

  const [loadingPrice, setLoadingPrice] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedPlans = useMemo(() => {
    const order = ["starter", "growth", "pro"];
    return [...plans].sort((a, b) => order.indexOf(a.plan_key) - order.indexOf(b.plan_key));
  }, [plans]);

  async function startCheckout(price_id: string) {
    setError(null);
    setLoadingPrice(price_id);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, price_id }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "checkout_failed");

      const url = String(json?.url || "");
      if (!url) throw new Error("missing_checkout_url");

      window.location.href = url;
    } catch (e: any) {
      setError(e?.message || String(e));
      setLoadingPrice(null);
    }
  }

  async function openPortal() {
    setError(null);
    setLoadingPortal(true);

    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "portal_failed");

      const url = String(json?.url || "");
      if (!url) throw new Error("missing_portal_url");

      window.location.href = url;
    } catch (e: any) {
      setError(e?.message || String(e));
      setLoadingPortal(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-4">
        <div className="text-lg font-semibold">Abonnement-Status</div>
        <div className="mt-2 text-sm text-gray-600">
          Status: <span className="font-medium text-gray-900">{status}</span>
          {activePlanKey ? (
            <>
              {" "}
              · Plan: <span className="font-medium text-gray-900">{activePlanKey}</span>
            </>
          ) : null}
          {billing?.current_period_end ? (
            <>
              {" "}
              · Laufzeit bis:{" "}
              <span className="font-medium text-gray-900">
                {new Date(billing.current_period_end).toLocaleString()}
              </span>
            </>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={openPortal}
            disabled={loadingPortal}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {loadingPortal ? "Öffne Portal..." : "Abo verwalten (Stripe Portal)"}
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}
      </div>

      <div className="rounded-xl border p-4">
        <div className="text-lg font-semibold">Pläne</div>
        <div className="mt-1 text-sm text-gray-600">
          Upgrade/Downgrade startet über Stripe Checkout. Plan-Zuordnung läuft über `price_id` → `billing_plans`.
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {sortedPlans.map((p) => {
            const priceId = p.stripe_price_id;
            const isCurrent = activePlanKey === p.plan_key;
            const disabled = !p.is_active || !priceId;

            const rl = p.entitlements_json?.rate_limits || {};
            const perMin = rl?.per_minute ?? "-";
            const perDay = rl?.per_day ?? "-";

            return (
              <div key={p.plan_key} className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold">{p.name}</div>
                  {isCurrent ? (
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                      aktiv
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 text-sm text-gray-600">
                  Rate Limits: <span className="text-gray-900">{perMin}</span>/min ·{" "}
                  <span className="text-gray-900">{perDay}</span>/Tag
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => priceId && startCheckout(priceId)}
                    disabled={disabled || loadingPrice === priceId}
                    className="w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {disabled
                      ? "Preis-ID fehlt"
                      : loadingPrice === priceId
                      ? "Weiter zu Checkout..."
                      : isCurrent
                      ? "Aktueller Plan"
                      : "Plan wählen"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
