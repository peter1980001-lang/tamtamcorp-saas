export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — crawling can be slow

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { importFromWebsite } from "@/lib/knowledgeImport";
import { captureError } from "@/lib/logger";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // no secret configured = disabled for safety

  // Vercel Cron sends Authorization: Bearer <secret>
  const authHeader = req.headers.get("authorization") || "";
  return authHeader === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Find all companies that have a homepage_url stored in branding
  const { data: rows, error } = await supabaseServer
    .from("company_settings")
    .select("company_id, branding_json")
    .not("branding_json", "is", null);

  if (error) {
    captureError(error, { context: "knowledge_refresh_cron_fetch" });
    return NextResponse.json({ error: "db_fetch_failed" }, { status: 500 });
  }

  const targets: Array<{ company_id: string; homepage_url: string }> = [];

  for (const row of rows ?? []) {
    const url = (row.branding_json as { brand?: { homepage_url?: string } } | null)?.brand?.homepage_url;
    if (url && typeof url === "string" && url.startsWith("http")) {
      targets.push({ company_id: String(row.company_id), homepage_url: url });
    }
  }

  const results: Array<{ company_id: string; ok: boolean; chunks?: number; error?: string }> = [];

  for (const target of targets) {
    try {
      // Delete existing website chunks so stale content doesn't accumulate
      await supabaseServer
        .from("knowledge_chunks")
        .delete()
        .eq("company_id", target.company_id)
        .eq("source_type", "website");

      const r = await importFromWebsite({
        company_id: target.company_id,
        url: target.homepage_url,
        maxPages: 8,
      });

      if (r.ok) {
        results.push({ company_id: target.company_id, ok: true, chunks: r.chunksInserted });
      } else {
        results.push({ company_id: target.company_id, ok: false, error: r.error });
      }
    } catch (err) {
      captureError(err, { context: "knowledge_refresh_cron_import", company_id: target.company_id });
      results.push({ company_id: target.company_id, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ refreshed: results.length, results });
}
