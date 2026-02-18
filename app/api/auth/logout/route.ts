// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  const jar = await cookies();
  const all = jar.getAll();

  // Delete common Supabase cookie patterns
  for (const c of all) {
    if (
      c.name.startsWith("sb-") ||
      c.name.includes("supabase") ||
      c.name.includes("auth-token")
    ) {
      jar.set(c.name, "", { path: "/", expires: new Date(0) });
    }
  }

  return NextResponse.json({ ok: true });
}
