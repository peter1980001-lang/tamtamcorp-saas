// app/admin/login/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type EnsureCompanyResp =
  | { company_id: string; created: boolean }
  | { error: string };

type MeCompaniesResp =
  | {
      companies: Array<{
        company_id: string;
        role: string;
        company: { id: string; name: string };
      }>;
    }
  | { error: string };

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

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
    if (!res.ok) throw new Error("error" in data ? data.error : "Ensure-company failed");
    if ("error" in data) throw new Error(data.error);
    return data;
  }

  async function fetchMyCompanies() {
    const res = await fetch("/api/me/companies", { method: "GET" });
    const data = (await res.json()) as MeCompaniesResp;
    if (!res.ok) throw new Error("error" in data ? data.error : "Me-companies failed");
    if ("error" in data) throw new Error(data.error);
    return data.companies;
  }

  async function redirectToFirstCompanyOrOnboard() {
    const companies = await fetchMyCompanies();
    if (companies.length > 0) {
      router.push(`/admin/companies/${companies[0].company_id}?tab=billing`);
      return;
    }

    const ensured = await ensureCompany();
    router.push(`/admin/companies/${ensured.company_id}?tab=billing`);
  }

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

      await redirectToFirstCompanyOrOnboard();
    } catch (err: any) {
      setMsg(err?.message ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: "48px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Admin Login</h1>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        Sign in and we’ll route you to your company.
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

        {msg ? (
          <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: "#f7f7f7" }}>
            {msg}
          </div>
        ) : null}
      </form>
    </div>
  );
}
