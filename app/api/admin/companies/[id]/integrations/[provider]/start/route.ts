export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { requireCompanyAccess } from "@/lib/adminGuard";
import { PROVIDERS, type ProviderKey } from "@/lib/integrations/providers";
import { signState } from "@/lib/integrations/state";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; provider: string }> }) {
  const { id, provider } = await ctx.params;
  const company_id = String(id || "").trim();
  const p = String(provider || "").trim() as ProviderKey;

  if (!company_id) return NextResponse.json({ error: "missing_company_id" }, { status: 400 });
  if (!(p in PROVIDERS)) return NextResponse.json({ error: "invalid_provider" }, { status: 400 });

  const auth = await requireCompanyAccess(company_id);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const cfg = PROVIDERS[p];

  const client_id = process.env[cfg.clientIdEnv] || "";
  const redirect_uri = process.env[cfg.redirectUriEnv] || "";
  if (!client_id || !redirect_uri) return NextResponse.json({ error: "missing_oauth_env" }, { status: 500 });

  const state = signState({
    company_id,
    provider: p,
    t: Date.now(),
  });

  const url = new URL(cfg.authUrl);
  url.searchParams.set("client_id", client_id);
  url.searchParams.set("redirect_uri", redirect_uri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", cfg.scopes.join(" "));
  url.searchParams.set("state", state);

  // provider extras
  for (const [k, v] of Object.entries(cfg.extraAuthParams || {})) url.searchParams.set(k, v);

  // google wants include_granted_scopes often; harmless elsewhere
  if (p === "google_calendar") url.searchParams.set("include_granted_scopes", "true");

  return NextResponse.redirect(url.toString());
}