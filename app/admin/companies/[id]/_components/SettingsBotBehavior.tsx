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

  // Derived fields with defaults matching your loadFunnelConfig() defaults
  const view = useMemo(() => {
    const c = cfg || ({} as FunnelConfigRow);
    const qf = safeObj(c.qualification_fields);

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

      qualification_fields: {
        industry: qf.industry !== false,
        goal: qf.goal !== false,
        timeline: qf.timeline !== false,
        budget: qf.budget !== false,
        location: qf.location === true, // default false in your loader
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function save() {
    if (!cfg) return;

    setSaving(true);

    // Keep PATCH tight: only fields you actually use in widget/message.
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
    // We reset by explicitly setting fields back to your loadFunnelConfig defaults
    patch({
      enabled: true,
      objection_handling: true,
      require_qualification: true,
      show_pricing: true,
      pricing_strategy: "multi-tier" as any,
      allow_unknown_fallback: true,

      tone: "consultative" as any,
      response_length: "concise" as any,
      language: "auto",

      cta_style: "one-question" as any,
      default_cta: null,

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
      <Card title="Bot Behavior" subtitle="Controls how the AI responds (tone, sales mode, CTAs).">
        Loading…
      </Card>
    );
  }

  return (
    <Card
      title="Bot Behavior"
      subtitle="Controls tone, response length, qualification and pricing behavior. Applies instantly to the widget and Test Chat."
    >
      <div style={{ display: "grid", gap: 14 }}>
        {/* Core switches */}
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
              hint="If off, the bot still answers, but lead/funnel logic should be minimal."
            />
            <ToggleRow
              label="Show pricing"
              value={view.show_pricing}
              onChange={(v) => patch({ show_pricing: v })}
              hint="If on, pricing questions get compact plan blocks (from knowledge chunks)."
            />
            <ToggleRow
              label="Objection handling"
              value={view.objection_handling}
              onChange={(v) => patch({ objection_handling: v })}
              hint="If user says 'too expensive', the bot handles it and offers alternatives."
            />
            <ToggleRow
              label="Require qualification"
              value={view.require_qualification}
              onChange={(v) => patch({ require_qualification: v })}
              hint="If on, the bot pushes one strategic question at the end."
            />
          </div>
        </div>

        {/* Style controls */}
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
                placeholder='Example: "Would you like a quick demo call this week?"'
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

        {/* Qualification fields */}
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
            <ToggleRow
              label="Industry"
              value={!!view.qualification_fields.industry}
              onChange={(v) => patchQualificationField("industry", v)}
            />
            <ToggleRow
              label="Goal"
              value={!!view.qualification_fields.goal}
              onChange={(v) => patchQualificationField("goal", v)}
            />
            <ToggleRow
              label="Timeline"
              value={!!view.qualification_fields.timeline}
              onChange={(v) => patchQualificationField("timeline", v)}
            />
            <ToggleRow
              label="Budget"
              value={!!view.qualification_fields.budget}
              onChange={(v) => patchQualificationField("budget", v)}
            />
            <ToggleRow
              label="Location"
              value={!!view.qualification_fields.location}
              onChange={(v) => patchQualificationField("location", v)}
              hint="Off by default."
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