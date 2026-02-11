import { createSupabaseUserClient } from "@/lib/supabaseUser";

export async function requireOwner() {
  const supabase = await createSupabaseUserClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return { ok: false as const, status: 401 as const, user: null };
  }

  const { data: ownerRow } = await supabase
    .from("platform_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerRow?.role !== "platform_owner") {
    return { ok: false as const, status: 403 as const, user };
  }

  return { ok: true as const, status: 200 as const, user };
}
