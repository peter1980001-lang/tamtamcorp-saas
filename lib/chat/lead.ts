import { supabaseServer } from "@/lib/supabaseServer";
import { notifyHotLead } from "@/lib/notifications";
import type { DecidedAction, FunnelState } from "./types";

export function extractEmail(text: string): string | null {
  const m = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  return m ? m[0].trim().toLowerCase() : null;
}

export function extractPhone(text: string): string | null {
  const m = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

function extractLeadSignals(text: string) {
  const t = text.toLowerCase();

  const timeline =
    /(tomorrow|morgen)/i.test(t) ? "tomorrow" :
    /(today|heute)/i.test(t) ? "today" :
    /(this week|diese woche)/i.test(t) ? "this_week" :
    /(asap|as soon as possible|urgent|sofort)/i.test(t) ? "asap" :
    null;

  const location =
    /(dubai|uae|abu dhabi|abudhabi|sharjah|ajman|rak|ras al khaimah)/i.test(t) ? "uae" : null;

  const industryMatch = t.match(/\b(oil|real estate|construction|tattoo|beauty|clinic|gym|salon|agency|saas)\b/i);
  const industry = industryMatch ? industryMatch[1].toLowerCase() : null;

  return { timeline, location, industry };
}

export function intentScore(intent: string | null): number {
  if (intent === "pricing") return 10;
  if (intent === "contact") return 8;
  if (intent === "faq") return 2;
  return 0;
}

function computeScore(params: {
  message: string;
  commercial: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  intent: string | null;
  state: FunnelState;
}): number {
  let score = 0;
  if (params.commercial) score += 25;
  score += intentScore(params.intent);
  if (/(demo|call|appointment|termin|book|schedule|meeting|beratung)/i.test(params.message)) score += 20;
  if (/(budget|€|aed|dirham|euro|usd)/i.test(params.message)) score += 10;
  if (/(asap|urgent|sofort|heute|this week|tomorrow|morgen)/i.test(params.message)) score += 10;
  if (params.state === "objection_price") score += 10;
  if (params.hasEmail) score += 25;
  if (params.hasPhone) score += 25;
  return Math.min(score, 100);
}

function bandFromScore(score: number): "cold" | "warm" | "hot" {
  if (score >= 60) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}

function buildLeadPreview(input: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  intent?: string | null;
  score_band: "cold" | "warm" | "hot";
  message: string;
}): string {
  const bits: string[] = [input.score_band.toUpperCase()];
  if (input.intent) bits.push(input.intent.toUpperCase());
  if (input.name) bits.push(input.name);
  if (input.email) bits.push(input.email);
  if (input.phone) bits.push(input.phone);
  const msg = input.message.replace(/\s+/g, " ").trim();
  const snippet = msg.length > 140 ? msg.slice(0, 140) + "…" : msg;
  return `${bits.join(" · ")} — ${snippet}`;
}

export async function upsertCompanyLead(params: {
  company_id: string;
  conversation_id: string;
  message: string;
  intent: string | null;
  commercial: boolean;
  state: FunnelState;
  action: DecidedAction;
}) {
  const email = extractEmail(params.message);
  const phone = extractPhone(params.message);
  const hasContact = !!email || !!phone;
  const leadSignals = extractLeadSignals(params.message);

  const { data: existing } = await supabaseServer
    .from("company_leads")
    .select("id,name,email,phone,score_total,score_band,status,lead_state,qualification_json,consents_json,tags,intent_score")
    .eq("company_id", params.company_id)
    .eq("conversation_id", params.conversation_id)
    .maybeSingle();

  const shouldCreate =
    !!existing ||
    params.commercial ||
    hasContact ||
    params.intent === "contact" ||
    params.state === "closing" ||
    params.action === "show_slots" ||
    params.action === "handoff";

  if (!shouldCreate) return;

  const prevScore = Number(existing?.score_total ?? 0);
  const nextScore = Math.max(
    prevScore,
    computeScore({
      message: params.message,
      commercial: params.commercial,
      hasEmail: !!(email || existing?.email),
      hasPhone: !!(phone || existing?.phone),
      intent: params.intent,
      state: params.state,
    })
  );

  const nextBand = bandFromScore(nextScore);
  const mergedEmail = existing?.email || email || null;
  const mergedPhone = existing?.phone || phone || null;

  const prevQual =
    existing?.qualification_json && typeof existing.qualification_json === "object"
      ? (existing.qualification_json as Record<string, unknown>)
      : {};

  const nextQual = {
    ...prevQual,
    last_user_message: params.message,
    last_intent: params.intent,
    funnel_state: params.state,
    ...(leadSignals.timeline ? { timeline: prevQual.timeline ?? leadSignals.timeline } : {}),
    ...(leadSignals.location ? { location: prevQual.location ?? leadSignals.location } : {}),
    ...(leadSignals.industry ? { industry: prevQual.industry ?? leadSignals.industry } : {}),
    booking_requested: prevQual.booking_requested || params.action === "show_slots",
    human_handoff_requested: prevQual.human_handoff_requested || params.action === "handoff",
  };

  const lead_preview = buildLeadPreview({
    name: existing?.name || null,
    email: mergedEmail,
    phone: mergedPhone,
    intent: params.intent,
    score_band: nextBand,
    message: params.message,
  });

  const prevBand = existing?.score_band ?? "cold";

  // Map funnel state → lead_state pipeline stage (only advance, never go backwards)
  const funnelToLeadState: Record<string, string> = {
    awareness: "discovery",
    pricing_interest: "qualified",
    objection_price: "qualified",
    qualification: "qualified",
    contact_capture: "committed",
    closing: "committed",
  };
  const nextLeadStateFromFunnel = funnelToLeadState[params.state] ?? "discovery";
  const leadStatePriority: Record<string, number> = {
    discovery: 0,
    qualified: 1,
    committed: 2,
    closed: 3,
  };
  const prevLeadState = existing?.lead_state || "discovery";
  const nextLeadState =
    (leadStatePriority[nextLeadStateFromFunnel] ?? 0) > (leadStatePriority[prevLeadState] ?? 0)
      ? nextLeadStateFromFunnel
      : prevLeadState;

  await supabaseServer.from("company_leads").upsert(
    {
      company_id: params.company_id,
      conversation_id: params.conversation_id,
      channel: "widget",
      lead_state: nextLeadState,
      status: existing?.status || "new",
      name: existing?.name || null,
      email: mergedEmail,
      phone: mergedPhone,
      qualification_json: nextQual,
      intent_score: Math.max(Number(existing?.intent_score ?? 0), intentScore(params.intent)),
      score_total: nextScore,
      score_band: nextBand,
      tags: existing?.tags ?? [],
      last_touch_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lead_preview,
    },
    { onConflict: "company_id,conversation_id" }
  );

  // Fire hot lead notification the first time a lead reaches "hot"
  if (nextBand === "hot" && prevBand !== "hot") {
    notifyHotLead({
      company_id: params.company_id,
      conversation_id: params.conversation_id,
      score_band: nextBand,
      name: existing?.name || null,
      email: mergedEmail,
      phone: mergedPhone,
      intent: params.intent,
      last_message: params.message,
    }).catch(() => {});
  }
}
