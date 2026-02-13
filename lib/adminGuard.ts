import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// NOTE: In Next.js (App Router) cookies() can be async in some environments.
// We handle both sync/async safely.
async function getCookieStore() {
  const c: any = cookies();
  return typeof c?.then === "function" ? await c : c;
}

function getSupabaseAuthServerWithCookieStore(cookieStore: any) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) throw new Error("missing_supabase_env_for_auth");

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

type Role = "owner" | "admin" | "agent" | "viewer";

type GuardResult =
  | { ok: true; status: 200; user_id: string; role: Role; company_id?: string }
  | { ok: false; status: 401 | 403; error: string };

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await getCookieStore();
  const supabase = getSupabaseAuthServerWithCookieStore(cookieStore);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

/**
 * OWNER RULE:
 * Prefer email whitelist:
 *   OWNER_EMAILS="a@b.com,c@d.com"
 * Optional fallback:
 *   OWNER_USER_ID="<uuid>"
 */
async function isOwner(): Promise<{ ok: boolean; user_id?: string }> {
  const cookieStore = await getCookieStore();
  const supabase = getSupabaseAuthServerWithCookieStore(cookieStore);
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

// ---- Public Guards ----

export async function requireOwner(): Promise<GuardResult> {
  const o = await isOwner();
  if (!o.user_id) return { ok: false, status: 401, error: "unauthorized" };
  if (!o.ok) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, status: 200, user_id: o.user_id, role: "owner" };
}

/**
 * Company access for Admin UI routes:
 * - Owner -> always allowed for any company
 * - Otherwise must exist in company_admins with matching company_id + user_id
 */
export async function requireCompanyAccess(company_id: string): Promise<GuardResult> {
  const user_id = await getAuthUserId();
  if (!user_id) return { ok: false, status: 401, error: "unauthorized" };

  const o = await isOwner();
  if (o.ok) return { ok: true, status: 200, user_id, role: "owner", company_id };

  const { supabaseServer } = await import("@/lib/supabaseServer");

  const { data, error } = await supabaseServer
    .from("company_admins")
    .select("role, company_id, user_id")
    .eq("company_id", company_id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (error || !data) return { ok: false, status: 403, error: "forbidden" };

  const role = String((data as any).role || "admin") as Role;
  return { ok: true, status: 200, user_id, role, company_id };
}

// Backward-compatible aliases (so old routes won’t crash)
export async function requireCompanyAdmin(company_id: string) {
  return requireCompanyAccess(company_id);
}
export async function requireOwnerOrCompanyAdmin(company_id: string) {
  return requireCompanyAccess(company_id);
}
