# Plan: tamtamcorp-website — Multi-Page Expansion

**Date:** 2026-03-25
**Goal:** Expand tamtamcorp-website from a single-page homepage to a multi-page site with React Router v6, a shared Layout component, and 5 priority pages: Services, About, Team, Contact, and Lead Generator.
**Repo:** `C:\Users\ibrah\Documents\tamtamcorp-website\`

---

## Architecture Overview

```
src/
  App.jsx                         ← rewritten: BrowserRouter + Routes
  pages/
    HomePage.jsx                  ← all homepage sections (moved from App.jsx)
    ServicesPage.jsx              ← /services
    AboutPage.jsx                 ← /about
    TeamPage.jsx                  ← /team
    ContactPage.jsx               ← /contact  (also /StartConversation)
    LeadGeneratorPage.jsx         ← /lead-generator
  components/
    layout/
      Navbar.jsx                  ← modified: hash links → route links
      Footer.jsx                  ← modified: hash links → route links
      Layout.jsx                  ← new: SmoothScroll + Navbar + main + Footer
    ui/
      PageHero.jsx                ← new: shared dark-bg hero for inner pages
      Button.jsx                  ← unchanged
      Badge.jsx                   ← unchanged
      AnimatedSection.jsx         ← unchanged
      SpotlightCard.jsx           ← unchanged
      NeuralBackground.jsx        ← unchanged
      SmoothScroll.jsx            ← unchanged
    sections/                     ← all existing sections unchanged
```

## Tech Stack

- Vite + React (JSX)
- Tailwind CSS v3
- Framer Motion
- Lucide React
- **react-router-dom v6** (new dependency)

---

## Task 1: Routing Setup

### Files

**Install:**
- `react-router-dom`

**Create:**
- `src/components/layout/Layout.jsx`
- `src/pages/HomePage.jsx`

**Modify:**
- `src/App.jsx`
- `vite.config.js`
- `src/components/layout/Navbar.jsx`
- `src/components/layout/Footer.jsx`

---

### Steps

- [ ] Install react-router-dom

```bash
npm install react-router-dom
```

- [ ] Create `src/components/layout/Layout.jsx`

```jsx
import SmoothScroll from '../ui/SmoothScroll'
import Navbar from './Navbar'
import Footer from './Footer'
import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

export default function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <SmoothScroll>
      <div className="min-h-screen bg-white font-sans">
        <Navbar />
        <main>
          <Outlet />
        </main>
        <Footer />
      </div>
    </SmoothScroll>
  )
}
```

- [ ] Create `src/pages/HomePage.jsx`

```jsx
import Hero from '../components/sections/Hero'
import MarqueeTicker from '../components/sections/MarqueeTicker'
import WhatWeBuild from '../components/sections/WhatWeBuild'
import StatsSection from '../components/sections/StatsSection'
import FounderStatement from '../components/sections/FounderStatement'
import HumanAndAI from '../components/sections/HumanAndAI'
import GoodFit from '../components/sections/GoodFit'
import HowWeWork from '../components/sections/HowWeWork'
import CTASection from '../components/sections/CTASection'

export default function HomePage() {
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

- [ ] Rewrite `src/App.jsx`

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import ServicesPage from './pages/ServicesPage'
import AboutPage from './pages/AboutPage'
import TeamPage from './pages/TeamPage'
import ContactPage from './pages/ContactPage'
import LeadGeneratorPage from './pages/LeadGeneratorPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/StartConversation" element={<ContactPage />} />
          <Route path="/lead-generator" element={<LeadGeneratorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] Update `vite.config.js` to support SPA routing in dev

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    historyApiFallback: true,
  },
})
```

- [ ] Update `src/components/layout/Navbar.jsx`

Replace the `links` array and switch from `<a>` to `<Link>` from react-router-dom. The entire updated file:

```jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import Button from '../ui/Button'

