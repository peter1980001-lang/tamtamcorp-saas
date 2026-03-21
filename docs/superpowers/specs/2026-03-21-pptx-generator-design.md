# Design Spec: PPTX Generator

**Date:** 2026-03-21
**Status:** Approved
**Project:** `pptx-generator` (new standalone Next.js app)

---

## Overview

A web app that takes text, images, or existing `.pptx` files as input and generates a professionally designed, downloadable `.pptx` presentation. The AI (Claude API) designs the structure and content automatically — always different, always high quality. A consistent company branding is applied to every cover slide.

---

## Architecture & Data Flow

```
User-Input (Text / Images / .pptx)
        ↓
  /api/generate (Next.js Route Handler)
        ↓
  /api/extract (if .pptx uploaded → extract text)
        ↓
  Claude API (claude-sonnet-4-6) → structured JSON (slides array)
        ↓
  pptxgenjs → .pptx Buffer
        ↓
  HTTP Response → file download
```

**Key decisions:**
- Stateless: no database, no stored presentations
- Single company: no auth, no multi-tenancy
- Branding stored as `config/branding.json` + logo in `public/branding/`
- Generated files returned directly as binary response, not persisted

---

## UI & Pages

### `/` — Main Page

Three sections:

1. **Input Section**
   - Textarea: topic / content as freetext
   - Image upload: multiple images (used as context for Claude)
   - `.pptx` upload: existing presentation to extract and perfect
   - Optional field: desired slide count (e.g. 8–12)
   - Button: "Präsentation generieren"

2. **Status Section** (shown during generation)
   - Loading animation
   - Progressive status messages: "Struktur wird geplant...", "Folien werden gebaut..."

3. **Download Section** (shown after generation)
   - "Download .pptx" button
   - Summary: list of generated slide titles

### `/branding` — One-time Setup

- Logo upload
- Primary color picker
- Company name input
- Save → writes to `config/branding.json`, saves logo to `public/branding/logo`

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
      "image_hint": "optional: which uploaded image to place here"
    },
    {
      "type": "closing",
      "title": "Thank You",
      "subtitle": "Contact info or CTA"
    }
  ]
}
```

**Slide types:** `cover`, `agenda`, `content`, `closing`
**Content layouts:** `title-bullets`, `title-text`, `two-columns`, `image-right`

---

## Claude Prompt Strategy

**System prompt:**
- Role: "Elite Presentation Designer"
- Branding context: company name, primary color
- Rules: max 6 bullets per slide, concise titles, vary layouts across slides, always start with cover, always end with closing
- Output: valid JSON only, no prose

**User prompt:**
- Raw input text
- Extracted text from uploaded `.pptx` (if any)
- Image descriptions (filenames + any extracted metadata)
- Requested slide count (if provided)

**Error recovery:** If Claude returns invalid JSON, retry once with a corrected prompt that includes the error and asks for valid JSON only.

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
│   ├── page.tsx                  ← Main page (input + status + download)
│   ├── branding/
│   │   └── page.tsx              ← Branding setup
│   └── api/
│       ├── generate/
│       │   └── route.ts          ← Claude call + pptxgenjs
│       ├── branding/
│       │   └── route.ts          ← Read/write branding config
│       └── extract/
│           └── route.ts          ← Extract text from uploaded .pptx
├── lib/
│   ├── claude.ts                 ← Claude API call + JSON parsing
│   ├── buildPptx.ts              ← pptxgenjs slide builder
│   └── extractPptx.ts            ← .pptx text extractor
├── config/
│   └── branding.json             ← { name, color, logoPath }
└── public/
    └── branding/                 ← Uploaded company logo
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| Claude returns invalid JSON | Retry once with corrected prompt |
| Upload too large | Clear error message, reject with 413 |
| Generation fails | User sees error message, can retry |
| No branding configured | Fallback to neutral gray + placeholder |

---

## Out of Scope (v1)

- User accounts / authentication
- Presentation history / storage
- Real-time collaborative editing
- Browser-based slide preview/editor
- Multiple company brandings
