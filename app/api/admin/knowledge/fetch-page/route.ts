// app/api/admin/knowledge/fetch-page/route.ts
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";

export const runtime = "nodejs";

function isUrl(s: string) {
  const t = String(s || "").trim();
  return /^https?:\/\/[^\s]+$/i.test(t);
}

function stripHtmlToText(html: string) {
  // remove scripts/styles
  let s = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  // remove noscript
  s = s.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ");
  // remove tags
  s = s.replace(/<\/?[^>]+>/g, " ");
  // decode a few common entities
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  // normalize whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function extractTitle(html: string) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m && m[1]) return m[1].replace(/\s+/g, " ").trim();
  // fallback: og:title
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (og && og[1]) return og[1].trim();
  return "Untitled";
}

function pickColorsFromHtml(html: string) {
  // 1) theme-color is best signal
  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  const themeColor = theme?.[1]?.trim() || null;

  // 2) collect hex colors from inline styles + style tags (simple heuristic)
  const hexes = html.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const counts = new Map<string, number>();
  for (const h of hexes) {
    const c = h.toLowerCase();
    counts.set(c, (counts.get(c) || 0) + 1);
  }

  // helper: filter out near-white/near-black and obvious grays for accent choosing
  function isBoring(hex: string) {
    // only handle #rgb or #rrggbb
    const h = hex.replace("#", "");
    const full =
      h.length === 3
        ? h.split("").map((x) => x + x).join("")
        : h.length === 6
        ? h
        : null;
    if (!full) return true;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const nearWhite = max > 245 && min > 235;
    const nearBlack = max < 35;
    const grayish = max - min < 18;
    return nearWhite || nearBlack || grayish;
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const primaryGuess =
    (themeColor && themeColor.startsWith("#") ? themeColor : null) ||
    (sorted.find((x) => !isBoring(x)) || null);

  // accent: next non-boring distinct color
  const accentGuess =
    sorted.find((x) => x !== primaryGuess && !isBoring(x)) || null;

  // logo: og:image as fallback
  const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  const logo_url = ogImg?.[1]?.trim() || null;

  return {
    theme_color: themeColor,
    primary_color_guess: primaryGuess,
    accent_color_guess: accentGuess,
    logo_url,
    debug_top_hex: sorted.slice(0, 10),
  };
}

export async function POST(req: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const url = String(body?.url || "").trim();

  if (!isUrl(url)) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        // Helps some sites return the real HTML
        "User-Agent": "Mozilla/5.0 (compatible; TamTamCorpBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      cache: "no-store",
    });

    const html = await res.text();

    if (!res.ok || !html) {
      return NextResponse.json({ error: "fetch_failed", status: res.status }, { status: 502 });
    }

    const title = extractTitle(html);
    const text = stripHtmlToText(html);

    const colors = pickColorsFromHtml(html);

    // Safety: cap text size
    const cappedText = text.length > 120_000 ? text.slice(0, 120_000) : text;

    return NextResponse.json({
      ok: true,
      url,
      title,
      text: cappedText,
      colors,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "fetch_error", details: e?.message || "unknown" }, { status: 500 });
  }
}