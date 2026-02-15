"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error("missing_supabase_env");
  return createBrowserClient(url, anon);
}

function parseDomains(input: string) {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function SignupPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [companyName, setCompanyName] = useState("");
  const [domains, setDomains] = useState("localhost:3000");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const name = companyName.trim();
    if (!name) return setError("Company name required");
    if (!email.trim()) return setError("Email required");
    if (!password.trim() || password.length < 8) return setError("Password min. 8 characters");

    setLoading(true);

    // 1) Create user (Supabase Auth)
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpErr) {
      setLoading(false);
      return setError(signUpErr.message);
    }

    const session = signUpData.session;

    // IMPORTANT:
    // If your Supabase project has "Confirm email" enabled, session may be null.
    // For MVP: turn off email confirmation OR implement a "verify then login" step.
    if (!session?.access_token) {
      setLoading(false);
      setInfo(
        "Account created. Please verify your email, then log in. (For MVP, disable email confirmation in Supabase Auth to auto-login.)"
      );
      return;
    }

    // 2) Create company + keys + settings + billing trial (server-side)
    const res = await fetch("/api/public/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        company_name: name,
        allowed_domains: parseDomains(domains),
      }),
    });

    const json = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(json?.error || "signup_company_failed");
      return;
    }

    const companyId = String(json.company_id || "");
    if (!companyId) {
      setError("missing_company_id");
      return;
    }

    // Redirect to your admin company detail (billing tab)
    window.location.href = `/admin/companies/${companyId}?tab=billing`;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
        <h1 style={{ fontSize: 28, margin: "8px 0 6px" }}>Create your account</h1>
        <div style={{ opacity: 0.75, marginBottom: 16 }}>
          This creates: user + company + widget keys + 14-day trial (no Stripe required).
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, background: "#fff", border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Company name</div>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. ACME Real Estate"
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Allowed domains (comma-separated)</div>
            <input
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="example.com,www.example.com"
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
            />
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
              Used for widget Origin allowlist (company_keys.allowed_domains).
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Password</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min 8 characters"
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {loading ? "Creating…" : "Create account + start trial"}
          </button>

          {error ? <div style={{ color: "crimson", fontSize: 13 }}>{error}</div> : null}
          {info ? <div style={{ color: "#111", fontSize: 13, opacity: 0.85 }}>{info}</div> : null}
        </form>
      </div>
    </div>
  );
}
