export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

/* =========================================================
   GET – Fetch Leads (Owner only)
========================================================= */
export async function GET(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: auth.status }
    );
  }

  const url = new URL(req.url);

  const q = (url.searchParams.get("q") || "").trim();
  const band = (url.searchParams.get("band") || "all").trim(); // all|cold|warm|hot
  const status = (url.searchParams.get("status") || "all").trim(); // all|new|contacted|closed
  const limit = Math.min(
    500,
    Math.max(1, Number(url.searchParams.get("limit") || 200))
  );

  let query = supabaseServer
    .from("company_leads")
    .select(
      `
      id,
      company_id,
      conversation_id,
      lead_state,
      status,
      name,
      email,
      phone,
      qualification_json,
      consents_json,
      intent_score,
      score_total,
      score_band,
      tags,
      last_touch_at,
      created_at,
      updated_at
    `
    )
    .order("last_touch_at", { ascending: false })
    .limit(limit);

  if (band !== "all") query = query.eq("score_band", band);
  if (status !== "all") query = query.eq("status", status);

  if (q) {
    const like = `%${q}%`;

    query = query.or(
      [
        `name.ilike.${like}`,
        `email.ilike.${like}`,
        `phone.ilike.${like}`,
        `conversation_id.ilike.${like}`,
        `qualification_json->>use_case.ilike.${like}`,
      ].join(",")
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "db_failed", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ leads: data ?? [] });
}

/* =========================================================
   DELETE – Bulk Delete Leads (Owner only)
========================================================= */
export async function DELETE(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: auth.status }
    );
  }

  try {
    const body = await req.json();
    const ids: string[] = body?.ids ?? [];

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "no_ids_provided" },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from("company_leads")
      .delete()
      .in("id", ids);

    if (error) {
      return NextResponse.json(
        { error: "delete_failed", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, deleted_ids: ids });
  } catch (err: any) {
    return NextResponse.json(
      { error: "invalid_request_body", details: err.message },
      { status: 400 }
    );
  }
}