import type { AssistantMode, ClosingStyle, FunnelState, PrimaryGoal, QuestionStyle } from "@/lib/funnelEngine";

export type { FunnelState };

export type FunnelConfig = {
  enabled: boolean;
  objection_handling: boolean;
  require_qualification: boolean;
  show_pricing: boolean;
  pricing_strategy: "multi-tier" | "anchor" | "request-only";
  allow_unknown_fallback: boolean;

  tone: "consultative" | "direct" | "luxury" | "formal" | "playful";
  response_length: "concise" | "medium" | "detailed";
  language: string;

  cta_style: "one-question" | "strong-close" | "soft-close";
  default_cta: string | null;

  qualification_fields: Record<string, unknown>;
  retrieval_overrides: Record<string, unknown>;

  assistant_mode: AssistantMode;
  primary_goal: PrimaryGoal;
  question_style: QuestionStyle;
  closing_style: ClosingStyle;
  booking_priority: boolean;
  human_handoff_enabled: boolean;
  human_handoff_triggers: Record<string, unknown>;
  model: string;
  temperature: number;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type DecidedAction = "reply" | "show_slots" | "capture_contact" | "handoff";
