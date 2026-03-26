# Scroll Theater Homepage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tamtamcorp.tech homepage with a full-page WebGL scroll-theater: a generative Three.js particle animation (neural network burst) that plays across 8 acts as the user scrolls, with fixed text overlays appearing and disappearing at specific scroll positions.

**Architecture:** The page body is 800vh tall. A fixed Three.js canvas sits at z-index 0. Fixed overlay divs sit at z-index 10. GSAP ScrollTrigger (scrub: 1) maps scroll progress (0→1) to particle state transitions and overlay opacity. Lenis smooth scroll drives GSAP via the standard `lenis.on('scroll', ScrollTrigger.update)` integration. WebGL and `prefers-reduced-motion` failures fall back to the existing static homepage.

**Tech Stack:** Vite + React 19, Three.js 0.183 (raw, not R3F), GSAP 3.14 + ScrollTrigger, @gsap/react, Lenis 1.3, Framer Motion (Navbar only), Tailwind CSS v3

**Working directory:** `C:\Users\ibrah\Documents\tamtamcorp-website\`

**Spec:** `C:\Users\ibrah\Documents\tamtam-bot\docs\superpowers\specs\2026-03-26-homepage-scroll-theater-design.md`

---

## File Map

### Created
```
src/components/three/
  sceneStates.js             — 8 Float32Array particle configs (pure data, no React)
  ParticleSystem.js          — Three.js BufferGeometry point cloud factory
  NodeConnections.js         — Three.js LineSegments factory + pulse state
  SceneCanvas.jsx            — Three.js renderer, camera, rAF loop, WebGL detection

src/components/scroll/
  sectionTimelines.js        — Act scroll ranges + overlay timing helpers (pure data)
  ScrollOrchestrator.jsx     — Master GSAP ScrollTrigger, wires scene + overlays

src/components/overlays/
  HeroOverlay.jsx
  WhatWeBuildOverlay.jsx
  FounderOverlay.jsx
  HumanAIOverlay.jsx
  GoodFitOverlay.jsx
  HowWeWorkOverlay.jsx
  CTAOverlay.jsx

src/components/ScrollCue.jsx          — "Scroll to explore ↓" indicator
src/components/FallbackHomepage.jsx   — Static homepage for WebGL/reduced-motion fallback
src/pages/ScrollTheaterPage.jsx       — Composes the full scroll theater
```

### Modified
```
src/components/ui/SmoothScroll.jsx    — Integrate Lenis with GSAP ticker
src/pages/HomePage.jsx                — Replace section list with <ScrollTheaterPage />
src/styles/index.css                  — Add scroll container + fixed canvas base styles
```

### Archived (not deleted — source of truth for content copy)
```
src/components/sections/Hero.jsx           → src/components/sections/_archive/Hero.jsx
src/components/sections/WhatWeBuild.jsx    → _archive/
src/components/sections/FounderStatement.jsx → _archive/
src/components/sections/HumanAndAI.jsx    → _archive/
src/components/sections/GoodFit.jsx       → _archive/
src/components/sections/HowWeWork.jsx     → _archive/
src/components/sections/CTASection.jsx    → _archive/
src/components/sections/MarqueeTicker.jsx → _archive/
src/components/sections/StatsSection.jsx  → _archive/
```

---

## The 8 Acts Reference

| Index | Act | Scroll Range | Particle state |
|-------|-----|-------------|----------------|
| 0 | Dormant | 0–8% | Sparse, slow drift |
| 1 | Awakening | 8–20% | Brighten, connections form |
| 2 | Network | 20–35% | Full neural net, pulse |
| 3 | Explosion | 35–50% | Radial burst outward |
| 4 | Reformation | 50–65% | Arc back inward |
| 5 | Data Streams | 65–80% | Horizontal circuit streams |
| 6 | Convergence | 80–90% | Pull to center |
| 7 | Resolution | 90–95% | Settled glow |

---

## Task 1: Lenis + GSAP Integration

**Files:**
- Modify: `src/components/ui/SmoothScroll.jsx`

**Why:** The current SmoothScroll runs Lenis via its own rAF loop. GSAP ScrollTrigger doesn't know about Lenis's virtual scroll position. Fixing this now means all subsequent GSAP ScrollTrigger work in Tasks 7+ will "just work" on all pages.

- [ ] **Step 1: Update SmoothScroll.jsx**

Replace the file with:

```jsx
import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function SmoothScroll({ children }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothTouch: false,
    })

    // Wire Lenis scroll events → ScrollTrigger so GSAP always knows the scroll position
    lenis.on('scroll', ScrollTrigger.update)

    // Let GSAP's ticker drive Lenis (replaces the manual rAF loop)
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000)
    })
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
      gsap.ticker.remove(lenis.raf)
    }
  }, [])

  return <>{children}</>
}
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev`. Navigate to `/`. Check DevTools console for errors. Scroll the existing homepage — should still be smooth.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\ibrah\Documents\tamtamcorp-website"
git add src/components/ui/SmoothScroll.jsx
git commit -m "feat: integrate Lenis with GSAP ticker for ScrollTrigger compatibility"
```

---

## Task 2: Archive Existing Sections

**Files:**
- `src/components/sections/` — move 9 files to `_archive/`
- Modify: `src/pages/HomePage.jsx` — clear section imports (temporary blank page)

**Why:** The overlay components contain the same content but different layout. Archiving preserves the originals as content reference and prevents stale imports.

- [ ] **Step 1: Create archive directory and move files**

```bash
cd "C:\Users\ibrah\Documents\tamtamcorp-website"
mkdir -p src/components/sections/_archive
mv src/components/sections/Hero.jsx src/components/sections/_archive/
mv src/components/sections/WhatWeBuild.jsx src/components/sections/_archive/
mv src/components/sections/FounderStatement.jsx src/components/sections/_archive/
mv src/components/sections/HumanAndAI.jsx src/components/sections/_archive/
mv src/components/sections/GoodFit.jsx src/components/sections/_archive/
mv src/components/sections/HowWeWork.jsx src/components/sections/_archive/
mv src/components/sections/CTASection.jsx src/components/sections/_archive/
mv src/components/sections/MarqueeTicker.jsx src/components/sections/_archive/
mv src/components/sections/StatsSection.jsx src/components/sections/_archive/
```

- [ ] **Step 2: Replace HomePage.jsx with a placeholder**

