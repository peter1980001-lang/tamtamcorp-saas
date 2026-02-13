export default function AdminHome() {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.65 }}>Admin</div>
          <h1 style={{ fontSize: 28, margin: "4px 0 0" }}>Dashboard</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Quick access to the most important admin areas.
          </div>
        </div>

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <a
            href="/admin/companies"
            style={{
              textDecoration: "none",
              color: "#111",
              border: "1px solid #eee",
              borderRadius: 16,
              padding: 16,
              background: "#fff",
              boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
              display: "block",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Companies</div>
            <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
              Manage tenants, keys, domains, limits, embed snippet, test chat, knowledge ingest.
            </div>
          </a>

          <a
            href="/admin/inbox"
            style={{
              textDecoration: "none",
              color: "#111",
              border: "1px solid #eee",
              borderRadius: 16,
              padding: 16,
              background: "#fff",
              boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
              display: "block",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Global Inbox</div>
            <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
              View and manage all leads across all companies. Open conversations instantly.
            </div>
          </a>

          <a
            href="/admin/plans"
            style={{
              textDecoration: "none",
              color: "#111",
              border: "1px solid #eee",
              borderRadius: 16,
              padding: 16,
              background: "#fff",
              boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
              display: "block",
              opacity: 0.6,
              pointerEvents: "none",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Plans (soon)</div>
            <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
              Billing plans and entitlements management.
            </div>
          </a>
        </div>

        <div style={{ marginTop: 18, fontSize: 12, opacity: 0.65 }}>
          Tip: Bookmark <code>/admin/inbox</code> for daily operations.
        </div>
      </div>
    </div>
  );
}
