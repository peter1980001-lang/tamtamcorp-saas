import { supabaseServer } from "@/lib/supabaseServer";

export async function fetchForcedPricingContext(company_id: string, match_count = 12) {
  // Assumption: pricing chunks are tagged in metadata.type or metadata.section_title
  // We fetch a broader set and let the prompt summarize.
  const { data, error } = await supabaseServer
    .from("knowledge_chunks")
    .select("id, content, title, source_ref, metadata, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(Math.min(50, Math.max(6, match_count)));

  if (error) return { ok: false as const, rows: [] as any[] };

  // Filter likely pricing chunks (best-effort)
  const rows = (data ?? []).filter((r: any) => {
    const m = r?.metadata || {};
    const type = String(m?.type || "").toLowerCase();
    const section = String(m?.section_title || "").toLowerCase();
    const title = String(r?.title || "").toLowerCase();
    const text = String(r?.content || "").toLowerCase();
    return (
      type.includes("pricing") ||
      type.includes("plan") ||
      section.includes("pricing") ||
      section.includes("plan") ||
      title.includes("pricing") ||
      title.includes("plan") ||
      text.includes("€/") ||
      text.includes("per month") ||
      text.includes("monat") ||
      text.includes("starter") ||
      text.includes("growth") ||
      text.includes("pro")
    );
  });

  // If nothing matched, fallback to raw data slice
  return { ok: true as const, rows: (rows.length ? rows : (data ?? []).slice(0, match_count)) };
}