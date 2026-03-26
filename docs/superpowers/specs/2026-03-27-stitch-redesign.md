# TamTamCorp Website — Full Stitch Redesign Spec
**Date:** 2026-03-27
**Project:** `C:\Users\ibrah\Documents\tamtamcorp-website\`
**Status:** Approved — Approach A (full redesign in one pass)

---

## Overview

Complete visual redesign of tamtamcorp.tech applying the Stitch "Cinematic Intelligence" design system to all 12 pages. All existing live-site content is preserved 1:1. The Stitch hero copy replaces the current homepage hero. All routing is corrected to match live URL structure.

---

## Design System — "The Cinematic Intelligence"

### Color Tokens (replace all amber `#F59E0B` references)

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#131313` | Global page background |
| `--bg-low` | `#1b1b1b` | Large content sections |
| `--bg-card` | `#2a2a2a` | Cards, interactive elements |
| `--bg-card-high` | `#353535` | Elevated cards, hover states |
| `--bg-lowest` | `#0e0e0e` | Deepest backgrounds |
| `--primary` | `#D3BBFF` | Primary text accents, glows |
| `--primary-container` | `#6D28D9` | Buttons, CTA fills |
| `--secondary` | `#C3C0FF` | Secondary accents |
| `--on-surface` | `#E2E2E2` | Primary text |
| `--on-surface-variant` | `#CCC3D7` | Body text, descriptions |
| `--outline` | `#958DA1` | Ghost borders (accessibility only, max 15% opacity) |

### The No-Border Rule
Borders are **prohibited** for sectioning. Use background color shifts (`--bg` → `--bg-low` → `--bg-card`) to create depth. Ghost borders (`outline-variant` at 15% opacity) only for accessibility-critical inputs.

### Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Display/Hero | Plus Jakarta Sans | 800 | clamp(48px, 7vw, 88px) |
| Headline | Plus Jakarta Sans | 700 | clamp(28px, 4vw, 48px) |
| Title | Plus Jakarta Sans | 600 | 20–24px |
| Body lead | Inter | 400 | 17px |
| Body | Inter | 400 | 15–16px |
| Labels/tags | Space Grotesk | 600 | 11–13px uppercase |

Load via Google Fonts: `Plus+Jakarta+Sans:wght@400;600;700;800`, `Inter:wght@400;500;600`, `Space+Grotesk:wght@500;600`.

### Elevation & Depth
- No shadows for cards — use tonal background shifts
- Floating elements (dropdowns, modals): `backdrop-blur: 20px`, semi-transparent `--bg-card/80`
- Glassmorphism on Navbar and key overlays

### Buttons
- **Primary:** gradient fill `#6D28D9` → `#9333EA`, rounded-full, `label-md` uppercase, Space Grotesk
- **Secondary:** transparent + ghost border `--primary/30`, hover: subtle `--bg-card` fill
- **Tertiary:** text-only, animated underline in `--primary`

### Accent Glow Effect
Apply on hero headline and key CTAs:
```css
text-shadow: 0 0 40px rgba(211, 187, 255, 0.25);
```

---

## Routing — App.jsx (corrected URLs)

```
/                    → HomePage
/services            → ServicesPage
/about               → AboutPage
/OurTeam             → TeamPage
/StartConversation   → ContactPage
/LeadGenerator       → LeadGeneratorPage
/resources           → ResourcesPage
/PrivacyPolicy       → PrivacyPolicyPage
/Terms               → TermsPage
/DataSecurity        → DataSecurityPage
/HowWeDecide         → HowWeDecidePage
/SelectiveOutreach   → SelectiveOutreachPage
```

---

## Navigation

### Navbar links (match live site)
- Services · Process (scroll anchor `/#process` on homepage) · About · How We Decide · Team · Contact · Demo (scroll anchor `/#demo`) · Get Started (→ /StartConversation)

### Navbar design (Stitch)
- Always dark background: `--bg-lowest/80` + `backdrop-blur: 20px`
- Logo: "Tam Tam" in `--on-surface`, "Corp" in `--primary`
- Animated pulse dot in `--primary-container`
- Active link: `--primary` color
- CTA button: primary gradient

