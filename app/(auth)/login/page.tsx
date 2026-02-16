// app/(auth)/login/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type EnsureCompanyResp = { company_id: string; created: boolean } | { error: string };

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const nextParam = String(searchParams?.get("next") || "").trim();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function ensureCompany() {
    const res = await fetch("/api/onboarding/ensure-company", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const data = (await res.json()) as EnsureCompanyResp;

    if (!res.ok) {
      const errMsg = "error" in data ? data.error : "Ensure-company failed";
      throw new Error(errMsg);
    }
    if ("error" in data) throw new Error(data.error);

    return data;
  }

  function safeNextUrlOrNull(v: string): string | null {
    // allow only internal paths
    if (!v) return null;
    if (!v.startsWith("/")) return null;
    if (v.startsWith("//")) return null;
    if (v.includes("://")) return null;
    return v;
  }

  async function finishOnboardingAndRedirect() {
    const ensured = await ensureCompany();

    const safeNext = safeNextUrlOrNull(nextParam);
    if (safeNext) {
      router.push(safeNext);
      return;
    }

    router.push(`/admin/companies/${ensured.company_id}?tab=billing`);
  }

  // If user already has a session, finish onboarding (and go to next if provided)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        try {
          await finishOnboardingAndRedirect();
        } catch {
          // do nothing (show login UI if something fails)
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail || !password) {
        setMsg("Please fill email and password.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;

      await finishOnboardingAndRedirect();
    } catch (err: any) {
      setMsg(err?.message ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: "48px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Login</h1>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        Sign in to complete onboarding and open your company.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: 6,
          }}
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/signup")}
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Create a new account
        </button>

        {msg ? (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 12,
              background: "#f7f7f7",
            }}
          >
            {msg}
          </div>
        ) : null}
      </form>
    </div>
  );
}
