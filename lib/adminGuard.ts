import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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

type GuardResult =
  | { ok: true; status: 200; user_id: string; role: "platform_owner" | "admin" | "agent" | "viewer"; company_id?: string }
  | { ok: false; status: 401 | 403; error: string };

async function getAuthUserId(): Promise<string | null> {
  const supabase = getSupabaseAuthServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

// PLATFORM OWNER via env
async function isPlatformOwner(): Promise<{ ok: boolean; user_id?: string }> {
  const supabase = getSupabaseAuthServer();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user?.id) return { ok: false };

  const ownerUserId = process.env.OWNER_USER_ID;
  if (ownerUserId && user.id === ownerUserId) return { ok: true, user_id: user.id };

  const ownerEmails = (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const email = (user.email || "").toLowerCase();
  if (email && ownerEmails.includes(email)) return { ok: true, user_id: user.id };

  return { ok: false, user_id: user.id };
}

export async function requireOwner(): Promise<GuardResult> {
  const o = await isPlatformOwner();
  if (!o.user_id) return { ok: false, status: 401, error: "unauthorized" };
  if (!o.ok) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, status: 200, user_id: o.user_id, role: "platform_owner" };
}

/**
 * Company access: platform_owner OR member of company_admins for that company.
 */
export async function requireCompanyAccess(company_id: string): Promise<GuardResult> {
  const user_id = await getAuthUserId();
  if (!user_id) return { ok: false, status: 401, error: "unauthorized" };

  // platform owner always allowed
  const o = await isPlatformOwner();
  if (o.ok) return { ok: true, status: 200, user_id, role: "platform_owner", company_id };

  // check membership in company_admins
  const { supabaseServer } = await import("@/lib/supabaseServer");

  const { data, error } = await supabaseServer
    .from("company_admins")
    .select("role, company_id, user_id")
    .eq("company_id", company_id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (error || !data) return { ok: false, status: 403, error: "forbidden" };

  const role = String((data as any).role || "admin") as any;
  return { ok: true, status: 200, user_id, role, company_id };
}

// Backward compat: alte Routes bauen weiter
export const requireOwnerOrCompanyAdmin = requireCompanyAccess;
export const requireCompanyAdmin = requireCompanyAccess;