### Footer (match live site structure)
- Dark `--bg-lowest`
- 4 columns: Logo+tagline | Quick Links | Legal | Contact
- Quick Links: Services · Process · Resources · Contact
- Legal: Privacy Policy · Terms of Service · Data & Security · How We Decide · Selective Outreach
- Contact: address, tel, WhatsApp, email
- Bottom: trade license

---

## PageHero Component (updated)

Used on all inner pages. Changes from current version:
- Background: `--bg-lowest` (deeper black, not `#0A0A0A`)
- Radial glow: `rgba(109, 40, 217, 0.15)` (purple, not amber)
- Label: Space Grotesk, `--primary` color
- Bottom fade: into `--bg` (not white)
- Remove the white fade at bottom — inner pages have dark backgrounds

---

## Page-by-Page Spec

### 1. Homepage `/`

#### Hero (from Stitch)
- Full viewport height
- Background: `--bg-lowest` with radial purple gradient (`rgba(109,40,217,0.12)`)
- Animated particle/dot grid background (subtle, low opacity)
- Label (Space Grotesk, uppercase): `SYSTEM ALPHA · ACTIVE NODES: 1,024`
- Headline (Plus Jakarta Sans, 800, clamp 48–88px): `"Intelligence Redefined"`
- Subheadline: `"Synthesizing raw data into autonomous revenue engines."`
- Two CTAs: "Request Live Demo" (primary gradient) · "View the System" (secondary ghost)
- Status badge: `OPERATIONAL` in green dot + Space Grotesk

#### Three Systems Section (from live site, dark redesign)
Label: `THE SYSTEM`
Title: "Three systems. One revenue engine."
Subtitle: "Built to work together — from first touch to closed deal."

Cards (dark glassmorphism `--bg-card`):
- `01 · AI Lead Engine` — "Captures website visitors and converts them into qualified leads automatically." → "Never miss a prospect — your site works 24/7."
- `02 · Conversation AI` — "Handles inquiries, qualifies prospects, and routes them to the right team." → "Every conversation moves toward a decision."
- `03 · Revenue Orchestration` — "Automates scheduling, follow-ups, and lead routing so sales teams focus only on high-value prospects." → "Your pipeline fills itself. Your team closes."

#### Process Section (scroll anchor `#process`, from live site)
Label: `THE PROCESS`
Title: "How it works"
Subtitle: "From first message to qualified opportunity — fully automated."

4 steps (numbered, Space Grotesk labels):
1. Visitor starts a conversation
2. AI understands intent
3. Lead is qualified automatically
4. Meeting or action is triggered

#### Dashboard Section (scroll anchor `#demo`)
Label: `THE DASHBOARD`
Title: "See every conversation become an opportunity."
Feature list: Lead Scoring · Conversation History · Appointment Scheduling · AI Insights
CTA: "Book a Live Demo"
Mock dashboard card (glassmorphism): Live indicator, "24 Leads Today +12%", "11 Qualified +8%", "5 Meetings +3"

#### Industries Section
Label: `BUILT FOR`
Title: "Industries where leads matter most."
4 industry blocks (dark cards):
- Professional Services — "Law firms, accounting practices, and advisory firms"
- Real Estate — "Developers and brokers automate initial property inquiries"
- Clinics & Healthcare — "Clinics and wellness centres capture patient inquiries"
- Consultants & Agencies — "Agencies deploy TamTam to handle inbound overnight"

#### Trust Section
"Built with trust in mind." — 3 pillars (Human oversight · Data protection · Responsible AI)
Link: "View Data & Security policy →" → /DataSecurity

#### Philosophy Section
Label: `THE PHILOSOPHY`
Title: "Built on principles, not promises."
3 principles:
- "Automation follows clarity"
- "AI executes — humans decide"
- "Systems must be explainable"
Paragraph: "TamTam is founder-led. Systems are designed and implemented personally — not delegated. One accountable point of responsibility from idea to execution."

