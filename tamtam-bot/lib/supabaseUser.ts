import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseUserClient() {
  const cookieStore = await cookies(); // 👈 Next 16: async

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // In Route Handlers kann set manchmal nicht nötig sein,
            // und in manchen Runtimes ist es eingeschränkt.
          }
        },
      },
    }
  );
}
