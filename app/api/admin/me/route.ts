import { NextResponse } from "next/server";
import { createSupabaseUserClient } from "@/lib/supabaseUser";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const supabase = await createSupabaseUserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: ownerRow } = await supabase
    .from("platform_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const isOwner = ownerRow?.role === "platform_owner";

  const { data: memberships } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id);

  return NextResponse.json({
    user_id: user.id,
    is_owner: isOwner,
    companies: memberships ?? [],
  });
}
