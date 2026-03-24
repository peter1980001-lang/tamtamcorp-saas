# tamtamcorp.tech Website Redesign — Design Spec
**Date:** 2026-03-24
**Project:** tamtamcorp-website (new standalone project)
**Status:** Approved

---

## Overview

Redesign of tamtamcorp.tech as a new standalone React project. The goal is a stunning, professional website for Tam Tam Corp FZE LLC — a UAE-based, founder-led AI automation consultancy run by Ibrahim Surucu. Phase 1 covers the homepage only. All 19 pages to be built subsequently.

---

## Design System

### Identity
- **Style:** Clean & Modern ("The Operator") — inspired by Linear and Stripe
- **Personality:** Premium, trustworthy, authoritative — not generic tech
- **Differentiator:** Warm Amber accent communicates craft and human accountability

### Color Palette
| Token | Value | Usage |
|---|---|---|
| Background | `#FFFFFF` | Page background |
| Text Primary | `#0A0A0A` | Headings, body |
| Text Secondary | `#6B7280` | Subtext, meta |
| Accent | `#F59E0B` | CTAs, highlights, one word in hero |
| Surface | `#F9FAFB` | Cards, subtle backgrounds |
| Border | `#E5E7EB` | Dividers, card borders |
| Dark Section BG | `#0A0A0A` | Human + AI section only |

### Typography
- **Font:** Inter (Google Fonts) — loaded via `<link>` preconnect in `index.html` with `font-display: swap`
- **Hero Headline:** 72px / font-weight 800 / tight letter-spacing (-0.03em)
- **Section Titles:** 48px / font-weight 700
- **Subheadings:** 24px / font-weight 600
- **Body:** 17px / font-weight 400 / line-height 1.7
- **Small/Meta:** 14px / font-weight 500

### Animation System (Framer Motion)
- **Hero entrance:** Staggered — headline slides up, subtext fades in, badges fade in with delay
- **Scroll reveals:** `AnimatedSection` wrapper triggers fade-up on viewport entry (threshold: 0.1)
- **Cards hover:** `y: -4`, shadow grows, 200ms ease
- **CTA buttons:** scale(1.02) + amber glow on hover
- **Navbar:** blur backdrop appears after 20px scroll

---

## Project Setup

### Location
`C:\Users\ibrah\Documents\tamtamcorp-website\`

### Stack
- **Framework:** Vite + React
- **Styling:** Tailwind CSS v3
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Language:** JSX (no TypeScript for speed)

### File Structure
```
tamtamcorp-website/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.jsx
│   │   │   └── Footer.jsx
│   │   ├── sections/
│   │   │   ├── Hero.jsx
│   │   │   ├── WhatWeBuild.jsx
│   │   │   ├── FounderStatement.jsx
│   │   │   ├── HumanAndAI.jsx
│   │   │   ├── GoodFit.jsx
│   │   │   ├── HowWeWork.jsx
│   │   │   └── CTASection.jsx
│   │   └── ui/
│   │       ├── Button.jsx
│   │       ├── Badge.jsx
│   │       └── AnimatedSection.jsx
│   ├── styles/
│   │   └── index.css
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## Homepage Sections

### 1. Navbar
- Sticky, transparent → blur-backdrop after scroll
- Logo: "Tam Tam Corp" text-only wordmark (no image asset), font-weight 700, left-aligned. "Tam Tam" in `#0A0A0A`, "Corp" in `#F59E0B` (amber)
- Links: Services, Process, About, Team, Contact
- CTA: "Start a Conversation" — filled amber button, right-aligned
- Mobile: hamburger menu

### 2. Hero Section
- Full viewport height
- Headline (2-3 lines, 72px, weight 800):
  > "**Founder-led** AI Automation & Systems Consulting"
  - "Founder-led" is the amber-highlighted word (exact, locked)
- Subtext (verbatim from site):
  > "Tam Tam Corp helps businesses implement AI automation, WhatsApp bots, and internal systems with direct founder involvement — designed and built personally, not delegated."
  > "Implementation-focused, not advisory-only. One accountable point of responsibility from design to deployment."
- Two CTAs: "Start a Conversation" (black, filled) + "See How We Work" (outlined)
- Trust badges row: "UAE Based & Licensed · Founder-led · Hands-on Implementation"
- Staggered entrance animation on load

### 3. What We Build
- Section title: "What We Build"
- Subtitle: "Practical systems that solve real operational problems"
- 5 cards in responsive grid (2 cols desktop, 1 col mobile):
  1. AI automation & workflow systems
  2. AI.bo — Assisted communication & intake systems
  3. Internal tools & operational dashboards
  4. System architecture & integrations
  5. Consulting with hands-on implementation
