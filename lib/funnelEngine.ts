export type FunnelState =
  | "awareness"
  | "pricing_interest"
  | "objection_price"
  | "qualification"
  | "contact_capture"
  | "closing";

export function detectPriceObjection(text: string) {
  return /(too expensive|expensive|teuer|zu teuer|pricey|costly)/i.test(text);
}

export function detectProceed(text: string) {
  return /(how can we proceed|next step|what now|let's proceed|start|book|schedule|call|demo|meeting|weiter|wie geht es weiter)/i.test(text);
}

export function detectCommercial(text: string) {
  return /(price|pricing|cost|quote|offer|demo|trial|subscribe|plan|package|preis|kosten|angebot|paket|abo)/i.test(text);
}

export function detectContact(text: string) {
  const email = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text);
  const phone = /(\+?\d[\d\s().-]{7,}\d)/.test(text);
  return email || phone;
}

export function nextFunnelState(params: { message: string; prev?: FunnelState | null }) : FunnelState {
  const { message, prev } = params;

  if (detectContact(message)) return "contact_capture";
  if (detectPriceObjection(message)) return "objection_price";
  if (detectProceed(message)) return "closing";
  if (detectCommercial(message)) return "pricing_interest";

  // If we already are in pricing/qualification, keep it sticky
  if (prev === "pricing_interest" || prev === "objection_price") return "qualification";
  if (prev === "qualification") return "qualification";

  return "awareness";
}

export function oneStrategicQuestion(state: FunnelState, fields: any) {
  // fields = qualification_fields config
  const wantIndustry = fields?.industry !== false;
  const wantGoal = fields?.goal !== false;
  const wantTimeline = fields?.timeline !== false;
  const wantBudget = fields?.budget !== false;

  if (state === "awareness") {
    if (wantIndustry) return "What industry are you in?";
    if (wantGoal) return "What outcome are you aiming for—more leads, bookings, or support automation?";
    return "What is the main goal you want to achieve with the AI assistant?";
  }

  if (state === "pricing_interest") {
    if (wantTimeline) return "When do you want to go live—this week, this month, or later?";
    return "Roughly how much traffic or how many chats per month do you expect?";
  }

  if (state === "objection_price") {
    if (wantBudget) return "What monthly budget range would feel comfortable so I can recommend the best plan?";
    return "What’s your expected number of conversations per month?";
  }

  if (state === "qualification") {
    if (wantGoal) return "What would a ‘perfect lead’ look like for you (industry, budget, location, urgency)?";
    return "Do you want the bot to focus more on qualification or immediate appointment booking?";
  }

  if (state === "contact_capture") {
    return "Would you like a quick demo call, or should we set it up directly on your website first?";
  }

  return "Would you like to start with a quick demo or a setup checklist?";
}