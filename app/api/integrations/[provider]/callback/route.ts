// app/api/integrations/[provider]/callback/route.ts
export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { PROVIDERS, type ProviderKey } from "@/lib/integrations/providers";
import { verifyState } from "@/lib/integrations/state";

function abs(req: Request, path: string) {
  const u = new URL(req.url);
  return new URL(path, `${u.protocol}//${u.host}`).toString();
}

async function exchangeCode(provider: ProviderKey, code: string) {
  const cfg = PROVIDERS[provider];

  const client_id = process.env[cfg.clientIdEnv] || "";
  const client_secret = process.env[cfg.clientSecretEnv] || "";
  const redirect_uri = process.env[cfg.redirectUriEnv] || "";

  if (!client_id || !client_secret || !redirect_uri) throw new Error("missing_oauth_env");

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirect_uri);
  body.set("client_id", client_id);
  body.set("client_secret", client_secret);

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`token_exchange_failed:${res.status}:${json?.error || json?.message || "unknown"}`);
  }
  return json;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const p = String(provider || "").trim() as ProviderKey;
  if (!(p in PROVIDERS)) return NextResponse.json({ error: "invalid_provider" }, { status: 400 });

  const url = new URL(req.url);
  const code = String(url.searchParams.get("code") || "").trim();
  const stateRaw = String(url.searchParams.get("state") || "").trim();
  const err = String(url.searchParams.get("error") || "").trim();

  if (err) {
    return NextResponse.redirect(abs(req, `/admin/companies?oauth_error=${encodeURIComponent(err)}`));
  }
  if (!code || !stateRaw) return NextResponse.json({ error: "missing_code_or_state" }, { status: 400 });

  const state = verifyState(stateRaw);
  if (!state?.company_id || state?.provider !== p) return NextResponse.json({ error: "invalid_state" }, { status: 400 });

  const company_id = String(state.company_id);

  const tok = await exchangeCode(p, code);

  const access_token = String(tok.access_token || "");
  const refresh_token = tok.refresh_token ? String(tok.refresh_token) : null;
  const expires_in = Number(tok.expires_in || 0);
  const token_expires_at = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;

  const { error: upErr } = await supabaseServer
    .from("company_integrations")
    .upsert(
      {
        company_id,
        provider: p,
        status: "connected",
        access_token,
        refresh_token,
        token_expires_at,
        scopes: (PROVIDERS[p].scopes || []) as any,
        provider_meta: tok || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,provider" }
    );

  if (upErr) return NextResponse.json({ error: "db_upsert_failed", details: upErr.message }, { status: 500 });

  return NextResponse.redirect(abs(req, `/admin/companies/${company_id}?tab=integrations`));
}