const links = [
  { label: 'Services', href: '/services' },
  { label: 'About', href: '/about' },
  { label: 'Team', href: '/team' },
  { label: 'Contact', href: '/contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // On dark-bg pages (homepage hero), navbar text starts white;
  // on inner pages (white bg), start dark immediately.
  const isHomePage = pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const textLight = isHomePage && !scrolled

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || !isHomePage
          ? 'bg-white/80 backdrop-blur-[20px] saturate-150 border-b border-[#E5E7EB]/50 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <motion.div
            className="w-2 h-2 rounded-full bg-[#F59E0B]"
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="text-[18px] font-black tracking-tight">
            <span className={`transition-colors duration-300 ${textLight ? 'text-white' : 'text-[#0A0A0A]'}`}>
              Tam Tam{' '}
            </span>
            <span className="text-[#F59E0B]">Corp</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map(link => (
            <motion.div key={link.label} className="relative py-1" whileHover="hover">
              <Link
                to={link.href}
                className={`relative text-[14px] font-medium transition-colors duration-300 ${
                  textLight ? 'text-white/70 hover:text-white' : 'text-[#374151] hover:text-[#0A0A0A]'
                } ${pathname === link.href ? '!text-[#F59E0B]' : ''}`}
              >
                {link.label}
              </Link>
              <motion.span
                className="absolute bottom-0 left-0 h-[2px] bg-[#F59E0B] rounded-full"
                initial={{ width: 0 }}
                variants={{ hover: { width: '100%' } }}
                transition={{ duration: 0.2 }}
              />
            </motion.div>
          ))}
        </div>

        <div className="hidden md:block">
          <Button variant="amber" href="/contact">Start a Conversation</Button>
        </div>

        <button
          className={`md:hidden p-2 transition-colors duration-300 ${textLight ? 'text-white' : 'text-[#0A0A0A]'}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-white border-b border-[#E5E7EB] px-6 py-4 flex flex-col gap-4"
        >
          {links.map(link => (
            <Link
              key={link.label}
              to={link.href}
              className="text-sm font-medium text-[#0A0A0A]"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Button variant="amber" href="/contact">Start a Conversation</Button>
        </motion.div>
      )}
    </motion.nav>
  )
}
```

- [ ] Update `src/components/layout/Footer.jsx`

Replace hash links with real routes. Full updated file:

```jsx
import { Link } from 'react-router-dom'

const quickLinks = [
  { label: 'Services', href: '/services' },
  { label: 'About', href: '/about' },
  { label: 'Team', href: '/team' },
  { label: 'Contact', href: '/contact' },
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
                  <Link to={link.href} className="text-white/50 text-sm hover:text-white transition-colors">
                    {link.label}
                  </Link>
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

- [ ] Also update `Button.jsx` to use `Link` when the href is an internal route (starts with `/`) so navigation doesn't do full-page reloads. Full updated file:

```jsx
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const variants = {
  primary: 'bg-[#0A0A0A] text-white hover:bg-[#1a1a1a]',
  outlined: 'border-2 border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white',
  amber: 'bg-[#F59E0B] text-white hover:bg-[#D97706] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]',
  'outlined-white': 'border-2 border-white text-white hover:bg-white hover:text-[#0A0A0A]',
}

const MotionLink = motion(Link)

export default function Button({ children, variant = 'primary', href, onClick, className = '' }) {
  const base = 'inline-flex items-center justify-center px-6 py-3 rounded-full font-semibold text-sm transition-all duration-200 cursor-pointer'
  const cls = `${base} ${variants[variant]} ${className}`

  if (href) {
    const isInternal = href.startsWith('/')
    if (isInternal) {
      return (
        <MotionLink to={href} className={cls} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          {children}
        </MotionLink>
      )
    }
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

- [ ] Verify dev server starts and homepage renders correctly at `http://localhost:5173/`

- [ ] Git commit

```bash
git add src/App.jsx src/pages/HomePage.jsx src/components/layout/Layout.jsx src/components/layout/Navbar.jsx src/components/layout/Footer.jsx src/components/ui/Button.jsx vite.config.js
git commit -m "feat: add react-router-dom, Layout component, HomePage page, update Navbar/Footer to route links"
```

---

## Task 2: PageHero Shared Component

### Files

**Create:**
- `src/components/ui/PageHero.jsx`

---

### Steps

- [ ] Create `src/components/ui/PageHero.jsx`

This component is used by every inner page (Services, About, Team, Contact, Lead Generator). It uses a dark `#0A0A0A` background with a subtle dot-grid pattern (no neural network canvas for performance), an animated amber label, a large animated h1, and an optional subtitle. The bottom fades to white matching the homepage hero transition.

```jsx
import { motion } from 'framer-motion'

/**
 * PageHero — shared dark hero banner for inner pages.
 *
 * Props:
 *   label      {string}  — small amber uppercase label above the title
 *   title      {string}  — large h1 headline (supports \n for line breaks)
 *   subtitle   {string}  — optional muted subtext below the title
 *   children   {node}    — optional slot rendered below subtitle (e.g. badges)
 */
export default function PageHero({ label, title, subtitle, children }) {
  return (
    <section className="relative bg-[#0A0A0A] pt-40 pb-32 px-6 overflow-hidden">

      {/* Dot-grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Subtle amber glow centred behind text */}
      <motion.div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        <div
          className="w-[600px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, transparent 70%)' }}
        />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center">

        {/* Amber label */}
        {label && (
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block text-[12px] font-semibold text-[#F59E0B] tracking-[0.2em] uppercase mb-6"
          >
            {label}
          </motion.span>
        )}

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-[clamp(38px,6vw,72px)] font-extrabold text-white leading-[1.05] mb-6"
          style={{ letterSpacing: '-0.03em' }}
        >
          {title}
        </motion.h1>

        {/* Divider line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="w-16 h-px bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent mx-auto mb-6"
        />

        {/* Subtitle */}
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="text-[17px] text-white/50 leading-relaxed max-w-2xl mx-auto"
          >
            {subtitle}
          </motion.p>
        )}

        {/* Optional slot (badges, CTAs, etc.) */}
        {children && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8"
          >
            {children}
          </motion.div>
        )}
      </div>

      {/* Gradient fade to white */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '45%',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.5) 60%, #ffffff 100%)',
        }}
      />
    </section>
  )
}
```

- [ ] Git commit

```bash
git add src/components/ui/PageHero.jsx
git commit -m "feat: add PageHero shared component for inner page dark hero banners"
```

---

## Task 3: ServicesPage (`/services`)

### Files

**Create:**
- `src/pages/ServicesPage.jsx`

---

### Steps

- [ ] Create `src/pages/ServicesPage.jsx`

```jsx
import { motion } from 'framer-motion'
import { Bot, MessageSquare, Phone, LayoutDashboard, Cpu, Handshake } from 'lucide-react'
import PageHero from '../components/ui/PageHero'
import SpotlightCard from '../components/ui/SpotlightCard'
import AnimatedSection from '../components/ui/AnimatedSection'
import MarqueeTicker from '../components/sections/MarqueeTicker'
import CTASection from '../components/sections/CTASection'

const services = [
  {
    icon: Bot,
    tag: 'Core Service',
    title: 'AI Automation & Workflow Systems',
    description:
      'End-to-end automation pipelines that eliminate manual work. We design, build, and deploy — no handoff to a third-party vendor.',
  },
  {
    icon: MessageSquare,
    tag: 'Flagship Product',
    title: 'AI.bo — Assisted Communication & Intake',
    description:
      'Intelligent intake systems that qualify, route, and respond. AI.bo handles the first touch so your team focuses on decisions.',
    isAibo: true,
  },
  {
    icon: Phone,
    tag: 'Messaging',
    title: 'WhatsApp Agents',
    description:
      'Automated WhatsApp flows for lead capture, appointment booking, support, and follow-up — running 24/7 without manual effort.',
  },
  {
    icon: LayoutDashboard,
    tag: 'Operations',
    title: 'Internal Tools & Dashboards',
    description:
      'Custom dashboards that give your team real-time visibility and control over operations. Built for the specific way your business runs.',
  },
  {
    icon: Cpu,
    tag: 'Infrastructure',
    title: 'System Architecture & Integrations',
    description:
      'Connect your stack with integrations that hold under production load. We design the architecture and implement it — no abstract diagrams.',
  },
  {
    icon: Handshake,
    tag: 'Advisory',
    title: 'Consulting with Hands-on Implementation',
    description:
      "Strategy that doesn't stop at the whiteboard. We build what we recommend — directly, personally, and with full accountability.",
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
}

export default function ServicesPage() {
  return (
    <>
      <PageHero
        label="What We Build"
        title="Systems that run in production"
        subtitle="We design and implement automation systems that actually run — built personally, not delegated. No advisory-only deliverables."
      />

      <MarqueeTicker />

      {/* Services grid */}
      <section className="relative py-24 px-6 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto">

          <AnimatedSection className="text-center mb-16">
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold tracking-tight text-[#0A0A0A] mb-4">
              Six ways we can work together
            </h2>
            <p className="text-[16px] text-[#6B7280] max-w-xl mx-auto">
              Most businesses have the same problem: manual processes that should be automated but never are.
              We solve that — directly.
            </p>
          </AnimatedSection>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.05 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {services.map((service, i) => {
              const Icon = service.icon
              return (
                <motion.div key={i} variants={cardVariants}>
                  <SpotlightCard className="bg-white border border-[#E5E7EB] h-full p-8 group">
                    <div className="flex items-start gap-4 mb-5">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center group-hover:bg-[#F59E0B] transition-colors duration-300">
                        <Icon
                          size={22}
                          className="text-[#F59E0B] group-hover:text-white transition-colors duration-300"
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-[#9CA3AF] tracking-widest uppercase mt-1">
                        {service.tag}
                      </span>
                    </div>

                    <h3 className="text-[18px] font-semibold text-[#0A0A0A] mb-3 leading-snug">
                      {service.isAibo ? (
                        <>
                          <span className="text-[#F59E0B] font-bold">AI.bo</span>
                          {' — Assisted Communication & Intake'}
                        </>
                      ) : (
                        service.title
                      )}
                    </h3>

                    <p className="text-[15px] text-[#6B7280] leading-relaxed mb-6">
                      {service.description}
                    </p>

                    <a
                      href="/contact"
                      className="text-[13px] font-semibold text-[#F59E0B] hover:text-[#D97706] transition-colors inline-flex items-center gap-1"
                    >
                      Learn more →
                    </a>

                    <div className="mt-4 w-8 h-[2px] bg-[#F59E0B] group-hover:w-16 transition-all duration-300" />
                  </SpotlightCard>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      <CTASection />
    </>
  )
}
```

- [ ] Git commit

```bash
git add src/pages/ServicesPage.jsx
git commit -m "feat: add ServicesPage with 6 service cards, marquee ticker, and CTA"
```

---

## Task 4: AboutPage (`/about`)

### Files

**Create:**
- `src/pages/AboutPage.jsx`

---

### Steps

- [ ] Create `src/pages/AboutPage.jsx`

```jsx
import { motion } from 'framer-motion'
import { Shield, Zap, Eye, UserCheck } from 'lucide-react'
import PageHero from '../components/ui/PageHero'
import AnimatedSection from '../components/ui/AnimatedSection'
import StatsSection from '../components/sections/StatsSection'
import CTASection from '../components/sections/CTASection'

const pillars = [
  {
    icon: UserCheck,
    title: 'One Accountable Person',
    description:
      'One identifiable human remains responsible for system design, decisions, and implementation from strategy to deployment.',
  },
  {
    icon: Eye,
    title: 'Consistency Between Promise and Delivery',
    description:
      'What is recommended is what is built. No gap between the consulting layer and the implementation layer.',
  },
  {
    icon: Zap,
    title: 'Hands-on, Not Delegated',
    description:
      'Systems are built personally by the founder, not handed off to a team of contractors or subcontracted overseas.',
  },
  {
    icon: Shield,
    title: 'Production-First Thinking',
    description:
      'Every system is designed to run in production under real conditions — not to look good in a slide deck or proof-of-concept demo.',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const itemVariants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
}

export default function AboutPage() {
  return (
    <>
      <PageHero
        label="About Us"
        title="Founder-led. Detail-driven. Built from the inside."
        subtitle="A consultancy where the person who designs your system is the same person who builds and deploys it."
      />

      {/* Main content: two-column */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* Left: company story */}
            <AnimatedSection delay={0.1}>
              <p className="text-[13px] font-semibold text-[#F59E0B] tracking-widest uppercase mb-5">
                Who We Are
              </p>
              <h2
                className="text-[clamp(28px,4vw,42px)] font-bold text-[#0A0A0A] leading-tight mb-8"
                style={{ letterSpacing: '-0.02em' }}
              >
                Tam Tam Corp FZE LLC
              </h2>

              <div className="space-y-5 text-[16px] text-[#374151] leading-relaxed">
                <p>
                  Tam Tam Corp FZE LLC is a founder-led consultancy built and operated by Ibrahim Surucu, focusing on
                  AI automation, systems design, and hands-on implementation.
                </p>
                <p>
                  Systems are built personally by the founder, not delegated to teams. This means one identifiable
                  human remains responsible for system design, decisions, and implementation from strategy to
                  deployment.
                </p>
                <p>
                  This structure maintains consistency between what is recommended and what is delivered — a gap that
                  exists in almost every traditional consultancy.
                </p>
                <p className="text-[#6B7280]">
                  Based in Ajman, United Arab Emirates. Licensed and operational. Working with clients across the UAE,
                  Europe, and beyond.
                </p>
              </div>

              {/* Divider accent */}
              <div className="mt-10 flex items-center gap-4">
                <div className="w-12 h-[3px] bg-[#F59E0B] rounded-full" />
                <span className="text-[13px] text-[#9CA3AF] font-medium tracking-wide">
                  Trade License: 262705457888
                </span>
              </div>
            </AnimatedSection>

            {/* Right: value pillars */}
            <AnimatedSection delay={0.25}>
              <p className="text-[13px] font-semibold text-[#F59E0B] tracking-widest uppercase mb-5">
                Core Principles
              </p>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.1 }}
                className="space-y-6"
              >
                {pillars.map((pillar, i) => {
                  const Icon = pillar.icon
                  return (
                    <motion.div
                      key={i}
                      variants={itemVariants}
                      className="flex gap-5 p-5 rounded-2xl border border-[#E5E7EB] hover:border-[#F59E0B]/30 hover:bg-[#FFFBEB]/30 transition-all duration-300"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center">
                        <Icon size={18} className="text-[#F59E0B]" />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">{pillar.title}</h3>
                        <p className="text-[14px] text-[#6B7280] leading-relaxed">{pillar.description}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      <StatsSection />

      <CTASection />
    </>
  )
}
```

- [ ] Git commit

```bash
git add src/pages/AboutPage.jsx
git commit -m "feat: add AboutPage with two-column story/pillars layout, stats, and CTA"
```

---

## Task 5: TeamPage (`/team`)

### Files

**Create:**
- `src/pages/TeamPage.jsx`

---

### Steps

- [ ] Create `src/pages/TeamPage.jsx`

```jsx
import { motion } from 'framer-motion'
import { Crown, Bot, Cpu } from 'lucide-react'
import PageHero from '../components/ui/PageHero'
import SpotlightCard from '../components/ui/SpotlightCard'
import AnimatedSection from '../components/ui/AnimatedSection'
import CTASection from '../components/sections/CTASection'

const roles = [
  {
    icon: Crown,
    badge: 'CEO & Founder',
    title: 'Strategy, Vision & Responsibility',
    description:
      'Strategy, vision, and responsibility come together here. Every decision, every system, and every project carries my personal signature.',
  },
  {
    icon: Bot,
    badge: 'Head of AI',
    title: 'AI Systems Design',
    description:
      'AI is not a buzzword here — it is a tool. This is where automation, agents, and systems are designed with purpose and deployed with precision.',
  },
  {
    icon: Cpu,
    badge: 'Systems & Implementation',
    title: 'Architecture & Deployment',
    description:
      'Architecture decisions, integration logic, and deployment pipelines — this is where systems become real. Built to run, not just to present.',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
}

export default function TeamPage() {
  return (
    <>
      <PageHero
        label="The Team"
        title="Many roles. One responsibility."
        subtitle="Tam Tam Corp is not an anonymous agency with interchangeable faces. Here, you always know who thinks, who builds, and who is accountable."
      />

      {/* Intro strip */}
      <section className="py-16 px-6 bg-white border-b border-[#F3F4F6]">
        <div className="max-w-3xl mx-auto text-center">
          <AnimatedSection>
            <p className="text-[17px] text-[#374151] leading-relaxed">
              In most agencies, accountability is distributed across teams until no single person is responsible for
              the outcome. At Tam Tam Corp, the structure is intentionally different: one founder, multiple
              responsibilities, zero delegation of ownership.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Role cards */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {roles.map((role, i) => {
              const Icon = role.icon
              return (
                <motion.div key={i} variants={cardVariants}>
                  <SpotlightCard className="bg-white border border-[#E5E7EB] h-full p-8 group flex flex-col">
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-2xl bg-[#0A0A0A] flex items-center justify-center mb-6 group-hover:bg-[#F59E0B] transition-colors duration-300">
                      <Icon size={24} className="text-white" />
                    </div>

                    {/* Amber badge */}
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] mb-4 self-start tracking-wide uppercase">
                      {role.badge}
                    </span>

                    <h3 className="text-[18px] font-bold text-[#0A0A0A] mb-3 leading-snug">
                      {role.title}
                    </h3>
                    <p className="text-[15px] text-[#6B7280] leading-relaxed flex-1">
                      {role.description}
                    </p>

                    <div className="mt-6 w-8 h-[2px] bg-[#F59E0B] group-hover:w-16 transition-all duration-300" />
                  </SpotlightCard>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Founder quote card */}
      <section className="py-8 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection delay={0.1}>
            <div className="relative bg-[#0A0A0A] rounded-3xl px-10 py-12 border-l-4 border-[#F59E0B] overflow-hidden">
              {/* Subtle amber glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse 60% 80% at 10% 50%, rgba(245,158,11,0.08) 0%, transparent 70%)',
                }}
              />
              <div className="relative z-10">
                <div className="text-[#F59E0B] text-[64px] font-serif leading-none mb-4 opacity-30 select-none">"</div>
                <p className="text-[22px] font-light text-white leading-relaxed italic mb-8">
                  If something works, I stand behind it. If it doesn't — I do too.
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-[2px] bg-[#F59E0B] rounded-full" />
                  <span className="text-[13px] font-semibold text-white/60 tracking-wide uppercase">
                    Ibrahim Surucu — CEO & Founder, Tam Tam Corp
                  </span>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <div className="py-8 bg-white" />

      <CTASection />
    </>
  )
}
```

- [ ] Git commit

```bash
git add src/pages/TeamPage.jsx
git commit -m "feat: add TeamPage with role cards, founder quote, and CTA"
```

---

## Task 6: ContactPage (`/contact`)

### Files

**Create:**
- `src/pages/ContactPage.jsx`

---

### Steps

- [ ] Create `src/pages/ContactPage.jsx`

The form is static (no backend). On submit it opens a `mailto:` with the field values pre-filled. A visual success state is shown using `useState`. The form uses `type="submit"` and `onSubmit` handler.

```jsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Phone, MapPin, MessageCircle, CheckCircle } from 'lucide-react'
import PageHero from '../components/ui/PageHero'
import AnimatedSection from '../components/ui/AnimatedSection'

const steps = [
  {
    number: '01',
    title: 'Describe your problem',
    description:
      'Fill in the form with a clear description of the operational problem you want to solve. Three to five sentences is enough.',
  },
  {
    number: '02',
    title: 'AI.bo assists with first intake',
    description:
      'AI.bo reviews your submission to help structure the problem clearly. All decisions remain human-led.',
  },
  {
    number: '03',
    title: 'Conversation is scheduled',
    description:
      'Once the problem is understood, a conversation is scheduled. Time is spent where meaningful progress is possible.',
  },
]

const contactDetails = [
  {
    icon: Mail,
    label: 'Email',
    value: 'info@tamtamcorp.online',
    href: 'mailto:info@tamtamcorp.online',
  },
  {
    icon: Phone,
    label: 'Phone / WhatsApp',
    value: '+971 58 873 7467',
    href: 'https://wa.me/971588737467',
  },
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: 'Send a message on WhatsApp',
    href: 'https://wa.me/971588737467',
  },
  {
    icon: MapPin,
    label: 'Location',
    value: 'Ajman, United Arab Emirates',
    href: null,
  },
]

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [problem, setProblem] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const subject = encodeURIComponent(`Inquiry from ${name}`)
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nProblem description:\n${problem}`
    )
    window.location.href = `mailto:info@tamtamcorp.online?subject=${subject}&body=${body}`
    setSubmitted(true)
  }

  return (
    <>
      <PageHero
        label="Start a Conversation"
        title="Let's understand your problem first."
        subtitle="Tam Tam Corp works with a limited number of clients at a time. Before scheduling any conversation, we first aim to understand the problem clearly."
      />

      {/* Main content */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* Left: context + process steps */}
            <AnimatedSection delay={0.1}>
              <p className="text-[13px] font-semibold text-[#F59E0B] tracking-widest uppercase mb-5">
                How It Works
              </p>
              <h2 className="text-[clamp(24px,3vw,34px)] font-bold text-[#0A0A0A] mb-6 leading-tight"
                  style={{ letterSpacing: '-0.02em' }}>
                Conversations are scheduled only after the problem is understood.
              </h2>
              <p className="text-[16px] text-[#6B7280] leading-relaxed mb-10">
                This helps ensure that time is spent where meaningful progress is possible. We do not take on every
                project — only the ones where we can deliver real value.
              </p>

              <div className="space-y-8">
                {steps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -24 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.6, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="flex gap-5"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#0A0A0A] flex items-center justify-center">
                      <span className="text-[12px] font-bold text-[#F59E0B]">{step.number}</span>
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">{step.title}</h3>
                      <p className="text-[14px] text-[#6B7280] leading-relaxed">{step.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatedSection>

            {/* Right: form */}
            <AnimatedSection delay={0.25}>
              <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 shadow-sm">
                <AnimatePresence mode="wait">
                  {submitted ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="flex flex-col items-center justify-center py-16 text-center"
                    >
                      <div className="w-16 h-16 rounded-full bg-[#FEF3C7] flex items-center justify-center mb-6">
                        <CheckCircle size={32} className="text-[#F59E0B]" />
                      </div>
                      <h3 className="text-[22px] font-bold text-[#0A0A0A] mb-3">Message sent</h3>
                      <p className="text-[15px] text-[#6B7280] leading-relaxed max-w-xs">
                        Your email client should have opened. If not, write directly to{' '}
                        <a href="mailto:info@tamtamcorp.online" className="text-[#F59E0B] hover:underline">
                          info@tamtamcorp.online
                        </a>
                        .
                      </p>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit}
                      className="space-y-6"
                    >
                      <div>
                        <label className="block text-[13px] font-semibold text-[#374151] mb-2">
                          Your Name
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="Ibrahim Surucu"
                          className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[15px] text-[#0A0A0A] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/40 focus:border-[#F59E0B] transition-all duration-200"
                        />
                      </div>

                      <div>
                        <label className="block text-[13px] font-semibold text-[#374151] mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[15px] text-[#0A0A0A] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/40 focus:border-[#F59E0B] transition-all duration-200"
                        />
                      </div>

                      <div>
                        <label className="block text-[13px] font-semibold text-[#374151] mb-2">
                          Describe the operational problem you want to solve
                        </label>
                        <p className="text-[12px] text-[#9CA3AF] mb-2">3–5 sentences is enough.</p>
                        <textarea
                          required
                          value={problem}
                          onChange={e => setProblem(e.target.value)}
                          rows={5}
                          placeholder="We currently handle all customer intake manually via email. The volume has grown to the point where responses are delayed by 2–3 days. We want to automate the first-touch qualification and routing..."
                          className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[15px] text-[#0A0A0A] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/40 focus:border-[#F59E0B] transition-all duration-200 resize-none"
                        />
                      </div>

                      <motion.button
                        type="submit"
                        whileHover={{ scale: 1.02, boxShadow: '0 8px 30px rgba(245,158,11,0.3)' }}
                        whileTap={{ scale: 0.97 }}
                        className="w-full bg-[#F59E0B] text-white py-4 rounded-full font-semibold text-[15px] transition-all duration-200 hover:bg-[#D97706]"
                      >
                        Send My Inquiry
                      </motion.button>

                      <p className="text-[12px] text-[#9CA3AF] text-center">
                        AI.bo assists with first intake only. All decisions remain human-led.
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Contact info strip */}
      <section className="py-16 px-6 bg-[#F9FAFB] border-t border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {contactDetails.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex flex-col gap-2"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] flex items-center justify-center mb-1">
                    <Icon size={16} className="text-[#F59E0B]" />
                  </div>
                  <span className="text-[11px] font-semibold text-[#9CA3AF] tracking-widest uppercase">
                    {item.label}
                  </span>
                  {item.href ? (
                    <a
                      href={item.href}
                      className="text-[14px] text-[#374151] hover:text-[#F59E0B] transition-colors font-medium"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <span className="text-[14px] text-[#374151] font-medium">{item.value}</span>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
```

- [ ] Git commit

```bash
git add src/pages/ContactPage.jsx
git commit -m "feat: add ContactPage with mailto form, process steps, and contact info strip"
```

---

## Task 7: LeadGeneratorPage (`/lead-generator`)

### Files

**Create:**
- `src/pages/LeadGeneratorPage.jsx`

---

### Steps

- [ ] Create `src/pages/LeadGeneratorPage.jsx`

```jsx
import { motion } from 'framer-motion'
import {
  MessageCircle,
  Star,
  Calendar,
  Palette,
  BarChart2,
  Building2,
  Briefcase,
  Home,
  Heart,
  Monitor,
  Check,
  ArrowRight,
} from 'lucide-react'
import AnimatedSection from '../components/ui/AnimatedSection'
import SpotlightCard from '../components/ui/SpotlightCard'

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: MessageCircle,
    title: '24/7 Intelligent Responses',
    description:
      'Your AI assistant answers visitor questions instantly around the clock — no missed leads, no delays.',
  },
  {
    icon: Star,
    title: 'Lead Qualification',
    description:
      'Automatically qualify prospects as cold, warm, or hot based on their responses before they ever reach your inbox.',
  },
  {
    icon: Calendar,
    title: 'Appointment Preparation',
    description:
      'Collect the context your team needs before a call. Every conversation ends with structured, actionable data.',
  },
  {
    icon: Palette,
    title: 'Fully Branded (White-Label)',
    description:
      'Match your company colors, logo, and tone exactly. Visitors see your brand — not ours.',
  },
  {
    icon: BarChart2,
    title: 'Conversation Analytics',
    description:
      'Understand what visitors ask, where they drop off, and which questions convert. Data-driven improvement built in.',
  },
  {
    icon: Building2,
    title: 'Multi-Tenant Ready',
    description:
      'Deploy across multiple websites, locations, or client accounts from a single dashboard.',
  },
]

const industries = [
  {
    icon: Briefcase,
    title: 'Professional Services',
    subtitle: 'Law firms · Consulting · Accountants',
  },
  {
    icon: Home,
    title: 'Real Estate',
    subtitle: 'Developers · Agents · Rentals',
  },
  {
    icon: Heart,
    title: 'Healthcare',
    subtitle: 'Clinics · Medical centers · Wellness',
  },
  {
    icon: Monitor,
    title: 'B2B SaaS',
    subtitle: 'Software companies · Tech providers',
  },
]

const plans = [
  {
    name: 'Starter',
    price: '€49.90',
    period: '/month',
    highlight: false,
    features: [
      '1 website',
      'Up to 1,000 conversations/month',
      'Auto website import',
      'Basic lead capture',
      'Lead dashboard',
      'Email support',
    ],
    cta: 'Get Started',
    ctaHref: '/contact',
  },
  {
    name: 'Growth',
    price: '€149',
    period: '/month',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Everything in Starter',
      'Up to 5,000 conversations/month',
      'Multi-step lead qualification',
      'Lead scoring (cold / warm / hot)',
      'Custom branding (colors & logo)',
      'Up to 3 websites',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/contact',
  },
  {
    name: 'Pro',
    price: '€399',
    period: '/month',
    highlight: false,
    features: [
      'Everything in Growth',
      'Up to 20,000 conversations/month',
      'Full white-label',
      'API access',
      'Advanced lead analytics',
      'CRM export',
      'Multi-location support',
      'Premium support',
    ],
    cta: 'Get Started',
    ctaHref: '/contact',
  },
  {
    name: 'Custom',
    price: 'Contact us',
    period: '',
    highlight: false,
    features: [
      'Unlimited conversations',
      'Dedicated infrastructure',
      'White-label reselling',
      'SLA guarantees',
      'Custom development',
    ],
    cta: 'Talk to Us',
    ctaHref: '/contact',
  },
]

// ─── Sub-components ────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeadGeneratorPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative bg-[#0A0A0A] pt-40 pb-32 px-6 overflow-hidden">
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Amber glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
        >
          <div
            className="w-[700px] h-[350px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.15) 0%, transparent 70%)' }}
          />
        </motion.div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Amber label */}
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block text-[12px] font-semibold text-[#F59E0B] tracking-[0.2em] uppercase mb-6"
          >
            AI.bo Lead Generator
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-[clamp(36px,6vw,68px)] font-extrabold text-white leading-[1.05] mb-6"
            style={{ letterSpacing: '-0.03em' }}
          >
            Turn Website Visitors into<br />
            <span
              style={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #F59E0B 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Qualified Leads
            </span>
            {' '}— Automatically
          </motion.h1>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="w-16 h-px bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent mx-auto mb-6"
          />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="text-[17px] text-white/50 leading-relaxed max-w-2xl mx-auto mb-8"
          >
            Our AI assistant answers questions, qualifies prospects, and captures contact details 24/7 — fully in
            your company design.
          </motion.p>

          {/* Badges */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center justify-center gap-3 mb-10"
          >
            {['Setup in 5 minutes', 'No coding required', 'Live demo active'].map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center px-4 py-1.5 rounded-full text-[12px] font-semibold border border-white/10 bg-white/5 text-white/60 tracking-wide"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] mr-2 flex-shrink-0" />
                {badge}
              </span>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.95, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.a
              href="/contact"
              whileHover={{ scale: 1.03, boxShadow: '0 0 40px rgba(245,158,11,0.4)' }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 bg-[#F59E0B] text-[#0A0A0A] px-8 py-4 rounded-full font-bold text-[15px] transition-all duration-200"
            >
              Start Converting Leads Today <ArrowRight size={16} />
            </motion.a>
            <motion.a
              href="#pricing"
              whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.08)' }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 border border-white/20 text-white/70 px-8 py-4 rounded-full font-semibold text-[15px] transition-all duration-200"
            >
              See Pricing
            </motion.a>
          </motion.div>
        </div>

        {/* Bottom gradient fade to white */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: '45%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.5) 60%, #ffffff 100%)',
          }}
        />
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-block text-[13px] font-semibold text-[#F59E0B] tracking-widest uppercase mb-4">
              Features
            </span>
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold tracking-tight text-[#0A0A0A] mb-4">
              Everything you need to convert visitors
            </h2>
            <p className="text-[16px] text-[#6B7280] max-w-lg mx-auto">
              Built for businesses that need leads, not just traffic. Every feature is designed for real conversion.
            </p>
          </AnimatedSection>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.05 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <motion.div key={i} variants={cardVariants}>
                  <SpotlightCard className="bg-white border border-[#E5E7EB] h-full p-7 group">
                    <div className="w-11 h-11 rounded-xl bg-[#FEF3C7] flex items-center justify-center mb-5 group-hover:bg-[#F59E0B] transition-colors duration-300">
                      <Icon size={20} className="text-[#F59E0B] group-hover:text-white transition-colors duration-300" />
                    </div>
                    <h3 className="text-[16px] font-semibold text-[#0A0A0A] mb-2">{feature.title}</h3>
                    <p className="text-[14px] text-[#6B7280] leading-relaxed">{feature.description}</p>
                    <div className="mt-5 w-6 h-[2px] bg-[#F59E0B] group-hover:w-12 transition-all duration-300" />
                  </SpotlightCard>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ── Industries ── */}
      <section className="py-20 px-6 bg-[#F9FAFB] border-y border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-12">
            <span className="inline-block text-[13px] font-semibold text-[#F59E0B] tracking-widest uppercase mb-4">
              Industries
            </span>
            <h2 className="text-[clamp(24px,3.5vw,38px)] font-bold tracking-tight text-[#0A0A0A]">
              Built for high-intent industries
            </h2>
          </AnimatedSection>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {industries.map((industry, i) => {
              const Icon = industry.icon
              return (
                <motion.div
                  key={i}
                  variants={cardVariants}
                  className="bg-white border border-[#E5E7EB] rounded-2xl p-6 text-center hover:border-[#F59E0B]/40 hover:shadow-sm transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center mx-auto mb-4">
                    <Icon size={20} className="text-[#F59E0B]" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">{industry.title}</h3>
                  <p className="text-[12px] text-[#9CA3AF]">{industry.subtitle}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-block text-[13px] font-semibold text-[#F59E0B] tracking-widest uppercase mb-4">
              Pricing
            </span>
            <h2 className="text-[clamp(28px,4vw,42px)] font-bold tracking-tight text-[#0A0A0A] mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-[16px] text-[#6B7280] max-w-md mx-auto">
              Start free. Scale as you grow. No hidden fees.
            </p>
          </AnimatedSection>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.05 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start"
          >
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                variants={cardVariants}
                className={`relative rounded-2xl p-7 flex flex-col ${
                  plan.highlight
                    ? 'bg-[#0A0A0A] border-2 border-[#F59E0B] shadow-[0_0_40px_rgba(245,158,11,0.15)]'
                    : 'bg-white border border-[#E5E7EB]'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-[11px] font-bold bg-[#F59E0B] text-white tracking-wide uppercase whitespace-nowrap">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6 mt-2">
                  <h3
                    className={`text-[16px] font-bold mb-3 ${plan.highlight ? 'text-white' : 'text-[#0A0A0A]'}`}
                  >
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-[clamp(28px,4vw,36px)] font-extrabold leading-none ${
                        plan.highlight ? 'text-[#F59E0B]' : 'text-[#0A0A0A]'
                      }`}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className={`text-[14px] font-medium ${plan.highlight ? 'text-white/50' : 'text-[#9CA3AF]'}`}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                </div>

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <Check
                        size={14}
                        className={`flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-[#F59E0B]' : 'text-[#F59E0B]'}`}
                      />
                      <span
                        className={`text-[13px] leading-snug ${plan.highlight ? 'text-white/70' : 'text-[#374151]'}`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <motion.a
                  href={plan.ctaHref}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-[14px] transition-all duration-200 ${
                    plan.highlight
                      ? 'bg-[#F59E0B] text-[#0A0A0A] hover:bg-[#D97706]'
                      : 'bg-[#0A0A0A] text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight size={14} />
                </motion.a>
              </motion.div>
            ))}
          </motion.div>

          {/* Trust line */}
          <AnimatedSection delay={0.3} className="text-center mt-10">
            <p className="text-[13px] text-[#9CA3AF]">
              Start Converting Leads Today · No credit card required · Setup takes 5 minutes
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-20 px-6 bg-[#F59E0B] relative overflow-hidden">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,0,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <AnimatedSection>
            <h2 className="text-[clamp(28px,5vw,52px)] font-extrabold text-white mb-5 leading-tight"
                style={{ letterSpacing: '-0.03em' }}>
              Ready to turn visitors into leads?
            </h2>
            <p className="text-[16px] text-white/80 mb-8 leading-relaxed">
              Set up in 5 minutes. No developer needed. Your first leads captured today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.a
                href="/contact"
                whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-8 py-4 rounded-full font-semibold text-[15px]"
              >
                Get Started — Free <ArrowRight size={16} />
              </motion.a>
              <motion.a
                href="#pricing"
                whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.15)' }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 border-2 border-white/60 text-white px-8 py-4 rounded-full font-semibold text-[15px]"
              >
                See All Plans
              </motion.a>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </>
  )
}
```

- [ ] Git commit

```bash
git add src/pages/LeadGeneratorPage.jsx
git commit -m "feat: add LeadGeneratorPage with hero, features, industries, pricing, and CTA"
```

---

## Final Verification Checklist

- [ ] `npm run dev` starts without errors
- [ ] `/` loads homepage with all sections
- [ ] `/services` renders ServicesPage
- [ ] `/about` renders AboutPage
- [ ] `/team` renders TeamPage
- [ ] `/contact` and `/StartConversation` both render ContactPage
- [ ] `/lead-generator` renders LeadGeneratorPage
- [ ] Navbar links use `<Link>` and active route gets amber text
- [ ] Navbar adapts correctly on homepage (transparent) vs. inner pages (frosted immediately)
- [ ] Footer quick links navigate without full-page reload
- [ ] Scrolling to top on each route change works (Layout `useEffect`)
- [ ] `Button` component uses `<Link>` for internal hrefs — no full-page reload
- [ ] Contact form opens `mailto:` on submit; success state renders correctly
- [ ] LeadGeneratorPage pricing section Growth card has amber border and dark background
- [ ] `vite.config.js` has `server.historyApiFallback: true` — direct URL access works in dev

---

## Dependency Summary

| Package | Version | Purpose |
|---|---|---|
| `react-router-dom` | `^6` | Client-side routing |

All other dependencies (`framer-motion`, `lucide-react`, `lenis`) already installed.
