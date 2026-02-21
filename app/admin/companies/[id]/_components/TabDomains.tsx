"use client";

import { useMemo, useState } from "react";
import { UI, Button } from "./ui";
import type { DetailResponse } from "./types";
import { safeJsonParse } from "./api";

function normalizeDomain(s: string) {
  return s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export default function TabDomains(props: {
  companyId: string;
  data: DetailResponse;
  reload: () => Promise<void> | void;
  setToast: (s: string) => void;
}) {
  const { companyId, data, reload, setToast } = props;

  const initial = useMemo(() => (data.keys?.allowed_domains || []).map(String), [data.keys?.allowed_domains]);
  const [domains, setDomains] = useState<string[]>(initial);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);

  function add() {
    const d = normalizeDomain(newDomain);
    if (!d) return;
    setDomains((prev) => Array.from(new Set([...prev, d])));
    setNewDomain("");
  }

  function remove(d: string) {
    setDomains((prev) => prev.filter((x) => x !== d));
  }

  async function save() {
    setSaving(true);
    try {
      const allowed_domains = domains.map(normalizeDomain).filter(Boolean);

      const res = await fetch(`/api/admin/companies/${companyId}/domains`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allowed_domains }),
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
      <div style={{ fontWeight: 1100, marginBottom: 6 }}>Domains</div>
      <div style={{ color: UI.text2, fontSize: 13.5, lineHeight: 1.5 }}>
        Widget will only run on allowed domains (Origin allowlist).
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="example.com"
          style={{
            flex: "1 1 260px",
            padding: "10px 12px",
            borderRadius: 12,
            border: `1px solid ${UI.border}`,
            outline: "none",
            fontSize: 13.5,
          }}
        />
        <Button onClick={add} variant="secondary" disabled={!newDomain.trim()}>
          Add
        </Button>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {(domains.length ? domains : ["—"]).map((d, i) => (
          <div
            key={`${d}-${i}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${UI.border}`,
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 13.5, color: UI.text }}>{d}</div>
            {d !== "—" ? (
              <Button onClick={() => remove(d)} variant="secondary">
                Remove
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button onClick={save} variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}