```jsx
// src/pages/HomePage.jsx
export default function HomePage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-white text-xl">Scroll theater loading…</p>
    </div>
  )
}
```

- [ ] **Step 3: Verify no broken imports**

Run `npm run dev`. The homepage should show the placeholder text. No console errors about missing modules.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/_archive src/pages/HomePage.jsx
git commit -m "feat: archive section components, placeholder homepage"
```

---

## Task 3: sceneStates.js — Particle Configuration Data

**Files:**
- Create: `src/components/three/sceneStates.js`

**Why:** Pure data file. All 8 act particle configurations live here as typed arrays. Separating data from rendering logic keeps ParticleSystem.js focused on Three.js and makes states easy to tweak.

**Particle count:** The state arrays are always sized for the maximum (30,000). ParticleSystem picks the slice to render based on breakpoint. This avoids generating multiple arrays.

- [ ] **Step 1: Create sceneStates.js**

```js
// src/components/three/sceneStates.js
//
// 8 particle state configurations, indexed 0–7 matching the 8 acts.
// Index 0 = Act 0 (Dormant), ..., 6 = Act 6a (Convergence), 7 = Act 6b (Resolution)
//
// Each state: { positions: Float32Array (N*3), colors: Float32Array (N*3), sizes: Float32Array (N) }
// positions: world-space x/y/z, range -200 to +200
// colors: r/g/b, range 0.0–1.0
// sizes: point size, range 0.5–4.0
//
// Particle indices are STABLE across all states — particle i always tweens to particle i.

const MAX = 30_000

// Brand colors as RGB triplets (0.0–1.0)
const WHITE   = [1.0, 1.0, 1.0]
const AMBER   = [0.961, 0.624, 0.043]   // #F59E0B
const ORANGE  = [0.918, 0.345, 0.024]   // #EA580C
const DIM     = [0.961, 0.624, 0.043]   // amber at low opacity baked into size

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function buildState(fn) {
  const positions = new Float32Array(MAX * 3)
  const colors    = new Float32Array(MAX * 3)
  const sizes     = new Float32Array(MAX)
  for (let i = 0; i < MAX; i++) {
    const [x, y, z, r, g, b, s] = fn(i, MAX)
    positions[i * 3]     = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    colors[i * 3]        = r
    colors[i * 3 + 1]    = g
    colors[i * 3 + 2]    = b
    sizes[i]             = s
  }
  return { positions, colors, sizes }
}

// Seed so states are deterministic (same random pattern every build)
// We build states once at module load — no need to re-seed per call.

const STATES = [
  // 0 — Dormant: sparse sphere, dim amber, tiny
  buildState((i) => {
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    const r     = rand(60, 180)
    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
      ...DIM,
      rand(0.5, 1.5),
    ]
  }),

  // 1 — Awakening: tighter sphere, brighter amber, nodes emerge
  buildState((i) => {
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    const r     = rand(40, 130)
    const t     = i / MAX
    const col   = t < 0.3 ? WHITE : AMBER
    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
      ...col,
      rand(1.0, 2.5),
    ]
  }),

  // 2 — Network: layered neural-net planes, amber + white nodes
  buildState((i) => {
    const layer = Math.floor(i / (MAX / 5))
    const z     = (layer - 2) * 40
    const theta = Math.random() * Math.PI * 2
    const r     = rand(20, 140)
    const t     = i / MAX
    const col   = t < 0.15 ? WHITE : AMBER
    return [
      r * Math.cos(theta),
      r * Math.sin(theta),
      z + rand(-15, 15),
      ...col,
      rand(1.0, 3.0),
    ]
  }),

  // 3 — Explosion: radial burst, hot core orange, outer amber
  buildState((i) => {
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    const r     = rand(0, 220)
    const t     = i / MAX
    const col   = t < 0.2 ? ORANGE : t < 0.5 ? AMBER : DIM
    const s     = t < 0.1 ? rand(2.5, 4.0) : rand(0.5, 2.0)
    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi) * 0.5,
      ...col,
      s,
    ]
  }),

  // 4 — Reformation: converging arcs — particles sweep back inward
  buildState((i) => {
    const t     = i / MAX
    const angle = t * Math.PI * 4
    const r     = rand(30, 150) * (1 - t * 0.4)
    const col   = t < 0.3 ? WHITE : AMBER
    return [
      r * Math.cos(angle),
      r * Math.sin(angle),
      rand(-60, 60),
      ...col,
      rand(1.0, 2.5),
    ]
  }),

  // 5 — Data Streams: horizontal flowing lines, circuit pattern
  buildState((i) => {
    const stream = Math.floor(i / (MAX / 12))
    const y      = (stream - 6) * 28
    const x      = rand(-200, 200)
    const t      = i / MAX
    const col    = t < 0.2 ? WHITE : AMBER
    return [
      x,
      y + rand(-6, 6),
      rand(-30, 30),
      ...col,
      rand(0.8, 2.0),
    ]
  }),

  // 6 — Convergence: spiral pulling toward center
  buildState((i) => {
    const t     = i / MAX
    const angle = t * Math.PI * 6
    const r     = (1 - t) * 120 + 5
    const col   = t > 0.7 ? WHITE : AMBER
    return [
      r * Math.cos(angle),
      r * Math.sin(angle),
      (1 - t) * rand(-50, 50),
      ...col,
      rand(1.0, 3.0),
    ]
  }),

  // 7 — Resolution: tight glowing core, settled
  buildState((i) => {
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    const r     = rand(0, 30)
    const t     = i / MAX
    const col   = t < 0.4 ? WHITE : AMBER
    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
      ...col,
      rand(1.5, 4.0),
    ]
  }),
]

export default STATES
```

- [ ] **Step 2: Smoke-check in browser console**

Temporarily add to `src/main.jsx` after imports:
```js
import STATES from './components/three/sceneStates.js'
console.log('States loaded:', STATES.length, 'First positions length:', STATES[0].positions.length)
```
Run `npm run dev`. Console should print: `States loaded: 8 First positions length: 90000`
Remove the temporary import from `main.jsx` after verifying.

- [ ] **Step 3: Commit**

```bash
git add src/components/three/sceneStates.js
git commit -m "feat: add particle scene states for 8 scroll theater acts"
```

---

## Task 4: ParticleSystem.js — Three.js Point Cloud

**Files:**
- Create: `src/components/three/ParticleSystem.js`

**Why:** Creates and owns the Three.js `Points` object. Returns handles for the geometry (to mutate via GSAP), material (to update opacity), and the mesh itself (to add to scene).

- [ ] **Step 1: Create ParticleSystem.js**

```js
// src/components/three/ParticleSystem.js
import {
  BufferGeometry,
  BufferAttribute,
  Points,
  PointsMaterial,
  AdditiveBlending,
} from 'three'
import STATES from './sceneStates.js'

