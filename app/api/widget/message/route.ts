export const runtime = "nodejs";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkBillingGate } from "@/lib/billingGate";
import {
  decideAction,
  detectBookingIntent,
  detectCommercial,
  detectContact,
  detectFrustration,
  detectHumanHandoffRequest,
  nextFunnelState,
  oneStrategicQuestion,
} from "@/lib/funnelEngine";
import { loadFunnelConfig } from "@/lib/chat/funnelConfig";
import { captureError } from "@/lib/logger";
import {
  buildContext,
  buildRagQuery,
  compressHistory,
  embedQuery,
  fetchForcedPricingContext,
  loadChatHistory,
  matchKnowledgeChunks,
} from "@/lib/chat/retrieval";
import { upsertCompanyLead } from "@/lib/chat/lead";
import { buildSystemPrompt } from "@/lib/chat/prompt";
import { notifyHumanHandoff } from "@/lib/notifications";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function detectIntent(text: string): "pricing" | "faq" | "contact" | null {
  if (/(price|pricing|cost|quote|offer|proposal|plan|package|preis|preise|kosten|angebot|paket|abo)/i.test(text)) return "pricing";
  if (/(faq|question|questions|frage|fragen|how does|wie funktioniert)/i.test(text)) return "faq";
  if (/(contact|call|appointment|termin|kontakt|anruf|reach|demo|meeting|book|schedule)/i.test(text)) return "contact";
  return null;
}

async function loadCompanyName(company_id: string): Promise<string> {
  const { data } = await supabaseServer.from("companies").select("name").eq("id", company_id).maybeSingle();
  return String((data as { name?: string } | null)?.name || "").trim() || "Nova";
}

