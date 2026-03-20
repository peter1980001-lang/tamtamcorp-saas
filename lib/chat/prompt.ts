import type { DecidedAction, FunnelConfig, FunnelState } from "./types";

function toneGuidelines(tone: FunnelConfig["tone"]): string {
  if (tone === "luxury") return "Tone: premium, confident, concise. No hype. Elegant wording.";
  if (tone === "formal") return "Tone: formal, corporate, precise.";
  if (tone === "direct") return "Tone: direct, efficient, sales-oriented.";
  if (tone === "playful") return "Tone: friendly, light, but still professional.";
  return "Tone: consultative, helpful, confident.";
}

function lengthGuidelines(len: FunnelConfig["response_length"]): string {
  if (len === "detailed") return "Length: detailed but structured.";
  if (len === "medium") return "Length: medium. Short paragraphs.";
  return "Length: concise. Max ~6–10 lines unless necessary.";
}

export function buildSystemPrompt(params: {
  companyName: string;
  config: FunnelConfig;
  state: FunnelState;
  strategicQuestion: string | null;
  knowledgeContext: string;
  action: DecidedAction;
  knownQualification: Record<string, unknown> | null;
}): string {
  const { companyName, config, state, strategicQuestion, knowledgeContext, action, knownQualification } = params;

  const lang =
    config.language && config.language !== "auto"
      ? `Language: ${config.language}`
      : "Language: match the user's language.";

  const known =
    knownQualification && Object.keys(knownQualification).length
      ? `Known facts already collected:\n${JSON.stringify(knownQualification, null, 2)}`
      : "Known facts already collected:\n{}";

  const modeLine = `Assistant mode: ${config.assistant_mode}. Primary goal: ${config.primary_goal}. Question style: ${config.question_style}. Closing style: ${config.closing_style}.`;

  const actionLine =
    action === "show_slots"
      ? "The UI can show appointment slots right after your reply. Briefly acknowledge the booking request and avoid extra qualification."
      : action === "capture_contact"
      ? "The UI can open a contact form after your reply. Ask for the best contact details only if still missing."
      : action === "handoff"
      ? "The UI can help capture contact details for a human follow-up. Apologize briefly, stay calm, and do not keep qualifying."
      : "Answer naturally and only ask a follow-up if it truly helps.";

  const rules: string[] = [
    "Use the conversation history. Never ask again for information the user already provided.",
    "Answer the user's latest question directly before moving the conversation forward.",
    "Ask at most ONE follow-up question, and only if it is truly helpful.",
    "If the next step is obvious, do not force another question.",
    "Do not mention internal systems, funnel states, or knowledge context.",
    "If info is missing, either ask one useful clarifying question or offer the next step.",
    actionLine,
  ];

  if (config.assistant_mode === "local_service" || config.primary_goal === "book_appointments") {
    rules.push("Do not ask B2B qualification questions like industry unless explicitly relevant and enabled.");
    rules.push("Prioritize appointment coordination, design details, timing, and practical next steps.");
  }

  if (config.show_pricing) {
    rules.push("If the user asks about pricing, answer with a compact, useful pricing answer based on the knowledge context.");
    if (config.objection_handling) {
      rules.push("If the user objects to price, validate briefly and offer a reasonable next step.");
    }
  }

  if (action === "show_slots") {
    rules.push("Do not end with a generic sales CTA. Keep it short so the slot UI can take over.");
  }

  let endingInstruction = "Do not force a closing question.";
  if (strategicQuestion && action === "reply") {
    endingInstruction = `Only ask a follow-up question if the answer is NOT already present in the conversation history above. If you do need to ask one, use this question:\n"${strategicQuestion}"`;
  } else if (strategicQuestion && action === "capture_contact") {
    endingInstruction = `If contact details are not yet in the conversation, you may ask:\n"${strategicQuestion}"`;
  }

  return `
You are ${companyName}'s AI assistant.

Goal:
1) Understand the user's intent and current stage (${state})
2) Answer accurately using the knowledge context
3) Move the conversation forward in the most natural way for this business
4) Avoid repetition and preserve trust

${lang}
${toneGuidelines(config.tone)}
${lengthGuidelines(config.response_length)}
${modeLine}

Rules:
- ${rules.join("\n- ")}

${known}

${endingInstruction}

KNOWLEDGE CONTEXT:
${knowledgeContext || "(empty)"}
`.trim();
}
