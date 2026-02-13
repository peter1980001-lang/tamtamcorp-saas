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

type GuardRole = "platform_owner" | "admin" | "agent" | "viewer";

type GuardResult =
  | { ok: true; status: 200; user_id: string; role: GuardRole; company_id?: string }
  | { ok: false; status: 401 | 403; error: string };

async function getAuthUserId(): Promise<string | null> {
  const supabase = getSupabaseAuthServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

async function isPlatformOwner(user_id: string): Promise<boolean> {
  const { supabaseServer } = await import("@/lib/supabaseServer");
  const { data } = await supabaseServer
    .from("platform_members")
    .select("role")
    .eq("user_id", user_id)
    .maybeSingle();

  return String((data as any)?.role || "") === "platform_owner";
}

export async function requirePlatformOwner(): Promise<GuardResult> {
  const user_id = await getAuthUserId();
  if (!user_id) return { ok: false, status: 401, error: "unauthorized" };

  const ok = await isPlatformOwner(user_id);
  if (!ok) return { ok: false, status: 403, error: "forbidden" };

  return { ok: true, status: 200, user_id, role: "platform_owner" };
}

export async function requireCompanyAccess(company_id: string): Promise<GuardResult> {
  const user_id = await getAuthUserId();
  if (!user_id) return { ok: false, status: 401, error: "unauthorized" };

  // platform_owner always allowed
  if (await isPlatformOwner(user_id)) {
    return { ok: true, status: 200, user_id, role: "platform_owner", company_id };
  }

  const { supabaseServer } = await import("@/lib/supabaseServer");
  const { data } = await supabaseServer
    .from("company_admins")
    .select("role")
    .eq("company_id", company_id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (!data) return { ok: false, status: 403, error: "forbidden" };

  const role = String((data as any).role || "admin") as GuardRole;
  return { ok: true, status: 200, user_id, role, company_id };
}

export async function requireOwnerOrCompanyAdmin(company_id: string): Promise<GuardResult> {
  // alias für alte Stellen im Code
  return requireCompanyAccess(company_id);
}
