// app/api/onboarding/ensure-company/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAuthServer } from "@/lib/supabaseAuthServer";
import { supabaseServer } from "@/lib/supabaseServer";

type Body = { company_name?: string };

function makeKey(prefix: "pk_" | "sk_") {
  return `${prefix}${crypto.randomBytes(24).toString("hex")}`;
}

function pickCompanyName(user: any, bodyName?: string) {
  const fromBody = String(bodyName || "").trim();
  if (fromBody) return fromBody;

  const meta = user?.user_metadata?.company_name;
  const fromMeta = typeof meta === "string" ? meta.trim() : "";
  if (fromMeta) return fromMeta;

  return "My Company";
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = await supabaseAuthServer();
    const { data: userData, error: uErr } = await supabaseAuth.auth.getUser();

    if (uErr || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = userData.user;
    const userId = user.id;

    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      body = {};
    }

    const desiredName = pickCompanyName(user, body.company_name);

    // already has a company?
    const { data: existing, error: exErr } = await supabaseAuth
      .from("company_admins")
      .select("company_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!exErr && existing && existing.length > 0) {
      const companyId = String(existing[0].company_id);

      // If name is still default, upgrade it (service role)
      if (desiredName && desiredName !== "My Company") {
        const { data: cRow } = await supabaseServer
          .from("companies")
          .select("id,name")
          .eq("id", companyId)
          .maybeSingle();

        if (cRow?.name === "My Company") {
          await supabaseServer.from("companies").update({ name: desiredName }).eq("id", companyId);
        }
      }

      return NextResponse.json({ company_id: companyId, created: false }, { status: 200 });
    }

    // create new company via RPC
    const publicKey = makeKey("pk_");
    const secretKey = makeKey("sk_");

    const { data: rpcData, error: rpcErr } = await supabaseServer.rpc("onboard_ensure_company", {
      p_user_id: userId,
      p_company_name: desiredName,
      p_public_key: publicKey,
      p_secret_key: secretKey,
    });

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    }

    return NextResponse.json(
      { company_id: String(rpcData), created: true },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
