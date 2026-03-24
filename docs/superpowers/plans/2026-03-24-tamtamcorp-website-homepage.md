# tamtamcorp.tech Homepage Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tamtamcorp.tech homepage as a new Vite + React project with Tailwind CSS and Framer Motion animations — "The Operator" design (clean & modern, amber accent).

**Architecture:** Standalone Vite + React SPA. All sections are independent components assembled in App.jsx. A shared `AnimatedSection` wrapper handles scroll-triggered fade-up animations via Framer Motion's `useInView`. No routing in Phase 1.

**Tech Stack:** Vite 5, React 18, Tailwind CSS v3, Framer Motion, Lucide React

**Spec:** `docs/superpowers/specs/2026-03-24-tamtamcorp-website-redesign.md`

---

## File Map

| File | Responsibility |
|---|---|
| `index.html` | HTML shell, Inter font via Google Fonts |
| `vite.config.js` | Vite config (React plugin) |
| `tailwind.config.js` | Tailwind content paths + font extension (colors use Tailwind arbitrary values inline) |
| `postcss.config.js` | PostCSS with Tailwind + autoprefixer — auto-generated; must use ESM syntax |
| `src/main.jsx` | React root mount |
| `src/App.jsx` | Page assembly — imports all sections/layout |
| `src/styles/index.css` | Tailwind directives + global resets |
| `src/components/ui/AnimatedSection.jsx` | Reusable scroll-reveal wrapper |
| `src/components/ui/Button.jsx` | Reusable button (4 variants) |
| `src/components/ui/Badge.jsx` | Small inline badge/chip |
| `src/components/layout/Navbar.jsx` | Sticky nav, blur on scroll, mobile menu |
| `src/components/layout/Footer.jsx` | 4-column footer, dark bg |
| `src/components/sections/Hero.jsx` | Fullscreen hero, staggered entrance |
| `src/components/sections/WhatWeBuild.jsx` | 5-card service grid |
| `src/components/sections/FounderStatement.jsx` | Asymmetric 2-col quote + benefits |
| `src/components/sections/HumanAndAI.jsx` | Dark section, AI.bo explanation |
| `src/components/sections/GoodFit.jsx` | Good fit / Not a fit 2-col |
| `src/components/sections/HowWeWork.jsx` | 4-step process stepper |
| `src/components/sections/CTASection.jsx` | Amber bg CTA |

---

## Task 1: Scaffold Project

**Files:**
- Create: `C:\Users\ibrah\Documents\tamtamcorp-website\` (new project)

- [ ] **Step 1: Scaffold Vite + React project**

```bash
cd C:\Users\ibrah\Documents
npm create vite@latest tamtamcorp-website -- --template react
cd tamtamcorp-website
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install framer-motion lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

> **Important:** `npm create vite@latest` with the React template sets `"type": "module"` in `package.json`. The auto-generated `postcss.config.js` must use ESM syntax. Verify it looks like this — if it uses `module.exports`, replace it:
>
> ```js
> export default {
>   plugins: {
>     tailwindcss: {},
>     autoprefixer: {},
>   },
> }
> ```

- [ ] **Step 3: Initialize git**

```bash
git init
git add .
git commit -m "chore: initial Vite + React scaffold"
```

- [ ] **Step 4: Remove default Vite boilerplate**

Delete these files (they will be replaced):
- `src/App.css`
- `src/assets/react.svg`
- `public/vite.svg`

Clear `src/App.jsx` to an empty component shell.

---

## Task 2: Configure Tooling

**Files:**
- Modify: `index.html`
- Modify: `tailwind.config.js`
- Modify: `src/styles/index.css` (create this file)
- Modify: `src/main.jsx`

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tam Tam Corp — Founder-led AI Automation & Systems Consulting</title>
    <meta name="description" content="Tam Tam Corp helps businesses implement AI automation, WhatsApp bots, and internal systems with direct founder involvement — designed and built personally, not delegated." />
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

