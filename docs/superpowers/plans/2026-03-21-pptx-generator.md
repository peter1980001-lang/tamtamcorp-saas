# PPTX Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js web app that accepts text/images/existing .pptx as input and returns a professionally designed .pptx file, with consistent company branding on the cover slide.

**Architecture:** Single POST to `/api/generate` handles everything inline: extract text from uploaded .pptx (officeparser), send content + images to Claude API as vision blocks, parse the returned JSON slide structure, then build the .pptx with pptxgenjs. Response is JSON `{ slides: [...], file: "<base64>" }`. Branding (logo, color, name) is stored in `config/branding.json` and applied automatically to every cover slide.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, `@anthropic-ai/sdk` (claude-sonnet-4-6), `pptxgenjs`, `officeparser`, Vitest

---

## File Map

| File | Responsibility |
|---|---|
| `lib/extractPptx.ts` | Wrap officeparser: Buffer → extracted text string |
| `lib/claude.ts` | Build prompt, call Claude API with vision blocks, parse JSON, retry once on invalid JSON |
| `lib/buildPptx.ts` | Map Claude's slide JSON to pptxgenjs calls, embed images, return Buffer |
| `lib/types.ts` | Shared TypeScript types: `SlideSchema`, `BrandingConfig`, `GenerateResponse` |
| `app/api/generate/route.ts` | POST: parse FormData, call extract/claude/buildPptx, return JSON |
| `app/api/branding/route.ts` | GET: read branding.json. POST: write branding.json + save logo file |
| `app/page.tsx` | Main UI: input form, spinner, result section with download button |
| `app/branding/page.tsx` | Branding setup form: company name, color picker, logo upload |
| `config/branding.json` | Runtime config: `{ name, color, logoPath }` — gitignored |
| `public/branding/` | Uploaded logo files |
| `next.config.ts` | Body size limit: `experimental.serverActions.bodySizeLimit: '25mb'` |

---

## Task 1: Scaffold the Project

**Files:**
- Create: `pptx-generator/` (project root at `c:/Users/ibrah/Documents/pptx-generator/`)
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create the Next.js project**

```bash
cd /c/Users/ibrah/Documents
npx create-next-app@latest pptx-generator --typescript --tailwind --app --no-src-dir --no-eslint --import-alias "@/*"
cd pptx-generator
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @anthropic-ai/sdk pptxgenjs officeparser
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 3: Configure body size limit in next.config.ts**

Replace the contents of `next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
}

export default nextConfig
```

- [ ] **Step 4: Add vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 5: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Update .gitignore**

Append to `.gitignore`:
```
config/branding.json
public/branding/
.env.local
```

- [ ] **Step 7: Create required directories**

```bash
mkdir -p config public/branding lib __tests__
```

- [ ] **Step 8: Create empty branding.json with defaults**

`config/branding.json`:
```json
{
  "name": "",
  "color": "#1a1a2e",
  "logoPath": ""
}
```

- [ ] **Step 9: Initial commit**

```bash
git init
git add -A
git commit -m "feat: scaffold pptx-generator project"
```

---

## Task 2: Shared Types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Write the types file**

`lib/types.ts`:
```typescript
export interface BrandingConfig {
  name: string
  color: string      // hex, e.g. "#003366"
  logoPath: string   // filesystem-relative, e.g. "public/branding/logo.png"
}

export type SlideType = 'cover' | 'agenda' | 'content' | 'closing'
export type ContentLayout = 'title-bullets' | 'title-text' | 'two-columns' | 'image-right'

export interface SlideSchema {
  type: SlideType
  title: string
  subtitle?: string          // cover, closing
  items?: string[]           // agenda
  layout?: ContentLayout     // content
  content?: string[]         // title-bullets, title-text, image-right
  left?: string[]            // two-columns
  right?: string[]           // two-columns
  imageIndex?: number        // image-right (0-based index into uploaded images)
}

export interface PresentationSchema {
  title: string
  slides: SlideSchema[]
}

export interface GenerateResponse {
  slides: Pick<SlideSchema, 'type' | 'title'>[]
  file: string   // base64-encoded .pptx
}

