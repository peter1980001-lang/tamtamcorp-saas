"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    })();
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui" }}>
      <div style={{ padding: 18, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}>
        Logging out…
      </div>
    </div>
  );
}
