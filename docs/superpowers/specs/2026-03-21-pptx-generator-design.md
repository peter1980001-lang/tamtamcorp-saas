# Design Spec: PPTX Generator

**Date:** 2026-03-21
**Status:** Approved
**Project:** `pptx-generator` (new standalone Next.js app)

---

## Overview

A web app that takes text, images, or existing `.pptx` files as input and generates a professionally designed, downloadable `.pptx` presentation. The AI (Claude API) designs the structure and content automatically — always different, always high quality. A consistent company branding is applied to every cover slide.

**Deployment target:** Self-hosted Node.js (not serverless/Vercel). Filesystem writes for branding are valid.

---

## Architecture & Data Flow

```
User submits single FormData POST (text + images + optional .pptx)
        ↓
  /api/generate (Next.js Route Handler)
    ├── if .pptx uploaded: extract text inline (officeparser)
    ├── images: read as Buffer, kept in-memory for this request
    ├── call Claude API (text + image Buffers as base64 vision blocks)
    ├── Claude returns structured JSON (slides array)
    ├── pptxgenjs builds .pptx (images embedded from in-memory Buffers)
    └── Response: JSON { slides: [...metadata], file: base64-encoded .pptx }
        ↓
  Frontend receives JSON, shows slide title list, offers download
```

**Key decisions:**
- Single combined request: extract + generate + build all happen in one POST
- Images are passed as base64 vision content blocks to Claude (full vision, not just filenames)
- Images stay in-memory for the duration of the request — no temp file storage needed
- Response is JSON (not raw binary) so the frontend can show metadata AND trigger download
- Branding stored as `config/branding.json` + logo in `public/branding/logo` (absolute path resolved at runtime)
- No database, no session storage, no persisted presentations

---

## File Size Limits

| Upload type | Limit |
|---|---|
| Single image | 5 MB (JPEG, PNG, GIF, WebP only — return 400 for other types) |
| Total images per request | 20 MB |
| Uploaded `.pptx` | 20 MB |

**Next.js 15 App Router body size configuration** (Pages Router `export const config` is silently ignored in App Router):
```js
// next.config.ts
experimental: {
  serverActions: { bodySizeLimit: '25mb' }
}
```

---

## UI & Pages

### `/` — Main Page

Three sections:

1. **Input Section**
   - Textarea: topic / content as freetext
   - Image upload: multiple images (sent to Claude as vision input)
   - `.pptx` upload: existing presentation (text extracted inline)
   - Optional field: desired slide count (default: auto, min: 4, max: 20)
   - Button: "Präsentation generieren"

2. **Status Section** (shown during generation)
   - Simple spinner + single message: "Präsentation wird generiert..."
   - No progressive status messages (single request, no streaming)

3. **Result Section** (shown after generation)
   - List of generated slide titles (from response JSON metadata)
   - "Download .pptx" button (triggers download from base64 response)

### `/branding` — One-time Setup

- Logo upload
- Primary color picker (hex)
- Company name input
- Save → `POST /api/branding` → writes `config/branding.json`, saves logo to `public/branding/logo.[ext]`
- On mount: `GET /api/branding` → loads existing values into form

---

## API Routes

### `POST /api/generate`

**Request:** `multipart/form-data`
- `text` (string) — freetext input
- `slideCount` (string, optional) — requested number of slides
- `images[]` (File[], optional) — uploaded images
- `presentation` (File, optional) — existing `.pptx`

**Response:** `application/json`
```json
{
  "slides": [
    { "type": "cover", "title": "Main Title" },
    { "type": "content", "title": "Slide Title" },
    { "type": "closing", "title": "Thank You" }
  ],
  "file": "<base64-encoded .pptx>"
}
```

### `GET /api/branding`

**Response:** `application/json`
```json
{
  "name": "Acme GmbH",
  "color": "#003366",
  "logoPath": "/branding/logo.png"
}
```
Returns empty defaults if no branding configured yet.

### `POST /api/branding`

**Request:** `multipart/form-data`
- `name` (string)
- `color` (string, hex)
- `logo` (File, optional)

**Response:** `{ "ok": true }`

---

## Slide Structure (Claude JSON Output)