export interface UploadedImage {
  data: Buffer
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: extractPptx.ts (TDD)

**Files:**
- Create: `lib/extractPptx.ts`
- Create: `__tests__/extractPptx.test.ts`

- [ ] **Step 1: Write the failing test**

`__tests__/extractPptx.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

// Mock officeparser before importing our module
vi.mock('officeparser', () => ({
  default: {
    parseOfficeAsync: vi.fn(),
  },
}))

import officeParser from 'officeparser'
import { extractTextFromPptx } from '../lib/extractPptx'

describe('extractTextFromPptx', () => {
  it('returns extracted text from buffer', async () => {
    vi.mocked(officeParser.parseOfficeAsync).mockResolvedValue('Slide 1 content. Slide 2 content.')
    const buffer = Buffer.from('fake pptx data')
    const result = await extractTextFromPptx(buffer)
    expect(result).toBe('Slide 1 content. Slide 2 content.')
    expect(officeParser.parseOfficeAsync).toHaveBeenCalledWith(buffer)
  })

  it('returns empty string when extraction throws', async () => {
    vi.mocked(officeParser.parseOfficeAsync).mockRejectedValue(new Error('Parse error'))
    const buffer = Buffer.from('bad data')
    const result = await extractTextFromPptx(buffer)
    expect(result).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/extractPptx.test.ts
```
Expected: FAIL with "Cannot find module '../lib/extractPptx'"

- [ ] **Step 3: Implement extractPptx.ts**

`lib/extractPptx.ts`:
```typescript
import officeParser from 'officeparser'

export async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  try {
    const text = await officeParser.parseOfficeAsync(buffer)
    return text ?? ''
  } catch (err) {
    console.warn('[extractPptx] extraction failed, continuing without:', err)
    return ''
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/extractPptx.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/extractPptx.ts __tests__/extractPptx.test.ts
git commit -m "feat: add pptx text extractor with tests"
```

---

## Task 4: claude.ts (TDD)

**Files:**
- Create: `lib/claude.ts`
- Create: `__tests__/claude.test.ts`

- [ ] **Step 1: Write the failing tests**

`__tests__/claude.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: vi.fn(),
    }
  },
}))

import Anthropic from '@anthropic-ai/sdk'
import { generateSlides } from '../lib/claude'
import type { BrandingConfig, PresentationSchema } from '../lib/types'

const branding: BrandingConfig = { name: 'Acme GmbH', color: '#003366', logoPath: '' }

const validResponse: PresentationSchema = {
  title: 'Test Presentation',
  slides: [
    { type: 'cover', title: 'Test Title', subtitle: 'Subtitle' },
    { type: 'content', layout: 'title-bullets', title: 'Content', content: ['Point 1'] },
    { type: 'closing', title: 'Thank You' },
  ],
}

function getMockCreate() {
  const sdk = new Anthropic()
  return vi.mocked(sdk.messages.create)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateSlides', () => {
  it('parses valid JSON response from Claude', async () => {
    const mockCreate = getMockCreate()
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validResponse) }],
    } as any)

    const result = await generateSlides({
      text: 'Quarterly review',
      images: [],
      extractedPptxText: '',
      slideCount: undefined,
      branding,
    })

    expect(result.title).toBe('Test Presentation')
    expect(result.slides).toHaveLength(3)
    expect(result.slides[0].type).toBe('cover')
  })

  it('retries once on invalid JSON and succeeds', async () => {
    const mockCreate = getMockCreate()
    mockCreate
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not valid json!!!' }],
      } as any)
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(validResponse) }],
      } as any)

    const result = await generateSlides({
      text: 'Quarterly review',
      images: [],
      extractedPptxText: '',
      slideCount: undefined,
      branding,
    })

    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(result.title).toBe('Test Presentation')
  })

  it('throws after two failed JSON attempts', async () => {
    const mockCreate = getMockCreate()
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'still not json' }],
    } as any)

    await expect(
      generateSlides({
        text: 'Quarterly review',
        images: [],
        extractedPptxText: '',
        slideCount: undefined,
        branding,
      })
    ).rejects.toThrow('Failed to generate valid presentation JSON')
  })

  it('includes slide count instruction when provided', async () => {
    const mockCreate = getMockCreate()
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validResponse) }],
    } as any)

    await generateSlides({
      text: 'Topic',
      images: [],
      extractedPptxText: '',
      slideCount: 8,
      branding,
    })

    const callArgs = mockCreate.mock.calls[0][0] as any
    const userContent = callArgs.messages[0].content
    const textBlock = userContent.find((b: any) => b.type === 'text')
    expect(textBlock.text).toContain('exactly 8 slides')
  })

  it('sends correct media_type for each image', async () => {
    const mockCreate = getMockCreate()
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validResponse) }],
    } as any)

    await generateSlides({
      text: 'Topic',
      images: [
        { data: Buffer.from('jpg'), mimeType: 'image/jpeg' },
        { data: Buffer.from('png'), mimeType: 'image/png' },
      ],
      extractedPptxText: '',
      slideCount: undefined,
      branding,
    })

    const callArgs = mockCreate.mock.calls[0][0] as any
    const userContent = callArgs.messages[0].content
    const imageBlocks = userContent.filter((b: any) => b.type === 'image')
    expect(imageBlocks[0].source.media_type).toBe('image/jpeg')
    expect(imageBlocks[1].source.media_type).toBe('image/png')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/claude.test.ts
```
Expected: FAIL with "Cannot find module '../lib/claude'"

- [ ] **Step 3: Implement claude.ts**

`lib/claude.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { BrandingConfig, PresentationSchema, UploadedImage } from './types'

const client = new Anthropic()

interface GenerateSlidesParams {
  text: string
  images: UploadedImage[]
  extractedPptxText: string
  slideCount?: number
  branding: BrandingConfig
}

function buildSystemPrompt(branding: BrandingConfig): string {
  return `You are an Elite Presentation Designer. Your task is to create professional, visually compelling PowerPoint presentations.

Company branding:
- Company name: ${branding.name || 'the company'}
- Primary color: ${branding.color}

Rules:
- Always start with a "cover" slide and end with a "closing" slide
- Maximum 6 bullets per slide
- Use concise, impactful titles
- Vary layouts across slides — no two consecutive slides with the same layout
- Only use "image-right" layout if images were provided in the request
- Return ONLY valid JSON — no prose, no markdown code fences, no explanation

Output format:
{
  "title": "string",
  "slides": [
    { "type": "cover", "title": "string", "subtitle": "string" },
    { "type": "agenda", "title": "string", "items": ["string"] },
    { "type": "content", "layout": "title-bullets|title-text|two-columns|image-right", "title": "string", "content": ["string"], "left": ["string"], "right": ["string"], "imageIndex": 0 },
    { "type": "closing", "title": "string", "subtitle": "string" }
  ]
}`
}

function buildUserContent(
  params: GenerateSlidesParams
): Anthropic.Messages.MessageParam['content'] {
  const parts: Anthropic.Messages.MessageParam['content'] = []

  let textPrompt = `Create a professional presentation based on the following input:\n\n${params.text}`

  if (params.extractedPptxText) {
    textPrompt += `\n\nAdditional content from existing presentation:\n${params.extractedPptxText}`
  }

  if (params.slideCount) {
    textPrompt += `\n\nIMPORTANT: The presentation must contain exactly ${params.slideCount} slides total (including cover and closing slides).`
  } else {
    textPrompt += `\n\nChoose an appropriate number of slides between 6 and 12.`
  }

  if (params.images.length > 0) {
    textPrompt += `\n\n${params.images.length} image(s) have been provided. You may use "image-right" layout with imageIndex (0-based) to place them.`
  }

  parts.push({ type: 'text', text: textPrompt })

  for (const img of params.images) {
    parts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mimeType,
        data: img.data.toString('base64'),
      },
    })
  }

  return parts
}

async function callClaude(
  systemPrompt: string,
  userContent: Anthropic.Messages.MessageParam['content']
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  return textBlock && textBlock.type === 'text' ? textBlock.text : ''
}

export async function generateSlides(params: GenerateSlidesParams): Promise<PresentationSchema> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  }
  const systemPrompt = buildSystemPrompt(params.branding)
  const userContent = buildUserContent(params)

  // First attempt
  const firstResponse = await callClaude(systemPrompt, userContent)
  try {
    return JSON.parse(firstResponse) as PresentationSchema
  } catch (firstError) {
    // Retry once with error context
    const retryContent: Anthropic.Messages.MessageParam['content'] = [
      ...(Array.isArray(userContent) ? userContent : [userContent]),
      {
        type: 'text',
        text: `Your previous response was not valid JSON. The parse error was: ${(firstError as Error).message}\nPlease return only the JSON object, with no surrounding text, no markdown fences, and no explanation.`,
      },
    ]

    const retryResponse = await callClaude(systemPrompt, retryContent)
    try {
      return JSON.parse(retryResponse) as PresentationSchema
    } catch {
      throw new Error('Failed to generate valid presentation JSON after retry')
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/claude.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/claude.ts __tests__/claude.test.ts
git commit -m "feat: add Claude API wrapper with retry logic and tests"
```

---

## Task 5: buildPptx.ts (TDD)

**Files:**
- Create: `lib/buildPptx.ts`
- Create: `__tests__/buildPptx.test.ts`

- [ ] **Step 1: Write the failing tests**

`__tests__/buildPptx.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

// Mock pptxgenjs
const mockAddText = vi.fn()
const mockAddImage = vi.fn()
const mockAddSlide = vi.fn(() => ({
  addText: mockAddText,
  addImage: mockAddImage,
  background: {},
}))
const mockWrite = vi.fn().mockResolvedValue(Buffer.from('fake-pptx'))

vi.mock('pptxgenjs', () => ({
  default: class {
    addSlide = mockAddSlide
    write = mockWrite
    defineLayout = vi.fn()
    layout = ''
  },
}))

import { buildPptx } from '../lib/buildPptx'
import type { PresentationSchema, BrandingConfig, UploadedImage } from '../lib/types'

const branding: BrandingConfig = { name: 'Acme', color: '#003366', logoPath: '' }

const schema: PresentationSchema = {
  title: 'Test',
  slides: [
    { type: 'cover', title: 'My Title', subtitle: 'My Subtitle' },
    { type: 'agenda', title: 'Agenda', items: ['Point 1', 'Point 2'] },
    {
      type: 'content',
      layout: 'title-bullets',
      title: 'Content Slide',
      content: ['Bullet 1', 'Bullet 2'],
    },
    { type: 'closing', title: 'Thank You', subtitle: 'Contact us' },
  ],
}

describe('buildPptx', () => {
  it('returns a Buffer', async () => {
    const result = await buildPptx(schema, branding, [])
    expect(result).toBeInstanceOf(Buffer)
  })

  it('adds one slide per schema entry', async () => {
    mockAddSlide.mockClear()
    await buildPptx(schema, branding, [])
    expect(mockAddSlide).toHaveBeenCalledTimes(4)
  })

  it('calls write with nodebuffer output type', async () => {
    mockWrite.mockClear()
    await buildPptx(schema, branding, [])
    expect(mockWrite).toHaveBeenCalledWith('nodebuffer')
  })

  it('applies branding color to cover slide background', async () => {
    mockAddSlide.mockClear()
    const slideObjects: any[] = []
    mockAddSlide.mockImplementation(() => {
      const s = { addText: mockAddText, addImage: mockAddImage, background: {} as any }
      slideObjects.push(s)
      return s
    })
    await buildPptx(schema, branding, [])
    // First slide is cover, should have branding color
    expect(slideObjects[0].background.color).toBe('003366')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/buildPptx.test.ts
```
Expected: FAIL with "Cannot find module '../lib/buildPptx'"

- [ ] **Step 3: Implement buildPptx.ts**

`lib/buildPptx.ts`:
```typescript
import pptxgen from 'pptxgenjs'
import fs from 'fs'
import path from 'path'
import type { BrandingConfig, PresentationSchema, SlideSchema, UploadedImage } from './types'

const SLIDE_W = 10
const SLIDE_H = 5.63

function hexToRgb(hex: string): string {
  return hex.replace('#', '').toUpperCase()
}

function addCoverSlide(
  pptx: pptxgen,
  slide: SlideSchema,
  branding: BrandingConfig
) {
  const s = pptx.addSlide()
  s.background = { color: hexToRgb(branding.color) }

  // Logo
  if (branding.logoPath) {
    try {
      const absPath = path.resolve(process.cwd(), branding.logoPath)
      const logoBuffer = fs.readFileSync(absPath)
      s.addImage({
        data: 'image/png;base64,' + logoBuffer.toString('base64'),
        x: 0.5,
        y: 0.4,
        w: 2,
        h: 0.8,
      })
    } catch {
      // Logo missing — skip silently
    }
  }

  // Title
  s.addText(slide.title, {
    x: 0.5,
    y: 2,
    w: SLIDE_W - 1,
    h: 1.2,
    fontSize: 40,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
  })

  // Subtitle
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.5,
      y: 3.4,
      w: SLIDE_W - 1,
      h: 0.7,
      fontSize: 20,
      color: 'DDDDDD',
      align: 'center',
    })
  }

  // Company name bottom right
  if (branding.name) {
    s.addText(branding.name, {
      x: SLIDE_W - 3,
      y: SLIDE_H - 0.5,
      w: 2.5,
      h: 0.4,
      fontSize: 12,
      color: 'AAAAAA',
      align: 'right',
    })
  }
}

function addAgendaSlide(pptx: pptxgen, slide: SlideSchema) {
  const s = pptx.addSlide()
  s.addText(slide.title, {
    x: 0.5, y: 0.3, w: SLIDE_W - 1, h: 0.8,
    fontSize: 28, bold: true, color: '222222',
  })
  const items = (slide.items ?? []).map((item) => ({
    text: item,
    options: { bullet: true, fontSize: 18, color: '333333' },
  }))
  s.addText(items, { x: 0.8, y: 1.3, w: SLIDE_W - 1.5, h: SLIDE_H - 1.8 })
}

function addContentSlide(
  pptx: pptxgen,
  slide: SlideSchema,
  images: UploadedImage[]
) {
  const s = pptx.addSlide()
  // Title
  s.addText(slide.title, {
    x: 0.5, y: 0.3, w: SLIDE_W - 1, h: 0.7,
    fontSize: 24, bold: true, color: '222222',
  })

  const layout = slide.layout ?? 'title-bullets'

  if (layout === 'two-columns') {
    const leftItems = (slide.left ?? []).map((t) => ({
      text: t,
      options: { bullet: true, fontSize: 16, color: '333333' },
    }))
    const rightItems = (slide.right ?? []).map((t) => ({
      text: t,
      options: { bullet: true, fontSize: 16, color: '333333' },
    }))
    s.addText(leftItems, { x: 0.5, y: 1.2, w: 4.2, h: SLIDE_H - 1.6 })
    s.addText(rightItems, { x: 5.3, y: 1.2, w: 4.2, h: SLIDE_H - 1.6 })

  } else if (layout === 'image-right') {
    const bullets = (slide.content ?? []).map((t) => ({
      text: t,
      options: { bullet: true, fontSize: 16, color: '333333' },
    }))
    s.addText(bullets, { x: 0.5, y: 1.2, w: 4.5, h: SLIDE_H - 1.6 })

    const idx = slide.imageIndex ?? 0
    if (idx >= 0 && idx < images.length) {
      const img = images[idx]
      s.addImage({
        data: img.mimeType + ';base64,' + img.data.toString('base64'),
        x: 5.5,
        y: 1.0,
        w: 4.0,
        h: 3.5,
      })
    }

  } else {
    // title-bullets or title-text
    const items = (slide.content ?? []).map((t) => ({
      text: t,
      options: { bullet: layout === 'title-bullets', fontSize: 18, color: '333333' },
    }))
    s.addText(items, { x: 0.5, y: 1.2, w: SLIDE_W - 1, h: SLIDE_H - 1.6 })
  }
}

function addClosingSlide(
  pptx: pptxgen,
  slide: SlideSchema,
  branding: BrandingConfig
) {
  const s = pptx.addSlide()
  s.background = { color: hexToRgb(branding.color) }

  s.addText(slide.title, {
    x: 0.5, y: 2.0, w: SLIDE_W - 1, h: 1.0,
    fontSize: 36, bold: true, color: 'FFFFFF', align: 'center',
  })

  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.5, y: 3.2, w: SLIDE_W - 1, h: 0.6,
      fontSize: 18, color: 'DDDDDD', align: 'center',
    })
  }
}

export async function buildPptx(
  schema: PresentationSchema,
  branding: BrandingConfig,
  images: UploadedImage[]
): Promise<Buffer> {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE'

  for (const slide of schema.slides) {
    switch (slide.type) {
      case 'cover':
        addCoverSlide(pptx, slide, branding)
        break
      case 'agenda':
        addAgendaSlide(pptx, slide)
        break
      case 'content':
        addContentSlide(pptx, slide, images)
        break
      case 'closing':
        addClosingSlide(pptx, slide, branding)
        break
    }
  }

  return (await pptx.write('nodebuffer')) as Buffer
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/buildPptx.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Run all tests**

```bash
npm test
```
Expected: PASS (all tests from tasks 3–5)

- [ ] **Step 6: Commit**

```bash
git add lib/buildPptx.ts __tests__/buildPptx.test.ts
git commit -m "feat: add pptxgenjs builder with all slide types and tests"
```

---

## Task 6: /api/branding Route

**Files:**
- Create: `app/api/branding/route.ts`

- [ ] **Step 1: Implement the route**

`app/api/branding/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { BrandingConfig } from '@/lib/types'

const CONFIG_PATH = path.resolve(process.cwd(), 'config/branding.json')
const LOGO_DIR = path.resolve(process.cwd(), 'public/branding')

const DEFAULTS: BrandingConfig = { name: '', color: '#1a1a2e', logoPath: '' }

function readBranding(): BrandingConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { ...DEFAULTS }
  }
}

