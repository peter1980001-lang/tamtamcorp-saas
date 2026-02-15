// app/api/onboarding/ensure-company/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAuthServer } from "@/lib/supabaseAuthServer";
import { supabaseServer } from "@/lib/supabaseServer";

type Body = { company_name?: string };

function makeKey(prefix: "pk_" | "sk_") {
  return `${prefix}${crypto.randomBytes(24).toString("hex")}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = await supabaseAuthServer();
    const { data: userData, error: uErr } = await supabaseAuth.auth.getUser();

    if (uErr || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      body = {};
    }

    // 1) Check if already has a company (RLS read policy required)
    const { data: existing, error: exErr } = await supabaseAuth
      .from("company_admins")
      .select("company_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!exErr && existing && existing.length > 0) {
      return NextResponse.json(
        { company_id: existing[0].company_id, created: false },
        { status: 200 }
      );
    }

    // 2) Create (transaction via RPC). Use service role for writes.
    const companyName = (body.company_name || "My Company").trim() || "My Company";

    const publicKey = makeKey("pk_");
    const secretKey = makeKey("sk_");

    const { data: rpcData, error: rpcErr } = await supabaseServer.rpc(
      "onboard_ensure_company",
      {
        p_user_id: userId,
        p_company_name: companyName,
        p_public_key: publicKey,
        p_secret_key: secretKey,
      }
    );

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    }

    // RPC returns uuid (company_id)
    const companyId = String(rpcData);

    return NextResponse.json({ company_id: companyId, created: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