- Each card: icon (Lucide), title, 1-line description
- Hover: y-lift + shadow

### 4. Founder Statement
- Asymmetric 2-column layout
- Left: large pull-quote (verbatim from site, amber left-border accent):
  > "Systems are designed and implemented personally by the founder, not delegated to a team you never meet. Decisions come from execution knowledge — the person consulting is the same person who has built, deployed, and maintained similar systems in production. This matters when things get complex. No game of telephone. No layers between the problem and the solution. One accountable point of responsibility from idea to execution."
- Right: 3 benefit points with icons:
  - **Direct communication** — No layers. No forwarding. You work with the person who understands and builds your system.
  - **Clear responsibility** — One accountable mind from the first idea to the final delivery. No excuses, no gaps.
  - **Faster execution** — Decisions happen quickly because there are no internal approvals or handovers to slow things down.

### 5. Human + AI Section
- Only dark section on the page (`#0A0A0A` bg, white text)
- Headline: "AI executes. Humans decide."
- Explains AI.bo: speed & scale multiplier, not a replacement
- 3 points: AI handles execution / Humans make decisions / All outputs reviewed
- Visual rhythm contrast — makes the page breathe

### 6. Good Fit / Not a Fit
- Two-column layout
- Left column (✓ amber checkmarks — "Good fit"):
  1. Founders & SMEs needing hands-on implementation
  2. Operations-heavy businesses that need reliable systems
  3. Companies requiring direct accountability from design to deployment
  4. Businesses seeking long-term system partners with technical depth
- Right column (✗ gray X — "Not a fit"):
  1. Projects requiring large development teams or agency scale
  2. Low-budget, high-volume production work
  3. "Set it and forget it" buyers expecting zero maintenance
  4. Clients seeking advisory-only consulting without implementation
- Clean, honest, builds trust through transparency

### 7. How We Work — 4 Steps
- Horizontal stepper (desktop > 1024px) / 2×2 grid (tablet 768px–1024px) / vertical list (mobile < 768px)
- Numbered 01–04 in amber
- Connecting line between steps (desktop only)
- Steps (verbatim from site):
  - **01 — Understand the real problem:** "We dig into what's actually slowing you down, not what you think the solution should be."
  - **02 — Design the system:** "We map out automation logic, integrations, and workflows that fit your operations."
  - **03 — Build & integrate:** "We implement the system, connect it to your existing tools, and ensure it runs reliably."
  - **04 — Iterate and maintain:** "We refine based on real usage and provide ongoing support as your needs evolve."

### 8. CTA Section
- Amber background (`#F59E0B`) — only time amber is used as bg
- White text
- Headline (verbatim): "Ready to Automate?"
- Subtext (verbatim): "Chat with our AI agent now or schedule a call with our team. Discover which automation solutions will transform your business."
- Two buttons:
  - "Start a Conversation" (black, filled) — links to `/StartConversation`
  - "Chat with AI Agent" (outlined white) — links to `/#chat` (scroll to widget placeholder; live chat integration is out of scope for Phase 1, button renders as stub anchor)
- High-contrast moment, visually memorable

### 9. Footer
- 4-column grid
- Col 1: Logo + tagline + copyright
- Col 2: Quick Links (Services, Process, Resources, Contact)
- Col 3: Legal (Privacy Policy, Terms, Data & Security, How We Decide)
- Col 4: Contact info (address, tel, WhatsApp, email)
- Trade license number at bottom
- Dark background (`#0A0A0A`), white text

---

## Content Sources

All copy taken verbatim from the tamtamcorp.tech crawl (March 2026):
- Company: Tam Tam Corp FZE LLC
- Founder: Ibrahim Surucu
- Location: Ajman, United Arab Emirates
- Trade License: 262705457888
- Email: info@tamtamcorp.online
- Tel/WhatsApp: +971 58 873 7467

---

## AI.bo Branding Convention
- "AI.bo" is a proper noun rendered in amber (`#F59E0B`), font-weight 600, wherever it appears inline
- Never plain unstyled text

## Responsive Breakpoints
- Mobile: < 768px
- Tablet: 768px – 1024px
- Desktop: > 1024px

---

## Out of Scope (Phase 1)
- Routing / multiple pages (homepage only)
- Contact form functionality
- Live chat widget integration
- Remaining 18 pages
- Deployment configuration
