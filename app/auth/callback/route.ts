// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAuthServer } from "@/lib/supabaseAuthServer";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // If no code, just go to login
  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const supabase = await supabaseAuthServer();

  // Exchange code for session cookies
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // Login page will auto-finish onboarding if session exists.
  return NextResponse.redirect(new URL("/login", url.origin));
}