> **Note on amber glow:** The spec describes "amber glow on hover" for CTA buttons. This is deferred to a polish pass — scale animation is implemented but the `box-shadow` glow is not. Add `whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(245,158,11,0.4)' }}` when polishing.

- [ ] **Step 3: Create `src/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 4: Update `src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite starts at `http://localhost:5173`, blank white page (no errors in console).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: configure Tailwind, Inter font, global styles"
```

---

## Task 3: UI Primitives

**Files:**
- Create: `src/components/ui/AnimatedSection.jsx`
- Create: `src/components/ui/Button.jsx`
- Create: `src/components/ui/Badge.jsx`

- [ ] **Step 1: Create `src/components/ui/AnimatedSection.jsx`**

```jsx
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

export default function AnimatedSection({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.1 })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 2: Create `src/components/ui/Button.jsx`**

```jsx
import { motion } from 'framer-motion'

const variants = {
  primary: 'bg-[#0A0A0A] text-white hover:bg-[#1a1a1a]',
  outlined: 'border-2 border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white',
  amber: 'bg-[#F59E0B] text-white hover:bg-[#D97706]',
  'outlined-white': 'border-2 border-white text-white hover:bg-white hover:text-[#0A0A0A]',
}

export default function Button({ children, variant = 'primary', href, onClick, className = '' }) {
  const base = 'inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold text-sm transition-colors duration-200 cursor-pointer'
  const cls = `${base} ${variants[variant]} ${className}`

  if (href) {
    return (
      <motion.a href={href} className={cls} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        {children}
      </motion.a>
    )
  }

  return (
    <motion.button onClick={onClick} className={cls} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      {children}
    </motion.button>
  )
}
```

- [ ] **Step 3: Create `src/components/ui/Badge.jsx`**

```jsx
export default function Badge({ children }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB]">
      {children}
    </span>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add UI primitives (AnimatedSection, Button, Badge)"
```

---

## Task 4: Navbar

**Files:**
- Create: `src/components/layout/Navbar.jsx`

- [ ] **Step 1: Create `src/components/layout/Navbar.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Button from '../ui/Button'

const links = [
  { label: 'Services', href: '#services' },
  { label: 'Process', href: '#process' },
  { label: 'About', href: '#about' },
  { label: 'Team', href: '#team' },
  { label: 'Contact', href: '#contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/80 backdrop-blur-md border-b border-[#E5E7EB]' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="font-bold text-lg tracking-tight">
          <span className="text-[#0A0A0A]">Tam Tam </span>
          <span className="text-[#F59E0B]">Corp</span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map(link => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-[#6B7280] hover:text-[#0A0A0A] transition-colors font-medium"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <Button variant="amber" href="/StartConversation">Start a Conversation</Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-[#0A0A0A]"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-white border-b border-[#E5E7EB] px-6 py-4 flex flex-col gap-4"
        >
          {links.map(link => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-[#0A0A0A]"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Button variant="amber" href="/StartConversation">Start a Conversation</Button>
        </motion.div>
      )}
    </motion.nav>
  )
}
```

> **Breakpoint note:** Navbar shows full desktop links at `md:` (768px+), not `lg:` (1024px+). This is a deliberate deviation from the spec's desktop breakpoint definition — nav links fit comfortably at tablet width and hiding them behind a hamburger on tablet would hurt UX. Phase 2 pages may revisit this if needed.
>
> **Stub links:** `#team` and `#contact` Navbar links have no corresponding section in Phase 1. They will scroll to nothing — this is expected and matches how `/#chat` is handled in CTASection.

- [ ] **Step 2: Wire into App.jsx temporarily to verify**

```jsx
import Navbar from './components/layout/Navbar'

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="h-[200vh]" />
    </div>
  )
}
```

- [ ] **Step 3: Open `http://localhost:5173` and verify**

