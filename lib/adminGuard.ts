import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Server-side Supabase Auth Client (App Router compatible)
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

type Role = "platform_owner" | "admin" | "agent" | "viewer";

export type GuardResult =
  | { ok: true; status: 200; user_id: string; role: Role; company_id?: string }
  | { ok: false; status: 401 | 403; error: string };

async function getAuthUser() {
  const supabase = getSupabaseAuthServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user;
}

/**
 * PLATFORM OWNER:
 * Best practice: identify platform owner via env (OWNER_USER_ID or OWNER_EMAILS).
 *
 * Option A: OWNER_USER_ID="<uuid>"
 * Option B: OWNER_EMAILS="a@b.com,c@d.com"
 */
async function isPlatformOwner(): Promise<{ ok: boolean; user_id?: string }> {
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

/**
 * Backwards compatible export.
 * Many routes still import requireOwner() -> keep it as "platform_owner".
 */
export async function requireOwner(): Promise<GuardResult> {
  const o = await isPlatformOwner();
  if (!o.user_id) return { ok: false, status: 401, error: "unauthorized" };
  if (!o.ok) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, status: 200, user_id: o.user_id, role: "platform_owner" };
}

/**
 * Company access: platform_owner OR mapped user in company_admins for that company.
 * company_admins columns expected: company_id, user_id, role ('admin'|'agent'|'viewer')
 */
export async function requireCompanyAccess(company_id: string): Promise<GuardResult> {
  const user = await getAuthUser();
  if (!user?.id) return { ok: false, status: 401, error: "unauthorized" };

  const o = await isPlatformOwner();
  if (o.ok) return { ok: true, status: 200, user_id: user.id, role: "platform_owner", company_id };

  const { supabaseServer } = await import("@/lib/supabaseServer");

  const { data, error } = await supabaseServer
    .from("company_admins")
    .select("role, company_id, user_id")
    .eq("company_id", company_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return { ok: false, status: 403, error: "forbidden" };

  const role = String((data as any).role || "admin") as Role;
  if (role !== "admin" && role !== "agent" && role !== "viewer") {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: true, status: 200, user_id: user.id, role, company_id };
}

/**
 * Convenience helpers (optional)
 */
export async function requireCompanyAdmin(company_id: string): Promise<GuardResult> {
  const g = await requireCompanyAccess(company_id);
  if (!g.ok) return g;
  if (g.role === "platform_owner" || g.role === "admin") return g;
  return { ok: false, status: 403, error: "forbidden" };
}

export async function requireOwnerOrCompanyAdmin(company_id: string): Promise<GuardResult> {
  return requireCompanyAdmin(company_id);
}