/**
 * getParticleCount()
 * Returns particle count based on viewport width.
 * Must be called after DOM is ready.
 */
export function getParticleCount() {
  const w = window.innerWidth
  if (w > 1024) return 30_000
  if (w > 768)  return 15_000
  return 8_000
}

/**
 * createParticleSystem(count)
 * Builds a Three.js Points object seeded with Act 0 (Dormant) state.
 * Returns { points, geometry } — add points to scene, hold geometry ref for GSAP morphing.
 */
export function createParticleSystem(count) {
  const state = STATES[0]

  // Slice typed arrays to the desired count
  const positions = new Float32Array(state.positions.buffer, 0, count * 3)
  const colors    = new Float32Array(state.colors.buffer,    0, count * 3)
  const sizes     = new Float32Array(state.sizes.buffer,     0, count)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions.slice(), 3))
  geometry.setAttribute('color',    new BufferAttribute(colors.slice(),    3))
  geometry.setAttribute('size',     new BufferAttribute(sizes.slice(),     1))

  const material = new PointsMaterial({
    size: 2,
    vertexColors: true,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  })

  const points = new Points(geometry, material)

  return { points, geometry, material }
}
```

- [ ] **Step 2: Smoke-check in browser console**

Temporarily import and call in `main.jsx`:
```js
import { createParticleSystem, getParticleCount } from './components/three/ParticleSystem.js'
const count = getParticleCount()
const { geometry } = createParticleSystem(count)
console.log('Particle count:', count, 'Position attr length:', geometry.attributes.position.array.length)
```
Expected: `Particle count: 30000 Position attr length: 90000` (on desktop).
Remove after verifying.

- [ ] **Step 3: Commit**

```bash
git add src/components/three/ParticleSystem.js
git commit -m "feat: add Three.js particle system factory"
```

---

## Task 5: NodeConnections.js — Line Segments

**Files:**
- Create: `src/components/three/NodeConnections.js`

**Why:** Handles the "neural network" connecting lines. Built from a subset of particles (first 2,000) to keep the O(n²) proximity check tractable. Returns a `LineSegments` mesh and a `setPulse(t)` function to animate opacity.

- [ ] **Step 1: Create NodeConnections.js**

```js
// src/components/three/NodeConnections.js
import {
  BufferGeometry,
  BufferAttribute,
  LineSegments,
  LineBasicMaterial,
  AdditiveBlending,
} from 'three'

const THRESHOLD = 50        // world units — same for desktop and tablet
const SAMPLE    = 2_000     // check only first N particles (O(n²) cap)

/**
 * createNodeConnections(particleGeometry)
 * Builds LineSegments between nearby particles.
 * Returns { lines, updateConnections, setOpacity }
 *
 * Call updateConnections(positionArray) after each GSAP morph tick
 * to recompute which nodes are within threshold.
 * Call setOpacity(value) to drive the neural-firing pulse.
 */
export function createNodeConnections(particleGeometry) {
  // Pre-allocate max possible line pairs for SAMPLE nodes
  const maxPairs   = SAMPLE * 10
  const linePositions = new Float32Array(maxPairs * 6) // 2 verts × 3 floats

  const geometry = new BufferGeometry()
  const posAttr  = new BufferAttribute(linePositions, 3)
  posAttr.setUsage(35048) // THREE.DynamicDrawUsage
  geometry.setAttribute('position', posAttr)

  const material = new LineBasicMaterial({
    color: 0xf59e0b,           // amber
    blending: AdditiveBlending,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  })

  const lines = new LineSegments(geometry, material)

  let lineCount = 0

  function updateConnections(positions) {
    lineCount = 0
    const n = Math.min(SAMPLE, positions.length / 3)
    for (let i = 0; i < n && lineCount < maxPairs; i++) {
      for (let j = i + 1; j < n && lineCount < maxPairs; j++) {
        const ax = positions[i * 3],     ay = positions[i * 3 + 1], az = positions[i * 3 + 2]
        const bx = positions[j * 3],     by = positions[j * 3 + 1], bz = positions[j * 3 + 2]
        const dx = ax - bx, dy = ay - by, dz = az - bz
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dist < THRESHOLD) {
          const base = lineCount * 6
          linePositions[base]     = ax; linePositions[base + 1] = ay; linePositions[base + 2] = az
          linePositions[base + 3] = bx; linePositions[base + 4] = by; linePositions[base + 5] = bz
          lineCount++
        }
      }
    }
    posAttr.needsUpdate = true
    geometry.setDrawRange(0, lineCount * 2)
  }

  function setOpacity(value) {
    material.opacity = value
  }

  // Initial computation
  updateConnections(particleGeometry.attributes.position.array)

  return { lines, updateConnections, setOpacity }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/three/NodeConnections.js
git commit -m "feat: add neural network connection lines (LineSegments)"
```

---

## Task 6: SceneCanvas.jsx — Renderer, Camera, rAF Loop

**Files:**
- Create: `src/components/three/SceneCanvas.jsx`

**Why:** The React component that owns the Three.js lifecycle. Mounts the canvas, initializes renderer + camera + scene, runs the render loop, handles resize, and provides WebGL detection. Exposes `sceneRef` via a forwarded ref so ScrollOrchestrator can call `morphToState(index)` and `setMouseParallaxEnabled(bool)`.

- [ ] **Step 1: Create SceneCanvas.jsx**

```jsx
// src/components/three/SceneCanvas.jsx
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Color,
} from 'three'
import { gsap } from 'gsap'
import { createParticleSystem, getParticleCount } from './ParticleSystem.js'
import { createNodeConnections } from './NodeConnections.js'
import STATES from './sceneStates.js'