export async function POST(req: Request) {
  // --- Auth ---
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

  let payload: { company_id?: string };
  try {
    payload = jwt.verify(token, process.env.WIDGET_JWT_SECRET!) as { company_id?: string };
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const company_id = String(payload.company_id || "").trim();
  if (!company_id) return NextResponse.json({ error: "missing_company" }, { status: 401 });

  // --- Parse body ---
  const body = await req.json().catch(() => null);
  const conversation_id = String(body?.conversation_id || "").trim();
  const message = String(body?.message || "").trim();

  if (!conversation_id || !message) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ error: "message_too_long" }, { status: 400 });
  }

  // --- Verify conversation belongs to company ---
  const { data: conv } = await supabaseServer
    .from("conversations")
    .select("id,company_id")
    .eq("id", conversation_id)
    .maybeSingle();

  if (!conv || String((conv as { company_id: string }).company_id) !== company_id) {
    return NextResponse.json({ error: "invalid_conversation" }, { status: 403 });
  }

  // --- Billing gate ---
  const bill = await checkBillingGate(company_id);
  if (!bill.ok) return NextResponse.json({ error: bill.code }, { status: 402 });

  // --- Store user message ---
  await supabaseServer.from("messages").insert({ conversation_id, role: "user", content: message });

  // --- Signal detection ---
  const intent = detectIntent(message);
  const commercial = detectCommercial(message);
  const contactShared = detectContact(message);

  // --- Load config + history (both needed before RAG and prompt) ---
  const [funnelConfig, historyMsgs] = await Promise.all([
    loadFunnelConfig(company_id),
    loadChatHistory(conversation_id, 18),
  ]);

  // --- Funnel state ---
  let prevState = null as import("@/lib/funnelEngine").FunnelState | null;
  let knownQualification: Record<string, unknown> | null = null;

  try {
    const { data: existingLead } = await supabaseServer
      .from("company_leads")
      .select("qualification_json")
      .eq("company_id", company_id)
      .eq("conversation_id", conversation_id)
      .maybeSingle();

    const qual = (existingLead as { qualification_json?: Record<string, unknown> } | null)?.qualification_json ?? null;
    knownQualification = qual;
    const ps = qual?.funnel_state;
    if (ps && typeof ps === "string") prevState = ps as import("@/lib/funnelEngine").FunnelState;
  } catch (err) {
    captureError(err, { context: "funnel_state_load", company_id, conversation_id });
  }

  const state = nextFunnelState({ message, prev: prevState, config: funnelConfig });
  const action = decideAction({ message, state, config: funnelConfig });

  const strategicQuestion = funnelConfig.default_cta?.trim()
    ? funnelConfig.default_cta.trim()
    : oneStrategicQuestion(state, funnelConfig, knownQualification);

  const needLeadCapture =
    action === "capture_contact" ||
    action === "handoff" ||
    (contactShared && action === "reply");

  // --- Lead upsert (non-blocking) ---
  if (funnelConfig.enabled) {
    upsertCompanyLead({ company_id, conversation_id, message, intent, commercial, state, action }).catch(() => {});
  }

  // --- RAG retrieval ---
  let context = "";
  let sources: Record<string, unknown>[] = [];

  try {
    const isPricingStage = intent === "pricing" || state === "pricing_interest" || state === "objection_price";
    const pricingOverrideEnabled = !!(funnelConfig.retrieval_overrides as { pricing?: { enabled?: boolean } })?.pricing?.enabled;

    if (isPricingStage && pricingOverrideEnabled) {
      const mc = Number((funnelConfig.retrieval_overrides as { pricing?: { match_count?: number } })?.pricing?.match_count ?? 12);
      const forced = await fetchForcedPricingContext(company_id, mc);
      if (forced.ok && forced.rows.length > 0) {
        sources = forced.rows;
        context = buildContext(forced.rows);
      } else {
        const emb = await embedQuery(buildRagQuery(historyMsgs, message));
        const match = await matchKnowledgeChunks(company_id, emb, 12, intent);
        if (match.ok && match.rows.length > 0) {
          sources = match.rows;
          context = buildContext(match.rows);
        }
      }
    } else {
      const emb = await embedQuery(buildRagQuery(historyMsgs, message));
      const match = await matchKnowledgeChunks(company_id, emb, 6, intent);
      if (match.ok && match.rows.length > 0) {
        sources = match.rows;
        context = buildContext(match.rows);
      }
    }
  } catch (err) {
    captureError(err, { context: "rag_retrieval", company_id, conversation_id });
  }

  // --- Build prompt + stream LLM ---
  const companyName = await loadCompanyName(company_id);
  const systemPrompt = buildSystemPrompt({
    companyName,
    config: funnelConfig,
    state,
    strategicQuestion,
    knowledgeContext: context || "(empty)",
    action,
    knownQualification,
  });

  // Summarize old messages when thread is long to keep the prompt tight
  const compressedHistory = await compressHistory(historyMsgs, openai);

  const llmStream = await openai.chat.completions.create({
    model: funnelConfig.model,
    temperature: funnelConfig.temperature,
    messages: [{ role: "system", content: systemPrompt }, ...compressedHistory],
    stream: true,
  });

  const encoder = new TextEncoder();

  const isHumanHandoff = action === "handoff" || detectHumanHandoffRequest(message) || detectFrustration(message);

  const meta = {
    action,
    need_lead_capture: needLeadCapture,
    lead_prompt: strategicQuestion || null,
    funnel_state: state,
    sources,
    booking_requested: action === "show_slots" || detectBookingIntent(message),
    human_handoff: isHumanHandoff,
  };

  // Fire handoff notification non-blocking
  if (isHumanHandoff && funnelConfig.human_handoff_enabled) {
    const trigger =
      action === "handoff"
        ? detectHumanHandoffRequest(message)
          ? "owner_request"
          : "frustrated_user"
        : detectFrustration(message)
        ? "frustrated_user"
        : "unknown";
    notifyHumanHandoff({ company_id, conversation_id, trigger, last_message: message }).catch(() => {});
  }

  const readable = new ReadableStream({
    async start(controller) {
      let fullText = "";

      try {
        for await (const chunk of llmStream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullText += delta;
            // JSON-encode delta so newlines inside the text don't break SSE framing
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
          }
        }
      } catch (err) {
        captureError(err, { context: "llm_stream", company_id, conversation_id });
        // emit what accumulated so far
      }

      // Fallback if LLM returned nothing
      if (!fullText) {
        const fallback =
          action === "show_slots"
            ? "Absolutely — here are the next available appointment options."
            : action === "handoff"
            ? "Of course — I'm sorry for the frustration. I'll help you get this to a real person."
            : "How can I help?";
        fullText = fallback;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(fallback)}\n\n`));
      }

      // Store completed assistant message
      await supabaseServer.from("messages").insert({
        conversation_id,
        role: "assistant",
        content: fullText,
      });

      // Final metadata event — client reads this to trigger actions
      controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify(meta)}\n\n`));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
