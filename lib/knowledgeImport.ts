import OpenAI from "openai";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type ImportResult = {
  ok: true;
  pages?: Array<{ url: string; title: string }>;
  chunksInserted: number;
  brandingUpdated: boolean;
  brandingPreview?: any;
};

function hash(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function normalizeText(text: string) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function detectSectionType(title: string) {
  const t = title.toLowerCase();
  if (t.includes("price") || t.includes("pricing") || t.includes("preis")) return "pricing";
  if (t.includes("faq") || t.includes("question")) return "faq";
  if (t.includes("contact") || t.includes("kontakt")) return "contact";
  if (t.includes("feature") || t.includes("service") || t.includes("solution")) return "feature";
  if (t.includes("about") || t.includes("company")) return "about";
  return "general";
}

function chunkTextSmart(text: string, size = 900, overlap = 120) {
  const clean = normalizeText(text);
  const chunks: string[] = [];
  let i = 0;

  while (i < clean.length) {
    const end = Math.min(clean.length, i + size);
    let slice = clean.slice(i, end);

    const lastSpace = slice.lastIndexOf(" ");
    if (lastSpace > 200 && end !== clean.length) {
      slice = slice.slice(0, lastSpace);
    }

    chunks.push(slice.trim());
    i += slice.length - overlap;
  }

  return chunks.filter(Boolean);
}

async function embedBatch(chunks: string[]) {
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks,
  });
  return emb.data.map((x) => x.embedding as number[]);
}

async function insertStructuredChunks(params: {
  company_id: string;
  page_url: string;
  doc_title: string;
  sections: Array<{ title: string; content: string; order: number }>;
}) {
  let totalInserted = 0;

  const doc_id = hash(params.page_url);

  for (const section of params.sections) {
    const chunks = chunkTextSmart(section.content);
    if (!chunks.length) continue;

    const vectors = await embedBatch(chunks);

    const rows = chunks.map((c, idx) => ({
      company_id: params.company_id,
      source_type: "website",
      source_ref: params.page_url,
      title: section.title,
      content: c,
      metadata: {
        doc_id,
        page_url: params.page_url,
        doc_title: params.doc_title,
        section_title: section.title,
        section_type: detectSectionType(section.title),
        section_order: section.order,
        chunk_index: idx,
      },
      embedding: vectors[idx],
    }));

    const { error } = await supabaseServer.from("knowledge_chunks").insert(rows);
    if (error) throw new Error(error.message);

    totalInserted += rows.length;
  }

  return totalInserted;
}

function extractStructuredSections(baseUrl: string, html: string) {
  const $ = cheerio.load(html);
  $("script,style,noscript,svg,canvas").remove();

  const pageTitle = $("title").first().text().trim() || baseUrl;

  const sections: Array<{ title: string; content: string; order: number }> = [];

  let currentSection = {
    title: "Introduction",
    content: "",
    order: 0,
  };

  let orderIndex = 0;

  $("body")
    .find("h2, h3, p, li")
    .each((_i, el) => {
      const tag = el.tagName.toLowerCase();
      const text = normalizeText($(el).text());
      if (!text) return;

      if (tag === "h2") {
        if (currentSection.content.length > 100) {
          sections.push(currentSection);
        }
        orderIndex += 1;
        currentSection = {
          title: text,
          content: "",
          order: orderIndex,
        };
      } else if (tag === "h3") {
        currentSection.content += `\n\n${text}\n`;
      } else {
        currentSection.content += ` ${text}`;
      }
    });

  if (currentSection.content.length > 100) {
    sections.push(currentSection);
  }

  return { pageTitle, sections };
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "TamTamCorpBot/1.0",
      accept: "text/html",
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const ct = String(res.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("text/html")) return null;

  return res.text();
}

export async function importFromWebsite(params: {
  company_id: string;
  url: string;
  maxPages?: number;
}): Promise<ImportResult | { ok: false; error: string }> {
  const maxPages = Math.max(1, Math.min(10, Number(params.maxPages || 5)));
  const visited = new Set<string>();
  const toVisit = [params.url];
  let totalChunks = 0;
  const pages: Array<{ url: string; title: string }> = [];

  while (toVisit.length && visited.size < maxPages) {
    const current = toVisit.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const html = await fetchHtml(current);
    if (!html) continue;

    const { pageTitle, sections } = extractStructuredSections(current, html);

    if (sections.length) {
      const inserted = await insertStructuredChunks({
        company_id: params.company_id,
        page_url: current,
        doc_title: pageTitle,
        sections,
      });
      totalChunks += inserted;
    }

    pages.push({ url: current, title: pageTitle });
  }

  return {
    ok: true,
    pages,
    chunksInserted: totalChunks,
    brandingUpdated: false,
  };
}
