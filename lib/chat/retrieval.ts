import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";
import { captureError } from "@/lib/logger";
import type { ChatMessage } from "./types";

const SUMMARY_THRESHOLD = 14; // summarize when history exceeds this many messages
const SUMMARY_TAIL = 6;       // keep this many recent messages verbatim after summarizing

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function embedQuery(text: string): Promise<number[]> {
  const r = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return r.data[0].embedding as unknown as number[];
}

export async function matchKnowledgeChunks(
  company_id: string,
  embedding: number[],
  match_count: number,
  intent: string | null
) {
  const { data, error } = await supabaseServer.rpc("match_knowledge_chunks", {
    p_company_id: company_id,
    p_query_embedding: embedding,
    p_match_count: match_count,
    p_intent: intent,
  });

  if (error) return { ok: false as const, rows: [] as Record<string, unknown>[] };
  return { ok: true as const, rows: Array.isArray(data) ? data : [] };
}

export function buildContext(rows: Record<string, unknown>[]): string {
  if (!Array.isArray(rows) || rows.length === 0) return "";

  const sorted = [...rows].sort((a, b) => {
    const simA = Number(a.similarity ?? 0);
    const simB = Number(b.similarity ?? 0);
    if (simA !== simB) return simB - simA;

    const metaA = (a.metadata as Record<string, unknown>) || {};
    const metaB = (b.metadata as Record<string, unknown>) || {};

    const sectionA = Number(metaA.section_order ?? 0);
    const sectionB = Number(metaB.section_order ?? 0);
    if (sectionA !== sectionB) return sectionA - sectionB;

    return Number(metaA.chunk_index ?? 0) - Number(metaB.chunk_index ?? 0);
  });

  return sorted
    .map((r, i) => {
      const meta = (r.metadata as Record<string, unknown>) || {};
      const section = meta.section_title ? `SECTION: ${meta.section_title}\n` : "";
      return `[#${i + 1}]\n${section}${String(r.content || "").trim()}`;
    })
    .join("\n\n---\n\n");
}

export async function fetchForcedPricingContext(company_id: string, match_count = 12) {
  const { data, error } = await supabaseServer
    .from("knowledge_chunks")
    .select("id, title, content, source_ref, metadata, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(Math.min(60, Math.max(8, match_count * 4)));

  if (error) return { ok: false as const, rows: [] as Record<string, unknown>[] };

  const rows = (data ?? []).filter((r) => {
    const m = (r?.metadata as Record<string, unknown>) || {};
    const type = String(m?.type || "").toLowerCase();
    const section = String(m?.section_title || "").toLowerCase();
    const title = String(r?.title || "").toLowerCase();
    const text = String(r?.content || "").toLowerCase();
    return (
      type.includes("pricing") ||
      type.includes("plan") ||
      section.includes("pricing") ||
      section.includes("plan") ||
      title.includes("pricing") ||
      title.includes("plan") ||
      text.includes("€/") ||
      text.includes("per month") ||
      text.includes("monat") ||
      text.includes("starter") ||
      text.includes("growth") ||
      text.includes("pro")
    );
  });

  const picked = rows.length ? rows.slice(0, match_count) : (data ?? []).slice(0, match_count);
  return { ok: true as const, rows: picked };
}

export async function loadChatHistory(conversation_id: string, limit = 18): Promise<ChatMessage[]> {
  const { data } = await supabaseServer
    .from("messages")
    .select("role,content,created_at")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data ?? [])
    .filter((m) => m?.content && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content).trim(),
    }));
}

/** Build a context-aware RAG query from recent user messages + current message. */
export function buildRagQuery(historyMsgs: ChatMessage[], currentMessage: string): string {
  const recentUserContext = historyMsgs
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join(" ");
  return (recentUserContext + " " + currentMessage).trim().slice(0, 1000);
}

/**
 * When a conversation exceeds SUMMARY_THRESHOLD messages, summarize the older
 * half into a single system message so the prompt stays focused and cheap.
 * Returns the messages array to pass to OpenAI — either unchanged (short threads)
 * or [summary-system-msg, ...recent-tail].
 */
export async function compressHistory(
  msgs: ChatMessage[],
  openai: OpenAI
): Promise<ChatMessage[]> {
  if (msgs.length <= SUMMARY_THRESHOLD) return msgs;

  const toSummarize = msgs.slice(0, msgs.length - SUMMARY_TAIL);
  const tail = msgs.slice(msgs.length - SUMMARY_TAIL);

  const transcript = toSummarize
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "Summarize the following chat transcript in 3–5 bullet points. Focus on: what the user wants, what they've already shared (name, email, phone, preferences), and where the conversation left off. Be factual and concise.",
        },
        { role: "user", content: transcript },
      ],
    });

    const summary = res.choices[0]?.message?.content?.trim() ?? "";
    if (!summary) return msgs;

    // Inject summary as a system message before the recent tail
    return [
      { role: "assistant", content: `[Earlier conversation summary]\n${summary}` } as unknown as ChatMessage,
      ...tail,
    ];
  } catch (err) {
    captureError(err, { context: "compress_history" });
    // Fall back to just the tail to stay within limits
    return tail;
  }
}
