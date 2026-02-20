export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { supabaseServer } from "@/lib/supabaseServer";

const PatchSchema = z.object({
  enabled: z.boolean().optional(),
  objection_handling: z.boolean().optional(),
  require_qualification: z.boolean().optional(),
  show_pricing: z.boolean().optional(),
  pricing_strategy: z.enum(["multi-tier", "anchor", "request-only"]).optional(),
  allow_unknown_fallback: z.boolean().optional(),

  tone: z.enum(["consultative", "direct", "luxury", "formal", "playful"]).optional(),
  response_length: z.enum(["concise", "medium", "detailed"]).optional(),
  language: z.string().max(10).optional(),

  cta_style: z.enum(["one-question", "strong-close", "soft-close"]).optional(),
  default_cta: z.string().max(400).nullable().optional(),

  qualification_fields: z.any().optional(),
  retrieval_overrides: z.any().optional(),
});

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const companyId = String(ctx?.params?.id || "").trim();
  if (!companyId) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(companyId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseServer
    .from("company_funnel_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });

  // auto-create if missing
  if (!data) {
    const { data: created, error: cErr } = await supabaseServer
      .from("company_funnel_config")
      .insert({ company_id: companyId })
      .select("*")
      .single();
    if (cErr) return NextResponse.json({ error: "db_failed", details: cErr.message }, { status: 500 });
    return NextResponse.json({ config: created });
  }

  return NextResponse.json({ config: data });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const companyId = String(ctx?.params?.id || "").trim();
  if (!companyId) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });

  const auth = await requireCompanyAccess(companyId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request", details: parsed.error.flatten() }, { status: 400 });

  const patch = parsed.data;

  const { data, error } = await supabaseServer
    .from("company_funnel_config")
    .update({ ...patch })
    .eq("company_id", companyId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "db_failed", details: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ config: data });
}