import { supabaseServer } from "@/lib/supabaseServer";
import type { FunnelConfig } from "./types";

export async function loadFunnelConfig(company_id: string): Promise<FunnelConfig> {
  const { data } = await supabaseServer
    .from("company_funnel_config")
    .select("*")
    .eq("company_id", company_id)
    .maybeSingle();

  return {
    enabled: data?.enabled ?? true,
    objection_handling: data?.objection_handling ?? true,
    require_qualification: data?.require_qualification ?? true,
    show_pricing: data?.show_pricing ?? true,
    pricing_strategy: (data?.pricing_strategy as FunnelConfig["pricing_strategy"]) ?? "multi-tier",
    allow_unknown_fallback: data?.allow_unknown_fallback ?? true,

    tone: (data?.tone as FunnelConfig["tone"]) ?? "consultative",
    response_length: (data?.response_length as FunnelConfig["response_length"]) ?? "concise",
    language: (data?.language as string) ?? "auto",

    cta_style: (data?.cta_style as FunnelConfig["cta_style"]) ?? "one-question",
    default_cta: data?.default_cta ?? null,

    qualification_fields: data?.qualification_fields ?? {
      industry: true,
      goal: true,
      timeline: true,
      budget: true,
      location: false,
    },

    retrieval_overrides: data?.retrieval_overrides ?? {
      pricing: { enabled: true, match_count: 12, force_sections: ["pricing", "plans"] },
    },

    assistant_mode: (data?.assistant_mode as FunnelConfig["assistant_mode"]) ?? "sales",
    primary_goal: (data?.primary_goal as FunnelConfig["primary_goal"]) ?? "capture_leads",
    question_style: (data?.question_style as FunnelConfig["question_style"]) ?? "guided",
    closing_style: (data?.closing_style as FunnelConfig["closing_style"]) ?? "soft_close",
    booking_priority: data?.booking_priority ?? false,
    human_handoff_enabled: data?.human_handoff_enabled ?? true,
    human_handoff_triggers: data?.human_handoff_triggers ?? {
      owner_request: true,
      frustrated_user: true,
      repeated_failure: true,
    },
  };
}