#### Final CTA
Title: "Turn your website into a 24/7 sales system."
Subtitle: "Start capturing and qualifying leads automatically — no manual effort required."
CTAs: "Start Free Demo" · "Talk to Sales"

---

### 2. About `/about`

Full content from live site (verbatim). Sections:

**PageHero:** label "About Tam Tam Corp" · title "Founder-led. Detail-driven. Built from the inside."

**Founder story block:**
- "Tam Tam Corp FZE LLC is a founder-led consultancy built and operated by Ibrahim Surucu..."
- "From idea to implementation. Systems are designed to solve operational problems..."
- `THIS IS HOW WE SCALE WITHOUT LOSING RESPONSIBILITY.` (dark accent label, Space Grotesk)

**Human judgment. AI precision.** section:
- Paragraph about AI.bo as execution layer
- "What this means for clients" — 3 dark cards: Direct communication · Clear responsibility · Faster execution

**Bottom paragraph:** "Systems are built for long-term use, not demonstrations..." + links to DataSecurity and HowWeDecide

**Closing CTA:** "If this approach resonates, let's talk." + "This is not an agency model."

---

### 3. Team `/OurTeam` ⭐ PRIORITY

**PageHero:** label "Our Team" · title "Many roles. One responsibility." · subtitle "Tam Tam Corp is not an anonymous agency with interchangeable faces. Here, you always know who thinks, who builds, and who is accountable."

**Concept note:** Every role card shows a photo of Ibrahim Surucu in a role-appropriate outfit. This visually proves the founder-led model — one person, seven hats. Photos must be prominently displayed. Large photo area per card, cinematic presentation.

**Photo treatment:**
- Each card: large 280px photo area, `object-fit: cover`, `object-position: top`
- Photo placeholder: dark gradient card with role initial badge until real photo is added
- Photo props accepted via `src/assets/team/` directory — filenames: `role-ceo.jpg`, `role-ai.jpg`, `role-analyst.jpg`, `role-ops.jpg`, `role-support.jpg`, `role-aibo.jpg`, `role-office.jpg`
- Role badge overlay at bottom of photo area: Space Grotesk uppercase, `--primary-container` background

**7 Role Cards (exact content from live site):**

1. **CEO & Founder**
   - Focus: Strategy · Vision · Responsibility
   - "Strategy, vision, and responsibility come together here. Every decision, every system, and every project carries my personal signature."
   - Quote: *"If something works, I stand behind it. If it doesn't — I do too."*

2. **Head of AI**
   - Focus: Automation · Agents · Systems Design
   - "AI is not a buzzword here — it's a tool. This is where automation, agents, and systems are designed to solve real problems, reliably and at scale."
   - Quote: *"Nothing is automated unless I fully understand it."*

3. **Analyst & Strategy**
   - Focus: Data · Processes · Structures
   - "Data, processes, and structures are analyzed before decisions are made. No guesswork — only clarity and informed choices."
   - Quote: *"Without analysis, every idea is just a feeling."*

4. **Operations & Project Lead**
   - Focus: Architecture · Coordination · Delivery
   - "Ideas mean nothing without execution. This role ensures projects are planned, coordinated, and delivered — consistently and reliably."
   - Quote: *"A promise made is a promise kept."*

5. **Support**
   - Focus: Direct · Reachable · Problem-solving
   - "Support is not a ticket system — it's a person. Direct, reachable, and focused on solving problems without detours."
   - Quote: *"Yes, that's really me. And yes, I do answer."*

6. **AI.bo – Assisted Intake**
   - Focus: Intake · Classification · Routing
   - "AI.bo handles first intake, classification, and routing. Decisions and approvals remain human. Available as part of consulting engagements."
   - Quote: *"I assist. I don't decide."*

7. **Office Care**
   - Focus: Structure · Cleanliness · Order
   - "Structure, cleanliness, and order are part of professional responsibility. Nothing here is outsourced — not even the basics."
   - Quote: *"Yes. I handle this personally too."*

