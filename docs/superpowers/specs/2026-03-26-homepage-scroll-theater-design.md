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

Footer renders normally below the scroll container — the only non-fixed element.

---

## The 7 Acts

| # | Act | Scroll Range | Particle State | Content Overlay |
|---|-----|-------------|----------------|-----------------|
| 0 | Dormant | 0–8% | Sparse nodes, slow ambient drift | None |
| 1 | Awakening | 8–20% | Nodes brighten, connections form | Hero |
| 2 | Network | 20–35% | Full neural net, connections pulse | What We Build |
| 3 | Explosion | 35–50% | BURST — radial explosion outward | Founder Statement |
| 4 | Reformation | 50–65% | Particles arc back like solar flare | Human + AI |
| 5 | Data Streams | 65–80% | Particles align into circuit streams | Good Fit / Not a Fit |
| 6 | Convergence | 80–95% | All particles pull to center point | How We Work + CTA |
| — | Footer | 95–100% | Settled, calm | Footer (normal flow) |

---

## Three.js Scene

### Camera
- `THREE.PerspectiveCamera`, FOV 75, slight Z depth
- Subtle mouse-parallax: ±2° rotation following cursor
- `devicePixelRatio` capped at 2

### Particle System
- **Count:** 30,000 desktop / 8,000 mobile
- **Renderer:** `THREE.Points` — single GPU draw call
- **Blending:** `THREE.AdditiveBlending` — particles glow and stack like light
- **Color system** (tied to brand):
  - Core nodes: `#FFFFFF` (white)
  - Mid-field: `#F59E0B` (amber — brand accent)
  - Explosion hot core: `#EA580C` (deep orange)
  - Outer drift: amber at 20% opacity

### Node Connections
- `THREE.LineSegments` — single draw call
- Lines between nodes within proximity threshold
- Opacity oscillates 0.1→0.4 ("neural firing" pulse)
- **Disabled on mobile** for performance

### State Morphing
Each act defines a target particle configuration (positions, sizes, colors). GSAP tweens Float32Array geometry attributes between states — particles flow smoothly, never teleport.

### Key Visual Moments
- **Act 3 — Explosion (35–50%):** Radial burst at high velocity. Connections shatter. Hot orange core pulses. Maximum drama — sits behind the Founder Statement.
- **Act 4 — Reformation (50–65%):** Particles arc back inward like a solar flare pulled by gravity. Ties to "AI executes. Humans decide." overlay.
- **Act 5 — Data Streams (65–80%):** Particles align into horizontal flowing streams, like circuit traces. Amber streams reinforce brand.

---

## Text Overlay System

### Lifecycle
Each overlay fades in, holds, then fades out before the next:
```
scroll ──[fade in 300ms]──[hold]──[fade out 200ms]── next overlay
```

### Layout Modes
- **Full-center** (Hero, Founder Statement, Human+AI, CTA): Text centered on screen, large type, maximum drama
- **Left-panel** (What We Build, Good Fit, How We Work): Text in left 40% of screen, right 60% open for animation to breathe

### Typography
Inherits the base design system exactly — Inter font, existing size scale. All text switches to `#FFFFFF` (white) since background is now black. Amber `#F59E0B` accents remain unchanged.

### Overlay Components

**HeroOverlay** (full-center, Act 1)
- Headline: "**Founder-led** AI Automation & Systems Consulting" (72px, weight 800, "Founder-led" in amber)
- Subtext: existing copy (max-width 600px, centered)
- CTAs: "Start a Conversation" (amber filled) + "See How We Work" (white outlined)
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

**HowWeWorkOverlay** (left-panel, Act 6)
- 4 numbered steps (01–04 in amber)

**CTAOverlay** (full-center, Act 6 tail)
- Headline: "Ready to Automate?"
- Two CTAs — amber filled + white outlined

---

## File Structure

### New files (`src/components/`)
```
three/
  SceneCanvas.jsx       — Three.js renderer init, camera, resize handler
  ParticleSystem.js     — Geometry, BufferAttribute, point cloud (30k)
  NodeConnections.js    — LineSegments, proximity threshold, pulse animation
  sceneStates.js        — 7 act target configs (positions, colors, sizes)

scroll/
  ScrollOrchestrator.jsx — GSAP ScrollTrigger setup, scroll→scene bridge
  sectionTimelines.js   — Per-section GSAP timelines (fade in/hold/out)

overlays/
  HeroOverlay.jsx
  WhatWeBuildOverlay.jsx
  FounderOverlay.jsx
  HumanAIOverlay.jsx
  GoodFitOverlay.jsx
  HowWeWorkOverlay.jsx
  CTAOverlay.jsx
```

### Modified files
- `App.jsx` — wraps in scroll container, sets 800vh, mounts SceneCanvas + ScrollOrchestrator + overlays
- `src/styles/index.css` — adds `overflow-x: hidden`, scroll container base styles

### Retired files
Existing section components (Hero.jsx, WhatWeBuild.jsx, etc.) — content migrated to overlay components. Original files deleted.

---

## New Dependencies

```bash
npm install three gsap @gsap/react
```

| Package | Gzipped size |
|---------|-------------|
| three | ~120KB |
| gsap + @gsap/react | ~60KB |
| **Total addition** | **~180KB** |

---

## Performance

| Context | Particles | Connections |
|---------|-----------|-------------|
| Desktop | 30,000 | Enabled |
| Mobile (`< 768px`) | 8,000 | Disabled |

- All geometry uses `BufferGeometry` with typed arrays (Float32Array)
- Particle system = 1 draw call. Connections = 1 draw call. Total: 2 draw calls per frame.
- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` — no 3x/4x screens

---

## Integration with Base Design System

- Navbar: unchanged, `z-index: 100`, floats above all layers
- Footer: unchanged, renders in normal flow below the 800vh scroll container
- Color tokens: amber `#F59E0B` carried into particle colors — visual continuity
- All copy: verbatim from base spec (`2026-03-24-tamtamcorp-website-redesign.md`)

---

## Out of Scope
- Video/Veo asset pipeline (fully replaced by generative canvas)
- Scroll-jacking / preventing native scroll (GSAP scrub is non-blocking)
- IE / non-WebGL fallback (not required)
- Additional pages beyond homepage
