"use client";

import { useEffect, useMemo, useState } from "react";

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
  stripe_customer_id?: string | null;
};

type UsageState = {
  minute_count: number;
  day_count: number;
  reset_minute: string | null;
  reset_day: string | null;
};

function formatErr(e: string) {
  // kurze, saubere DE-Messages
  switch (e) {
    case "no_stripe_customer":
      return "Stripe-Portal ist erst nach dem ersten Checkout verfügbar.";
    case "payment_required":
      return "Bitte zuerst einen Plan buchen, um den Chat zu nutzen.";
    case "invalid_or_inactive_price":
      return "Dieser Tarif ist aktuell nicht buchbar (Preis/Plan nicht aktiv).";
    case "missing_app_url":
      return "APP-URL fehlt in Vercel ENV (NEXT_PUBLIC_APP_URL).";
    case "checkout_failed":
      return "Checkout konnte nicht gestartet werden. Bitte erneut versuchen.";
    case "portal_failed":
      return "Portal konnte nicht geöffnet werden. Bitte erneut versuchen.";
    default:
      return e;
  }
}

function secondsUntil(iso: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.ceil((t - Date.now()) / 1000));
}

function fmtCountdown(sec: number | null) {
  if (sec === null) return "-";
  if (sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export default function BillingClient(props: {
  companyId: string;
  plans: BillingPlan[];
  billing: BillingStatus | null;
}) {
  const { companyId, plans, billing } = props;

  const activePlanKey = billing?.plan_key ?? null;
  const status = billing?.status ?? "none";
  const hasStripeCustomer = !!String(billing?.stripe_customer_id || "").trim();

  const [loadingPrice, setLoadingPrice] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [usage, setUsage] = useState<UsageState | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const sortedPlans = useMemo(() => {
    const order = ["starter", "growth", "pro"];
    return [...plans].sort((a, b) => order.indexOf(a.plan_key) - order.indexOf(b.plan_key));
  }, [plans]);

  async function refreshUsage() {
    setUsageLoading(true);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/usage`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "usage_failed");
      setUsage({
        minute_count: Number(json?.minute_count ?? 0),
        day_count: Number(json?.day_count ?? 0),
        reset_minute: json?.reset_minute ?? null,
        reset_day: json?.reset_day ?? null,
      });
    } catch {
      // usage ist nice-to-have, kein hard error
    } finally {
      setUsageLoading(false);
    }
  }

  useEffect(() => {
    refreshUsage();
    const t = setInterval(refreshUsage, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

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
      setError(formatErr(e?.message || String(e)));
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
      setError(formatErr(e?.message || String(e)));
      setLoadingPortal(false);
    }
  }

  const activePlan = useMemo(
    () => sortedPlans.find((p) => p.plan_key === activePlanKey) || null,
    [sortedPlans, activePlanKey]
  );

  const effLimits = useMemo(() => {
    const rl = activePlan?.entitlements_json?.rate_limits || {};
    return {
      per_minute: rl?.per_minute ?? null,
      per_day: rl?.per_day ?? null,
    };
  }, [activePlan]);

  const secMin = secondsUntil(usage?.reset_minute ?? null);
  const secDay = secondsUntil(usage?.reset_day ?? null);

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

        {/* Usage */}
        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="font-medium text-gray-900">Usage</div>
            <div className="text-xs text-gray-500">{usageLoading ? "aktualisiere..." : "live"}</div>
          </div>

          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div className="rounded-md bg-white p-3">
              <div className="text-xs text-gray-500">Diese Minute</div>
              <div className="mt-1 text-sm text-gray-900">
                {usage?.minute_count ?? 0}
                {effLimits.per_minute ? ` / ${effLimits.per_minute}` : ""}
                <span className="ml-2 text-xs text-gray-500">
                  Reset in {fmtCountdown(secMin)}
                </span>
              </div>
            </div>

            <div className="rounded-md bg-white p-3">
              <div className="text-xs text-gray-500">Heute</div>
              <div className="mt-1 text-sm text-gray-900">
                {usage?.day_count ?? 0}
                {effLimits.per_day ? ` / ${effLimits.per_day}` : ""}
                <span className="ml-2 text-xs text-gray-500">
                  Reset in {fmtCountdown(secDay)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-500">
            Hinweis: Usage zählt pro Chat-Request (Minute/Tag Buckets).
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={openPortal}
            disabled={loadingPortal || !hasStripeCustomer}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
            title={!hasStripeCustomer ? "Portal erst nach erstem Checkout verfügbar" : ""}
          >
            {loadingPortal ? "Öffne Portal..." : "Abo verwalten (Stripe Portal)"}
          </button>

          {!hasStripeCustomer ? (
            <div className="self-center text-xs text-gray-500">
              Portal wird nach dem ersten Checkout freigeschaltet.
            </div>
          ) : null}
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
                    disabled={disabled || loadingPrice === priceId || isCurrent}
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
