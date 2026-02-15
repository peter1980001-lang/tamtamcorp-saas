// app/(auth)/signup/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type EnsureCompanyResp =
  | { company_id: string; created: boolean }
  | { error: string };

function getSiteUrl() {
  // prefer explicit env (prod), fallback to window origin
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && envUrl.startsWith("http")) return envUrl.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function ensureCompany(optionalCompanyName?: string) {
    const res = await fetch("/api/onboarding/ensure-company", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ company_name: optionalCompanyName || undefined }),
    });

    const data = (await res.json()) as EnsureCompanyResp;
    if (!res.ok) throw new Error("error" in data ? data.error : "Ensure-company failed");
    if ("error" in data) throw new Error(data.error);
    return data;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedCompany = companyName.trim();

      if (!trimmedEmail || !password || !trimmedCompany) {
        setMsg("Please fill email, password, and company name.");
        return;
      }

      const siteUrl = getSiteUrl();
      const emailRedirectTo = siteUrl ? `${siteUrl}/auth/callback` : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo,
        },
      });

      if (error) throw error;

      // Confirmation ON -> no session -> user must confirm then login
      if (!data.session) {
        setMsg("Account created. Please confirm your email, then log in to finish onboarding.");
        router.push("/login");
        return;
      }

      // Confirmation OFF -> session exists -> onboard now
      const ensured = await ensureCompany(trimmedCompany);
      router.push(`/admin/companies/${ensured.company_id}?tab=billing`);
    } catch (err: any) {
      setMsg(err?.message ?? "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: "48px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Create account</h1>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        Create your user and company in one flow.
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
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Company name</span>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="TamTamCorp"
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
          {loading ? "Creating..." : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/login")}
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          I already have an account
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
