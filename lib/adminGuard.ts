import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// --- Supabase auth client (Next App Router server) ---
function getSupabaseAuthServer() {
  const cookieStore = cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) throw new Error("missing_supabase_env_for_auth");

  return createServerClient(url, anon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

export type Role = "platform_owner" | "admin" | "agent" | "viewer";

export type GuardResult =
  | { ok: true; status: 200; user_id: string; role: Role; company_id?: string }
  | { ok: false; status: 401 | 403; error: string };

async function getAuthUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = getSupabaseAuthServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return { id: data.user.id, email: (data.user.email || null) as any };
}

/**
 * PLATFORM OWNER (global):
 * We identify the platform owner via:
 * - OWNER_USER_ID or OWNER_EMAILS
 */
async function isPlatformOwner(): Promise<{ ok: boolean; user_id?: string }> {
  const u = await getAuthUser();
  if (!u?.id) return { ok: false };

  const ownerUserId = process.env.OWNER_USER_ID;
  if (ownerUserId && u.id === ownerUserId) return { ok: true, user_id: u.id };

  const ownerEmails = (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const email = (u.email || "").toLowerCase();
  if (email && ownerEmails.includes(email)) return { ok: true, user_id: u.id };

  return { ok: false, user_id: u.id };
}

/** New: global owner guard (best practice naming) */
export async function requirePlatformOwner(): Promise<GuardResult> {
  const o = await isPlatformOwner();
  if (!o.user_id) return { ok: false, status: 401, error: "unauthorized" };
  if (!o.ok) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, status: 200, user_id: o.user_id, role: "platform_owner" };
}

/**
 * Company access:
 * - platform_owner: always allowed
 * - otherwise: must exist in company_admins mapping
 */
export async function requireCompanyAccess(company_id: string): Promise<GuardResult> {
  const u = await getAuthUser();
  if (!u?.id) return { ok: false, status: 401, error: "unauthorized" };

  // platform owner always allowed
  const o = await isPlatformOwner();
  if (o.ok) return { ok: true, status: 200, user_id: u.id, role: "platform_owner", company_id };

  // DB check via service role client (your supabaseServer)
  const { supabaseServer } = await import("@/lib/supabaseServer");

  const { data, error } = await supabaseServer
    .from("company_admins")
    .select("role, company_id, user_id")
    .eq("company_id", company_id)
    .eq("user_id", u.id)
    .maybeSingle();

  if (error || !data) return { ok: false, status: 403, error: "forbidden" };

  const role = (String((data as any).role || "admin") as Role) || "admin";
  return { ok: true, status: 200, user_id: u.id, role, company_id };
}

/** Convenience */
export async function requireOwnerOrCompanyAdmin(company_id: string): Promise<GuardResult> {
  return requireCompanyAccess(company_id);
}

/* -------------------------------------------------------
   Backward compatible exports (to stop Vercel build errors)
   ------------------------------------------------------- */

/**
 * OLD NAME: requireOwner()
 * Many routes still import this.
 * We map it to requirePlatformOwner().
 */
export async function requireOwner(): Promise<GuardResult> {
  return requirePlatformOwner();
}

/**
 * OLD NAME: requireCompanyAdmin(company_id)
 * Map to requireCompanyAccess(company_id)
 */
export async function requireCompanyAdmin(company_id: string): Promise<GuardResult> {
  return requireCompanyAccess(company_id);
}
