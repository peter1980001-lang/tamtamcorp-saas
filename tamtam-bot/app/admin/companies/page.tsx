"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Company = {
  id: string;
  name: string;
  status: string;
  created_at: string;
};

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/companies");
    const json = await res.json();
    setCompanies(json.companies ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 28 }}>Companies</h1>
        <Link
          href="/admin/companies/new"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          + Create Company
        </Link>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : companies.length === 0 ? (
        <p>No companies yet.</p>
      ) : (
        <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 120px", padding: 12, background: "#fafafa", fontWeight: 600 }}>
            <div>Name</div>
            <div>Status</div>
            <div>Created</div>
            <div></div>
          </div>

          {companies.map((c) => (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 120px", padding: 12, borderTop: "1px solid #eee" }}>
              <div>{c.name}</div>
              <div>{c.status}</div>
              <div>{new Date(c.created_at).toLocaleString()}</div>
              <div>
                <Link href={`/admin/companies/${c.id}`} style={{ textDecoration: "none" }}>
                  Open →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