```json
{
  "title": "Presentation title",
  "slides": [
    {
      "type": "cover",
      "title": "Main Title",
      "subtitle": "Subtitle or date"
    },
    {
      "type": "agenda",
      "title": "Agenda",
      "items": ["Item 1", "Item 2", "Item 3"]
    },
    {
      "type": "content",
      "layout": "title-bullets | title-text | two-columns | image-right",
      "title": "Slide Title",
      "content": ["Bullet 1", "Bullet 2"],
      "left": ["Left col 1", "Left col 2"],
      "right": ["Right col 1", "Right col 2"],
      "imageIndex": 0
    },
    {
      "type": "closing",
      "title": "Thank You",
      "subtitle": "Contact info or CTA"
    }
  ]
}
```

**Layout-specific fields:**
- `title-bullets` / `title-text`: uses `content` array
- `two-columns`: uses `left` array + `right` array (ignores `content`)
- `image-right`: uses `content` array + `imageIndex` (0-based index into uploaded images array; omit if no images)

**Branding.json schema:**
```json
{
  "name": "Company Name",
  "color": "#003366",
  "logoPath": "public/branding/logo.png"
}
```
`logoPath` is stored as a filesystem-relative path from project root (e.g. `public/branding/logo.png`).
- `buildPptx.ts` uses `path.resolve(process.cwd(), branding.logoPath)` to get the absolute path for embedding.
- `GET /api/branding` strips the `public/` prefix before returning, so the browser receives a public URL: `/branding/logo.png`.

---

## Claude Prompt Strategy

**System prompt:**
- Role: "Elite Presentation Designer"
- Branding context: company name, primary color
- Rules:
  - Always start with `cover` slide, always end with `closing` slide
  - Max 6 bullets per slide
  - Concise, impactful titles
  - Vary layouts across slides — no two consecutive slides with the same layout
  - Only use `image-right` layout if images were provided in the request
  - If `slideCount` is provided, hit that count exactly (including cover + closing)
  - Return valid JSON only — no prose, no markdown code fences

**User prompt:**
- Freetext input
- Extracted text from uploaded `.pptx` (if any)
- Uploaded images sent as base64 vision content blocks via Anthropic SDK's `image` content type
- Requested slide count (if provided, otherwise "choose appropriate count between 6 and 12")

**Retry logic for invalid JSON:**
If `JSON.parse()` fails on Claude's response, retry once with this prompt appended to the original user message:
```
Your previous response was not valid JSON. The parse error was: {error.message}
Please return only the JSON object, with no surrounding text, no markdown fences, and no explanation.
```
If retry also fails, throw an error and return HTTP 500 to the client.

---

## Tech Stack

| Concern | Tool |
|---|---|
| Framework | Next.js 15 + TypeScript |
| Styling | Tailwind CSS |
| AI | `@anthropic-ai/sdk` (claude-sonnet-4-6) |
| PPTX generation | `pptxgenjs` |
| PPTX extraction | `officeparser` |
| File uploads | Next.js built-in FormData handling |

---

## Project Structure

```
pptx-generator/
├── app/
│   ├── page.tsx                  ← Main page (input + status + result)
│   ├── branding/
│   │   └── page.tsx              ← Branding setup
│   └── api/
│       ├── generate/
│       │   └── route.ts          ← Extract + Claude + pptxgenjs (combined)
│       └── branding/
│           └── route.ts          ← GET + POST branding config
├── lib/
│   ├── claude.ts                 ← Claude API call + JSON parsing + retry
│   ├── buildPptx.ts              ← pptxgenjs slide builder
│   └── extractPptx.ts            ← .pptx text extractor (officeparser wrapper)
├── config/
│   └── branding.json             ← { name, color, logoPath }
└── public/
    └── branding/                 ← Uploaded company logo
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| Claude returns invalid JSON | Retry once with corrected prompt; 500 if retry fails |
| Upload exceeds size limit | 413 with message |
| Generation fails | 500 with message, user can retry |
| No branding configured | Fallback: neutral dark blue (#1a1a2e), no logo, no company name |
| `.pptx` extraction fails | Continue with freetext only, log warning |
| `imageIndex` out of bounds | Skip image embedding for that slide, continue |

---

## Out of Scope (v1)

- User accounts / authentication
- Presentation history / storage
- Real-time collaborative editing
- Browser-based visual slide preview
- Multiple company brandings
- Streaming / progressive generation updates
