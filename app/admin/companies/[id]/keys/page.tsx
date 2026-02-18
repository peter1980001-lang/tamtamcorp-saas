"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type KeysResp = {
  ok: boolean;
  public_key: string | null;
  secret_key?: string | null; // only after rotate
  secret_key_masked: string | null;
  keys_rotated_at: string | null;
  error?: string;
  details?: string;
};

const UI = {
  surface: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  text2: "#6B7280",
  accent: "#3B82F6",
  radius: 12,
  radiusLg: 16,
  shadow: "0 1px 0 rgba(16,24,40,0.03), 0 1px 2px rgba(16,24,40,0.04)",
};

function Card(props: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: UI.surface, border: `1px solid ${UI.border}`, borderRadius: UI.radiusLg, boxShadow: UI.shadow }}>
      <div style={{ padding: "18px 18px 0", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: UI.text }}>{props.title}</div>
          {props.subtitle ? <div style={{ marginTop: 4, fontSize: 12.5, color: UI.text2, lineHeight: 1.45 }}>{props.subtitle}</div> : null}
        </div>
        {props.right}
      </div>
      <div style={{ padding: "14px 18px 18px" }}>{props.children}</div>
    </div>
  );
}

function Button(props: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary"; disabled?: boolean }) {
  const v = props.variant || "secondary";
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        padding: "10px 12px",
        borderRadius: UI.radius,
        border: v === "primary" ? `1px solid ${UI.accent}` : `1px solid ${UI.border}`,
        background: v === "primary" ? UI.accent : "#fff",
        color: v === "primary" ? "#fff" : UI.text,
        cursor: props.disabled ? "not-allowed" : "pointer",
        fontSize: 13.5,
        fontWeight: 700,
        opacity: props.disabled ? 0.6 : 1,
      }}
    >
      {props.children}
    </button>
  );
}

function Field({ label, value, right }: { label: string; value: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12.5, color: UI.text2 }}>{label}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          value={value}
          readOnly
          style={{
            width: "100%",
            padding: "11px 12px",
            borderRadius: UI.radius,
            border: `1px solid ${UI.border}`,
            background: "#FBFBFC",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 12.5,
            color: UI.text,
          }}
        />
        {right}
      </div>
    </div>
  );
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

export default function KeysPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<KeysResp | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function loadKeys() {
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/admin/companies/${id}/keys`);
    const json = (await res.json().catch(() => ({}))) as KeysResp;
    setLoading(false);

    if (!res.ok || !json.ok) {
      setToast(json.error || "load_failed");
      setData(null);
      return;
    }

    setData(json);
  }

  async function rotate() {
    if (!id) return;
    const res = await fetch(`/api/admin/companies/${id}/rotate-keys`, { method: "POST" });
    const json = (await res.json().catch(() => ({}))) as KeysResp;

    if (!res.ok || !json.ok) {
      setToast(json.error || "rotate_failed");
      return;
    }

    setData(json);
    setShowSecret(true);
    setToast("Keys rotated");
  }

  useEffect(() => {
    loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const publicKey = data?.public_key ?? "";
  const secretVisible = (data?.secret_key ?? "") || ""; // full secret only after rotate
  const secretMasked = data?.secret_key_masked ?? "";
  const secretToShow = showSecret ? secretVisible || secretMasked : secretMasked;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card
        title="API Keys"
        subtitle={
          data?.keys_rotated_at
            ? `Last rotation: ${new Date(data.keys_rotated_at).toLocaleString()}`
            : "Rotate keys if a key was exposed or you want a fresh pair."
        }
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={loadKeys} variant="secondary">Refresh</Button>
            <Button onClick={rotate} variant="primary">Rotate keys</Button>
          </div>
        }
      >
        {loading ? (
          <div style={{ color: UI.text2 }}>Loading…</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <Field
              label="Public key"
              value={publicKey || "—"}
              right={
                <Button
                  onClick={() => {
                    copyToClipboard(publicKey || "");
                    setToast("Copied");
                  }}
                >
                  Copy
                </Button>
              }
            />

            <Field
              label="Secret key"
              value={secretToShow || "—"}
              right={
                <div style={{ display: "flex", gap: 10 }}>
                  <Button onClick={() => setShowSecret((v) => !v)}>{showSecret ? "Hide" : "Show"}</Button>
                  <Button
                    onClick={() => {
                      copyToClipboard(secretVisible || "");
                      setToast(secretVisible ? "Copied" : "Rotate to get full secret");
                    }}
                  >
                    Copy
                  </Button>
                </div>
              }
            />

            {!secretVisible && (
              <div style={{ fontSize: 12.5, color: UI.text2, lineHeight: 1.45 }}>
                Hinweis: Der Secret Key wird nach Neuladen nur maskiert angezeigt. Nach <b>Rotate keys</b> siehst du ihn einmal vollständig.
              </div>
            )}
          </div>
        )}
      </Card>

      {toast && (
        <div
          onClick={() => setToast(null)}
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            background: "#fff",
            color: UI.text,
            padding: "12px 14px",
            borderRadius: 16,
            border: `1px solid ${UI.border}`,
            boxShadow: UI.shadow,
            cursor: "pointer",
            fontSize: 13.5,
            maxWidth: 360,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 2 }}>Notice</div>
          <div style={{ color: UI.text2 }}>{toast}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>Click to dismiss</div>
        </div>
      )}
    </div>
  );
}
