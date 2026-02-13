import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Self-contained Supabase auth server client for Next.js App Router (server).
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

type Role = "owner" | "admin" | "agent" | "viewer";

type GuardResult =
  | { ok: true; status: 200; user_id: string; role: Role; company_id?: string }
  | { ok: false; status: 401 | 403; error: string };

async function getAuthUserId(): Promise<string | null> {
  const supabase = await getSupabaseAuthServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

/**
 * OWNER RULE:
 * - Owner is identified by whitelist of emails OR a single OWNER_USER_ID.
 *
 * Pick ONE method:
 *  A) OWNER_EMAILS="a@b.com,c@d.com"
 *  B) OWNER_USER_ID="<uuid>"
 */
async function isOwner(): Promise<{ ok: boolean; user_id?: string }> {
  const supabase = await getSupabaseAuthServer();
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
  const o = await isOwner();
  if (!o.user_id) return { ok: false, status: 401, error: "unauthorized" };
  if (!o.ok) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, status: 200, user_id: o.user_id, role: "owner" };
}

/**
 * Company access guard:
 * - Owner always allowed
 * - Otherwise checks company_admins mapping for (company_id, user_id)
 */
export async function requireCompanyAccess(company_id: string): Promise<GuardResult> {
  const user_id = await getAuthUserId();
  if (!user_id) return { ok: false, status: 401, error: "unauthorized" };

  // Owner is always allowed
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

/**
 * Backwards-compat alias:
 * Some routes still call requireOwnerOrCompanyAdmin(company_id)
 * -> keep this to avoid build errors
 */
export async function requireOwnerOrCompanyAdmin(company_id: string): Promise<GuardResult> {
  return requireCompanyAccess(company_id);
}
