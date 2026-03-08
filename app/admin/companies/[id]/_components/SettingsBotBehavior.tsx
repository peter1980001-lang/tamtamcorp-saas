"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Button, Input, Textarea, UI } from "./ui";
import { fetchJson } from "./api";

type FunnelConfigRow = {
  company_id: string;
  enabled?: boolean | null;
  objection_handling?: boolean | null;
  require_qualification?: boolean | null;
  show_pricing?: boolean | null;
  pricing_strategy?: "multi-tier" | "anchor" | "request-only" | string | null;
  allow_unknown_fallback?: boolean | null;

  tone?: "consultative" | "direct" | "luxury" | "formal" | "playful" | string | null;
  response_length?: "concise" | "medium" | "detailed" | string | null;
  language?: string | null;

  cta_style?: "one-question" | "strong-close" | "soft-close" | string | null;
  default_cta?: string | null;

  qualification_fields?: any;
  retrieval_overrides?: any;

  assistant_mode?: "sales" | "local_service" | "support" | "hybrid" | string | null;
  primary_goal?:
    | "book_appointments"
    | "capture_leads"
    | "qualify_before_contact"
    | "answer_questions"
    | "sell_services"
    | string
    | null;
  question_style?: "minimal" | "guided" | "qualification_heavy" | string | null;
  closing_style?: "booking_first" | "contact_first" | "soft_close" | "strong_close" | string | null;
  booking_priority?: boolean | null;
  human_handoff_enabled?: boolean | null;
  human_handoff_triggers?: any;
};

function toBool(v: any, fallback: boolean) {
  return typeof v === "boolean" ? v : fallback;
}

