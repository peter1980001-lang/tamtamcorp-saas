import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// NOTE: In newer Next versions, cookies() can be async (returns Promise).
async function getSupabaseAuthServer() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("missing_supabase_env_for_auth");
  }

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

type Role = "platform_owner" | "admin" | "agent" | "viewer";

type GuardResult =
  | { ok: true; status: 200; user_id: string; role: Role; company_id?: string }
  | { ok: false; status: 401 | 403; error: string };

async function getAuthUser(): Promise<{ id: string; email?: string | null } | null> {
  const supabase = await getSupabaseAuthServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return { id: data.user.id, email: data.user.email };
}

/**
 * PLATFORM OWNER
 * - via OWNER_EMAILS="a@b.com,c@d.com" OR OWNER_USER_ID="<uuid>"
 * Recommended: OWNER_EMAILS (works even if you recreate user)
 */
async function isOwner(): Promise<{ ok: boolean; user_id?: string }> {
  const user = await getAuthUser();
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
  const o = await isOwner();
  if (!o.user_id) return { ok: false, status: 401, error: "unauthorized" };
  if (!o.ok) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, status: 200, user_id: o.user_id, role: "platform_owner" };
}

/**
 * Company Access:
 * - platform_owner always allowed
 * - otherwise must exist in company_admins mapping for that company
 */
export async function requireCompanyAccess(company_id: string): Promise<GuardResult> {
  const user = await getAuthUser();
  if (!user?.id) return { ok: false, status: 401, error: "unauthorized" };

  // platform owner always allowed
  const o = await isOwner();
  if (o.ok) return { ok: true, status: 200, user_id: user.id, role: "platform_owner", company_id };

  // Check company_admins mapping using service role supabaseServer
  const { supabaseServer } = await import("@/lib/supabaseServer");

  const { data, error } = await supabaseServer
    .from("company_admins")
    .select("role, company_id, user_id")
    .eq("company_id", company_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return { ok: false, status: 403, error: "forbidden" };

  const role = String((data as any).role || "admin") as Role;
  return { ok: true, status: 200, user_id: user.id, role, company_id };
}

/**
 * Backwards-compat alias (so older routes still compile)
 */
export async function requireOwnerOrCompanyAdmin(company_id: string): Promise<GuardResult> {
  return requireCompanyAccess(company_id);
}
