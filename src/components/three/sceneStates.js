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
