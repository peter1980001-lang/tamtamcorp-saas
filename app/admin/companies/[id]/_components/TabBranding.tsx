"use client";

import { useMemo, useRef, useState } from "react";
import type { DetailResponse } from "./types";
import { Card, Button, Badge, Divider, UI } from "./ui";
import { fetchJson } from "./api";

function pick(branding: any, keys: string[]) {
  for (const k of keys) {
    const v = branding?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function swatch(hex: string) {
  const h = String(hex || "").trim();
  if (!h) return null;
  return <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: h, border: "1px solid rgba(0,0,0,0.12)", marginRight: 8, verticalAlign: "middle" }} />;
}

export default function TabBranding(props: {
  companyId: string;
  data: DetailResponse;
  setData: (updater: any) => void;
  setToast: (s: string) => void;
}) {
  const { companyId, data, setData, setToast } = props;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const branding = useMemo(() => (data?.settings?.branding_json || {}) as any, [data?.settings?.branding_json]);
  const companyName = useMemo(() => pick(branding, ["company_name"]) || String(data?.company?.name || "").trim() || "Company", [branding, data?.company?.name]);
  const greeting = useMemo(() => pick(branding, ["greeting"]), [branding]);
  const logoUrl = useMemo(() => pick(branding, ["logo_url", "logoUrl"]), [branding]);

  const primaryColor = useMemo(() => pick(branding?.brand_colors, ["primary"]) || pick(branding, ["primary"]) || "", [branding]);
  const accentColor = useMemo(() => pick(branding?.brand_colors, ["accent"]) || pick(branding, ["accent"]) || "", [branding]);

  async function uploadLogo(file: File) {
    if (!companyId) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const { ok, json } = await fetchJson(`/api/admin/companies/${companyId}/logo`, { method: "POST", body: fd });
      if (!ok) {
        setUploadErr(String(json?.error || "upload_failed"));
        return;
      }

      const nextLogoUrl = String(json?.logo_url || "");
      setData((prev: DetailResponse | null) => {
        if (!prev) return prev;
        const b = prev.settings?.branding_json || {};
        return { ...prev, settings: { ...prev.settings, branding_json: { ...b, logo_url: nextLogoUrl } } };
      });

      setToast("Logo updated");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
      <Card title="Widget Branding" subtitle="Logo + colors used by the widget (no JSON shown to customers).">
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 66, height: 66, borderRadius: 18, border: `1px solid ${UI.border}`, background: "#fff", overflow: "hidden", display: "grid", placeItems: "center" }}>
              {logoUrl ? <img src={logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontWeight: 1100, color: UI.text2, fontSize: 22 }}>{companyName.slice(0, 1).toUpperCase()}</span>}
            </div>

            <div style={{ display: "grid", gap: 8, minWidth: 320 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadLogo(f);
                  e.currentTarget.value = "";
                }}
              />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} variant="primary">
                  {uploading ? "Uploading…" : "Logo uploaden"}
                </Button>
                <Button onClick={() => setToast("Farben werden automatisch über Knowledge → Fetch Page erkannt.")} variant="secondary">
                  Farben automatisch holen
                </Button>
              </div>

              <div style={{ fontSize: 12.5, color: UI.text3 }}>
                PNG/JPG/WEBP/SVG · max 2MB
                {uploadErr ? <span style={{ color: UI.danger, fontWeight: 900 }}> · {uploadErr}</span> : null}
              </div>
            </div>
          </div>

          <Divider />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 14, background: "#fff" }}>
              <div style={{ fontSize: 12.5, color: UI.text2, fontWeight: 900 }}>Company name</div>
              <div style={{ marginTop: 8, fontWeight: 1000 }}>{companyName}</div>
              <div style={{ marginTop: 10, fontSize: 12.5, color: UI.text3 }}>Used for widget title.</div>
            </div>

            <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 14, background: "#fff" }}>
              <div style={{ fontSize: 12.5, color: UI.text2, fontWeight: 900 }}>Greeting</div>
              <div style={{ marginTop: 8, fontWeight: 900, color: UI.text }}>{greeting || <span style={{ color: UI.text3 }}>Not set (uses default)</span>}</div>
              <div style={{ marginTop: 10, fontSize: 12.5, color: UI.text3 }}>First message visitors see.</div>
            </div>
          </div>

          <div style={{ border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, padding: 14, background: "#fff" }}>
            <div style={{ fontSize: 12.5, color: UI.text2, fontWeight: 900 }}>Colors</div>
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Badge text={primaryColor ? `Primary: ${primaryColor}` : "Primary: default"} tone="neutral" />
              <Badge text={accentColor ? `Accent: ${accentColor}` : "Accent: default"} tone="info" />
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: UI.text3 }}>
              {swatch(primaryColor)} {primaryColor || ""} {swatch(accentColor)} {accentColor || ""}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Live Preview" subtitle="Visual preview of the widget (colors + logo).">
        <div style={{ border: `1px solid ${UI.border}`, borderRadius: 18, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${UI.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: 10, border: `1px solid ${UI.border}`, overflow: "hidden", background: "#fff" }}>
                {logoUrl ? <img src={logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
              </div>
              <div style={{ fontWeight: 1100, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{companyName}</div>
            </div>
            <Badge text="Online" tone="success" />
          </div>

          <div style={{ padding: 14, background: "#fff" }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ alignSelf: "flex-start", maxWidth: "82%", background: "rgba(17,17,17,0.06)", borderRadius: 14, padding: "10px 12px", color: "#111" }}>
                {greeting || `Hi! Welcome to ${companyName}. How can I help?`}
              </div>

              <div style={{ alignSelf: "flex-end", maxWidth: "82%", background: primaryColor || "#111111", color: "#fff", borderRadius: 14, padding: "10px 12px" }}>
                I’m interested. Can you tell me more?
              </div>

              <div style={{ alignSelf: "flex-start", maxWidth: "82%", background: "rgba(17,17,17,0.06)", borderRadius: 14, padding: "10px 12px", color: "#111" }}>
                Sure — I’ll guide you. If you want, I can capture your details and arrange a quick call.
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <div style={{ flex: 1, border: `1px solid ${UI.border}`, borderRadius: 12, padding: "10px 12px", color: UI.text3 }}>
                Type…
              </div>
              <div style={{ borderRadius: 12, padding: "10px 14px", background: primaryColor || "#111111", color: "#fff", fontWeight: 1000 }}>
                Send
              </div>
            </div>

            <div style={{ marginTop: 12, height: 4, borderRadius: 999, background: accentColor || "#F5C400", opacity: 0.95 }} />
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 12.5, color: UI.text3 }}>This preview is purely visual.</div>
      </Card>
    </div>
  );
}