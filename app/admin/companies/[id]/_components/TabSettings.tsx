"use client";

import { useEffect, useMemo, useState } from "react";
import type { DetailResponse, Keys } from "./types";
import { Card, Button, Input, Textarea, CodeBox, UI } from "./ui";
import { copyToClipboard, fetchJson } from "./api";
import SettingsBotBehavior from "./SettingsBotBehavior";

function normalizeHost(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
}
function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}
function safeJsonStringify(v: any) {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export default function TabSettings(props: {
  companyId: string;
  data: DetailResponse;
  isOwner: boolean;
  setData: (updater: any) => void;
  setToast: (s: string) => void;
}) {
  const { companyId, data, isOwner, setData, setToast } = props;

  const [domainInput, setDomainInput] = useState("");
  const [domainDraft, setDomainDraft] = useState<string[]>([]);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainDirty, setDomainDirty] = useState(false);

  const [limitsText, setLimitsText] = useState<string>("{}");
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [limitsDirty, setLimitsDirty] = useState(false);

  useEffect(() => {
    const current = data?.keys?.allowed_domains ?? [];
    setDomainDraft(current);
    setDomainInput("");
    setDomainDirty(false);

    const lim = data?.settings?.limits_json ?? {};
    setLimitsText(safeJsonStringify(lim));
    setLimitsDirty(false);
  }, [data?.keys?.allowed_domains, data?.settings?.limits_json]);

  const embedSnippet = useMemo(() => {
    const pk = data?.keys?.public_key || "pk_xxx";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `<script src="${origin}/widget-loader.js" data-public-key="${pk}"></script>`;
  }, [data?.keys?.public_key]);

  function addDomainFromInput() {
    const normalized = normalizeHost(domainInput || "");
    if (!normalized) return setToast("Enter a domain");
    if (/\s/.test(normalized) || normalized.includes("/") || normalized.includes("http")) return setToast("Invalid domain");
    setDomainDraft((prev) => uniq([...prev, normalized]));
    setDomainInput("");
    setDomainDirty(true);
  }

  function removeDomain(d: string) {
    setDomainDraft((prev) => prev.filter((x) => x !== d));
    setDomainDirty(true);
  }

  async function saveDomains() {
    setDomainSaving(true);
    const payload = { allowed_domains: uniq(domainDraft.map((x) => normalizeHost(x)).filter(Boolean)) };

    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/domains`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setDomainSaving(false);
    if (!ok) return setToast(json?.error || "domains_save_failed");

    const updatedKeys: Keys | null = json?.keys ?? null;
    if (updatedKeys) {
      setData((prev: DetailResponse | null) => (prev ? { ...prev, keys: updatedKeys } : prev));
    }

    setDomainDirty(false);
    setToast("Saved");
  }

  async function saveLimits() {
    if (!isOwner) return setToast("Not allowed");

    let parsed: any = null;
    try {
      parsed = JSON.parse(limitsText || "{}");
    } catch {
      return setToast("Limits JSON invalid");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return setToast("Limits must be a JSON object");

    setLimitsSaving(true);
    const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/limits`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limits_text: limitsText }),
    });
    setLimitsSaving(false);

    if (!ok) return setToast(json?.error || "limits_save_failed");

    const updatedSettings = json?.settings ?? null;
    if (updatedSettings) setData((prev: DetailResponse | null) => (prev ? { ...prev, settings: updatedSettings } : prev));

    setLimitsDirty(false);
    setToast("Saved");
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* ✅ New: Bot Behavior (Funnel Config) */}
      <SettingsBotBehavior companyId={companyId} setToast={setToast} />

      <Card title="Advanced Settings" subtitle="Only for technical setup. Most customers never need this.">
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 14, background: "#fff" }}>
            <div style={{ fontWeight: 1000, color: UI.text }}>Allowed websites</div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: UI.text2 }}>Only these domains can load your widget.</div>

            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
                <Input value={domainInput} onChange={(e) => setDomainInput(e.target.value)} placeholder="example.com" />
                <Button onClick={addDomainFromInput} variant="secondary">
                  Add
                </Button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {domainDraft.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => removeDomain(d)}
                    style={{ border: `1px solid ${UI.border}`, background: UI.surface2, borderRadius: 999, padding: "7px 10px", fontSize: 12.5, cursor: "pointer", fontWeight: 900 }}
                    title="Click to remove"
                  >
                    {d} ✕
                  </button>
                ))}
                {domainDraft.length === 0 ? <div style={{ color: UI.text2, fontSize: 13 }}>No domains yet.</div> : null}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <Button onClick={saveDomains} disabled={!domainDirty || domainSaving} variant="primary">
                  {domainSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>

          <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 14, background: "#fff" }}>
            <div style={{ fontWeight: 1000, color: UI.text }}>Usage limits (owner)</div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: UI.text2 }}>Only the platform owner should edit this.</div>

            {!isOwner ? (
              <div style={{ marginTop: 12, color: UI.text2 }}>Not available for your role.</div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                <Textarea
                  value={limitsText}
                  onChange={(e) => {
                    setLimitsText(e.target.value);
                    setLimitsDirty(true);
                  }}
                  style={{ minHeight: 220, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5 }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button onClick={saveLimits} disabled={!limitsDirty || limitsSaving} variant="primary">
                    {limitsSaving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 14, background: "#fff" }}>
            <div style={{ fontWeight: 1000, color: UI.text }}>Embed snippet</div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: UI.text2 }}>Use on your website.</div>

            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <Button
                  onClick={async () => {
                    await copyToClipboard(embedSnippet);
                    setToast("Copied");
                  }}
                  variant="secondary"
                >
                  Copy
                </Button>
              </div>
              <CodeBox text={embedSnippet} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}