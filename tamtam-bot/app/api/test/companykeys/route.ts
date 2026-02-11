import { NextResponse } from "next/server";
import { createSupabaseUserClient } from "@/lib/supabaseUser";

export async function GET() {
  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase.from("company_keys").select("*").limit(5);
  return NextResponse.json({ data, error });
}