const SceneCanvas = forwardRef(function SceneCanvas({ onWebGLUnavailable }, ref) {
  const canvasRef = useRef(null)
  const internals = useRef(null)  // holds { renderer, camera, scene, points, geometry, connections, count }

  useImperativeHandle(ref, () => ({
    morphToState(index) {
      if (!internals.current) return
      const { geometry, count } = internals.current
      const target = STATES[index]

      // Tween positions
      gsap.to(geometry.attributes.position.array, {
        endArray: target.positions.slice(0, count * 3),
        duration: 1.2,
        ease: 'power2.inOut',
        overwrite: true,
        onUpdate() { geometry.attributes.position.needsUpdate = true },
      })
      // Tween colors
      gsap.to(geometry.attributes.color.array, {
        endArray: target.colors.slice(0, count * 3),
        duration: 1.2,
        ease: 'power2.inOut',
        overwrite: true,
        onUpdate() { geometry.attributes.color.needsUpdate = true },
      })
      // Tween sizes
      gsap.to(geometry.attributes.size.array, {
        endArray: target.sizes.slice(0, count),
        duration: 1.2,
        ease: 'power2.inOut',
        overwrite: true,
        onUpdate() { geometry.attributes.size.needsUpdate = true },
      })
    },

    setMouseParallaxEnabled(enabled) {
      if (!internals.current) return
      internals.current.mouseParallaxEnabled = enabled
    },

    setCanvasOpacity(value) {
      if (canvasRef.current) {
        canvasRef.current.style.opacity = value
      }
    },
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // WebGL detection
    let renderer
    try {
      renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false })
    } catch (e) {
      onWebGLUnavailable?.()
      return
    }

    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene  = new Scene()
    scene.background = new Color(0x000000)

    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 100

    const count = getParticleCount()
    const { points, geometry, material } = createParticleSystem(count)
    scene.add(points)

    // Add connections only on tablet+desktop
    let connections = null
    if (window.innerWidth >= 768) {
      connections = createNodeConnections(geometry)
      scene.add(connections.lines)
    }

    const mouseTarget = { x: 0, y: 0 }
    let mouseParallaxEnabled = true

    const onMouseMove = (e) => {
      if (!mouseParallaxEnabled) return
      mouseTarget.x =  (e.clientX / window.innerWidth  - 0.5) * 0.035  // ±~2° in radians
      mouseTarget.y = -(e.clientY / window.innerHeight - 0.5) * 0.035
    }
    window.addEventListener('mousemove', onMouseMove)

    // Pulse animation state for connections
    let pulseT = 0

    let animId
    const render = () => {
      animId = requestAnimationFrame(render)

      // Lerp camera rotation toward mouse target
      camera.rotation.x += (mouseTarget.y - camera.rotation.x) * 0.05
      camera.rotation.y += (mouseTarget.x - camera.rotation.y) * 0.05

      // Neural firing pulse on connection opacity (1Hz oscillation, 0.1→0.4)
      if (connections) {
        pulseT += 0.016  // ~60fps increment
        const pulse = 0.25 + Math.sin(pulseT * Math.PI * 2) * 0.15  // 0.1→0.4
        connections.setOpacity(pulse)
      }

      renderer.render(scene, camera)
    }
    render()

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    internals.current = { renderer, camera, scene, points, geometry, material, connections, count, mouseParallaxEnabled }

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        transition: 'opacity 0.5s ease',
      }}
    />
  )
})

export default SceneCanvas
```

- [ ] **Step 2: Smoke-check in browser**

Temporarily add to `HomePage.jsx`:
```jsx
import { useRef } from 'react'
import SceneCanvas from '../components/three/SceneCanvas'
export default function HomePage() {
  const sceneRef = useRef(null)
  return (
    <div style={{ height: '200vh', background: '#000' }}>
      <SceneCanvas ref={sceneRef} onWebGLUnavailable={() => console.warn('no webgl')} />
    </div>
  )
}
```
Run `npm run dev`. You should see a black page with glowing amber particles. No console errors.
Remove the smoke-check code from HomePage.jsx after verifying.

- [ ] **Step 3: Commit**

```bash
git add src/components/three/SceneCanvas.jsx
git commit -m "feat: add Three.js SceneCanvas with WebGL detection, particle system, mouse parallax"
```

---

## Task 7: sectionTimelines.js — Scroll Timing Config

**Files:**
- Create: `src/components/scroll/sectionTimelines.js`

**Why:** Pure data + helpers. Defines the scroll range for each act and each overlay. The 15%/70%/15% lifecycle rule is encoded here once; ScrollOrchestrator reads it.

- [ ] **Step 1: Create sectionTimelines.js**

```js
// src/components/scroll/sectionTimelines.js
//
// Scroll progress is 0→1 over the full 800vh page.
// Each act has a [start, end] range.
// Each overlay fades in over first 15% of range, holds for 70%, fades out over last 15%.

export const ACT_RANGES = [
  [0.00, 0.08],   // 0 Dormant
  [0.08, 0.20],   // 1 Awakening — Hero overlay
  [0.20, 0.35],   // 2 Network — What We Build overlay
  [0.35, 0.50],   // 3 Explosion — Founder overlay
  [0.50, 0.65],   // 4 Reformation — Human+AI overlay
  [0.65, 0.80],   // 5 Data Streams — Good Fit overlay
  [0.80, 0.90],   // 6a Convergence — How We Work overlay
  [0.90, 0.95],   // 6b Resolution — CTA overlay
]

// Canvas fades out from scroll 0.95 → 0.97
export const CANVAS_FADE_OUT = [0.95, 0.97]

// Scroll cue fades out by scroll 0.06
export const SCROLL_CUE_FADE = [0.00, 0.06]

// Mouse parallax is DISABLED during Act 3 (explosion) for maximum impact
export const PARALLAX_DISABLED_ACT = 3

/**
 * getOverlayTiming(actIndex)
 * Returns { fadeIn: [start, end], hold: [start, end], fadeOut: [start, end] }
 * based on the 15%/70%/15% lifecycle rule.
 */
export function getOverlayTiming(actIndex) {
  const [start, end] = ACT_RANGES[actIndex]
  const span  = end - start
  const fi    = span * 0.15
  const fo    = span * 0.15
  return {
    fadeIn:  [start,        start + fi],
    hold:    [start + fi,   end - fo],
    fadeOut: [end - fo,     end],
  }
}

