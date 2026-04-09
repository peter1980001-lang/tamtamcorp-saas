// app/admin/companies/[id]/_components/TabGettingStarted.tsx
"use client";

import { useEffect, useState } from "react";
import { UI, Button, Card } from "./ui";
import type { DetailResponse, Tab } from "./types";

type StepStatus = "done" | "pending";

type Step = {
  key: string;
  label: string;
  description: string;
  targetTab: Tab;
  status: StepStatus;
};

function CheckIcon({ done }: { done: boolean }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        border: `2px solid ${done ? UI.success : UI.border}`,
        background: done ? UI.success : "#fff",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      {done ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
}

export default function TabGettingStarted(props: {
  companyId: string;
  data: DetailResponse;
  setTabAndUrl: (tab: Tab) => void;
  onDismiss: () => void;
  onAllComplete: () => void;
  setToast: (s: string) => void;
}) {
  const { companyId, data, setTabAndUrl, onDismiss, onAllComplete, setToast } = props;

  const [hasKnowledge, setHasKnowledge] = useState(false);
  const [hasCalendar, setHasCalendar] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    const ac = new AbortController();

    fetch(`/api/admin/knowledge/chunks?company_id=${encodeURIComponent(companyId)}&limit=1`, { signal: ac.signal })
      .then((r) => r.json())
      .then((j) => {
        setHasKnowledge((Array.isArray(j?.chunks) ? j.chunks : []).length > 0);
      })
      .catch(() => {});

    fetch(`/api/admin/companies/${encodeURIComponent(companyId)}/calendar?status=all&limit=1`, { signal: ac.signal })
      .then((r) => r.json())
      .then((j) => {
        setHasCalendar((Array.isArray(j?.appointments) ? j.appointments : []).length > 0);
      })
      .catch(() => {});

    return () => ac.abort();
  }, [companyId]);

  const branding = (data.settings?.branding_json || {}) as Record<string, any>;
  const hasBranding =
    String(branding?.company_name || "").trim().length > 0 &&
    String(branding?.logo_url || "").trim().length > 0;

  const hasEmbed = String(data.keys?.public_key || "").trim().length > 0;
  const hasTeam = (data.admins || []).length >= 2;
  const hasBilling = String(data.company?.status || "").toLowerCase() === "active";

  const steps: Step[] = [
    {
      key: "account",
      label: "Create your account",
      description: "Register and create your company workspace.",
      targetTab: "dashboard",
      status: "done",
    },
    {
      key: "branding",
      label: "Set up branding",
      description: "Add your company name and logo so the widget looks like yours.",
      targetTab: "branding",
      status: hasBranding ? "done" : "pending",
    },
    {
      key: "knowledge",
      label: "Add knowledge",
      description: "Teach the AI about your business — paste your website URL or text.",
      targetTab: "knowledge",
      status: hasKnowledge ? "done" : "pending",
    },
    {
      key: "embed",
      label: "Embed the widget",
      description: "Copy the embed snippet and add it to your website.",
      targetTab: "embed",
      status: hasEmbed ? "done" : "pending",
    },
    {
      key: "team",
      label: "Invite your team",
      description: "Add teammates so they can manage leads and conversations.",
      targetTab: "team",
      status: hasTeam ? "done" : "pending",
    },
    {
      key: "calendar",
      label: "Set up calendar",
      description: "View and manage bookings made through your widget.",
      targetTab: "calendar",
      status: hasCalendar ? "done" : "pending",
    },
    {
      key: "billing",
      label: "Activate your plan",
      description: "Choose a plan and go live.",
      targetTab: "billing",
      status: hasBilling ? "done" : "pending",
    },
  ];

  const doneCount = steps.filter((s) => s.status === "done").length;
  const total = steps.length;
  const progressPct = Math.round((doneCount / total) * 100);

  // Auto-hide when all steps are complete
  useEffect(() => {
    if (doneCount === total) {
      onAllComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount, total]);

  async function handleDismiss() {
    setDismissing(true);
    try {
      await fetch("/api/onboarding/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "dismiss", company_id: companyId }),
      });
    } catch {
      setToast("Dismiss failed — please try again.");
    }
    setDismissing(false);
    onDismiss();
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card
        title="Getting Started"
        subtitle="Complete these steps to get the most out of your TamTam widget."
        right={
          <Button onClick={handleDismiss} disabled={dismissing} variant="secondary">
            {dismissing ? "Dismissing…" : "Dismiss"}
          </Button>
        }
      >
        <div style={{ display: "grid", gap: 16 }}>
          {/* Progress bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: UI.text2 }}>
              <span>
                <b style={{ color: UI.text }}>{doneCount}</b> of {total} complete
              </span>
              <span>{progressPct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: UI.border, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: progressPct === 100 ? UI.success : UI.accent,
                  borderRadius: 999,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>

          {/* Steps */}
          <div style={{ display: "grid", gap: 2 }}>
            {steps.map((step) => (
              <div
                key={step.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 4px",
                  borderBottom: `1px solid ${UI.borderSoft}`,
                }}
              >
                <CheckIcon done={step.status === "done"} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 950,
                      fontSize: 14,
                      color: step.status === "done" ? UI.text2 : UI.text,
                      textDecoration: step.status === "done" ? "line-through" : "none",
                    }}
                  >
                    {step.label}
                  </div>
                  <div style={{ fontSize: 12.5, color: UI.text3, marginTop: 2 }}>{step.description}</div>
                </div>
                {step.key !== "account" ? (
                  <Button onClick={() => setTabAndUrl(step.targetTab)} variant="secondary">
                    {step.status === "done" ? "View" : "Go →"}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>

          {doneCount === total ? (
            <div
              style={{
                padding: 14,
                borderRadius: UI.radius,
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                color: "#065F46",
                fontWeight: 950,
                fontSize: 13.5,
              }}
            >
              All steps complete! Your TamTam widget is fully set up.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
