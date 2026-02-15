"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnon);

export default function InviteClient(props: { token: string }) {
  const token = String(props.token || "").trim();

  const [status, setStatus] = useState<"idle" | "checking" | "need_login" | "accepting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const loginUrl = useMemo(() => "/login", []);

  useEffect(() => {
    async function run() {
      setError(null);

      if (!token) {
        setStatus("error");
        setError("missing_token");
        return;
      }

      setStatus("checking");
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;

      if (!accessToken) {
        setStatus("need_login");
        return;
      }

      setStatus("accepting");
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus("error");
        setError(json?.error || "accept_failed");
        return;
      }

      setCompanyId(String(json.company_id || ""));
      setStatus("done");
    }

    run();
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 16, padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Invite</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 14 }}>
            Token: <code>{token || "—"}</code>
          </div>

          {status === "checking" && <div style={{ opacity: 0.8 }}>Checking session…</div>}

          {status === "need_login" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 14 }}>Du musst eingeloggt sein, um die Einladung anzunehmen.</div>
              <a
                href={loginUrl}
                style={{
                  display: "inline-block",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #111",
                  background: "#111",
                  color: "#fff",
                  textDecoration: "none",
                  width: "fit-content",
                }}
              >
                Go to Login
              </a>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Nach dem Login: diese Invite-URL erneut öffnen.</div>
            </div>
          )}

          {status === "accepting" && <div style={{ opacity: 0.8 }}>Accepting invite…</div>}

          {status === "done" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Invite accepted ✅</div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                Company ID: <code>{companyId || "—"}</code>
              </div>
              <a
                href={companyId ? `/admin/companies/${companyId}` : "/admin"}
                style={{
                  display: "inline-block",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #111",
                  background: "#111",
                  color: "#fff",
                  textDecoration: "none",
                  width: "fit-content",
                }}
              >
                Go to Company
              </a>
            </div>
          )}

          {status === "error" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Error</div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{error || "unknown_error"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