function safeObj(v: any) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export default function SettingsBotBehavior(props: {
  companyId: string;
  setToast: (s: string) => void;
}) {
  const { companyId, setToast } = props;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<FunnelConfigRow | null>(null);

  const view = useMemo(() => {
    const c = cfg || ({} as FunnelConfigRow);
    const qf = safeObj(c.qualification_fields);
    const ht = safeObj(c.human_handoff_triggers);

    return {
      enabled: toBool(c.enabled, true),
      objection_handling: toBool(c.objection_handling, true),
      require_qualification: toBool(c.require_qualification, true),
      show_pricing: toBool(c.show_pricing, true),
      pricing_strategy: (c.pricing_strategy || "multi-tier") as string,
      allow_unknown_fallback: toBool(c.allow_unknown_fallback, true),

      tone: (c.tone || "consultative") as string,
      response_length: (c.response_length || "concise") as string,
      language: (c.language || "auto") as string,

      cta_style: (c.cta_style || "one-question") as string,
      default_cta: (c.default_cta || "") as string,

      assistant_mode: (c.assistant_mode || "sales") as string,
      primary_goal: (c.primary_goal || "capture_leads") as string,
      question_style: (c.question_style || "guided") as string,
      closing_style: (c.closing_style || "soft_close") as string,
      booking_priority: toBool(c.booking_priority, false),

      human_handoff_enabled: toBool(c.human_handoff_enabled, true),
      human_handoff_triggers: {
        owner_request: ht.owner_request !== false,
        frustrated_user: ht.frustrated_user !== false,
        repeated_failure: ht.repeated_failure !== false,
      },

      qualification_fields: {
        industry: qf.industry !== false,
        goal: qf.goal !== false,
        timeline: qf.timeline !== false,
        budget: qf.budget !== false,
        location: qf.location === true,
      },
    };
  }, [cfg]);

  async function load() {
    setLoading(true);
    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/funnel-config`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    setLoading(false);

    if (!ok) {
      setToast(json?.error || "funnel_config_load_failed");
      setCfg(null);
      return;
    }

    setCfg((json?.config ?? null) as FunnelConfigRow | null);
  }

  useEffect(() => {
    void load();
  }, [companyId]);

  function patch(partial: Partial<FunnelConfigRow>) {
    setCfg((prev) => ({ ...(prev || ({ company_id: companyId } as FunnelConfigRow)), ...partial }));
  }

  function patchQualificationField(key: string, val: boolean) {
    const prev = safeObj(cfg?.qualification_fields);
    patch({
      qualification_fields: {
        ...prev,
        [key]: val,
      },
    });
  }

  function patchHandoffTrigger(key: string, val: boolean) {
    const prev = safeObj(cfg?.human_handoff_triggers);
    patch({
      human_handoff_triggers: {
        ...prev,
        [key]: val,
      },
    });
  }

  function applyPreset(preset: "sales" | "local_service" | "support" | "hybrid") {
    if (preset === "local_service") {
      patch({
        assistant_mode: "local_service",
        primary_goal: "book_appointments",
        question_style: "minimal",
        closing_style: "booking_first",
        booking_priority: true,
        require_qualification: true,
        show_pricing: true,
        objection_handling: true,
        qualification_fields: {
          industry: false,
          goal: false,
          timeline: true,
          budget: false,
          location: true,
        },
      });
      setToast("Local service preset loaded");
      return;
    }

    if (preset === "support") {
      patch({
        assistant_mode: "support",
        primary_goal: "answer_questions",
        question_style: "minimal",
        closing_style: "soft_close",
        booking_priority: false,
        require_qualification: false,
        show_pricing: false,
        objection_handling: false,
        qualification_fields: {
          industry: false,
          goal: false,
          timeline: false,
          budget: false,
          location: false,
        },
      });
      setToast("Support preset loaded");
      return;
    }

    if (preset === "hybrid") {
      patch({
        assistant_mode: "hybrid",
        primary_goal: "capture_leads",
        question_style: "guided",
        closing_style: "soft_close",
        booking_priority: true,
        require_qualification: true,
        show_pricing: true,
        objection_handling: true,
        qualification_fields: {
          industry: false,
          goal: true,
          timeline: true,
          budget: true,
          location: true,
        },
      });
      setToast("Hybrid preset loaded");
      return;
    }

    patch({
      assistant_mode: "sales",
      primary_goal: "qualify_before_contact",
      question_style: "guided",
      closing_style: "contact_first",
      booking_priority: false,
      require_qualification: true,
      show_pricing: true,
      objection_handling: true,
      qualification_fields: {
        industry: true,
        goal: true,
        timeline: true,
        budget: true,
        location: false,
      },
    });
    setToast("Sales preset loaded");
  }

  async function save() {
    if (!cfg) return;

    setSaving(true);

    const payload: Partial<FunnelConfigRow> = {
      enabled: view.enabled,
      objection_handling: view.objection_handling,
      require_qualification: view.require_qualification,
      show_pricing: view.show_pricing,
      pricing_strategy: view.pricing_strategy as any,
      allow_unknown_fallback: view.allow_unknown_fallback,

      tone: view.tone as any,
      response_length: view.response_length as any,
      language: view.language,

      cta_style: view.cta_style as any,
      default_cta: view.default_cta ? view.default_cta.trim() : null,

      assistant_mode: view.assistant_mode as any,
      primary_goal: view.primary_goal as any,
      question_style: view.question_style as any,
      closing_style: view.closing_style as any,
      booking_priority: !!view.booking_priority,

      human_handoff_enabled: !!view.human_handoff_enabled,
      human_handoff_triggers: {
        owner_request: !!view.human_handoff_triggers.owner_request,
        frustrated_user: !!view.human_handoff_triggers.frustrated_user,
        repeated_failure: !!view.human_handoff_triggers.repeated_failure,
      },

      qualification_fields: {
        industry: !!view.qualification_fields.industry,
        goal: !!view.qualification_fields.goal,
        timeline: !!view.qualification_fields.timeline,
        budget: !!view.qualification_fields.budget,
        location: !!view.qualification_fields.location,
      },
    };

    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/funnel-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!ok) {
      setToast(json?.error || "funnel_config_save_failed");
      return;
    }

    setCfg((json?.config ?? null) as FunnelConfigRow | null);
    setToast("Bot behavior saved");
  }

  async function resetToDefaults() {
    patch({
      enabled: true,
      objection_handling: true,
      require_qualification: true,
      show_pricing: true,
      pricing_strategy: "multi-tier",
      allow_unknown_fallback: true,

      tone: "consultative",
      response_length: "concise",
      language: "auto",

      cta_style: "one-question",
      default_cta: null,

      assistant_mode: "sales",
      primary_goal: "capture_leads",
      question_style: "guided",
      closing_style: "soft_close",
      booking_priority: false,
      human_handoff_enabled: true,
      human_handoff_triggers: {
        owner_request: true,
        frustrated_user: true,
        repeated_failure: true,
      },

      qualification_fields: {
        industry: true,
        goal: true,
        timeline: true,
        budget: true,
        location: false,
      },
    });

    setToast("Defaults loaded (click Save)");
  }

  if (loading) {
    return (
      <Card title="Bot Behavior" subtitle="Controls how the AI responds.">
        Loading…
      </Card>
    );
  }

  return (
    <Card
      title="Bot Behavior"
      subtitle="Controls tone, conversation strategy, qualification and booking behavior. Applies instantly to the widget and Test Chat."
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            border: `1px solid ${UI.border}`,
            borderRadius: UI.radiusLg,
            padding: 14,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 1000, color: UI.text }}>Presets</div>
          <div style={{ marginTop: 6, fontSize: 12.5, color: UI.text2 }}>
            Quick-start configurations for common business types.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <Button variant="secondary" onClick={() => applyPreset("sales")}>Sales</Button>
            <Button variant="secondary" onClick={() => applyPreset("local_service")}>Local service</Button>
            <Button variant="secondary" onClick={() => applyPreset("support")}>Support</Button>
            <Button variant="secondary" onClick={() => applyPreset("hybrid")}>Hybrid</Button>
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${UI.border}`,
            borderRadius: UI.radiusLg,
            padding: 14,
            background: "#fff",
          }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <ToggleRow
              label="Funnel enabled"
              value={view.enabled}
              onChange={(v) => patch({ enabled: v })}
              hint="If off, the bot still answers, but funnel logic should stay light."
            />
            <ToggleRow
              label="Show pricing"
              value={view.show_pricing}
              onChange={(v) => patch({ show_pricing: v })}
              hint="If on, pricing questions get compact plan blocks from knowledge."
            />
            <ToggleRow
              label="Objection handling"
              value={view.objection_handling}
              onChange={(v) => patch({ objection_handling: v })}
              hint="Handles 'too expensive' style objections."
            />
            <ToggleRow
              label="Require qualification"
              value={view.require_qualification}
              onChange={(v) => patch({ require_qualification: v })}
              hint="If on, the bot may ask a strategic follow-up when useful."
            />
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${UI.border}`,
            borderRadius: UI.radiusLg,
            padding: 14,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 1000, color: UI.text }}>Conversation strategy</div>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Assistant mode">
                <select
                  value={view.assistant_mode}
                  onChange={(e) => patch({ assistant_mode: e.target.value as any })}
                  style={selectStyle}
                >
                  <option value="sales">Sales</option>
                  <option value="local_service">Local service</option>
                  <option value="support">Support</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </Field>

              <Field label="Primary goal">
                <select
                  value={view.primary_goal}
                  onChange={(e) => patch({ primary_goal: e.target.value as any })}
                  style={selectStyle}
                >
                  <option value="book_appointments">Book appointments</option>
                  <option value="capture_leads">Capture leads</option>
                  <option value="qualify_before_contact">Qualify before contact</option>
                  <option value="answer_questions">Answer questions</option>
                  <option value="sell_services">Sell services</option>
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Question style">
                <select
                  value={view.question_style}
                  onChange={(e) => patch({ question_style: e.target.value as any })}
                  style={selectStyle}
                >
                  <option value="minimal">Minimal</option>
                  <option value="guided">Guided</option>
                  <option value="qualification_heavy">Qualification heavy</option>
                </select>
              </Field>

              <Field label="Closing style">
                <select
                  value={view.closing_style}
                  onChange={(e) => patch({ closing_style: e.target.value as any })}
                  style={selectStyle}
                >
                  <option value="booking_first">Booking first</option>
                  <option value="contact_first">Contact first</option>
                  <option value="soft_close">Soft close</option>
                  <option value="strong_close">Strong close</option>
                </select>
              </Field>
            </div>

            <ToggleRow
              label="Booking priority"
              value={view.booking_priority}
              onChange={(v) => patch({ booking_priority: v })}
              hint="If on, booking phrases like 'tomorrow' or 'available' push the bot into appointment coordination faster."
            />
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${UI.border}`,
            borderRadius: UI.radiusLg,
            padding: 14,
            background: "#fff",
          }}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Tone">
                <select
                  value={view.tone}
                  onChange={(e) => patch({ tone: e.target.value as any })}
                  style={selectStyle}
                >
                  <option value="consultative">Consultative</option>
                  <option value="direct">Direct</option>
                  <option value="luxury">Luxury</option>
                  <option value="formal">Formal</option>
                  <option value="playful">Playful</option>
                </select>
              </Field>

              <Field label="Response length">
                <select
                  value={view.response_length}
                  onChange={(e) => patch({ response_length: e.target.value as any })}
                  style={selectStyle}
                >
                  <option value="concise">Concise</option>
                  <option value="medium">Medium</option>
                  <option value="detailed">Detailed</option>
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="CTA style">
                <select
                  value={view.cta_style}
                  onChange={(e) => patch({ cta_style: e.target.value as any })}
                  style={selectStyle}
                >
                  <option value="one-question">One question</option>
                  <option value="soft-close">Soft close</option>
                  <option value="strong-close">Strong close</option>
                </select>
              </Field>

              <Field label="Language">
                <Input
                  value={view.language}
                  onChange={(e) => patch({ language: e.target.value })}
                  placeholder="auto / en / de / ar"
                />
              </Field>
            </div>

            <Field label="Default closing question (optional)">
              <Textarea
                value={view.default_cta}
                onChange={(e) => patch({ default_cta: e.target.value })}
                placeholder='Example: "Would you like me to check the next available appointment slots?"'
                style={{ minHeight: 90 }}
              />
            </Field>

            <Field label="Pricing strategy">
              <select
                value={view.pricing_strategy}
                onChange={(e) => patch({ pricing_strategy: e.target.value as any })}
                style={selectStyle}
              >
                <option value="multi-tier">Multi-tier</option>
                <option value="anchor">Anchor</option>
                <option value="request-only">Request-only</option>
              </select>
            </Field>
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${UI.border}`,
            borderRadius: UI.radiusLg,
            padding: 14,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 1000, color: UI.text }}>Qualification fields</div>
          <div style={{ marginTop: 6, fontSize: 12.5, color: UI.text2 }}>
            Choose what the bot should try to collect over the conversation.
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <ToggleRow label="Industry" value={!!view.qualification_fields.industry} onChange={(v) => patchQualificationField("industry", v)} />
            <ToggleRow label="Goal" value={!!view.qualification_fields.goal} onChange={(v) => patchQualificationField("goal", v)} />
            <ToggleRow label="Timeline" value={!!view.qualification_fields.timeline} onChange={(v) => patchQualificationField("timeline", v)} />
            <ToggleRow label="Budget" value={!!view.qualification_fields.budget} onChange={(v) => patchQualificationField("budget", v)} />
            <ToggleRow label="Location" value={!!view.qualification_fields.location} onChange={(v) => patchQualificationField("location", v)} hint="Off by default." />
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${UI.border}`,
            borderRadius: UI.radiusLg,
            padding: 14,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 1000, color: UI.text }}>Human handoff</div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <ToggleRow
              label="Human handoff enabled"
              value={view.human_handoff_enabled}
              onChange={(v) => patch({ human_handoff_enabled: v })}
              hint="If enabled, the bot can gracefully route to a real person when needed."
            />
            <ToggleRow
              label="Owner / real person request"
              value={!!view.human_handoff_triggers.owner_request}
              onChange={(v) => patchHandoffTrigger("owner_request", v)}
            />
            <ToggleRow
              label="Frustrated user"
              value={!!view.human_handoff_triggers.frustrated_user}
              onChange={(v) => patchHandoffTrigger("frustrated_user", v)}
            />
            <ToggleRow
              label="Repeated failure"
              value={!!view.human_handoff_triggers.repeated_failure}
              onChange={(v) => patchHandoffTrigger("repeated_failure", v)}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={resetToDefaults} variant="secondary" disabled={saving}>
            Reset to defaults
          </Button>
          <Button onClick={save} variant="primary" disabled={saving || !cfg}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, color: UI.text2, fontWeight: 900 }}>{props.label}</div>
      {props.children}
    </div>
  );
}

function ToggleRow(props: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 900, color: UI.text }}>{props.label}</div>
        {props.hint ? <div style={{ marginTop: 4, fontSize: 12.5, color: UI.text2 }}>{props.hint}</div> : null}
      </div>

      <button
        type="button"
        onClick={() => props.onChange(!props.value)}
        style={{
          border: `1px solid ${UI.border}`,
          background: props.value ? "#111827" : UI.surface2,
          color: props.value ? "#fff" : UI.text,
          borderRadius: 999,
          padding: "8px 12px",
          fontSize: 12.5,
          fontWeight: 900,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {props.value ? "On" : "Off"}
      </button>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: `1px solid ${UI.border}`,
  background: "#fff",
  outline: "none",
  fontSize: 13.5,
};