**Closing line (full width, centered, large):**
> "In the end, it's not about how big a team is — it's about how responsibly it works."

**Layout:** 3-column grid desktop (CEO spans full width at top as hero card, then 2×3 grid), 1-column mobile. All cards dark glassmorphism (`--bg-card`), no borders.

---

### 4. Contact `/StartConversation`

**PageHero:** label "Start a Conversation" · title "Let's understand your problem first." · subtitle "Tam Tam Corp works with a limited number of clients at a time. Before scheduling any conversation, we first aim to understand the problem clearly."

**Info block (left column):**
- "This helps ensure that time is spent where meaningful progress is possible."
- "Conversations are scheduled only after the problem is understood."
- "AI.bo assists with first intake only. All decisions remain human-led."

**Form (right column, dark glassmorphism card):**
- Your Name
- Your Email
- "Describe the operational problem you want to solve" (textarea, 5 rows)
- Placeholder: "3–5 sentences are enough. No technical detail required."
- Submit button: "Submit for Review →"

Form field styling: `--bg-lowest` fill, ghost border, focus → `--primary` glow ring

---

### 5. Lead Generator `/LeadGenerator`

**PageHero:** label "AI.bo Lead Generator" · title "Turn website visitors into qualified leads — automatically." · subtitle "Our AI assistant answers questions, qualifies prospects, and captures contact data 24/7 — fully branded in your company design."
Badges: "Set up in 5 minutes" · "No coding required" · "Live Demo Active"

**Features section (6 cards):**
- 24/7 Intelligent Responses · Lead Qualification · Meeting Preparation · Fully Branded · Conversation Analytics · Multi-Tenant Ready

**Industries (4 cards):** Professional Services · Real Estate · Healthcare · B2B SaaS

**Live demo callout:** "See it in action — This is the same AI assistant you see across our entire website. Ask questions about our services."
- Chat widget indicator: "Live AI Assistant active — Click the chat button, bottom right of the page ↘"

**Pricing (4 plans — exact from live site):**

| Plan | Price | Tagline |
|---|---|---|
| Starter | €49.90/mo | For small businesses & local service providers |
| Growth | €149/mo | For growing businesses with a clear lead strategy |
| Pro | €399/mo | For scaling businesses & performance-driven teams |
| Custom | Contact us | For businesses with special requirements |

Each plan: full feature list from live site (verbatim). "Most Popular" badge on Growth.

Highlighted plan (Growth): `--primary-container` background, white text. Others: `--bg-card`.

**Bottom CTA:** "Start converting leads today" — "No credit card required. Setup takes 5 minutes." — buttons: "Get started now" · "Contact Sales"

---

### 6. Services `/services` *(new page — from local code)*

**PageHero:** label "What We Build" · title "Systems that run in production" · subtitle "Every service is designed and built personally by the founder. No delegation, no middlemen — direct from problem to working system."

**9 Service cards (from local code):**
AI Automation & Workflows · AI.bo Lead Generator (SaaS tag, links to /LeadGenerator) · WhatsApp Agents · Persona Campaign Engine · AI Product Imagery · Lead Qualification Systems · Internal Tools & Dashboards · System Architecture & Integrations · Consulting with Implementation

**AI.bo Spotlight section (dark):** "AI.bo Lead Generator" headline + 4 pricing tier mini-cards + "See pricing & live demo →" CTA

**Bottom CTA:** "Not sure which service fits? Describe your problem →" → /StartConversation

---

### 7. Resources `/resources`

**PageHero:** label "Resources & Insights" · title "Real-world implementation guidance." · subtitle "Practical insights on AI implementation, founder-led execution, and operational efficiency. No theory. No hype."

**Category filter tabs (Space Grotesk):** All · AI Implementation · Business Operations · Decision Framework · Persona Systems · System Design

