// app/onboarding/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

const UI = {
  text: "#0B1220",
  text2: "#4B5563",
  text3: "#9CA3AF",
  border: "#E6E8EF",
  accent: "#2563EB",
  radius: 12,
};

type WizardStep = "welcome" | "branding" | "knowledge" | "embed" | "done";
const STEPS: WizardStep[] = ["welcome", "branding", "knowledge", "embed", "done"];

function ProgressBar({ current }: { current: WizardStep }) {
  const idx = STEPS.indexOf(current);
  const pct = Math.round((idx / (STEPS.length - 1)) * 100);
  return (
    <div style={{ height: 4, borderRadius: 999, background: UI.border, overflow: "hidden", marginBottom: 32 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: UI.accent, borderRadius: 999, transition: "width 0.3s ease" }} />
    </div>
  );
}

function StepLabel({ current }: { current: WizardStep }) {
  const labels: Record<WizardStep, string> = {
    welcome: "Welcome",
    branding: "Branding",
    knowledge: "Knowledge",
    embed: "Embed widget",
    done: "All done",
  };
  return (
    <div style={{ fontSize: 12.5, color: UI.text3, marginBottom: 8, fontWeight: 950, textTransform: "uppercase", letterSpacing: 1 }}>
      {labels[current]}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 560, margin: "80px auto", padding: 24, textAlign: "center" }}>Loading…</div>}>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const companyId = String(searchParams?.get("company_id") || "").trim();

  const [step, setStep] = useState<WizardStep>("welcome");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // Branding step state
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [brandingSaving, setBrandingSaving] = useState(false);

  // Knowledge step state
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [fetchedText, setFetchedText] = useState("");
  const [fetchedTitle, setFetchedTitle] = useState("");
  const [kbFetching, setKbFetching] = useState(false);
  const [kbIngesting, setKbIngesting] = useState(false);
  const [kbDone, setKbDone] = useState(false);

  // Embed step state
  const [publicKey, setPublicKey] = useState("");
  const [snippetCopied, setSnippetCopied] = useState(false);

  // Guard: no session → /login, wizard_done → admin panel
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.replace("/login");
        return;
      }
      if (!companyId) {
        router.replace("/login");
        return;
      }
      try {
        const res = await fetch(`/api/onboarding/state?company_id=${encodeURIComponent(companyId)}`);
        const json = await res.json();
        if (json?.wizard_done) {
          router.replace(`/admin/companies/${companyId}`);
          return;
        }
      } catch {
        // continue to wizard
      }
      // Pre-load company data for embed snippet and pre-fill branding fields
      try {
        const cr = await fetch(`/api/admin/companies/${companyId}`, { cache: "no-store" });
        if (cr.ok) {
          const cj = await cr.json();
          setPublicKey(String(cj?.keys?.public_key || "").trim());
          const b = (cj?.settings?.branding_json || {}) as Record<string, any>;
          setCompanyName(String(b?.company_name || "").trim());
          setLogoUrl(String(b?.logo_url || "").trim());
        }
      } catch {
        // continue without pre-fill
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function completeWizard() {
    try {
      await fetch("/api/onboarding/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "complete_wizard", company_id: companyId }),
      });
    } catch {
      // best-effort
    }
    router.push(`/admin/companies/${companyId}?tab=getting-started`);
  }

  async function saveBranding() {
    setBrandingSaving(true);
    setMsg(null);
    try {
      const patch: Record<string, any> = {};
      if (companyName.trim()) patch.company_name = companyName.trim();
      if (logoUrl.trim()) patch.logo_url = logoUrl.trim();
      if (primaryColor.trim()) patch.brand_colors = { primary: primaryColor.trim() };

      if (Object.keys(patch).length > 0) {
        const res = await fetch(`/api/admin/companies/${companyId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ branding_patch: patch }),
        });
        if (!res.ok) {
          const j = await res.json();
          setMsg(String(j?.error || "branding_save_failed"));
          return;
        }
      }
      setStep("knowledge");
    } catch (e: any) {
      setMsg(String(e?.message || "branding_save_failed"));
    } finally {
      setBrandingSaving(false);
    }
  }

  async function fetchWebsite() {
    const raw = websiteUrl.trim();
    if (!raw) return setMsg("Enter a URL first");
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    setKbFetching(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/knowledge/fetch-page", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(String(j?.error || "fetch_failed"));
        return;
      }
      setFetchedTitle(String(j?.title || "").trim());
      setFetchedText(String(j?.text || "").trim());
      setWebsiteUrl(url);
    } catch (e: any) {
      setMsg(String(e?.message || "fetch_failed"));
    } finally {
      setKbFetching(false);
    }
  }

  async function ingestKnowledge() {
    if (!fetchedText.trim()) return setMsg("Fetch your website first");
    setKbIngesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/knowledge/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          website_url: websiteUrl,
          persist_profile: true,
          pages: [{ url: websiteUrl, title: fetchedTitle || "Home", text: fetchedText, captured_at: new Date().toISOString() }],
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(String(j?.error || "ingest_failed"));
        return;
      }
      setKbDone(true);
    } catch (e: any) {
      setMsg(String(e?.message || "ingest_failed"));
    } finally {
      setKbIngesting(false);
    }
  }

  const embedSnippet = useMemo(() => {
    if (!publicKey) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
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

  function copySnippet() {
    try {
      void navigator.clipboard.writeText(embedSnippet);
      setSnippetCopied(true);
    } catch {
      setMsg("Copy failed — please copy the snippet manually.");
    }
  }

  if (loading) {
    return <div style={{ maxWidth: 560, margin: "80px auto", padding: 24, textAlign: "center", color: UI.text2 }}>Loading…</div>;
  }

  const inputStyle: React.CSSProperties = {
    padding: "11px 12px",
    borderRadius: UI.radius,
    border: `1px solid ${UI.border}`,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  };

  const btnPrimary: React.CSSProperties = {
    padding: "12px 20px",
    borderRadius: UI.radius,
    border: `1px solid ${UI.accent}`,
    background: UI.accent,
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  };

  const btnSecondary: React.CSSProperties = {
    padding: "12px 20px",
    borderRadius: UI.radius,
    border: `1px solid ${UI.border}`,
    background: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    color: UI.text,
  };

  return (
    <div style={{ maxWidth: 560, margin: "60px auto", padding: "0 16px 60px" }}>
      <ProgressBar current={step} />
      <StepLabel current={step} />

      {msg ? (
        <div style={{ padding: 12, borderRadius: UI.radius, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: 13.5, marginBottom: 16 }}>
          {msg}
        </div>
      ) : null}

      {/* WELCOME */}
      {step === "welcome" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 10px", color: UI.text }}>Welcome to TamTam</h1>
            <p style={{ fontSize: 15, color: UI.text2, lineHeight: 1.6, margin: 0 }}>
              Your account is ready. Let&apos;s set up your AI chat widget in a few steps — it takes about 5 minutes.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button style={btnPrimary} onClick={() => setStep("branding")}>Get started</button>
            <button style={btnSecondary} onClick={() => void completeWizard()}>Skip setup</button>
          </div>
        </div>
      )}

      {/* BRANDING */}
      {step === "branding" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: UI.text }}>Brand your widget</h2>
            <p style={{ fontSize: 14, color: UI.text2, margin: 0, lineHeight: 1.5 }}>
              Set your company name, logo, and primary color so visitors recognize your brand.
            </p>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: UI.text2, marginBottom: 6 }}>Company name</label>
              <input style={inputStyle} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: UI.text2, marginBottom: 6 }}>
                Logo URL <span style={{ fontWeight: 400, color: UI.text3 }}>(optional)</span>
              </label>
              <input style={inputStyle} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://yoursite.com/logo.png" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: UI.text2, marginBottom: 6 }}>
                Primary color <span style={{ fontWeight: 400, color: UI.text3 }}>(optional)</span>
              </label>
              <input style={inputStyle} value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#2563EB" />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              style={brandingSaving ? { ...btnPrimary, opacity: 0.6, cursor: "not-allowed" } : btnPrimary}
              disabled={brandingSaving}
              onClick={() => void saveBranding()}
            >
              {brandingSaving ? "Saving…" : "Save & continue"}
            </button>
            <button style={btnSecondary} onClick={() => setStep("knowledge")}>Skip</button>
            <button style={{ ...btnSecondary, marginLeft: "auto" }} onClick={() => setStep("welcome")}>Back</button>
          </div>
        </div>
      )}

      {/* KNOWLEDGE */}
      {step === "knowledge" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: UI.text }}>Teach the AI about your business</h2>
            <p style={{ fontSize: 14, color: UI.text2, margin: 0, lineHeight: 1.5 }}>
              Enter your website URL. We&apos;ll fetch it and use it to train your widget&apos;s answers.
            </p>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
              <input
                style={{ ...inputStyle, opacity: kbDone ? 0.5 : 1 }}
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
                disabled={kbDone}
              />
              <button
                style={kbDone || kbFetching ? { ...btnSecondary, opacity: 0.5, cursor: "not-allowed" } : btnSecondary}
                disabled={kbFetching || kbDone}
                onClick={() => void fetchWebsite()}
              >
                {kbFetching ? "Fetching…" : "Fetch"}
              </button>
            </div>

            {fetchedText && !kbDone ? (
              <div style={{ padding: 12, borderRadius: UI.radius, background: "#F9FAFB", border: `1px solid ${UI.border}`, fontSize: 13, color: UI.text2 }}>
                <b style={{ color: UI.text }}>{fetchedTitle || "Page fetched"}</b> — {fetchedText.length.toLocaleString()} characters ready to ingest.
              </div>
            ) : null}

            {kbDone ? (
              <div style={{ padding: 12, borderRadius: UI.radius, background: "#ECFDF5", border: "1px solid #A7F3D0", fontSize: 13, color: "#065F46", fontWeight: 700 }}>
                Knowledge added successfully.
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {!kbDone && fetchedText ? (
              <button
                style={kbIngesting ? { ...btnPrimary, opacity: 0.6, cursor: "not-allowed" } : btnPrimary}
                disabled={kbIngesting}
                onClick={() => void ingestKnowledge()}
              >
                {kbIngesting ? "Adding…" : "Add knowledge"}
              </button>
            ) : null}
            <button style={kbIngesting ? { ...btnPrimary, opacity: 0.6, cursor: "not-allowed" } : btnPrimary} onClick={() => setStep("embed")} disabled={kbIngesting}>
              {kbDone ? "Continue" : "Skip"}
            </button>
            <button style={{ ...btnSecondary, marginLeft: "auto" }} onClick={() => setStep("branding")}>Back</button>
          </div>
        </div>
      )}

      {/* EMBED */}
      {step === "embed" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: UI.text }}>Add the widget to your site</h2>
            <p style={{ fontSize: 14, color: UI.text2, margin: 0, lineHeight: 1.5 }}>
              Copy the snippet below and paste it into the{" "}
              <code style={{ background: "#F3F4F6", padding: "2px 6px", borderRadius: 6 }}>&lt;head&gt;</code> of your website.
            </p>
          </div>

          {embedSnippet ? (
            <pre style={{ padding: 14, borderRadius: UI.radius, border: `1px solid ${UI.border}`, background: "#F9FAFB", fontSize: 12.5, overflow: "auto", margin: 0, lineHeight: 1.6 }}>
              {embedSnippet}
            </pre>
          ) : (
            <div style={{ padding: 12, borderRadius: UI.radius, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 13, color: "#991B1B" }}>
              No public key found. Please check the Keys tab in the admin panel.
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {embedSnippet ? (
              <button
                style={snippetCopied ? { ...btnPrimary, background: "#16A34A", borderColor: "#16A34A" } : btnPrimary}
                onClick={copySnippet}
              >
                {snippetCopied ? "Copied!" : "Copy snippet"}
              </button>
            ) : null}
            <button style={btnPrimary} onClick={() => void completeWizard()}>
              {snippetCopied ? "Finish" : "Skip & finish"}
            </button>
            <button style={{ ...btnSecondary, marginLeft: "auto" }} onClick={() => setStep("knowledge")}>Back</button>
          </div>
        </div>
      )}

      {/* DONE */}
      {step === "done" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 10px", color: UI.text }}>You&apos;re all set!</h2>
            <p style={{ fontSize: 15, color: UI.text2, lineHeight: 1.6, margin: 0 }}>
              Your TamTam widget is configured and ready. Head to your admin panel to manage leads, conversations, and more.
            </p>
          </div>
          <button style={btnPrimary} onClick={() => void completeWizard()}>Go to admin panel</button>
        </div>
      )}
    </div>
  );
}
