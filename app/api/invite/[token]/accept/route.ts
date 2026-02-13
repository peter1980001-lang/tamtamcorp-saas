import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

async function getSupabaseAuthServer() {
  const cookieStore = await cookies();
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

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  // ... dein accept-flow hier ...
  // const supabase = await getSupabaseAuthServer();
  // supabase.auth.exchangeCodeForSession(...) etc.

  return NextResponse.json({ ok: true });
}