export async function GET() {
  const config = readBranding()
  // Strip "public/" prefix so browser can use as URL
  const logoUrl = config.logoPath ? '/' + config.logoPath.replace(/^public\//, '') : ''
  return NextResponse.json({ ...config, logoPath: logoUrl })
}

export async function POST(request: Request) {
  const formData = await request.formData()

  const name = (formData.get('name') as string) ?? ''
  const color = (formData.get('color') as string) ?? DEFAULTS.color
  const logoFile = formData.get('logo') as File | null

  const current = readBranding()
  let logoPath = current.logoPath

  if (logoFile && logoFile.size > 0) {
    const ext = logoFile.name.split('.').pop() ?? 'png'
    const filename = `logo.${ext}`
    const absPath = path.join(LOGO_DIR, filename)
    fs.mkdirSync(LOGO_DIR, { recursive: true })
    const arrayBuffer = await logoFile.arrayBuffer()
    fs.writeFileSync(absPath, Buffer.from(arrayBuffer))
    logoPath = `public/branding/${filename}`
  }

  const config: BrandingConfig = { name, color, logoPath }
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Manually test with curl (dev server must be running)**

```bash
# Start dev server in another terminal: npm run dev
curl -s http://localhost:3000/api/branding | jq .
```
Expected: `{ "name": "", "color": "#1a1a2e", "logoPath": "" }`

- [ ] **Step 3: Commit**

```bash
git add app/api/branding/route.ts
git commit -m "feat: add branding API route (GET + POST)"
```

---

## Task 7: /api/generate Route

**Files:**
- Create: `app/api/generate/route.ts`

- [ ] **Step 1: Implement the route**

`app/api/generate/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { extractTextFromPptx } from '@/lib/extractPptx'
import { generateSlides } from '@/lib/claude'
import { buildPptx } from '@/lib/buildPptx'
import type { BrandingConfig, UploadedImage } from '@/lib/types'

const CONFIG_PATH = path.resolve(process.cwd(), 'config/branding.json')
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024      // 5 MB
const MAX_TOTAL_IMAGES = 20 * 1024 * 1024   // 20 MB
const MAX_PPTX_SIZE = 20 * 1024 * 1024      // 20 MB

function readBranding(): BrandingConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return { name: '', color: '#1a1a2e', logoPath: '' }
  }
}

export async function POST(request: Request) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const text = (formData.get('text') as string) ?? ''
  const slideCountRaw = formData.get('slideCount') as string | null
  const slideCount = slideCountRaw ? parseInt(slideCountRaw, 10) : undefined
  const presentationFile = formData.get('presentation') as File | null
  const imageFiles = formData.getAll('images[]') as File[]

  // Validate .pptx size
  if (presentationFile && presentationFile.size > MAX_PPTX_SIZE) {
    return NextResponse.json({ error: 'Presentation file too large (max 20 MB)' }, { status: 413 })
  }

  // Validate images
  let totalImageSize = 0
  for (const img of imageFiles) {
    if (!ALLOWED_IMAGE_TYPES.includes(img.type)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${img.type}. Use JPEG, PNG, GIF, or WebP.` },
        { status: 400 }
      )
    }
    if (img.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: `Image "${img.name}" exceeds 5 MB limit` }, { status: 413 })
    }
    totalImageSize += img.size
    if (totalImageSize > MAX_TOTAL_IMAGES) {
      return NextResponse.json({ error: 'Total image size exceeds 20 MB' }, { status: 413 })
    }
  }

  // Extract text from uploaded .pptx
  let extractedPptxText = ''
  if (presentationFile && presentationFile.size > 0) {
    const pptxBuffer = Buffer.from(await presentationFile.arrayBuffer())
    extractedPptxText = await extractTextFromPptx(pptxBuffer)
  }

  // Read image buffers with MIME types
  const imageBuffers: UploadedImage[] = []
  for (const img of imageFiles) {
    imageBuffers.push({
      data: Buffer.from(await img.arrayBuffer()),
      mimeType: img.type as UploadedImage['mimeType'],
    })
  }

  const branding = readBranding()

  // Call Claude
  let schema
  try {
    schema = await generateSlides({ text, images: imageBuffers, extractedPptxText, slideCount, branding })
  } catch (err) {
    console.error('[generate] Claude error:', err)
    return NextResponse.json({ error: 'Failed to generate presentation content' }, { status: 500 })
  }

  // Build .pptx
  let pptxBuffer: Buffer
  try {
    pptxBuffer = await buildPptx(schema, branding, imageBuffers)
  } catch (err) {
    console.error('[generate] pptxgenjs error:', err)
    return NextResponse.json({ error: 'Failed to build presentation file' }, { status: 500 })
  }

  return NextResponse.json({
    slides: schema.slides.map((s) => ({ type: s.type, title: s.title })),
    file: pptxBuffer.toString('base64'),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/generate/route.ts
git commit -m "feat: add generate API route (extract + Claude + pptxgenjs)"
```

---

## Task 8: /branding Page (UI)

**Files:**
- Modify: `app/branding/page.tsx` (create new)

- [ ] **Step 1: Create the branding setup page**

`app/branding/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'

export default function BrandingPage() {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#1a1a2e')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [currentLogo, setCurrentLogo] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/branding')
      .then((r) => r.json())
      .then((data) => {
        setName(data.name ?? '')
        setColor(data.color ?? '#1a1a2e')
        setCurrentLogo(data.logoPath ?? '')
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    const fd = new FormData()
    fd.append('name', name)
    fd.append('color', color)
    if (logoFile) fd.append('logo', logoFile)

    await fetch('/api/branding', { method: 'POST', body: fd })
    setSaving(false)
    setSaved(true)
  }

  return (
    <main className="max-w-lg mx-auto mt-16 p-6">
      <h1 className="text-2xl font-bold mb-6">Branding einrichten</h1>
      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Firmenname</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Acme GmbH"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Primärfarbe</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-12 h-10 rounded cursor-pointer border"
            />
            <span className="text-sm text-gray-500">{color}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Logo</label>
          {currentLogo && (
            <img src={currentLogo} alt="Current logo" className="h-10 mb-2 object-contain" />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white rounded py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Wird gespeichert...' : 'Speichern'}
        </button>

        {saved && <p className="text-green-600 text-sm text-center">Branding gespeichert!</p>}
      </form>

      <p className="mt-6 text-sm text-gray-400 text-center">
        <a href="/" className="underline">← Zurück zur Präsentation</a>
      </p>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/branding/page.tsx
git commit -m "feat: add branding setup page"
```

---

## Task 9: Main Page (UI)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Implement the main page**

`app/page.tsx`:
```tsx
'use client'

import { useState } from 'react'

type SlideMetadata = { type: string; title: string }

export default function Home() {
  const [text, setText] = useState('')
  const [slideCount, setSlideCount] = useState('')
  const [imageFiles, setImageFiles] = useState<FileList | null>(null)
  const [presentationFile, setPresentationFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slides, setSlides] = useState<SlideMetadata[] | null>(null)
  const [fileBase64, setFileBase64] = useState<string | null>(null)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSlides(null)
    setFileBase64(null)

    const fd = new FormData()
    fd.append('text', text)
    if (slideCount) fd.append('slideCount', slideCount)
    if (presentationFile) fd.append('presentation', presentationFile)
    if (imageFiles) {
      Array.from(imageFiles).forEach((f) => fd.append('images[]', f))
    }

    try {
      const res = await fetch('/api/generate', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Unbekannter Fehler')
        return
      }

      setSlides(data.slides)
      setFileBase64(data.file)
    } catch {
      setError('Netzwerkfehler — bitte erneut versuchen.')
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!fileBase64) return
    const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0))
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'präsentation.pptx'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="max-w-2xl mx-auto mt-12 p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Präsentation Generator</h1>
        <a href="/branding" className="text-sm text-blue-600 underline">Branding einrichten</a>
      </div>

      <form onSubmit={handleGenerate} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">
            Inhalt / Thema <span className="text-gray-400">(Pflichtfeld)</span>
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            rows={5}
            className="w-full border rounded px-3 py-2 text-sm resize-y"
            placeholder="Beschreibe das Thema oder füge deinen Rohtext ein..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Bilder hochladen <span className="text-gray-400">(optional, JPEG/PNG/GIF/WebP, max 5 MB pro Bild)</span>
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={(e) => setImageFiles(e.target.files)}
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Bestehende Präsentation verbessern <span className="text-gray-400">(optional, .pptx, max 20 MB)</span>
          </label>
          <input
            type="file"
            accept=".pptx"
            onChange={(e) => setPresentationFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Anzahl Folien <span className="text-gray-400">(optional, 4–20)</span>
          </label>
          <input
            type="number"
            value={slideCount}
            onChange={(e) => setSlideCount(e.target.value)}
            min={4}
            max={20}
            className="border rounded px-3 py-2 text-sm w-32"
            placeholder="Auto"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Wird generiert...' : 'Präsentation generieren'}
        </button>
      </form>

      {/* Status */}
      {loading && (
        <div className="mt-8 text-center text-gray-500">
          <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
          <p>Präsentation wird generiert...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {slides && fileBase64 && (
        <div className="mt-8 border rounded p-5">
          <h2 className="font-semibold text-lg mb-3">Präsentation fertig</h2>
          <ul className="mb-4 space-y-1">
            {slides.map((s, i) => (
              <li key={i} className="text-sm text-gray-600">
                <span className="text-gray-400 mr-2">{i + 1}.</span>
                <span className="capitalize text-xs text-gray-400 mr-1">[{s.type}]</span>
                {s.title}
              </li>
            ))}
          </ul>
          <button
            onClick={handleDownload}
            className="bg-green-600 text-white rounded px-5 py-2 font-medium hover:bg-green-700"
          >
            Download .pptx
          </button>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Remove default Next.js page content from app/layout.tsx**

In `app/layout.tsx`, ensure the body has a clean white background. Remove any default boilerplate fonts/classes that conflict with Tailwind. Keep it minimal:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Präsentation Generator',
  description: 'KI-gestützte PowerPoint-Generierung',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: add main generation page and layout"
```

---

## Task 10: End-to-End Manual Test

- [ ] **Step 1: Run all unit tests**

```bash
npm test
```
Expected: All tests PASS

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```
Open `http://localhost:3000`

- [ ] **Step 3: Set up branding**

1. Go to `http://localhost:3000/branding`
2. Enter company name, pick a color, optionally upload a logo
3. Click "Speichern"
4. Verify `config/branding.json` was written

- [ ] **Step 4: Generate a presentation from text only**

1. Go to `http://localhost:3000`
2. Enter some text (e.g. "Quarterly business review Q1 2026. Revenue up 15%. Three new clients. Challenges: hiring.")
3. Click "Präsentation generieren"
4. Wait for result — verify slide titles appear
5. Click "Download .pptx"
6. Open the file in PowerPoint/LibreOffice — verify cover slide has company branding

- [ ] **Step 5: Generate from existing .pptx**

1. Upload an existing .pptx file in the second input
2. Add a short instruction in the text field (e.g. "Improve this presentation, make it more concise")
3. Generate and download — verify the content was extracted and improved

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: pptx-generator complete v1"
```

---

## Environment Variables

Create `.env.local` in the project root:
```
ANTHROPIC_API_KEY=your_key_here
```

Add to `.gitignore`:
```
.env.local
```
