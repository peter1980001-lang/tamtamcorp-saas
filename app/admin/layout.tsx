export const runtime = "nodejs";

import React from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import IdleLogoutGate from "@/components/IdleLogoutGate";

async function getSupabaseAuthServer() {
  const cookieStore = await cookies(); // ✅ FIX: await

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("missing_supabase_env_for_auth");
  }

  // In Layouts/Server Components sind Cookies read-only -> set/remove als No-Op
  return createServerClient(url, anon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // no-op in Server Components / layouts
      },
      remove() {
        // no-op in Server Components / layouts
      },
    },
  });
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Optional: wenn du hier künftig einen Login-Guard willst, kannst du den User laden.
  // Aktuell machen wir NICHTS, damit es sicher deployt und keine Redirect-Loops entstehen.
  await getSupabaseAuthServer();

  return (
    <>
      {/* Client-side idle logout (nur /admin) */}
      <IdleLogoutGate redirectTo="/login" />
      {children}
    </>
  );
}