// Acts that have overlays (index into ACT_RANGES)
// Act 0 (Dormant) has no text overlay — only ScrollCue
export const OVERLAY_ACTS = [1, 2, 3, 4, 5, 6, 7]
```

- [ ] **Step 2: Verify timing math in console**

Temporarily log in `main.jsx`:
```js
import { getOverlayTiming } from './components/scroll/sectionTimelines.js'
console.log('Hero overlay timing:', getOverlayTiming(1))
// Expected: { fadeIn: [0.08, 0.098], hold: [0.098, 0.182], fadeOut: [0.182, 0.20] }
```
Verify numbers match the spec example. Remove after.

- [ ] **Step 3: Commit**

```bash
git add src/components/scroll/sectionTimelines.js
git commit -m "feat: add scroll section timing configuration"
```

---

## Task 8: ScrollOrchestrator.jsx — Master GSAP ScrollTrigger

**Files:**
- Create: `src/components/scroll/ScrollOrchestrator.jsx`

**Why:** The brain of the scroll theater. Reads the scroll container's progress via ScrollTrigger and:
1. Calls `sceneRef.morphToState(actIndex)` when crossing act boundaries
2. Tweens each overlay's opacity per the lifecycle formula
3. Fades the canvas at the footer boundary
4. Enables/disables mouse parallax per act

- [ ] **Step 1: Create ScrollOrchestrator.jsx**

```jsx
// src/components/scroll/ScrollOrchestrator.jsx
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ACT_RANGES,
  CANVAS_FADE_OUT,
  SCROLL_CUE_FADE,
  PARALLAX_DISABLED_ACT,
  getOverlayTiming,
  OVERLAY_ACTS,
} from './sectionTimelines.js'

gsap.registerPlugin(ScrollTrigger)

/**
 * ScrollOrchestrator
 * Props:
 *   scrollContainerRef — ref to the 800vh div
 *   sceneRef           — ref to SceneCanvas (exposes morphToState, setMouseParallaxEnabled, setCanvasOpacity)
 *   overlayRefs        — object: { hero, whatWeBuild, founder, humanAI, goodFit, howWeWork, cta }
 *   scrollCueRef       — ref to ScrollCue element
 */
export default function ScrollOrchestrator({ scrollContainerRef, sceneRef, overlayRefs, scrollCueRef }) {
  const currentActRef = useRef(-1)

  useEffect(() => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current

    // Map overlay act indices to overlay ref keys (in order of OVERLAY_ACTS: 1,2,3,4,5,6,7)
    const overlayRefList = [
      overlayRefs.hero,
      overlayRefs.whatWeBuild,
      overlayRefs.founder,
      overlayRefs.humanAI,
      overlayRefs.goodFit,
      overlayRefs.howWeWork,
      overlayRefs.cta,
    ]

    // Set all overlays invisible initially
    overlayRefList.forEach(r => { if (r?.current) gsap.set(r.current, { opacity: 0, display: 'block' }) })

    const st = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
      onUpdate(self) {
        const p = self.progress  // 0→1

        // --- Scroll cue ---
        if (scrollCueRef?.current) {
          const alpha = p < SCROLL_CUE_FADE[1] ? 0.5 * (1 - p / SCROLL_CUE_FADE[1]) : 0
          gsap.set(scrollCueRef.current, { opacity: alpha })
        }

        // --- Canvas fade out at footer ---
        const [fo0, fo1] = CANVAS_FADE_OUT
        if (p >= fo0) {
          const fadeProgress = Math.min(1, (p - fo0) / (fo1 - fo0))
          sceneRef?.current?.setCanvasOpacity(1 - fadeProgress)
        } else {
          sceneRef?.current?.setCanvasOpacity(1)
        }

        // --- Determine current act ---
        let actIndex = 0
        for (let i = ACT_RANGES.length - 1; i >= 0; i--) {
          if (p >= ACT_RANGES[i][0]) { actIndex = i; break }
        }

        // --- Morph to new act state (only on act change) ---
        if (actIndex !== currentActRef.current) {
          currentActRef.current = actIndex
          sceneRef?.current?.morphToState(actIndex)

          // Mouse parallax: disable only during Act 3 (Explosion)
          sceneRef?.current?.setMouseParallaxEnabled(actIndex !== PARALLAX_DISABLED_ACT)
        }

        // --- Overlay opacity ---
        OVERLAY_ACTS.forEach((actIdx, i) => {
          const el = overlayRefList[i]?.current
          if (!el) return
          const { fadeIn, hold, fadeOut } = getOverlayTiming(actIdx)

          let opacity = 0
          if (p >= fadeIn[0] && p < fadeIn[1]) {
            opacity = (p - fadeIn[0]) / (fadeIn[1] - fadeIn[0])
          } else if (p >= fadeIn[1] && p <= hold[1]) {
            opacity = 1
          } else if (p > hold[1] && p <= fadeOut[1]) {
            opacity = 1 - (p - fadeOut[0]) / (fadeOut[1] - fadeOut[0])
          }

          gsap.set(el, { opacity: Math.max(0, Math.min(1, opacity)) })
        })
      },
    })

    return () => { st.kill() }
  }, [])

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scroll/ScrollOrchestrator.jsx
git commit -m "feat: add GSAP ScrollTrigger orchestrator for scroll theater"
```

---

## Task 9: Overlay Components (7 files)

**Files:**
- Create: `src/components/overlays/HeroOverlay.jsx`
- Create: `src/components/overlays/WhatWeBuildOverlay.jsx`
- Create: `src/components/overlays/FounderOverlay.jsx`
- Create: `src/components/overlays/HumanAIOverlay.jsx`
- Create: `src/components/overlays/GoodFitOverlay.jsx`
- Create: `src/components/overlays/HowWeWorkOverlay.jsx`
- Create: `src/components/overlays/CTAOverlay.jsx`

**Why:** Each overlay is a `position: fixed` div, initially `opacity: 0`. ScrollOrchestrator drives their opacity. They are purely presentational — no scroll logic, no state.

Layout modes: **full-center** = centered on screen. **left-panel** = left 40% of screen.
All text is white. Amber `#f59e0b` accents unchanged. Inter font (already loaded).

- [ ] **Step 1: Create HeroOverlay.jsx** (full-center, Act 1)

