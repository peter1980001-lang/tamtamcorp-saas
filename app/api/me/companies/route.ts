// app/api/me/companies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAuthServer } from "@/lib/supabaseAuthServer";

export async function GET(_req: NextRequest) {
  try {
    const supabase = await supabaseAuthServer();
    const { data: userData, error: uErr } = await supabase.auth.getUser();

    if (uErr || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    // Requires RLS read policy on company_admins + companies
    const { data, error } = await supabase
      .from("company_admins")
      .select("company_id, role, company:companies(id, name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ companies: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
