// lib/leadMerge.ts
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

type FindOrCreateParams = {
  company_id: string;
  conversation_id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
};

function normalizeEmail(email?: string | null) {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e ? e : null;
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  const p = phone.replace(/\s+/g, "").trim();
  return p ? p : null;
}

async function ensureConversationId(company_id: string, conversation_id?: string | null) {
  const cid = (conversation_id || "").trim();
  if (cid) {
    // validate it exists and belongs to company
    const { data } = await supabaseServer
      .from("conversations")
      .select("id,company_id")
      .eq("id", cid)
      .maybeSingle();

    if (data && String((data as any).company_id) === company_id) {
      return String((data as any).id);
    }
    // invalid conversation id => treat as missing
  }

  // create a new conversation for public booking / missing context
  const session_id = `public_${crypto.randomBytes(16).toString("hex")}`;

  const { data: conv, error } = await supabaseServer
    .from("conversations")
    .insert({
      company_id,
      session_id,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error || !conv?.id) throw new Error("conversation_create_failed");
  return String((conv as any).id);
}

export async function findOrCreateCompanyLead(params: FindOrCreateParams) {
  const { company_id, name, email, phone, source = "booking" } = params;

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  // Always ensure we have a valid conversation_id (FK requirement)
  const conversation_id = await ensureConversationId(company_id, params.conversation_id ?? null);

  // 1) Resolve by conversation_id (strongest link)
  {
    const { data } = await supabaseServer
      .from("company_leads")
      .select("*")
      .eq("company_id", company_id)
      .eq("conversation_id", conversation_id)
      .maybeSingle();

    if (data) return data;
  }

  // 2) Resolve by email
  if (normalizedEmail) {
    const { data } = await supabaseServer
      .from("company_leads")
      .select("*")
      .eq("company_id", company_id)
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) return data;
  }

  // 3) Resolve by phone
  if (normalizedPhone) {
    const { data } = await supabaseServer
      .from("company_leads")
      .select("*")
      .eq("company_id", company_id)
      .eq("phone", normalizedPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) return data;
  }

  // 4) Create new lead (with valid conversation_id)
  const { data: newLead, error } = await supabaseServer
    .from("company_leads")
    .insert({
      company_id,
      conversation_id,
      name: name ?? null,
      email: normalizedEmail,
      phone: normalizedPhone,
      source,
      channel: "booking",
      status: "new",
      last_touch_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();

  if (error || !newLead) throw new Error("lead_create_failed");
  return newLead;
}

export async function updateLeadBookingSignals(lead_id: string) {
  try {
    await supabaseServer.rpc("increment_lead_booking_count", { p_lead_id: lead_id });
  } catch {
    // ignore (optional)
  }
}