```jsx
// src/components/overlays/HeroOverlay.jsx
import { forwardRef } from 'react'

const HeroOverlay = forwardRef(function HeroOverlay(_, ref) {
  return (
    <div
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0 }}
    >
      <div className="text-center px-6 max-w-4xl">
        <h1 className="text-6xl md:text-7xl font-extrabold leading-tight tracking-tight text-white mb-6" style={{ letterSpacing: '-0.03em' }}>
          <span style={{ color: '#f59e0b' }}>Founder-led</span>{' '}
          AI Automation &amp; Systems Consulting
        </h1>
        <p className="text-lg md:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto mb-8">
          Tam Tam Corp helps businesses implement AI automation, WhatsApp bots, and internal systems
          with direct founder involvement — designed and built personally, not delegated.
        </p>
        <p className="text-base text-white/60 max-w-xl mx-auto mb-10">
          Implementation-focused, not advisory-only. One accountable point of responsibility from design to deployment.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8 pointer-events-auto">
          <a
            href="/StartConversation"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 font-semibold text-black"
            style={{ background: '#f59e0b' }}
          >
            Start a Conversation
          </a>
          <a
            href="#how-we-work"
            className="inline-flex h-12 items-center justify-center rounded-full px-7 font-semibold text-white border border-white/40 hover:border-white transition-colors"
          >
            See How We Work
          </a>
        </div>
        <p className="text-sm text-white/40 tracking-wide">UAE Based &amp; Licensed · Founder-led · Hands-on Implementation</p>
      </div>
    </div>
  )
})

export default HeroOverlay
```

- [ ] **Step 2: Create WhatWeBuildOverlay.jsx** (left-panel, Act 2)

```jsx
// src/components/overlays/WhatWeBuildOverlay.jsx
import { forwardRef } from 'react'

const WhatWeBuildOverlay = forwardRef(function WhatWeBuildOverlay(_, ref) {
  const items = [
    'AI automation & workflow systems',
    'AI.bo — Assisted communication & intake systems',
    'Internal tools & operational dashboards',
    'System architecture & integrations',
    'Consulting with hands-on implementation',
  ]
  return (
    <div
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', pointerEvents: 'none', opacity: 0 }}
    >
      <div className="px-8 md:px-16 max-w-[45vw]">
        <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#f59e0b' }}>What We Build</p>
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">Practical systems that solve real operational problems</h2>
        <ul className="mt-6 space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-white/80 text-base">
              <span style={{ color: '#f59e0b', marginTop: 2 }}>→</span>
              <span dangerouslySetInnerHTML={{ __html: item.replace('AI.bo', '<span style="color:#f59e0b;font-weight:600">AI.bo</span>') }} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
})

export default WhatWeBuildOverlay
```

- [ ] **Step 3: Create FounderOverlay.jsx** (full-center, Act 3)

```jsx
// src/components/overlays/FounderOverlay.jsx
import { forwardRef } from 'react'

const FounderOverlay = forwardRef(function FounderOverlay(_, ref) {
  return (
    <div
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0 }}
    >
      <div className="px-8 max-w-3xl">
        <blockquote
          className="text-xl md:text-2xl text-white/90 leading-relaxed pl-6"
          style={{ borderLeft: '4px solid #f59e0b' }}
        >
          "Systems are designed and implemented personally by the founder, not delegated to a team you
          never meet. Decisions come from execution knowledge — the person consulting is the same person
          who has built, deployed, and maintained similar systems in production. This matters when things
          get complex. No game of telephone. No layers between the problem and the solution. One
          accountable point of responsibility from idea to execution."
        </blockquote>
        <p className="mt-4 text-sm text-white/40 pl-6">— Ibrahim Surucu, Founder, Tam Tam Corp</p>
      </div>
    </div>
  )
})

export default FounderOverlay
```

- [ ] **Step 4: Create HumanAIOverlay.jsx** (full-center, Act 4)

```jsx
// src/components/overlays/HumanAIOverlay.jsx
import { forwardRef } from 'react'

const HumanAIOverlay = forwardRef(function HumanAIOverlay(_, ref) {
  const points = [
    { title: 'AI handles execution', desc: 'Speed, scale, and consistency at every layer.' },
    { title: 'Humans make decisions', desc: 'Strategy, judgment, and accountability stay with you.' },
    { title: 'All outputs reviewed', desc: 'Nothing ships without a human in the loop.' },
  ]
  return (
    <div
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0 }}
    >
      <div className="text-center px-8 max-w-2xl">
        <h2 className="text-5xl md:text-6xl font-bold text-white mb-8 leading-tight">
          AI executes.<br />Humans decide.
        </h2>
        <div className="space-y-4 text-left">
          {points.map((p, i) => (
            <div key={i} className="flex items-start gap-4">
              <span className="text-2xl font-bold" style={{ color: '#f59e0b' }}>0{i + 1}</span>
              <div>
                <p className="text-white font-semibold">{p.title}</p>
                <p className="text-white/60 text-sm">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

export default HumanAIOverlay
```

- [ ] **Step 5: Create GoodFitOverlay.jsx** (left-panel, Act 5)

```jsx
// src/components/overlays/GoodFitOverlay.jsx
import { forwardRef } from 'react'

const GoodFitOverlay = forwardRef(function GoodFitOverlay(_, ref) {
  const good = [
    'Founders & SMEs needing hands-on implementation',
    'Operations-heavy businesses that need reliable systems',
    'Companies requiring direct accountability from design to deployment',
    'Businesses seeking long-term system partners with technical depth',
  ]
  const notFit = [
    'Projects requiring large development teams or agency scale',
    'Low-budget, high-volume production work',
    '"Set it and forget it" buyers expecting zero maintenance',
    'Clients seeking advisory-only consulting without implementation',
  ]
  return (
    <div
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', pointerEvents: 'none', opacity: 0 }}
    >
      <div className="px-8 md:px-16 max-w-[48vw]">
        <h2 className="text-4xl font-bold text-white mb-6">Are we the right fit?</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#f59e0b' }}>Good fit</p>
            <ul className="space-y-2">
              {good.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                  <span style={{ color: '#f59e0b' }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest mb-3 text-white/40">Not a fit</p>
            <ul className="space-y-2">
              {notFit.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/50">
                  <span className="text-white/30">✗</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
})

export default GoodFitOverlay
```

- [ ] **Step 6: Create HowWeWorkOverlay.jsx** (left-panel, Act 6a)