Expected:
- Nav appears at top, transparent
- Scrolling down → blur + border appears
- Mobile: hamburger opens menu

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Navbar with scroll blur and mobile menu"
```

---

## Task 5: Footer

**Files:**
- Create: `src/components/layout/Footer.jsx`

- [ ] **Step 1: Create `src/components/layout/Footer.jsx`**

```jsx
const quickLinks = [
  { label: 'Services', href: '#services' },
  { label: 'Process', href: '#process' },
  { label: 'Resources', href: '#resources' },
  { label: 'Contact', href: '#contact' },
]

const legalLinks = [
  { label: 'Privacy Policy', href: '/PrivacyPolicy' },
  { label: 'Terms of Service', href: '/Terms' },
  { label: 'Data & Security', href: '/DataSecurity' },
  { label: 'How We Decide', href: '/HowWeDecide' },
]

export default function Footer() {
  return (
    <footer className="bg-[#0A0A0A] text-white px-6 py-20">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Col 1: Brand */}
          <div>
            <div className="font-bold text-lg mb-3">
              <span className="text-white">Tam Tam </span>
              <span className="text-[#F59E0B]">Corp</span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed mb-4">
              AI-powered business process automation for modern companies.
            </p>
            <p className="text-white/30 text-xs">© 2026 Tam Tam Corp FZE LLC. All rights reserved.</p>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="font-semibold text-sm mb-5 text-white/80">Quick Links</h4>
            <ul className="flex flex-col gap-3">
              {quickLinks.map(link => (
                <li key={link.label}>
                  <a href={link.href} className="text-white/50 text-sm hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-5 text-white/80">Legal</h4>
            <ul className="flex flex-col gap-3">
              {legalLinks.map(link => (
                <li key={link.label}>
                  <a href={link.href} className="text-white/50 text-sm hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Contact */}
          <div>
            <h4 className="font-semibold text-sm mb-5 text-white/80">Contact</h4>
            <div className="flex flex-col gap-3 text-sm">
              <span className="text-white/50">Ajman, United Arab Emirates</span>
              <a href="tel:+971588737467" className="text-white/50 hover:text-white transition-colors">
                Tel: +971 58 873 7467
              </a>
              <a href="https://wa.me/971588737467" className="text-white/50 hover:text-white transition-colors">
                WhatsApp: +971 58 873 7467
              </a>
              <a href="mailto:info@tamtamcorp.online" className="text-white/50 hover:text-white transition-colors">
                info@tamtamcorp.online
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 text-center">
          <p className="text-white/30 text-xs">Trade License No. 262705457888 • Ajman, UAE</p>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Add to App.jsx and verify**

```jsx
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="h-[200vh]" />
      <Footer />
    </div>
  )
}
```

Expected: 4-column footer at bottom, dark background, all links present.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Footer with 4-column layout"
```

---

## Task 6: Hero Section

**Files:**
- Create: `src/components/sections/Hero.jsx`

- [ ] **Step 1: Create `src/components/sections/Hero.jsx`**

```jsx
import { motion } from 'framer-motion'
import Button from '../ui/Button'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.25 },
  },
}

const item = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] } },
}

