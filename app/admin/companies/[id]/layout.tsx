// app/admin/companies/[id]/layout.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import LogoutButton from "./_components/LogoutButton";
import CompanyTabs from "./_components/CompanyTabs";

const UI = {
  bg: "#F6F7F9",
  border: "#E5E7EB",
  text: "#111827",
  text2: "#6B7280",
  text3: "#9CA3AF",
  radius: 12,
  font: 'system-ui, -apple-system, Segoe UI, Roboto, Inter, "Helvetica Neue", Arial',
};

export default async function CompanyLayout(props: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const { data: company } = await supabaseServer
    .from("companies")
    .select("id,name,status,created_at")
    .eq("id", id)
    .maybeSingle();

  return (
    <div style={{ minHeight: "100vh", background: UI.bg, fontFamily: UI.font, color: UI.text }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 22px 64px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: UI.text3, fontWeight: 650 }}>
              Admin / Companies / <span style={{ color: UI.text2 }}>{company?.name || id}</span>
            </div>

            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 28, margin: 0, letterSpacing: "-0.02em" }}>{company?.name || "Company"}</h1>
              <span
                style={{
                  display: "inline-flex",
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: "#F9FAFB",
                  border: `1px solid ${UI.border}`,
                  fontSize: 12,
                  fontWeight: 650,
                  textTransform: "capitalize",
                  color: UI.text2,
                }}
              >
                {company?.status || "unknown"}
              </span>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 999, border: `1px solid ${UI.border}`, background: "#fff", color: UI.text2, fontSize: 12 }}>
                Company ID:{" "}
                <span style={{ marginLeft: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: UI.text }}>
                  {id}
                </span>
              </span>

              <span style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 999, border: `1px solid ${UI.border}`, background: "#fff", color: UI.text2, fontSize: 12 }}>
                Created:{" "}
                <span style={{ marginLeft: 6, color: UI.text }}>
                  {company?.created_at ? new Date(company.created_at).toLocaleString() : "—"}
                </span>
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/admin/companies"
              style={{
                padding: "10px 12px",
                borderRadius: UI.radius,
                border: `1px solid ${UI.border}`,
                background: "#fff",
                fontSize: 13.5,
                fontWeight: 650,
                color: UI.text,
                textDecoration: "none",
              }}
            >
              Back
            </Link>
            <LogoutButton />
          </div>
        </div>

        {/* ✅ Tabs that ALWAYS work */}
        <CompanyTabs />

        <div style={{ marginTop: 16 }}>{props.children}</div>
      </div>
    </div>
  );
}
