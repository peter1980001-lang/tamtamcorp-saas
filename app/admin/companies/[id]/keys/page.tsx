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

function Field({ label, value, right }: { label: string; value: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          value={value}
          readOnly
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
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

    // IMPORTANT: Use rotate response as source of truth.
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
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>Company</div>
            <h1 style={{ fontSize: 28, margin: "4px 0 0" }}>Keys</h1>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
              {data?.keys_rotated_at ? `Created: ${new Date(data.keys_rotated_at).toLocaleString()}` : "Created: —"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={loadKeys}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
            >
              Refresh
            </button>
            <button
              onClick={rotate}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}
            >
              Rotate keys
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16, background: "#fff", border: "1px solid #eee", borderRadius: 16, padding: 16, display: "grid", gap: 14 }}>
          {loading ? (
            <div>Loading…</div>
          ) : (
            <>
              <Field
                label="Public Key"
                value={publicKey || "—"}
                right={
                  <button
                    onClick={() => {
                      copyToClipboard(publicKey || "");
                      setToast("Copied");
                    }}
                    style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                  >
                    Copy
                  </button>
                }
              />

              <Field
                label="Secret Key"
                value={secretToShow || "—"}
                right={
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => setShowSecret((v) => !v)}
                      style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                    >
                      {showSecret ? "Hide" : "Show secret"}
                    </button>
                    <button
                      onClick={() => {
                        copyToClipboard(secretVisible || "");
                        setToast(secretVisible ? "Copied" : "Rotate to get full secret");
                      }}
                      style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                    >
                      Copy
                    </button>
                  </div>
                }
              />

              {!secretVisible && (
                <div style={{ fontSize: 12, opacity: 0.65 }}>
                  Hinweis: Aus Sicherheitsgründen wird der Secret Key nach dem Neuladen nur maskiert angezeigt. Nach “Rotate keys” siehst du ihn einmal vollständig.
                </div>
              )}
            </>
          )}
        </div>

        {toast && (
          <div
            style={{
              position: "fixed",
              bottom: 18,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#111",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 999,
              fontSize: 13,
              cursor: "pointer",
            }}
            onClick={() => setToast(null)}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
