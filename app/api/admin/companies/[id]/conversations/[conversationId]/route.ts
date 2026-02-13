export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireCompanyAccess } from "@/lib/adminGuard";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; conversationId: string }> })