export default function Hero() {
  return (
    {/* pt-16 = 64px — intentionally coupled to Navbar's h-16. If Navbar height changes, update this too. */}
    <section className="min-h-screen flex items-center justify-center pt-16 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <motion.div variants={container} initial="hidden" animate="show">
          {/* Trust badge */}
          <motion.div variants={item} className="mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] text-xs font-medium text-[#6B7280]">
              UAE Based & Licensed
              <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
              Founder-led
              <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
              Hands-on Implementation
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={item}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-[#0A0A0A] tracking-tight leading-[1.05] mb-8"
          >
            <span className="text-[#F59E0B]">Founder-led</span>{' '}
            AI Automation<br className="hidden sm:block" />
            {' '}& Systems Consulting
          </motion.h1>

          {/* Subtext 1 */}
          <motion.p
            variants={item}
            className="text-lg text-[#6B7280] max-w-2xl mx-auto leading-relaxed mb-4"
          >
            Tam Tam Corp helps businesses implement AI automation, WhatsApp bots, and internal systems
            with direct founder involvement — designed and built personally, not delegated.
          </motion.p>

          {/* Subtext 2 */}
          <motion.p
            variants={item}
            className="text-base text-[#6B7280] max-w-xl mx-auto leading-relaxed mb-10"
          >
            Implementation-focused, not advisory-only. One accountable point of responsibility
            from design to deployment.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={item} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" href="/StartConversation">Start a Conversation</Button>
            <Button variant="outlined" href="#process">See How We Work</Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to App.jsx and verify**

Add `<Hero />` as first section after Navbar.

Expected:
- Full-viewport-height section with centered text
- "Founder-led" in amber
- Staggered animation on page load
- Two buttons below text

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Hero section with staggered entrance animation"
```

---

## Task 7: What We Build

**Files:**
- Create: `src/components/sections/WhatWeBuild.jsx`

- [ ] **Step 1: Create `src/components/sections/WhatWeBuild.jsx`**

```jsx
import { motion } from 'framer-motion'
import { Bot, MessageSquare, LayoutDashboard, GitMerge, Users } from 'lucide-react'
import AnimatedSection from '../ui/AnimatedSection'

const services = [
  {
    icon: Bot,
    title: 'AI automation & workflow systems',
    description: 'Designed and implemented for daily use in real business operations',
  },
  {
    icon: MessageSquare,
    isAibo: true,
    title: 'Assisted communication & intake systems',
    description: 'Structured intake, routing, and availability management with human oversight',
  },
  {
    icon: LayoutDashboard,
    title: 'Internal tools & operational dashboards',
    description: 'Used daily by teams to manage operations, track data, and generate reports',
  },
  {
    icon: GitMerge,
    title: 'System architecture & integrations',
    description: 'Connected and maintained in production environments with ongoing iteration',
  },
  {
    icon: Users,
    title: 'Consulting with hands-on implementation',
    description: 'Strategic decisions backed by direct execution and deployment',
  },
]

export default function WhatWeBuild() {
  return (
    <section id="services" className="py-32 px-6 bg-[#F9FAFB]">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-[#0A0A0A] tracking-tight mb-4">
            What We Build
          </h2>
          <p className="text-lg text-[#6B7280] max-w-xl mx-auto">
            Practical systems that solve real operational problems
          </p>
        </AnimatedSection>

        {/* 3 cols at lg: better visual balance for 5 cards than spec's "2 cols desktop" */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <AnimatedSection key={s.title} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}
                transition={{ duration: 0.2 }}
                className="bg-white p-8 rounded-2xl border border-[#E5E7EB] h-full"
              >
                <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center mb-5">
                  <s.icon size={20} className="text-[#F59E0B]" />
                </div>
                <h3 className="font-semibold text-[#0A0A0A] text-lg mb-2 leading-snug">
                  {s.isAibo ? (
                    <>
                      <span className="text-[#F59E0B] font-semibold">AI.bo</span>
                      {' — '}
                      {s.title}
                    </>
                  ) : (
                    s.title
                  )}
                </h3>
                <p className="text-[#6B7280] text-sm leading-relaxed">{s.description}</p>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to App.jsx and verify**

Expected:
- Light gray background section
- 5 cards in responsive grid
- "AI.bo" in amber in the second card title
- Cards lift on hover

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add WhatWeBuild section with hover cards"
```

---

## Task 8: Founder Statement

**Files:**
- Create: `src/components/sections/FounderStatement.jsx`

- [ ] **Step 1: Create `src/components/sections/FounderStatement.jsx`**

```jsx
import { MessageCircle, Shield, Zap } from 'lucide-react'
import AnimatedSection from '../ui/AnimatedSection'

const benefits = [
  {
    icon: MessageCircle,
    title: 'Direct communication',
    description: 'No layers. No forwarding. You work with the person who understands and builds your system.',
  },
  {
    icon: Shield,
    title: 'Clear responsibility',
    description: 'One accountable mind from the first idea to the final delivery. No excuses, no gaps.',
  },
  {
    icon: Zap,
    title: 'Faster execution',
    description: 'Decisions happen quickly because there are no internal approvals or handovers to slow things down.',
  },
]

export default function FounderStatement() {
  return (
    <section id="about" className="py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* Left: pull-quote */}
          <AnimatedSection>
            <div className="border-l-4 border-[#F59E0B] pl-8">
              <p className="text-xl lg:text-2xl font-medium text-[#0A0A0A] leading-relaxed">
                "Systems are designed and implemented personally by the founder, not delegated to a
                team you never meet. Decisions come from execution knowledge — the person consulting
                is the same person who has built, deployed, and maintained similar systems in
                production. This matters when things get complex. No game of telephone. No layers
                between the problem and the solution. One accountable point of responsibility from
                idea to execution."
              </p>
            </div>
          </AnimatedSection>

          {/* Right: benefits */}
          <AnimatedSection delay={0.15}>
            <h2 className="text-3xl font-bold text-[#0A0A0A] tracking-tight mb-10">
              Built by the person you work with
            </h2>
            <div className="flex flex-col gap-8">
              {benefits.map(b => (
                <div key={b.title} className="flex gap-5">
                  <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <b.icon size={18} className="text-[#F59E0B]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0A0A0A] mb-1">{b.title}</h3>
                    <p className="text-[#6B7280] text-sm leading-relaxed">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to App.jsx and verify**

Expected:
- White background, 2-column layout on desktop
- Amber left-border on pull-quote
- 3 benefit rows with amber icons on right

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add FounderStatement section with pull-quote"
```

---

## Task 9: Human + AI Section

**Files:**
- Create: `src/components/sections/HumanAndAI.jsx`

- [ ] **Step 1: Create `src/components/sections/HumanAndAI.jsx`**

```jsx
import AnimatedSection from '../ui/AnimatedSection'

const points = [
  {
    label: 'AI handles execution',
    description: 'Drafting, structuring, processing, analyzing — AI accelerates every repetitive step.',
  },
  {
    label: 'Humans make decisions',
    description: 'System design, business logic, and client accountability remain with the founder.',
  },
  {
    label: 'All outputs reviewed',
    description: 'Every AI output is validated and tested by a human before deployment or delivery.',
  },
]

export default function HumanAndAI() {
  return (
    <section className="py-32 px-6 bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 text-xs font-medium text-white/60 mb-6">
            Human + AI Collaboration
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight mb-6">
            AI executes.<br />Humans decide.
          </h2>
          <p className="text-white/60 text-lg leading-relaxed">
            <span className="text-[#F59E0B] font-semibold">AI.bo</span> is Tam Tam Corp's internal
            AI assistant — a speed and scale multiplier, not a replacement for human responsibility.
            It handles execution. Final decisions, system design, and client accountability remain
            with the founder. All AI outputs are reviewed, tested, and validated before deployment.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {points.map((p, i) => (
            <AnimatedSection key={p.label} delay={i * 0.1}>
              <div className="border border-white/10 rounded-2xl p-8 h-full">
                <div className="w-8 h-8 bg-[#F59E0B] rounded-full flex items-center justify-center mb-5">
                  <span className="text-white font-bold text-sm">{i + 1}</span>
                </div>
                <h3 className="font-semibold text-white mb-2">{p.label}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{p.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to App.jsx and verify**

Expected:
- Full dark section (only dark section on page)
- "AI.bo" in amber
- 3 numbered cards with white/transparent borders

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add HumanAndAI dark section"
```

---

## Task 10: Good Fit / Not a Fit

**Files:**
- Create: `src/components/sections/GoodFit.jsx`

- [ ] **Step 1: Create `src/components/sections/GoodFit.jsx`**

```jsx
import { CheckCircle, XCircle } from 'lucide-react'
import AnimatedSection from '../ui/AnimatedSection'

const goodFit = [
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

export default function GoodFit() {
  return (
    <section className="py-32 px-6 bg-[#F9FAFB]">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-[#0A0A0A] tracking-tight mb-4">
            When to Choose Tam Tam Corp
          </h2>
          <p className="text-lg text-[#6B7280] max-w-xl mx-auto">
            Best suited for companies that need implementation with direct accountability,
            not layered agencies or advisory-only consulting
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Good fit */}
          <AnimatedSection>
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 h-full">
              <h3 className="font-semibold text-[#0A0A0A] mb-6 text-lg">Good fit</h3>
              <div className="flex flex-col gap-4">
                {goodFit.map(item => (
                  <div key={item} className="flex gap-3 items-start">
                    <CheckCircle size={18} className="text-[#F59E0B] flex-shrink-0 mt-0.5" />
                    <span className="text-[#0A0A0A] text-sm leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* Not a fit */}
          <AnimatedSection delay={0.1}>
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 h-full">
              <h3 className="font-semibold text-[#6B7280] mb-6 text-lg">Not a fit</h3>
              <div className="flex flex-col gap-4">
                {notFit.map(item => (
                  <div key={item} className="flex gap-3 items-start">
                    <XCircle size={18} className="text-[#D1D5DB] flex-shrink-0 mt-0.5" />
                    <span className="text-[#6B7280] text-sm leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to App.jsx and verify**

Expected:
- Two white cards side by side on desktop
- Left: amber checkmarks, dark text
- Right: gray X icons, muted text

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add GoodFit section"
```

---

## Task 11: How We Work

**Files:**
- Create: `src/components/sections/HowWeWork.jsx`

- [ ] **Step 1: Create `src/components/sections/HowWeWork.jsx`**

```jsx
import AnimatedSection from '../ui/AnimatedSection'

const steps = [
  {
    num: '01',
    title: 'Understand the real problem',
    description: "We dig into what's actually slowing you down, not what you think the solution should be.",
  },
  {
    num: '02',
    title: 'Design the system',
    description: 'We map out automation logic, integrations, and workflows that fit your operations.',
  },
  {
    num: '03',
    title: 'Build & integrate',
    description: 'We implement the system, connect it to your existing tools, and ensure it runs reliably.',
  },
  {
    num: '04',
    title: 'Iterate and maintain',
    description: 'We refine based on real usage and provide ongoing support as your needs evolve.',
  },
]

function StepItem({ step, delay }) {
  return (
    <AnimatedSection delay={delay}>
      <div className="flex gap-4 items-start">
        <div className="w-10 h-10 rounded-full bg-[#F59E0B] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
          {step.num}
        </div>
        <div>
          <h3 className="font-semibold text-[#0A0A0A] mb-2">{step.title}</h3>
          <p className="text-[#6B7280] text-sm leading-relaxed">{step.description}</p>
        </div>
      </div>
    </AnimatedSection>
  )
}

export default function HowWeWork() {
  return (
    <section id="process" className="py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection className="text-center mb-20">
          <h2 className="text-4xl lg:text-5xl font-bold text-[#0A0A0A] tracking-tight mb-4">
            How We Work
          </h2>
          <p className="text-lg text-[#6B7280]">Structured, predictable, and grounded in execution</p>
        </AnimatedSection>

        {/* Desktop: horizontal stepper with connecting line */}
        <div className="hidden lg:block relative">
          <div className="absolute top-5 left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-px bg-[#E5E7EB]" />
          <div className="grid grid-cols-4 gap-8 relative">
            {steps.map((step, i) => (
              <AnimatedSection key={step.num} delay={i * 0.1} className="text-center">
                <div className="w-10 h-10 rounded-full bg-[#F59E0B] text-white text-sm font-bold flex items-center justify-center mx-auto mb-6 relative z-10">
                  {step.num}
                </div>
                <h3 className="font-semibold text-[#0A0A0A] mb-3 text-base">{step.title}</h3>
                <p className="text-[#6B7280] text-sm leading-relaxed">{step.description}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>

        {/* Tablet: 2x2 grid */}
        <div className="hidden md:grid lg:hidden grid-cols-2 gap-10">
          {steps.map((step, i) => (
            <StepItem key={step.num} step={step} delay={i * 0.1} />
          ))}
        </div>

        {/* Mobile: vertical */}
        <div className="md:hidden flex flex-col gap-8">
          {steps.map((step, i) => (
            <StepItem key={step.num} step={step} delay={i * 0.08} />
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to App.jsx and verify**

Expected:
- Desktop: 4 columns with connecting line, centered numbers
- Tablet: 2×2 grid
- Mobile: vertical stack
- All step numbers in amber circles

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add HowWeWork stepper (desktop/tablet/mobile layouts)"
```

---

## Task 12: CTA Section

**Files:**
- Create: `src/components/sections/CTASection.jsx`

- [ ] **Step 1: Create `src/components/sections/CTASection.jsx`**

```jsx
import AnimatedSection from '../ui/AnimatedSection'
import Button from '../ui/Button'

export default function CTASection() {
  return (
    <section className="py-32 px-6 bg-[#F59E0B]">
      <div className="max-w-4xl mx-auto text-center">
        <AnimatedSection>
          <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">
            Ready to Automate?
          </h2>
          <p className="text-white/80 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            Chat with our AI agent now or schedule a call with our team. Discover which
            automation solutions will transform your business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" href="/StartConversation">Start a Conversation</Button>
            <Button variant="outlined-white" href="/#chat">Chat with AI Agent</Button>
          </div>
        </AnimatedSection>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to App.jsx and verify**

Expected:
- Full amber background section — high contrast
- White headline and subtext
- Two buttons: black and white-outlined

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add CTASection with amber background"
```

---

## Task 13: Assemble Final App

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Write final `src/App.jsx`**

```jsx
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import Hero from './components/sections/Hero'
import WhatWeBuild from './components/sections/WhatWeBuild'
import FounderStatement from './components/sections/FounderStatement'
import HumanAndAI from './components/sections/HumanAndAI'
import GoodFit from './components/sections/GoodFit'
import HowWeWork from './components/sections/HowWeWork'
import CTASection from './components/sections/CTASection'

export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />
      <main>
        <Hero />
        <WhatWeBuild />
        <FounderStatement />
        <HumanAndAI />
        <GoodFit />
        <HowWeWork />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 2: Full visual review at `http://localhost:5173`**

Check each section in order:
- [ ] Navbar: transparent → blur on scroll, amber CTA button, mobile menu works
- [ ] Hero: staggered animation, "Founder-led" in amber, two buttons
- [ ] What We Build: 5 cards, "AI.bo" in amber, hover lift
- [ ] Founder Statement: pull-quote with amber border, 3 benefits
- [ ] Human + AI: dark section, "AI.bo" in amber, 3 numbered cards
- [ ] Good Fit: 2 white cards, amber checkmarks vs gray X
- [ ] How We Work: horizontal stepper on desktop, amber numbers
- [ ] CTA: amber background, white text, two buttons
- [ ] Footer: 4 columns, dark background, all links present
- [ ] Mobile: all sections stack correctly at < 768px

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: assemble complete homepage — Phase 1 complete"
```

---

## Task 14: Build Verification

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: Build completes with no errors. Output in `dist/`.

- [ ] **Step 2: Preview production build**

```bash
npm run preview
```

Expected: Site loads at `http://localhost:4173`, all sections render, animations work.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: verify production build passes — homepage Phase 1 done"
```

---

## Done

Homepage is complete. Next: invoke `superpowers:brainstorming` to plan Phase 2 (remaining 18 pages + routing).