**6 Article cards (exact from live site):**
1. AI IMPLEMENTATION · 6 min · "Why AI Systems Fail Without Human Accountability"
2. BUSINESS OPERATIONS · 5 min · "The Hidden Cost of 'Set and Forget' Automation"
3. DECISION FRAMEWORK · 7 min · "When to Build vs. When to Buy: A Founder's Framework"
4. AI IMPLEMENTATION · 5 min · "AI.bo as Assisted Execution: No Autonomy, Full Control"
5. PERSONA SYSTEMS · 6 min · "The Persona Engine: Controlled Digital Representation"
6. SYSTEM DESIGN · 6 min · "Why Internal Tools Fail: The Maintenance Problem"

Each card: category label (Space Grotesk, `--primary`), read time, title, "Read Article" CTA. Cards: `--bg-card`, hover: `--bg-card-high`.

---

### 8. Privacy Policy `/PrivacyPolicy`
### 9. Terms of Service `/Terms`
### 10. Data & Security `/DataSecurity`
### 11. How We Decide `/HowWeDecide`
### 12. Selective Outreach `/SelectiveOutreach`

**Shared treatment for all legal/policy pages:**
- PageHero with page title + last updated date
- Single-column `max-w-3xl` centered layout
- Dark `--bg-low` background
- Numbered sections with Plus Jakarta Sans headings (`--primary` accented numbers)
- Body text: Inter, `--on-surface-variant`, 16px, line-height 1.8
- Section dividers: background color shift (no borders)
- All content verbatim from live site

---

## Tailwind Config Changes

```js
// tailwind.config.js — add to theme.extend.colors:
colors: {
  bg: '#131313',
  'bg-low': '#1b1b1b',
  'bg-card': '#2a2a2a',
  'bg-card-high': '#353535',
  'bg-lowest': '#0e0e0e',
  primary: '#D3BBFF',
  'primary-container': '#6D28D9',
  secondary: '#C3C0FF',
  surface: '#E2E2E2',
  'surface-variant': '#CCC3D7',
}

// theme.extend.fontFamily:
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  display: ['"Plus Jakarta Sans"', 'sans-serif'],
  mono: ['"Space Grotesk"', 'monospace'],
}
```

## index.css Changes

```css
body { background: #131313; color: #E2E2E2; }
```

Remove all `dark:` variants — site is always dark.

---

## Component Changes Summary

| Component | Change |
|---|---|
| `Navbar.jsx` | Always dark glass; purple accent; updated links |
| `Footer.jsx` | Purple accent; updated link list (add SelectiveOutreach, Resources) |
| `PageHero.jsx` | Purple radial glow; dark-to-dark bottom fade; Space Grotesk label |
| `Button.jsx` | Primary = purple gradient; secondary = ghost purple |
| `AnimatedSection.jsx` | No changes needed |
| `Layout.jsx` | `bg-bg` global background |

---

## File Structure Additions

```
src/
  pages/
    ResourcesPage.jsx        ← new
    PrivacyPolicyPage.jsx    ← new
    TermsPage.jsx            ← new
    DataSecurityPage.jsx     ← new
    HowWeDecidePage.jsx      ← new
    SelectiveOutreachPage.jsx ← new
  assets/
    team/
      role-ceo.jpg           ← placeholder (add real photos here)
      role-ai.jpg
      role-analyst.jpg
      role-ops.jpg
      role-support.jpg
      role-aibo.jpg
      role-office.jpg
```

---

## Out of Scope

- Article detail pages for /resources (cards link to `#` for now)
- Live chat widget integration
- Backend/form submission (ContactPage submits locally as before)
- Authentication or dashboard functionality
- Mobile breakpoint redesign (responsive behavior preserved from existing components)

---

## Content Priority Notes

- **Team page** `/OurTeam`: Highest visual priority. 7 role cards with large photo areas. Photos loaded from `src/assets/team/`. Photo slot is prominent — the entire creative concept of "founder in 7 outfits" depends on the visual weight of the photo area. Fallback: initials badge in dark card until photos are added.
- **About page** `/about`: All copy verbatim. The "Human judgment. AI precision." section and the "Not an agency model" closing paragraph are non-negotiable content pieces.
