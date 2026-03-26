# tamtamcorp.tech Homepage — Scroll Theater Design Spec
**Date:** 2026-03-26
**Project:** tamtamcorp-website (`C:\Users\ibrah\Documents\tamtamcorp-website\`)
**Status:** Approved
**Depends on:** `2026-03-24-tamtamcorp-website-redesign.md` (base design system)

---

## Overview

A full-page cinematic scroll-theater experience for the tamtamcorp.tech homepage, inspired by cornrevolution.resn.global. The entire page is scroll-scrubbed: a generative WebGL particle animation (neural network / digital AI burst) plays behind fixed text overlays that appear and disappear at specific scroll positions. No external video assets — fully generative via Three.js.

**Stack additions:** Three.js + GSAP ScrollTrigger on top of the existing Vite + React + Tailwind + Framer Motion project.

---

## Architecture — "Scroll Theater"

The page body is stretched to **800vh**. Nothing traditionally scrolls. Three layers sit fixed in the viewport:

```
z-index: 100  Navbar (fixed, blur-backdrop after 20px scroll)
z-index: 10   Text Overlays (fixed divs, fade in/out via GSAP)
z-index: 0    Three.js Canvas (WebGL, full-screen, always visible)

              ↕ 800vh invisible scroll container
                (drives everything above via GSAP ScrollTrigger)
```

Scroll progress (0→1) is the single source of truth. GSAP `scrub: 1` ensures a 1-second catch-up lag for silky-smooth feel.

**Footer integration:** The canvas `opacity` is tweened from 1→0 over scroll range 95–97%. The footer (`#0A0A0A` background, full-width) appears in normal flow directly below the 800vh scroll container, visually covering the canvas as the user scrolls past 95%. No z-index conflict — the footer is out-of-flow from the fixed canvas.

---

## WebGL Fallback

If `WebGLRenderingContext` is unavailable (GPU blocklisted, disabled by corporate policy, low-power iOS mode):

1. `SceneCanvas.jsx` detects the failure via a try/catch on `renderer = new THREE.WebGLRenderer()`
2. Sets a React context flag `webglUnavailable: true`
3. The scroll theater is not mounted. Instead, the original base design system homepage renders (static sections, Framer Motion scroll reveals, amber/white color system). This is a complete, production-quality fallback — not a bare error state.
4. No error is shown to the user.

---

## Reduced Motion

If `prefers-reduced-motion: reduce` is detected via `window.matchMedia`:

- The Three.js canvas and GSAP scroll scrub are **not mounted**
- The base design system homepage renders instead (same as WebGL fallback)
- Framer Motion `useReducedMotion()` hook governs any remaining entrance animations

---

## The 8 Acts

Act 6 is split into two sub-acts to accommodate two overlays without ambiguity.

| # | Act | Scroll Range | Particle State | Content Overlay |
|---|-----|-------------|----------------|-----------------|
| 0 | Dormant | 0–8% | Sparse nodes, slow ambient drift | Scroll cue only (see below) |
| 1 | Awakening | 8–20% | Nodes brighten, connections form | Hero |
| 2 | Network | 20–35% | Full neural net, connections pulse | What We Build |
| 3 | Explosion | 35–50% | BURST — radial explosion outward | Founder Statement |
| 4 | Reformation | 50–65% | Particles arc back like solar flare | Human + AI |
| 5 | Data Streams | 65–80% | Particles align into circuit streams | Good Fit / Not a Fit |
| 6a | Convergence | 80–90% | All particles pull to center point | How We Work |
| 6b | Resolution | 90–95% | Settled glow at center | CTA |
| — | Footer | 95–100% | Canvas fades out (opacity 1→0, 95–97%) | Footer (normal flow) |

**Act 0 scroll cue:** A centered "Scroll to explore ↓" label with `opacity: 0.5` fades out at 6% scroll progress. This prevents the user from thinking the page is broken during the ambient drift phase.

---

## Three.js Scene

### Camera
- `THREE.PerspectiveCamera`, FOV 75, Z position 100 (world units)
- **Camera transform ownership:** GSAP owns `camera.position.z` during scroll state tweens. Mouse parallax is applied to a separate `mouseTarget = { x: 0, y: 0 }` object, lerped each frame, and added as an offset to `camera.rotation.x/y` — it never writes to the same properties as GSAP. Mouse parallax is active in Acts 0–2 and 4–6b only; it is disabled during Act 3 (Explosion) to preserve maximum visual impact.
- `devicePixelRatio` capped at 2

### Particle System
- **Count by breakpoint:**
  - Desktop `> 1024px`: 30,000
  - Tablet `768px–1024px`: 15,000
  - Mobile `< 768px`: 8,000
- **Renderer:** `THREE.Points` — single GPU draw call
- **Blending:** `THREE.AdditiveBlending` — particles glow and stack like light
- **Color system** (tied to brand):
  - Core nodes: `#FFFFFF` (white)
  - Mid-field: `#F59E0B` (amber — brand accent)
  - Explosion hot core: `#EA580C` (deep orange)
  - Outer drift: amber at 20% opacity

### Node Connections
- `THREE.LineSegments` — single draw call
- **Proximity threshold:** 50 world units — same value for both desktop and tablet. Connections drawn between all pairs of nodes within this distance.
- Threshold scales to 0 at scroll 40% (Act 3 onset) — connections dissolve as explosion begins. Threshold restores to 50 by scroll 55% (mid-Act 4 reformation).
- Opacity oscillates 0.1→0.4 at 1Hz ("neural firing" pulse)
- **Disabled on mobile `< 768px`** for performance

### State Morphing — Data Contract

`sceneStates.js` exports an array of 8 state objects, indexed 0–7, mapping directly to the 8 acts: index 0 = Act 0 (Dormant), index 1 = Act 1 (Awakening), ..., index 6 = Act 6a (Convergence / How We Work), index 7 = Act 6b (Resolution / CTA). The Footer row in the acts table is not a particle state — the canvas simply fades out via opacity.

Each state has this shape:

```js
{
  // Float32Array of length particleCount * 3 (x, y, z per particle)
  // world-space coordinates, range roughly -200 to +200 on each axis
  positions: Float32Array,

  // Float32Array of length particleCount * 3 (r, g, b per particle, 0.0–1.0)
  colors: Float32Array,

  // Float32Array of length particleCount (point size per particle, 0.5–4.0)
  sizes: Float32Array,
}
```

Particle indices are **stable across all states** — particle `i` in state 0 morphs into particle `i` in state 1. This is required for per-particle GSAP tweening.

GSAP morphs between states by tweening the underlying `Float32Array` of each `BufferAttribute` (i.e. `geometry.attributes.position.array`, not the `BufferAttribute` object itself):
```js
// positions = geometry.attributes.position.array (Float32Array)
gsap.to(positions, {
  endArray: nextState.positions,
  duration: 1,
  ease: "power2.inOut",
  onUpdate: () => { geometry.attributes.position.needsUpdate = true }
})
```
`needsUpdate = true` must be set on the **`BufferAttribute`** (not the array) in the `onUpdate` callback, as shown above.

**Fast-scroll interruption:** GSAP `scrub: 1` means tweens never truly "complete" before being overridden by the next scroll position — this is by design. Intermediate states are visually coherent because all values are interpolated linearly.

### Key Visual Moments
- **Act 3 — Explosion (35–50%):** Radial burst at high velocity. Connections shatter (threshold → 0). Hot orange core pulses. Maximum drama — sits behind the Founder Statement.
- **Act 4 — Reformation (50–65%):** Particles arc back inward like a solar flare pulled by gravity. Connections restore. Ties to "AI executes. Humans decide." overlay.
- **Act 5 — Data Streams (65–80%):** Particles align into horizontal flowing streams, like circuit traces. Amber streams reinforce brand.

---

## Text Overlay System

### Lifecycle — in scroll-progress units

Each overlay occupies a scroll range. Within that range:
- **First 15% of the range:** fade in (`opacity: 0 → 1`)
- **Middle 70% of the range:** hold (`opacity: 1`)
- **Last 15% of the range:** fade out (`opacity: 1 → 0`)

Example: Act 1 Hero overlay occupies 8–20% (12% wide). Fade-in: 8–9.8%. Hold: 9.8–18.2%. Fade-out: 18.2–20%.

All overlay transitions are GSAP `fromTo` on `opacity` within a ScrollTrigger timeline.

### Layout Modes
- **Full-center** (Hero, Founder Statement, Human+AI, CTA): Text centered on screen, large type, maximum drama
- **Left-panel** (What We Build, Good Fit, How We Work): Text in left 40% of screen, right 60% open for animation to breathe

### Typography
Inherits the base design system exactly — Inter font, existing size scale. All text switches to `#FFFFFF` (white) since background is now black. Amber `#F59E0B` accents remain unchanged.

### GSAP / Framer Motion Boundary

**Framer Motion** is retained for the Navbar only (blur-backdrop transition on scroll, hamburger menu animation). It is not used for any overlay or canvas animation on the homepage.

**GSAP** owns all scroll-driven animations: overlay fade in/out, particle state morphing, canvas opacity fade at footer boundary. There is no element on the homepage manipulated by both libraries simultaneously.

### Overlay Components

**HeroOverlay** (full-center, Act 1)
- Headline: "**Founder-led** AI Automation & Systems Consulting" (72px, weight 800, "Founder-led" in amber)
- Subtext: existing copy (max-width 600px, centered)
- CTAs: "Start a Conversation" (**amber filled** — intentional change from base spec's black filled; black-on-black is invisible against the dark canvas background) + "See How We Work" (white outlined)
- Trust badges: "UAE Based & Licensed · Founder-led · Hands-on Implementation"

**WhatWeBuildOverlay** (left-panel, Act 2)
- Section title: "What We Build" (48px)
- 5 items as compact single-line list (no full cards — overlays stay lean)

**FounderOverlay** (full-center, Act 3)
- Pull-quote, large type, amber left-border accent
- Full verbatim quote from base spec

**HumanAIOverlay** (full-center, Act 4)
- Headline: "AI executes. Humans decide."
- 3 supporting points

**GoodFitOverlay** (left-panel, Act 5)
- ✓ amber / ✗ gray two-column list

**HowWeWorkOverlay** (left-panel, Act 6a)
- 4 numbered steps (01–04 in amber)

**CTAOverlay** (full-center, Act 6b)
- Headline: "Ready to Automate?"
- Two CTAs — amber filled + white outlined

---

## File Structure

### New files (`src/components/`)
```
three/
  SceneCanvas.jsx       — Three.js renderer init, camera, resize handler, WebGL detection
  ParticleSystem.js     — BufferGeometry, Float32Array attributes, point cloud
  NodeConnections.js    — LineSegments, proximity threshold logic, pulse animation
  sceneStates.js        — 8 act state objects (positions, colors, sizes Float32Arrays)

scroll/
  ScrollOrchestrator.jsx — GSAP ScrollTrigger setup, scroll→scene bridge, overlay timeline
  sectionTimelines.js   — Per-section fade in/hold/out in scroll-progress units

overlays/
  HeroOverlay.jsx
  WhatWeBuildOverlay.jsx
  FounderOverlay.jsx
  HumanAIOverlay.jsx
  GoodFitOverlay.jsx
  HowWeWorkOverlay.jsx
  CTAOverlay.jsx

ScrollCue.jsx           — "Scroll to explore ↓" indicator, fades at 6% scroll (placed at components root, not under overlays/, because it is not tied to a named act)
FallbackHomepage.jsx    — Renders base design system homepage (WebGL/reduced-motion fallback)
```

### Modified files
- `App.jsx` — detects WebGL + reduced-motion, conditionally mounts scroll theater or FallbackHomepage
- `src/styles/index.css` — adds `overflow-x: hidden`, scroll container base styles

### Retired files
Existing section components (`Hero.jsx`, `WhatWeBuild.jsx`, `FounderStatement.jsx`, `HumanAndAI.jsx`, `GoodFit.jsx`, `HowWeWork.jsx`, `CTASection.jsx`) — **archived to `src/components/sections/_archive/`**, not deleted. These are the source of truth for content copy and will be referenced when building future pages.

The overlay components are **not reusable** for other pages — they are layout-specific to the fixed-position scroll theater. Future pages will use the archived section components directly.

---

## New Dependencies

```bash
npm install three gsap @gsap/react
```

Use named imports throughout for Vite tree-shaking:
```js
// Good — tree-shakeable
import { PerspectiveCamera, WebGLRenderer, Points, BufferGeometry } from 'three'

// Bad — imports entire library
import * as THREE from 'three'
```

| Package | Gzipped size |
|---------|-------------|
| three (tree-shaken) | ~80–120KB |
| gsap + @gsap/react | ~60KB |
| **Total addition** | **~140–180KB** |

---

## Performance

| Context | Particles | Connections |
|---------|-----------|-------------|
| Desktop `> 1024px` | 30,000 | Enabled |
| Tablet `768–1024px` | 15,000 | Enabled |
| Mobile `< 768px` | 8,000 | Disabled |

- All geometry uses `BufferGeometry` with typed arrays (Float32Array)
- Particle system = 1 draw call. Connections = 1 draw call. Total: 2 draw calls per frame.
- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` — no 3x/4x screens

---

## Integration with Base Design System

- Navbar: unchanged, `z-index: 100`, Framer Motion blur-backdrop transition retained
- Footer: unchanged, renders in normal flow below the 800vh scroll container. Canvas fades out 95–97% scroll so footer is revealed cleanly.
- Color tokens: amber `#F59E0B` carried into particle colors — visual continuity
- All copy: verbatim from base spec (`2026-03-24-tamtamcorp-website-redesign.md`)

---

## Out of Scope
- Video/Veo asset pipeline (fully replaced by generative canvas)
- Scroll-jacking / preventing native scroll (GSAP scrub is non-blocking)
- Additional pages beyond homepage
