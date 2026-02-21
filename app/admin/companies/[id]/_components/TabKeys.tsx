"use client";

import { useMemo, useState } from "react";
import { UI, Button } from "./ui";
import type { DetailResponse } from "./types";
import { safeJsonParse } from "./api";

export default function TabKeys(props: {
  companyId: string;
  data: DetailResponse;
  reload: () => Promise<void> | void;
  setToast: (s: string) => void;
}) {
  const { companyId, data, reload, setToast } = props;

  const initial = useMemo(() => {
    const k = data.keys;
    return {
      public_key: String(k?.public_key || "").trim(),
      secret_key: String(k?.secret_key || "").trim(),
    };
  }, [data.keys]);

  const [publicKey, setPublicKey] = useState(initial.public_key);
  const [secretKey, setSecretKey] = useState(initial.secret_key);
  const [saving, setSaving] = useState(false);

  function copy(text: string) {
    try {
      void navigator.clipboard.writeText(text);
      setToast("Copied");
    } catch {
      setToast("Copy failed");
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/keys`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          public_key: publicKey || null,
          secret_key: secretKey || null,
        }),
      });
      const text = await res.text();
      const json = safeJsonParse(text);
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

  async function rotate() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/rotate-keys`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const text = await res.text();
      const json = safeJsonParse(text);
      if (!res.ok) {
        setToast(`Rotate failed: ${json?.error || `HTTP ${res.status}`}`);
        return;
      }
      setToast("Rotated");
      await reload();
    } catch (e: any) {
      setToast(e?.message || "Rotate failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, boxShadow: UI.shadow, padding: 16 }}>
      <div style={{ fontWeight: 1100, marginBottom: 6 }}>Keys</div>
      <div style={{ color: UI.text2, fontSize: 13.5, lineHeight: 1.5 }}>
        Manage widget/API keys. Rotate keys to invalidate old tokens.
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: UI.text2, fontWeight: 900, marginBottom: 6 }}>Public key</div>
          <input
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="pk_..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${UI.border}`,
              outline: "none",
              fontSize: 13.5,
            }}
          />
          <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => copy(publicKey)} variant="secondary" disabled={!publicKey}>
              Copy
            </Button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: UI.text2, fontWeight: 900, marginBottom: 6 }}>Secret key</div>
          <input
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="sk_..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${UI.border}`,
              outline: "none",
              fontSize: 13.5,
            }}
          />
          <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => copy(secretKey)} variant="secondary" disabled={!secretKey}>
              Copy
            </Button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={save} variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button onClick={rotate} variant="secondary" disabled={saving}>
            Rotate keys
          </Button>
        </div>
      </div>
    </div>
  );
}