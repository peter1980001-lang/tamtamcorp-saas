import { describe, it, expect } from "vitest";
import {
  detectCommercial,
  detectContact,
  detectBookingIntent,
  detectFrustration,
  detectHumanHandoffRequest,
  detectPriceObjection,
  detectProceed,
  nextFunnelState,
  decideAction,
  oneStrategicQuestion,
} from "@/lib/funnelEngine";

// ─── Detectors ─────────────────────────────────────────────────────────────

describe("detectCommercial", () => {
  it("matches price/pricing keywords", () => {
    expect(detectCommercial("What is the price?")).toBe(true);
    expect(detectCommercial("Tell me about pricing")).toBe(true);
    expect(detectCommercial("Do you have a plan for startups?")).toBe(true);
  });

  it("matches German keywords", () => {
    expect(detectCommercial("Was kostet das?")).toBe(true);
    expect(detectCommercial("Was kosten die Pakete?")).toBe(true);
    expect(detectCommercial("Gibt es ein Abo?")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(detectCommercial("Hello, how are you?")).toBe(false);
    // "about" must not match the German "abo" subscription keyword
    expect(detectCommercial("Tell me about your features")).toBe(false);
    expect(detectCommercial("I want to know about the process")).toBe(false);
  });
});

describe("detectContact", () => {
  it("detects email addresses", () => {
    expect(detectContact("My email is john@example.com")).toBe(true);
    expect(detectContact("Reach me at test.user+tag@domain.co.uk")).toBe(true);
  });

  it("detects phone numbers", () => {
    expect(detectContact("Call me on +49 170 1234567")).toBe(true);
    expect(detectContact("My number is 0171 9876543")).toBe(true);
  });

  it("returns false when no contact info present", () => {
    expect(detectContact("I am interested in your services")).toBe(false);
    expect(detectContact("What are your hours?")).toBe(false);
  });
});

describe("detectBookingIntent", () => {
  it("detects booking/appointment keywords", () => {
    expect(detectBookingIntent("I want to book an appointment")).toBe(true);
    expect(detectBookingIntent("Can I schedule a slot for tomorrow?")).toBe(true);
    expect(detectBookingIntent("Are you available this week?")).toBe(true);
  });

  it("detects German booking keywords", () => {
    expect(detectBookingIntent("Ich möchte einen Termin buchen")).toBe(true);
    expect(detectBookingIntent("Haben Sie morgen Zeit?")).toBe(true);
  });

  it("does not trigger on unrelated messages", () => {
    expect(detectBookingIntent("Tell me about your services")).toBe(false);
    expect(detectBookingIntent("What does it cost?")).toBe(false);
  });
});

describe("detectFrustration", () => {
  it("detects repeated-question frustration", () => {
    expect(detectFrustration("You ask me every time! I already told you")).toBe(true);
    expect(detectFrustration("stop asking the same thing")).toBe(true);
    expect(detectFrustration("This is useless")).toBe(true);
  });

  it("detects German frustration", () => {
    expect(detectFrustration("Das ist nervig, warum fragst du das?")).toBe(true);
  });

  it("returns false for normal messages", () => {
    expect(detectFrustration("Can I see the pricing?")).toBe(false);
  });
});

describe("detectHumanHandoffRequest", () => {
  it("detects explicit human requests", () => {
    expect(detectHumanHandoffRequest("I want to speak to a real person")).toBe(true);
    expect(detectHumanHandoffRequest("Can I talk to the owner?")).toBe(true);
    expect(detectHumanHandoffRequest("call me please")).toBe(true);
  });

  it("detects German human requests", () => {
    expect(detectHumanHandoffRequest("Ich will mit einem echten Mitarbeiter sprechen")).toBe(true);
  });

  it("returns false for bot-friendly messages", () => {
    expect(detectHumanHandoffRequest("What are your prices?")).toBe(false);
  });
});

describe("detectPriceObjection", () => {
  it("detects price objections", () => {
    expect(detectPriceObjection("That seems too expensive")).toBe(true);
    expect(detectPriceObjection("This is way too pricey")).toBe(true);
    expect(detectPriceObjection("Das ist zu teuer")).toBe(true);
  });

  it("returns false for neutral price questions", () => {
    expect(detectPriceObjection("What is the price?")).toBe(false);
  });
});

describe("detectProceed", () => {
  it("detects proceed signals", () => {
    expect(detectProceed("How can we proceed?")).toBe(true);
    expect(detectProceed("What is the next step?")).toBe(true);
    expect(detectProceed("Let's start")).toBe(true);
  });
});

// ─── nextFunnelState ────────────────────────────────────────────────────────

describe("nextFunnelState", () => {
  it("returns contact_capture when contact info is shared", () => {
    expect(nextFunnelState({ message: "My email is test@example.com" })).toBe("contact_capture");
  });

  it("returns objection_price on price objection", () => {
    expect(nextFunnelState({ message: "That is too expensive" })).toBe("objection_price");
  });

  it("returns closing on proceed signal", () => {
    expect(nextFunnelState({ message: "How can we proceed?" })).toBe("closing");
  });

  it("returns pricing_interest on commercial keyword", () => {
    expect(nextFunnelState({ message: "Tell me about your pricing" })).toBe("pricing_interest");
  });

  it("returns awareness as default", () => {
    expect(nextFunnelState({ message: "Hi there" })).toBe("awareness");
  });

  it("persists qualification after pricing_interest", () => {
    expect(nextFunnelState({ message: "Okay", prev: "pricing_interest" })).toBe("qualification");
  });

  it("returns closing on booking intent when booking_priority is true", () => {
    const state = nextFunnelState({
      message: "Can I book an appointment tomorrow?",
      config: { booking_priority: true },
    });
    expect(state).toBe("closing");
  });
});

// ─── decideAction ───────────────────────────────────────────────────────────

describe("decideAction", () => {
  it("returns handoff when human handoff is requested", () => {
    expect(
      decideAction({ message: "I want to talk to a real person", state: "awareness" })
    ).toBe("handoff");
  });

  it("returns handoff when user is frustrated", () => {
    expect(
      decideAction({ message: "you keep asking me the same thing", state: "awareness" })
    ).toBe("handoff");
  });

  it("returns show_slots on booking intent with booking_priority", () => {
    expect(
      decideAction({
        message: "Book me an appointment tomorrow",
        state: "awareness",
        config: { booking_priority: true },
      })
    ).toBe("show_slots");
  });

  it("returns show_slots for local_service mode with booking intent", () => {
    expect(
      decideAction({
        message: "I want to schedule a slot",
        state: "awareness",
        config: { assistant_mode: "local_service" },
      })
    ).toBe("show_slots");
  });

  it("returns capture_contact when state is contact_capture", () => {
    expect(
      decideAction({ message: "Okay", state: "contact_capture" })
    ).toBe("capture_contact");
  });

  it("returns reply as default", () => {
    expect(
      decideAction({ message: "Tell me more about your services", state: "awareness" })
    ).toBe("reply");
  });

  it("respects human_handoff_enabled: false", () => {
    expect(
      decideAction({
        message: "I want to speak to the owner",
        state: "awareness",
        config: { human_handoff_enabled: false },
      })
    ).toBe("reply");
  });
});

// ─── oneStrategicQuestion ───────────────────────────────────────────────────

describe("oneStrategicQuestion", () => {
  it("returns null when require_qualification is false", () => {
    expect(oneStrategicQuestion("awareness", { require_qualification: false })).toBeNull();
  });

  it("asks industry question in awareness for sales mode", () => {
    const q = oneStrategicQuestion("awareness", {}, {});
    expect(q).toBe("What industry are you in?");
  });

  it("skips already-known fields", () => {
    const q = oneStrategicQuestion("awareness", {}, { industry: "retail" });
    // industry is known, should ask next unknown field
    expect(q).toBe("What outcome are you aiming for—more leads, bookings, or support automation?");
  });

  it("asks booking question in closing for local_service", () => {
    const q = oneStrategicQuestion("closing", { assistant_mode: "local_service" }, {});
    expect(q).toBe("What time works best for you?");
  });

  it("asks price objection budget question", () => {
    const q = oneStrategicQuestion("objection_price", {}, {});
    expect(q).toBe("What monthly budget range would feel comfortable so I can recommend the best plan?");
  });

  it("returns contact_capture question for soft_close", () => {
    const q = oneStrategicQuestion("contact_capture", { closing_style: "soft_close" }, {});
    expect(q).toMatch(/demo call|set it up/i);
  });
});