```jsx
// src/components/overlays/HowWeWorkOverlay.jsx
import { forwardRef } from 'react'

const HowWeWorkOverlay = forwardRef(function HowWeWorkOverlay(_, ref) {
  const steps = [
    { n: '01', title: 'Understand the real problem', desc: "We dig into what's actually slowing you down, not what you think the solution should be." },
    { n: '02', title: 'Design the system', desc: 'We map out automation logic, integrations, and workflows that fit your operations.' },
    { n: '03', title: 'Build & integrate', desc: 'We implement the system, connect it to your existing tools, and ensure it runs reliably.' },
    { n: '04', title: 'Iterate and maintain', desc: 'We refine based on real usage and provide ongoing support as your needs evolve.' },
  ]
  return (
    <div
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', pointerEvents: 'none', opacity: 0 }}
    >
      <div className="px-8 md:px-16 max-w-[48vw]">
        <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#f59e0b' }}>How We Work</p>
        <h2 className="text-4xl font-bold text-white mb-8">Four steps from problem to solution</h2>
        <div className="space-y-5">
          {steps.map((s) => (
            <div key={s.n} className="flex items-start gap-4">
              <span className="text-2xl font-bold shrink-0" style={{ color: '#f59e0b' }}>{s.n}</span>
              <div>
                <p className="text-white font-semibold">{s.title}</p>
                <p className="text-white/60 text-sm mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

export default HowWeWorkOverlay
```

- [ ] **Step 7: Create CTAOverlay.jsx** (full-center, Act 6b)

```jsx
// src/components/overlays/CTAOverlay.jsx
import { forwardRef } from 'react'

const CTAOverlay = forwardRef(function CTAOverlay(_, ref) {
  return (
    <div
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0 }}
    >
      <div className="text-center px-8 max-w-2xl">
        <h2 className="text-5xl md:text-6xl font-bold text-white mb-4">Ready to Automate?</h2>
        <p className="text-lg text-white/70 mb-8 max-w-lg mx-auto">
          Chat with our AI agent now or schedule a call with our team. Discover which automation solutions will transform your business.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pointer-events-auto">
          <a
            href="/StartConversation"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 font-semibold text-black"
            style={{ background: '#f59e0b' }}
          >
            Start a Conversation
          </a>
          <a
            href="#chat"
            className="inline-flex h-12 items-center justify-center rounded-full px-7 font-semibold text-white border border-white/40 hover:border-white transition-colors"
          >
            Chat with AI Agent
          </a>
        </div>
      </div>
    </div>
  )
})

export default CTAOverlay
```

- [ ] **Step 8: Commit all overlays**

```bash
git add src/components/overlays/
git commit -m "feat: add 7 scroll theater overlay components"
```

---

## Task 10: ScrollCue.jsx and FallbackHomepage.jsx

**Files:**
- Create: `src/components/ScrollCue.jsx`
- Create: `src/components/FallbackHomepage.jsx`

- [ ] **Step 1: Create ScrollCue.jsx**

```jsx
// src/components/ScrollCue.jsx
// "Scroll to explore ↓" indicator. Placed at components root (not overlays/) because
// it is not tied to a named act — ScrollOrchestrator fades it out at 6% scroll progress.
import { forwardRef } from 'react'

const ScrollCue = forwardRef(function ScrollCue(_, ref) {
  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        opacity: 0.5,
        pointerEvents: 'none',
        textAlign: 'center',
      }}
    >
      <p className="text-sm text-white/60 tracking-widest uppercase">Scroll to explore</p>
      <p className="text-white/40 mt-1 animate-bounce">↓</p>
    </div>
  )
})

export default ScrollCue
```

- [ ] **Step 2: Create FallbackHomepage.jsx**

This renders the static homepage for users where WebGL is unavailable or `prefers-reduced-motion` is set. It imports from the `_archive/` folder.

```jsx
// src/components/FallbackHomepage.jsx
import Hero from './sections/_archive/Hero'
import MarqueeTicker from './sections/_archive/MarqueeTicker'
import WhatWeBuild from './sections/_archive/WhatWeBuild'
import StatsSection from './sections/_archive/StatsSection'
import FounderStatement from './sections/_archive/FounderStatement'
import HumanAndAI from './sections/_archive/HumanAndAI'
import GoodFit from './sections/_archive/GoodFit'
import HowWeWork from './sections/_archive/HowWeWork'
import CTASection from './sections/_archive/CTASection'

export default function FallbackHomepage() {
  return (
    <>
      <Hero />
      <MarqueeTicker />
      <WhatWeBuild />
      <StatsSection />
      <FounderStatement />
      <HumanAndAI />
      <GoodFit />
      <HowWeWork />
      <CTASection />
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ScrollCue.jsx src/components/FallbackHomepage.jsx
git commit -m "feat: add ScrollCue indicator and FallbackHomepage for WebGL/reduced-motion"
```

---

## Task 11: ScrollTheaterPage.jsx — Compose the Full Experience

**Files:**
- Create: `src/pages/ScrollTheaterPage.jsx`

**Why:** This is the top-level composition component. It wires `SceneCanvas`, `ScrollOrchestrator`, all 7 overlays, and `ScrollCue` together. It also handles the WebGL + reduced-motion detection and renders the fallback if needed.

- [ ] **Step 1: Create ScrollTheaterPage.jsx**

