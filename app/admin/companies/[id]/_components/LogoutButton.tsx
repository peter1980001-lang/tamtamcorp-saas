"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
      }}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #E5E7EB",
        background: "#fff",
        fontSize: 13.5,
        fontWeight: 650,
        color: "#111827",
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  );
}
