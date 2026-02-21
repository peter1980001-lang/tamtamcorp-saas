"use client";

import { useMemo } from "react";
import type { DetailResponse } from "./types";
import { Card, Button, CodeBox } from "./ui";
import { copyToClipboard } from "./api";

export default function TabDashboard(props: { companyId: string; data: DetailResponse; setToast: (s: string) => void }) {
  const { data, setToast } = props;

  const embedSnippet = useMemo(() => {
    const pk = data?.keys?.public_key || "pk_xxx";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `<script src="${origin}/widget-loader.js" data-public-key="${pk}"></script>`;
  }, [data?.keys?.public_key]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card title="Widget" subtitle="Setup overview.">
          <div style={{ display: "grid", gap: 8, fontSize: 13.5 }}>
            <div>
              <b>Allowed sites:</b> {(data.keys?.allowed_domains ?? []).length}
            </div>
            <div>
              <b>Chat mode:</b> {data.settings?.branding_json?.chat?.mode ?? data.settings?.limits_json?.chat?.mode ?? "hybrid"}
            </div>
            <div>
              <b>Public key:</b> {data.keys?.public_key ? <span style={{ fontFamily: "ui-monospace" }}>{String(data.keys.public_key).slice(0, 14)}…</span> : "—"}
            </div>
          </div>
        </Card>

        <Card
          title="Quick actions"
          subtitle="Copy embed and paste into your website."
          right={
            <Button
              onClick={async () => {
                await copyToClipboard(embedSnippet);
                setToast("Copied");
              }}
              variant="secondary"
            >
              Copy
            </Button>
          }
        >
          <CodeBox text={embedSnippet} />
        </Card>
      </div>
    </div>
  );
}