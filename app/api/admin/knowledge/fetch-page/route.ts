// app/api/admin/knowledge/fetch-page/route.ts
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/adminGuard";

export const runtime = "nodejs";

function isUrl(s: string) {
  const t = String(s || "").trim();
  return /^https?:\/\/[^\s]+$/i.test(t);
}

function stripHtmlToText(html: string) {
  let s = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  s = s.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ");
  s = s.replace(/<\/?[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function extractTitle(html: string) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m && m[1]) return m[1].replace(/\s+/g, " ").trim();
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (og && og[1]) return og[1].trim();
  return "Untitled";
}

function resolveUrl(baseUrl: string, maybeRelative: string) {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractStylesheetUrls(html: string, baseUrl: string) {
  const urls: string[] = [];
  const re = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
  const hrefRe = /href=["']([^"']+)["']/i;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const hm = tag.match(hrefRe);
    if (!hm?.[1]) continue;
    const u = resolveUrl(baseUrl, hm[1]);
    if (u) urls.push(u);
  }

  // Also capture Next CSS preloads (sometimes rel="preload" as="style")
  const pre = /<link[^>]+as=["']style["'][^>]*>/gi;
  while ((m = pre.exec(html))) {
    const tag = m[0];
    const hm = tag.match(hrefRe);
    if (!hm?.[1]) continue;
    const u = resolveUrl(baseUrl, hm[1]);
    if (u) urls.push(u);
  }

  return Array.from(new Set(urls)).slice(0, 6); // limit
}

function extractManifestUrl(html: string, baseUrl: string) {
  const m = html.match(/<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  if (!m?.[1]) return null;
  return resolveUrl(baseUrl, m[1]);
}

function pickColorsFromTextBlobs(blobs: string[]) {
  const hexes: string[] = [];
  for (const b of blobs) {
    const found = b.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (found) hexes.push(...found);
  }
  const counts = new Map<string, number>();
  for (const h of hexes) {
    const c = h.toLowerCase();
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([k]) => k);

  function isBoring(hex: string) {
    const h = hex.replace("#", "");
    const full =
      h.length === 3 ? h.split("").map((x) => x + x).join("") :
      h.length === 6 ? h :
      null;
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

  const primary = sorted.find((x) => !isBoring(x)) || null;
  const accent = sorted.find((x) => x !== primary && !isBoring(x)) || null;

  return { primary, accent, debug_top_hex: sorted.slice(0, 12) };
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TamTamCorpBot/1.0)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    redirect: "follow",
    cache: "no-store",
  });

  const html = await res.text();
  return { ok: res.ok, status: res.status, html };
}

async function fetchCss(url: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TamTamCorpBot/1.0)",
      Accept: "text/css,*/*;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  // cap to avoid huge files
  return text.length > 400_000 ? text.slice(0, 400_000) : text;
}

async function fetchManifest(url: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TamTamCorpBot/1.0)",
      Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function jinaFallback(url: string) {
  // Fallback for JS-rendered sites
  // Example: https://r.jina.ai/https://example.com
  const jinaUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(jinaUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TamTamCorpBot/1.0)",
      Accept: "text/plain",
    },
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > 120_000 ? clean.slice(0, 120_000) : clean;
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
    const { ok, status, html } = await fetchText(url);
    if (!ok || !html) {
      return NextResponse.json({ error: "fetch_failed", status }, { status: 502 });
    }

    const title = extractTitle(html);

    // --- TEXT extraction ---
    let text = stripHtmlToText(html);

    // If HTML text is too short, try Jina fallback
    let used_fallback = false;
    if (!text || text.length < 300) {
      const fb = await jinaFallback(url);
      if (fb && fb.length > text.length) {
        text = fb;
        used_fallback = true;
      }
    }

    // --- COLORS extraction ---
    // 1) theme-color meta (often absent)
    const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const themeColor = theme?.[1]?.trim() || null;

    // 2) manifest theme_color/background_color (often present)
    const manifestUrl = extractManifestUrl(html, url);
    let manifestTheme: string | null = null;
    let manifestBg: string | null = null;
    if (manifestUrl) {
      const man = await fetchManifest(manifestUrl);
      if (man && typeof man === "object") {
        manifestTheme = typeof man.theme_color === "string" ? man.theme_color : null;
        manifestBg = typeof man.background_color === "string" ? man.background_color : null;
      }
    }

    // 3) CSS files (Next.js usually has them even when HTML is empty)
    const cssUrls = extractStylesheetUrls(html, url);
    const cssBlobs: string[] = [];
    for (const cssUrl of cssUrls) {
      try {
        cssBlobs.push(await fetchCss(cssUrl));
      } catch {
        // ignore single CSS failures
      }
    }

    // 4) Combine sources and pick colors
    const colorPick = pickColorsFromTextBlobs([html, ...cssBlobs]);

    const primaryGuess =
      (themeColor && themeColor.startsWith("#") ? themeColor : null) ||
      (manifestTheme && manifestTheme.startsWith("#") ? manifestTheme : null) ||
      colorPick.primary;

    const accentGuess =
      colorPick.accent ||
      (manifestBg && manifestBg.startsWith("#") ? manifestBg : null) ||
      null;

    // logo: og:image
    const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const logo_url = ogImg?.[1]?.trim() || null;

    return NextResponse.json({
      ok: true,
      url,
      title,
      text,
      used_fallback,
      colors: {
        theme_color: themeColor,
        manifest_theme_color: manifestTheme,
        manifest_background_color: manifestBg,
        primary_color_guess: primaryGuess,
        accent_color_guess: accentGuess,
        logo_url,
        css_urls: cssUrls,
        debug_top_hex: colorPick.debug_top_hex,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "fetch_error", details: e?.message || "unknown" }, { status: 500 });
  }
}