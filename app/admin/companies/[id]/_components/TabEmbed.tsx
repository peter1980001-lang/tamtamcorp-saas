"use client";

import { useMemo, useState } from "react";
import { UI, Button } from "./ui";
import type { DetailResponse } from "./types";
import { safeJsonParse } from "./api";

export default function TabEmbed(props: {
  companyId: string;
  data: DetailResponse;
  setToast: (s: string) => void;
}) {
  const { companyId, data, setToast } = props;

  const publicKey = String(data.keys?.public_key || "").trim();
  const [widgetToken, setWidgetToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const embedSnippet = useMemo(() => {
    if (!publicKey) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    // adjust widget.js path if yours differs
    return `<!-- TamTam Widget -->
<script>
  (function() {
    var s = document.createElement('script');
    s.src = '${origin}/widget.js';
    s.async = true;
    s.onload = function() {
      window.TamTamWidget && window.TamTamWidget.init({ publicKey: '${publicKey}' });
    };
    document.head.appendChild(s);
  })();
</script>`;
  }, [publicKey]);

  function copy(text: string) {
    try {
      void navigator.clipboard.writeText(text);
      setToast("Copied");
    } catch {
      setToast("Copy failed");
    }
  }

  async function generateToken() {
    setBusy(true);
    setWidgetToken(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/widget-token`, { cache: "no-store" });
      const raw = await res.text();
      const json = safeJsonParse(raw);
      if (!res.ok) {
        setToast(`Token failed: ${json?.error || `HTTP ${res.status}`}`);
        return;
      }
      const token = String((json as any)?.token || (json as any)?.widget_token || "").trim();
      if (!token) {
        setToast("Token response missing token field");
        return;
      }
      setWidgetToken(token);
      setToast("Token generated");
    } catch (e: any) {
      setToast(e?.message || "Token failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, boxShadow: UI.shadow, padding: 16 }}>
      <div style={{ fontWeight: 1100, marginBottom: 6 }}>Embed</div>
      <div style={{ color: UI.text2, fontSize: 13.5, lineHeight: 1.5 }}>
        Copy the embed snippet and optionally generate a widget token for testing.
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <pre
          style={{
            margin: 0,
            padding: "12px 12px",
            borderRadius: 12,
            border: `1px solid ${UI.border}`,
            background: "#fff",
            fontSize: 12.5,
            overflow: "auto",
            maxHeight: 280,
          }}
        >
          {embedSnippet || "Public key missing"}
        </pre>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={() => copy(embedSnippet)} variant="secondary" disabled={!embedSnippet}>
            Copy snippet
          </Button>
          <Button onClick={generateToken} variant="secondary" disabled={busy}>
            {busy ? "Generating…" : "Generate widget token"}
          </Button>
          {widgetToken ? (
            <Button onClick={() => copy(widgetToken)} variant="secondary">
              Copy token
            </Button>
          ) : null}
        </div>

        {widgetToken ? (
          <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12.5, padding: "10px 12px", border: `1px solid ${UI.border}`, borderRadius: 12, background: "#fff" }}>
            {widgetToken}
          </div>
        ) : null}
      </div>
    </div>
  );
}