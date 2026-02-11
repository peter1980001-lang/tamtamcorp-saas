"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // after login cookies/session exist in browser
    router.push("/admin");
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Admin Login</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10 }}
          autoComplete="email"
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10 }}
          autoComplete="current-password"
        />

        <button
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {error && (
          <div style={{ color: "crimson", fontSize: 14 }}>{error}</div>
        )}
      </form>

      <p style={{ marginTop: 14, opacity: 0.7, fontSize: 13 }}>
        Use the Supabase user you created (info@tamtamcorp.online).
      </p>
    </div>
  );
}