```jsx
// src/pages/ScrollTheaterPage.jsx
import { useRef, useState, useEffect } from 'react'
import SceneCanvas from '../components/three/SceneCanvas'
import ScrollOrchestrator from '../components/scroll/ScrollOrchestrator'
import ScrollCue from '../components/ScrollCue'
import FallbackHomepage from '../components/FallbackHomepage'

import HeroOverlay       from '../components/overlays/HeroOverlay'
import WhatWeBuildOverlay from '../components/overlays/WhatWeBuildOverlay'
import FounderOverlay    from '../components/overlays/FounderOverlay'
import HumanAIOverlay    from '../components/overlays/HumanAIOverlay'
import GoodFitOverlay    from '../components/overlays/GoodFitOverlay'
import HowWeWorkOverlay  from '../components/overlays/HowWeWorkOverlay'
import CTAOverlay        from '../components/overlays/CTAOverlay'

function detectWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    )
  } catch {
    return false
  }
}

function detectReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function ScrollTheaterPage() {
  const [useFallback, setUseFallback] = useState(false)
  const [ready, setReady] = useState(false)

  // Detection runs once on mount (needs browser context)
  useEffect(() => {
    if (!detectWebGL() || detectReducedMotion()) {
      setUseFallback(true)
    }
    setReady(true)
  }, [])

  if (!ready) return null  // Prevent SSR mismatch

  if (useFallback) return <FallbackHomepage />

  return <ScrollTheater onWebGLUnavailable={() => setUseFallback(true)} />
}

function ScrollTheater({ onWebGLUnavailable }) {
  const scrollContainerRef = useRef(null)
  const sceneRef           = useRef(null)
  const scrollCueRef       = useRef(null)

  const overlayRefs = {
    hero:        useRef(null),
    whatWeBuild: useRef(null),
    founder:     useRef(null),
    humanAI:     useRef(null),
    goodFit:     useRef(null),
    howWeWork:   useRef(null),
    cta:         useRef(null),
  }

  return (
    <>
      {/* Fixed WebGL canvas — z-index 0 */}
      <SceneCanvas ref={sceneRef} onWebGLUnavailable={onWebGLUnavailable} />

      {/* Fixed overlays — z-index 10 */}
      <HeroOverlay       ref={overlayRefs.hero} />
      <WhatWeBuildOverlay ref={overlayRefs.whatWeBuild} />
      <FounderOverlay    ref={overlayRefs.founder} />
      <HumanAIOverlay    ref={overlayRefs.humanAI} />
      <GoodFitOverlay    ref={overlayRefs.goodFit} />
      <HowWeWorkOverlay  ref={overlayRefs.howWeWork} />
      <CTAOverlay        ref={overlayRefs.cta} />

      {/* Scroll cue — z-index 10, fades at 6% scroll */}
      <ScrollCue ref={scrollCueRef} />

      {/* 800vh scroll container — invisible, drives everything */}
      <div ref={scrollContainerRef} style={{ height: '800vh', position: 'relative' }} />

      {/* GSAP wiring — no DOM output */}
      <ScrollOrchestrator
        scrollContainerRef={scrollContainerRef}
        sceneRef={sceneRef}
        overlayRefs={overlayRefs}
        scrollCueRef={scrollCueRef}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ScrollTheaterPage.jsx
git commit -m "feat: add ScrollTheaterPage composition with fallback detection"
```

---

## Task 12: Update HomePage.jsx and index.css

**Files:**
- Modify: `src/pages/HomePage.jsx`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Update HomePage.jsx**

```jsx
// src/pages/HomePage.jsx
import ScrollTheaterPage from './ScrollTheaterPage'

export default function HomePage() {
  return <ScrollTheaterPage />
}
```

- [ ] **Step 2: Update src/styles/index.css**

Add at the end of the file:

```css
/* Scroll Theater — prevent horizontal overflow from fixed elements */
html, body {
  overflow-x: hidden;
}

/* Ensure fixed canvas never causes layout scroll */
.scroll-theater-container {
  position: relative;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/HomePage.jsx src/styles/index.css
git commit -m "feat: mount scroll theater on homepage, add base styles"
```

---

## Task 13: End-to-End Browser Verification

**No code changes — browser QA only.**

- [ ] **Step 1: Start dev server**

```bash
cd "C:\Users\ibrah\Documents\tamtamcorp-website"
npm run dev
```

- [ ] **Step 2: Homepage smoke test**

Open `http://localhost:5173/`. Verify:
- Black canvas with glowing amber particles appears
- "Scroll to explore ↓" cue is visible at bottom
- No console errors

- [ ] **Step 3: Scroll through all 8 acts**

Scroll slowly from top to bottom. Verify at each threshold:
- **8% scroll:** Hero text fades in. Particles brighten.
- **20% scroll:** Hero fades out. "What We Build" panel appears on left. Network pattern forms.
- **35% scroll:** What We Build fades. Founder quote appears center. Particles explode outward.
- **50% scroll:** Founder fades. "AI executes. Humans decide." appears. Particles reform.
- **65% scroll:** Human+AI fades. Good Fit panel appears.
- **80% scroll:** Good Fit fades. How We Work panel appears. Particles converge.
- **90% scroll:** How We Work fades. CTA appears center. Particles settle.
- **95% scroll:** CTA fades. Canvas opacity starts dropping. Footer becomes visible.

- [ ] **Step 4: Test scroll cue fade**

Scroll to 6%+. "Scroll to explore ↓" should be invisible.

- [ ] **Step 5: Test mouse parallax**

In Acts 0–2 and 4–6b: move mouse. Camera should drift subtly.
At Act 3 (Explosion, 35–50%): move mouse. Camera should NOT drift.

- [ ] **Step 6: Test other routes**

Navigate to `/services`, `/about`, `/contact`. Verify:
- These pages render normally (static sections, no scroll theater)
- Lenis smooth scroll still works

- [ ] **Step 7: Test fallback** (optional, requires DevTools)

In Chrome DevTools → Rendering → check "Emulate CSS prefers-reduced-motion: reduce".
Refresh homepage. Should render the static fallback homepage (white background, existing sections).

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "feat: scroll theater homepage complete — 8-act WebGL particle animation"
```

---

## Troubleshooting Notes

**Particles not visible:** Check `AdditiveBlending` is set. Verify `depthWrite: false`. Check scene background is black.

**Overlays not fading in:** Check `ScrollOrchestrator` is receiving the correct `overlayRefs`. Add `console.log(self.progress)` inside `onUpdate` to verify ScrollTrigger is firing.

**GSAP ScrollTrigger not responding:** Verify `SmoothScroll.jsx` has `lenis.on('scroll', ScrollTrigger.update)`. Check that `gsap.registerPlugin(ScrollTrigger)` is called.

**Canvas not full-screen:** The canvas uses `width: 100vw; height: 100vh` inline styles. If Layout.jsx adds `overflow: hidden` somewhere, the fixed canvas may clip — check parent elements.

**Lenis + GSAP ticker teardown warning:** In `SmoothScroll.jsx` cleanup, `gsap.ticker.remove(lenis.raf)` may not match because `lenis.raf` is bound. If you see this, change cleanup to save the ticker function: `const tick = (time) => lenis.raf(time * 1000); gsap.ticker.add(tick)` then remove `tick` in cleanup.
