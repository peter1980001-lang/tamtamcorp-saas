import express from "express";
import { chromium, Browser } from "playwright";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 8787);
const HOST = String(process.env.HOST || "0.0.0.0");
const SECRET = String(process.env.CRAWLER_SECRET || "").trim();

let browser: Browser | null = null;

async function getBrowser() {
  if (browser) return browser;
  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote"
    ]
  });
  return browser;
}

function requireSecret(req: express.Request, res: express.Response) {
  if (!SECRET) return res.status(500).json({ error: "crawler_secret_not_set" });
  const h = String(req.header("x-crawler-secret") || "");
  if (h !== SECRET) return res.status(401).json({ error: "unauthorized" });
  return null;
}

const RenderBody = z.object({
  url: z.string().url(),
  wait_ms: z.number().int().min(0).max(15000).optional(),
  timeout_ms: z.number().int().min(3000).max(45000).optional()
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "tamtam-render-crawler" });
});

app.post("/render", async (req, res) => {
  const authErr = requireSecret(req, res);
  if (authErr) return;

  const parsed = RenderBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });

  const { url, wait_ms, timeout_ms } = parsed.data;
  const timeout = timeout_ms ?? 30000;

  const b = await getBrowser();
  const ctx = await b.newContext({
    userAgent: "TamTamCorpCrawler/1.0 (+https://tamtamcorp.tech)",
    viewport: { width: 1280, height: 720 }
  });

  const page = await ctx.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
    if (wait_ms && wait_ms > 0) await page.waitForTimeout(wait_ms);

    // If content is lazy-loaded on scroll (pricing cards often), do a few scrolls
    await page.evaluate(async () => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 4; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(350);
      }
      window.scrollTo(0, 0);
      await sleep(200);
    });

    const html = await page.content();

    const text = await page.evaluate(() => {
      const t = (document.body?.innerText || "").trim();
      return t;
    });

    const title = await page.title().catch(() => "");

    return res.json({
      ok: true,
      url,
      title: String(title || ""),
      html,
      text
    });
  } catch (e: any) {
    return res.status(500).json({ error: "render_failed", details: e?.message || String(e) });
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
});

process.on("SIGINT", async () => {
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
});
process.on("SIGTERM", async () => {
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`crawler listening on http://${HOST}:${PORT}`);
});
