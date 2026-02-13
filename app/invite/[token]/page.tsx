"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    async function run() {
      if (!token) return;
      setLoading(true);
      setMsg("");

      const res = await fetch(`/api/invite/${token}`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      setLoading(false);

      if (!res.ok) {
        setMsg(json.error || "invite_failed");
        return;
      }

      setMsg("Invite accepted. You can go to /admin now.");
    }
    run();
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui", padding: 24 }}>
      <div style={{ width: 520, maxWidth: "100%", border: "1px solid #eee", borderRadius: 16, padding: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>Invite</div>
        <div style={{ marginTop: 10, opacity: 0.8 }}>
          {loading ? "Processing invite..." : msg || "Done."}
        </div>
      </div>
    </div>
  );
}
