import { supabaseServer } from "@/lib/supabaseServer";

type HotLeadPayload = {
  company_id: string;
  conversation_id: string;
  score_band: "cold" | "warm" | "hot";
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  intent?: string | null;
  last_message?: string | null;
};

type HandoffPayload = {
  company_id: string;
  conversation_id: string;
  trigger: "owner_request" | "frustrated_user" | "repeated_failure" | "unknown";
  last_message?: string | null;
};

async function getCompanyAdminEmails(company_id: string): Promise<string[]> {
  const { data: rows } = await supabaseServer
    .from("company_admins")
    .select("user_id")
    .eq("company_id", company_id)
    .limit(5);

  if (!rows || rows.length === 0) return [];

  const emails: string[] = [];
  for (const row of rows) {
    try {
      const { data } = await supabaseServer.auth.admin.getUserById(row.user_id);
      const e = data?.user?.email;
      if (e) emails.push(e);
    } catch {
      // skip
    }
  }
  return emails;
}

async function getCompanyName(company_id: string): Promise<string> {
  const { data } = await supabaseServer
    .from("companies")
    .select("name")
    .eq("id", company_id)
    .maybeSingle();
  return String((data as { name?: string } | null)?.name || "").trim() || "your company";
}

async function sendViaResend(to: string[], subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // no key = silent no-op

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "notifications@tamtam.ai",
      to,
      subject,
      html,
    }),
  });
}

export async function notifyHotLead(payload: HotLeadPayload): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  try {
    const [adminEmails, companyName] = await Promise.all([
      getCompanyAdminEmails(payload.company_id),
      getCompanyName(payload.company_id),
    ]);

    if (adminEmails.length === 0) return;

    const contactLine = [
      payload.name ? `<b>Name:</b> ${payload.name}` : null,
      payload.email ? `<b>Email:</b> <a href="mailto:${payload.email}">${payload.email}</a>` : null,
      payload.phone ? `<b>Phone:</b> ${payload.phone}` : null,
      payload.intent ? `<b>Intent:</b> ${payload.intent}` : null,
    ]
      .filter(Boolean)
      .join("<br>");

    const lastMsg = payload.last_message
      ? `<p style="margin:16px 0 0;padding:12px;background:#f5f5f5;border-radius:8px;font-style:italic;">"${payload.last_message.slice(0, 300)}"</p>`
      : "";

    const html = `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111;">
  <h2 style="margin:0 0 8px;">🔥 Hot Lead — ${companyName}</h2>
  <p style="margin:0 0 16px;color:#555;">A visitor just reached <b>hot</b> lead status on your widget.</p>
  ${contactLine ? `<div style="line-height:1.8;">${contactLine}</div>` : ""}
  ${lastMsg}
  <p style="margin:24px 0 0;font-size:12px;color:#999;">
    Conversation ID: ${payload.conversation_id}
  </p>
</div>`;

    await sendViaResend(
      adminEmails,
      `🔥 Hot lead on ${companyName}`,
      html
    );
  } catch {
    // notifications are always non-fatal
  }
}

export async function notifyHumanHandoff(payload: HandoffPayload): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  try {
    const [adminEmails, companyName] = await Promise.all([
      getCompanyAdminEmails(payload.company_id),
      getCompanyName(payload.company_id),
    ]);

    if (adminEmails.length === 0) return;

    const triggerLabel: Record<HandoffPayload["trigger"], string> = {
      owner_request: "Customer requested a human",
      frustrated_user: "Frustrated visitor detected",
      repeated_failure: "Repeated failure to assist",
      unknown: "Human assistance needed",
    };

    const lastMsg = payload.last_message
      ? `<p style="margin:16px 0 0;padding:12px;background:#fff3cd;border-radius:8px;font-style:italic;">"${payload.last_message.slice(0, 300)}"</p>`
      : "";

    const html = `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111;">
  <h2 style="margin:0 0 8px;">🚨 Human Handoff — ${companyName}</h2>
  <p style="margin:0 0 16px;color:#555;"><b>Trigger:</b> ${triggerLabel[payload.trigger]}</p>
  ${lastMsg}
  <p style="margin:24px 0 0;font-size:12px;color:#999;">
    Conversation ID: ${payload.conversation_id}
  </p>
</div>`;

    await sendViaResend(
      adminEmails,
      `🚨 Human handoff needed — ${companyName}`,
      html
    );
  } catch {
    // notifications are always non-fatal
  }
}
