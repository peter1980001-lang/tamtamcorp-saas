"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateCompanyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("localhost:3000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setLoading(true);
    setError(null);
    setResult(null);

    const allowed_domains = domains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);

    const res = await fetch("/api/admin/companies/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, allowed_domains }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error || "failed");
      return;
    }

    setResult(json);
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28 }}>Create Company</h1>

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <label>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Company name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10, width: "100%" }}
            placeholder="e.g. Dreama Cosmetics"
          />
        </label>

        <label>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Allowed domains (comma-separated)</div>
          <input
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10, width: "100%" }}
            placeholder="localhost:3000, dreama.com"
          />
        </label>

        <button
          onClick={onCreate}
          disabled={loading || !name.trim()}
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            width: 220,
          }}
        >
          {loading ? "Creating..." : "Create"}
        </button>

        {error && <div style={{ color: "crimson" }}>{error}</div>}

        {result?.company && (
          <div style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Created ✅</div>
            <div><b>Company ID:</b> {result.company.id}</div>
            <div><b>Public Key:</b> {result.keys.public_key}</div>
            <div><b>Secret Key:</b> {result.keys.secret_key}</div>

            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => router.push(`/admin/companies/${result.company.id}`)}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #111",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Open Company →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
