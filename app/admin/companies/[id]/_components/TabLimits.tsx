"use client";

import { useMemo, useState } from "react";
import { UI, Button } from "./ui";
import type { DetailResponse } from "./types";
import { safeJsonParse } from "./api";

export default function TabLimits(props: {
  companyId: string;
  data: DetailResponse;
  reload: () => Promise<void> | void;
  setToast: (s: string) => void;
}) {
  const { companyId, data, reload, setToast } = props;

  const initialText = useMemo(() => JSON.stringify(data.settings?.limits_json ?? {}, null, 2), [data.settings?.limits_json]);
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);

  function parseOrThrow(t: string) {
    const v = JSON.parse(t);
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      // allow objects only; adjust if you allow arrays
      throw new Error("limits_json must be an object");
    }
    return v;
  }

  async function save() {
    setSaving(true);
    try {
      const limits_json = parseOrThrow(text);

      const res = await fetch(`/api/admin/companies/${companyId}/limits`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limits_json }),
      });
      const raw = await res.text();
      const json = safeJsonParse(raw);

      if (!res.ok) {
        setToast(`Save failed: ${json?.error || `HTTP ${res.status}`}`);
        return;
      }

      setToast("Saved");
      await reload();
    } catch (e: any) {
      setToast(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, boxShadow: UI.shadow, padding: 16 }}>
      <div style={{ fontWeight: 1100, marginBottom: 6 }}>Limits</div>
      <div style={{ color: UI.text2, fontSize: 13.5, lineHeight: 1.5 }}>
        Edit plan limits for this company (JSON).
      </div>

      <div style={{ marginTop: 12 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 340,
            padding: "12px 12px",
            borderRadius: 12,
            border: `1px solid ${UI.border}`,
            outline: "none",
            fontSize: 12.5,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        />
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button onClick={save} variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}