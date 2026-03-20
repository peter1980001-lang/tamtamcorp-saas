export type FunnelState =
  | "awareness"
  | "pricing_interest"
  | "objection_price"
  | "qualification"
  | "contact_capture"
  | "closing";

export type AssistantMode = "sales" | "local_service" | "support" | "hybrid";
export type PrimaryGoal =
  | "book_appointments"
  | "capture_leads"
  | "qualify_before_contact"
  | "answer_questions"
  | "sell_services";
export type QuestionStyle = "minimal" | "guided" | "qualification_heavy";
export type ClosingStyle = "booking_first" | "contact_first" | "soft_close" | "strong_close";

export type FunnelConfigLite = {
  require_qualification?: boolean | null;
  qualification_fields?: Record<string, unknown>;

  assistant_mode?: AssistantMode | string | null;
  primary_goal?: PrimaryGoal | string | null;
  question_style?: QuestionStyle | string | null;
  closing_style?: ClosingStyle | string | null;
  booking_priority?: boolean | null;

  human_handoff_enabled?: boolean | null;
  human_handoff_triggers?: Record<string, unknown>;
};

export function detectPriceObjection(text: string) {
  return /(too expensive|expensive|teuer|zu teuer|pricey|costly|overpriced)/i.test(text);
}

export function detectProceed(text: string) {
  return /(how can we proceed|next step|what now|let's proceed|start|weiter|wie geht es weiter)/i.test(text);
}

export function detectCommercial(text: string) {
  return /(price|pricing|cost|quote|offer|proposal|trial|subscribe|plan|package|preis|kostet?|angebot|paket|\babo\b)/i.test(text);
}

export function detectContact(text: string) {
  const email = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text);
  const phone = /(\+?\d[\d\s().-]{7,}\d)/.test(text);
  return email || phone;
}

export function detectBookingIntent(text: string) {
  return /(appointment|termin|book|booking|schedule|slot|available|availability|tomorrow|morgen|today|heute|this week|next week|friday|monday|tuesday|wednesday|thursday|saturday|sunday|uhrzeit|time tomorrow|have time|as soon as possible|asap)/i.test(
    text
  );
}

export function detectHumanHandoffRequest(text: string) {
  return /(owner|human|real person|real human|someone real|manager|call me|whatsapp|phone me|i want talk real person|ich will mit einem menschen sprechen|echte person|mitarbeiter)/i.test(
    text
  );
}

export function detectFrustration(text: string) {
  return /(why do you ask|you ask me everytime|you ask me every time|i told you|already told you|this is useless|annoying|stop asking|you keep asking|warum fragst du|ich habe es schon gesagt|nervig)/i.test(
    text
  );
}

export function nextFunnelState(params: {
  message: string;
  prev?: FunnelState | null;
  config?: FunnelConfigLite | null;
}): FunnelState {
  const { message, prev, config } = params;

  const assistantMode = String(config?.assistant_mode || "sales");
  const primaryGoal = String(config?.primary_goal || "capture_leads");
  const bookingPriority = !!config?.booking_priority;

  if (detectContact(message)) return "contact_capture";
  if (detectPriceObjection(message)) return "objection_price";

  if (
    detectBookingIntent(message) &&
    (bookingPriority || assistantMode === "local_service" || primaryGoal === "book_appointments")
  ) {
    return "closing";
  }

  if (detectProceed(message)) return "closing";
  if (detectCommercial(message)) return "pricing_interest";

  if (prev === "pricing_interest" || prev === "objection_price") return "qualification";
  if (prev === "qualification") return "qualification";

  return "awareness";
}

export function decideAction(params: {
  message: string;
  state: FunnelState;
  config?: FunnelConfigLite | null;
}): "reply" | "show_slots" | "capture_contact" | "handoff" {
  const { message, state, config } = params;

  const assistantMode = String(config?.assistant_mode || "sales");
  const primaryGoal = String(config?.primary_goal || "capture_leads");
  const bookingPriority = !!config?.booking_priority;
  const humanHandoffEnabled = config?.human_handoff_enabled !== false;
  const handoffTriggers =
    config?.human_handoff_triggers && typeof config.human_handoff_triggers === "object"
      ? config.human_handoff_triggers
      : {
          owner_request: true,
          frustrated_user: true,
          repeated_failure: true,
        };

  const wantsHuman = detectHumanHandoffRequest(message);
  const isFrustrated = detectFrustration(message);

  if (humanHandoffEnabled) {
    if (handoffTriggers.owner_request !== false && wantsHuman) return "handoff";
    if (handoffTriggers.frustrated_user !== false && isFrustrated) return "handoff";
  }

  const bookingIntent = detectBookingIntent(message);
  if (
    bookingIntent &&
    (bookingPriority || assistantMode === "local_service" || primaryGoal === "book_appointments")
  ) {
    return "show_slots";
  }

  if (state === "contact_capture") return "capture_contact";
  return "reply";
}

