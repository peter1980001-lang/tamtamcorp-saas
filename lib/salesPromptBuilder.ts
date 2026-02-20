import type { FunnelState } from "@/lib/funnelEngine";

type FunnelConfig = {
  enabled: boolean;
  objection_handling: boolean;
  require_qualification: boolean;
  show_pricing: boolean;
  pricing_strategy: string;
  allow_unknown_fallback: boolean;

  tone: string;
  response_length: string;
  language: string;

  cta_style: string;
  default_cta: string | null;

  qualification_fields: any;
};

function toneGuidelines(tone: string) {
  if (tone === "luxury") return "Tone: premium, confident, concise. No hype. Elegant wording.";
  if (tone === "formal") return "Tone: formal, corporate, precise.";
  if (tone === "direct") return "Tone: direct, efficient, sales-oriented.";
  if (tone === "playful") return "Tone: friendly, light, but still professional.";
  return "Tone: consultative, helpful, confident.";
}

function lengthGuidelines(len: string) {
  if (len === "detailed") return "Length: detailed but structured (headings/bullets).";
  if (len === "medium") return "Length: medium. Short paragraphs, some bullets.";
  return "Length: concise. Max ~6-10 lines unless necessary.";
}

export function buildSalesSystemPrompt(params: {
  companyName: string;
  config: FunnelConfig;
  state: FunnelState;
  strategicQuestion: string;
  knowledgeContext: string;
}) {
  const { companyName, config, state, strategicQuestion, knowledgeContext } = params;

  const rules = [
    "Never say: 'knowledge context does not provide'.",
    "If info is missing: ask a clarifying question or offer a next step.",
    "Ask exactly ONE strategic follow-up question at the end.",
    "Always keep the user moving toward qualification and contact capture.",
  ];

  if (config.show_pricing) {
    rules.push(
      "If user asks about pricing: present ALL available plans (Starter/Growth/Pro) in one compact block and recommend one based on their answers."
    );
    if (config.objection_handling) {
      rules.push(
        "If user says it's expensive: validate, offer a lower tier, then ask a qualification question (traffic/budget/timeline)."
      );
    }
  }

  const lang = config.language && config.language !== "auto" ? `Language: ${config.language}` : "Language: match the user's language.";

  return `
You are ${companyName}'s high-conversion AI Sales Concierge.

Goal:
1) Understand intent and funnel stage (${state})
2) Answer accurately using KNOWLEDGE CONTEXT
3) Qualify the visitor (one key question)
4) Move toward contact capture (email/phone) or booking

${lang}
${toneGuidelines(config.tone)}
${lengthGuidelines(config.response_length)}

Rules:
- ${rules.join("\n- ")}

End your answer with exactly one question:
"${strategicQuestion}"

KNOWLEDGE CONTEXT:
${knowledgeContext || "(empty)"}
`.trim();
}