export function oneStrategicQuestion(
  state: FunnelState,
  config?: FunnelConfigLite | null,
  known?: Record<string, unknown> | null
): string | null {
  const fields = config?.qualification_fields || {};
  const assistantMode = String(config?.assistant_mode || "sales");
  const primaryGoal = String(config?.primary_goal || "capture_leads");
  const questionStyle = String(config?.question_style || "guided");
  const closingStyle = String(config?.closing_style || "soft_close");

  const knownObj = known && typeof known === "object" ? known : {};

  const wantIndustry = fields?.industry !== false && !knownObj?.industry;
  const wantGoal = fields?.goal !== false && !knownObj?.goal;
  const wantTimeline = fields?.timeline !== false && !knownObj?.timeline;
  const wantBudget = fields?.budget !== false && !knownObj?.budget;
  const wantLocation = fields?.location === true && !knownObj?.location;

  const isLocalService = assistantMode === "local_service" || primaryGoal === "book_appointments";

  if (config?.require_qualification === false) return null;

  if (questionStyle === "minimal" && isLocalService) {
    if (state === "closing") return "What time works best for you?";
    if (wantTimeline) return "When would you like to come in?";
    if (wantLocation) return "Are you already in the area, or would you be traveling in?";
    return null;
  }

  if (state === "awareness") {
    if (isLocalService) {
      if (wantTimeline) return "When would you like to come in?";
      if (wantLocation) return "Are you already nearby, or would you be traveling in?";
      return "Would you like me to check the next available appointment slots?";
    }

    if (wantIndustry) return "What industry are you in?";
    if (wantGoal) return "What outcome are you aiming for—more leads, bookings, or support automation?";
    if (wantTimeline) return "When do you want to go live—this week, this month, or later?";
    return "What is the main goal you want to achieve with the AI assistant?";
  }

  if (state === "pricing_interest") {
    if (isLocalService) {
      if (wantTimeline) return "When would you like to come in?";
      return "Would you like me to check the next available slots?";
    }

    if (wantTimeline) return "When do you want to go live—this week, this month, or later?";
    if (wantBudget) return "What budget range are you considering?";
    return "Roughly how many conversations per month do you expect?";
  }

  if (state === "objection_price") {
    if (isLocalService) {
      if (wantTimeline) return "Do you want the earliest available slot, or a specific day?";
      return "Would you like me to check the next available appointment options?";
    }

    if (wantBudget) return "What monthly budget range would feel comfortable so I can recommend the best plan?";
    return "What’s your expected number of conversations per month?";
  }

  if (state === "qualification") {
    if (isLocalService) {
      if (wantTimeline) return "When would you like to come in?";
      if (wantLocation) return "Are you local, or should we plan around your travel schedule?";
      return "Would you like me to check the next available appointment slots?";
    }

    if (questionStyle === "qualification_heavy" && wantGoal) {
      return "What would a perfect lead look like for you in terms of industry, budget, location, and urgency?";
    }
    if (wantGoal) return "Do you want the bot to focus more on qualification, direct booking, or support?";
    if (wantBudget) return "What budget range are you working with?";
    return "Would you like a quick recommendation on the best next step?";
  }

  if (state === "contact_capture") {
    if (closingStyle === "booking_first" || isLocalService) return "Would you like me to help you secure the next available slot?";
    if (closingStyle === "contact_first") return "What is the best email or phone number to reach you on?";
    return "Would you like a quick demo call, or should we set it up directly on your website first?";
  }

  if (state === "closing") {
    if (closingStyle === "booking_first" || isLocalService) return "What time works best for you?";
    if (closingStyle === "contact_first") return "What is the best email or phone number to reach you on?";
    if (closingStyle === "strong_close") return "Would you like to move forward now?";
    return "Would you like the next step, or do you want me to answer one more question first?";
  }

  return null;
}