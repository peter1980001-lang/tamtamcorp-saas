# Stitch Redesign — Plan A: Foundation & Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the amber/white design system with the Stitch dark/purple "Cinematic Intelligence" system — fonts, colors, Tailwind config, and all shared components.

**Architecture:** Update design tokens first, then every shared component. Pages stay untouched until Plan B/C. Site will look broken mid-way — that's expected.

**Tech Stack:** Vite + React JSX, Tailwind CSS v3, Framer Motion, React Router v6
**Project root:** `C:\Users\ibrah\Documents\tamtamcorp-website\`

---

### Task 1: Fonts + CSS foundation

**Files:**
- Modify: `index.html`
- Modify: `src/styles/index.css`

- [ ] **Replace font imports in `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TamTam Corp — AI Systems that turn conversations into revenue</title>
    <meta name="description" content="TamTam builds intelligent automation that captures leads, qualifies prospects, schedules meetings, and routes opportunities — automatically." />
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Replace `src/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  *, *::before, *::after { box-sizing: border-box; }

  html { scroll-behavior: smooth; }

  body {
    background-color: #131313;
    color: #E2E2E2;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    margin: 0;
  }

  ::selection {
    background: rgba(109, 40, 217, 0.4);
    color: #E2E2E2;
  }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #0e0e0e; }
  ::-webkit-scrollbar-thumb { background: #6D28D9; border-radius: 3px; }
}

@layer utilities {
  .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
  .font-mono-label { font-family: 'Space Grotesk', monospace; }
  .glow-primary { text-shadow: 0 0 40px rgba(211, 187, 255, 0.3); }
  .glow-box { box-shadow: 0 0 24px rgba(109, 40, 217, 0.4); }
  .glass { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
}
```

- [ ] **Run dev server and confirm dark background loads**

```bash
cd C:\Users\ibrah\Documents\tamtamcorp-website
npm run dev
```

Expected: site background is `#131313`, fonts change to Plus Jakarta Sans/Inter.

- [ ] **Commit**

```bash
git add index.html src/styles/index.css
git commit -m "feat: apply Stitch dark foundation — fonts and base CSS"
```

---

### Task 2: Tailwind config

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Replace `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        label: ['"Space Grotesk"', 'monospace'],
      },
      colors: {
        noir: {
          DEFAULT: '#131313',
          low: '#1b1b1b',
          card: '#2a2a2a',
          high: '#353535',
          deep: '#0e0e0e',
        },
        iris: {
          DEFAULT: '#D3BBFF',
          deep: '#6D28D9',
          dim: '#C3C0FF',
          glow: 'rgba(109,40,217,0.15)',
        },
        stone: {
          DEFAULT: '#E2E2E2',
          dim: '#CCC3D7',
          muted: '#958DA1',
        },
      },
      backgroundImage: {
        'iris-gradient': 'linear-gradient(135deg, #6D28D9, #9333EA)',
        'iris-gradient-h': 'linear-gradient(90deg, #6D28D9, #9333EA)',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Commit**

```bash
git add tailwind.config.js
git commit -m "feat: add Stitch color tokens and font families to Tailwind"
```

---

### Task 3: Button component

**Files:**
- Modify: `src/components/ui/Button.jsx`

- [ ] **Replace `src/components/ui/Button.jsx`**

```jsx
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const variants = {
  primary: 'bg-iris-gradient text-white font-label tracking-wide hover:shadow-[0_0_24px_rgba(109,40,217,0.5)] hover:brightness-110',
  ghost: 'border border-iris/30 text-iris hover:bg-iris/10 font-label tracking-wide',
  'ghost-white': 'border border-white/20 text-white/70 hover:bg-white/10 hover:text-white font-label tracking-wide',
  dark: 'bg-noir-deep text-stone hover:bg-noir-card font-label tracking-wide',
}

const MotionLink = motion(Link)

export default function Button({ children, variant = 'primary', href, onClick, className = '', size = 'md' }) {
  const sizeClass = size === 'sm' ? 'px-4 py-2 text-xs' : size === 'lg' ? 'px-8 py-4 text-sm' : 'px-6 py-3 text-sm'
  const base = `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 cursor-pointer ${sizeClass}`
  const cls = `${base} ${variants[variant] ?? variants.primary} ${className}`

  if (href) {
    const isInternal = href.startsWith('/')
    if (isInternal) {
      return <MotionLink to={href} className={cls} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>{children}</MotionLink>
    }
    return <motion.a href={href} target="_blank" rel="noopener noreferrer" className={cls} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>{children}</motion.a>
  }

  return <motion.button onClick={onClick} className={cls} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>{children}</motion.button>
}
```

- [ ] **Commit**

```bash
git add src/components/ui/Button.jsx
git commit -m "feat: update Button to Stitch purple gradient + ghost variants"
```

---

### Task 4: PageHero component

**Files:**
- Modify: `src/components/ui/PageHero.jsx`

- [ ] **Replace `src/components/ui/PageHero.jsx`**

```jsx
import { motion } from 'framer-motion'

export default function PageHero({ label, title, subtitle, children }) {
  return (
    <section className="relative bg-noir-deep pt-40 pb-32 px-6 overflow-hidden">
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(211,187,255,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Purple radial glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        <div
          className="w-[700px] h-[350px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(109,40,217,0.18) 0%, transparent 70%)' }}
        />
      </motion.div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {label && (
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block font-label text-[11px] font-semibold text-iris tracking-[0.25em] uppercase mb-6"
          >
            {label}
          </motion.span>
        )}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-[clamp(36px,6vw,68px)] font-extrabold text-stone leading-[1.05] mb-6 glow-primary"
          style={{ letterSpacing: '-0.03em' }}
        >
          {title}
        </motion.h1>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="w-16 h-px bg-gradient-to-r from-transparent via-iris to-transparent mx-auto mb-6"
        />
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="text-[17px] text-stone-dim leading-relaxed max-w-2xl mx-auto"
          >
            {subtitle}
          </motion.p>
        )}
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

      {/* Bottom fade into noir */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: '40%', background: 'linear-gradient(to bottom, transparent 0%, rgba(19,19,19,0.6) 60%, #131313 100%)' }}
      />
    </section>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/ui/PageHero.jsx
git commit -m "feat: update PageHero to Stitch purple glow + dark bottom fade"
```

---

### Task 5: Navbar

**Files:**
- Modify: `src/components/layout/Navbar.jsx`

- [ ] **Replace `src/components/layout/Navbar.jsx`**

```jsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const links = [
  { label: 'Services', href: '/services' },
  { label: 'Process', href: '/#process' },
  { label: 'About', href: '/about' },
  { label: 'How We Decide', href: '/HowWeDecide' },
  { label: 'Team', href: '/OurTeam' },
  { label: 'Contact', href: '/StartConversation' },
]

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  const isActive = (href) => href === pathname || (href !== '/' && pathname.startsWith(href))

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="fixed top-0 left-0 right-0 z-50 bg-noir-deep/80 glass border-b border-iris-deep/20"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <motion.div
            className="w-2 h-2 rounded-full bg-iris-deep"
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="font-display text-[18px] font-black tracking-tight">
            <span className="text-stone">Tam Tam </span>
            <span className="text-iris">Corp</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-7">
          {links.map(link => (
            <motion.div key={link.label} className="relative py-1" whileHover="hover">
              <Link
                to={link.href}
                className={`text-[13px] font-medium transition-colors duration-200 ${
                  isActive(link.href) ? 'text-iris' : 'text-stone-dim hover:text-stone'
                }`}
              >
                {link.label}
              </Link>
              <motion.span
                className="absolute bottom-0 left-0 h-px bg-iris rounded-full"
                initial={{ width: 0 }}
                variants={{ hover: { width: '100%' } }}
                transition={{ duration: 0.2 }}
              />
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden lg:block">
          <Link
            to="/StartConversation"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold font-label tracking-wide text-white bg-iris-gradient hover:brightness-110 hover:shadow-[0_0_20px_rgba(109,40,217,0.5)] transition-all duration-200"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="lg:hidden p-2 text-stone-dim hover:text-stone transition-colors"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="lg:hidden bg-noir-deep/95 glass border-b border-iris-deep/20 px-6 py-5 flex flex-col gap-4"
          >
            {links.map(link => (
              <Link
                key={link.label}
                to={link.href}
                className="text-[14px] font-medium text-stone-dim hover:text-stone transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/StartConversation"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-[13px] font-semibold font-label tracking-wide text-white bg-iris-gradient"
              onClick={() => setMenuOpen(false)}
            >
              Get Started
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/layout/Navbar.jsx
git commit -m "feat: update Navbar to Stitch dark glass + purple accent + correct links"
```

---

### Task 6: Footer

**Files:**
- Modify: `src/components/layout/Footer.jsx`

- [ ] **Replace `src/components/layout/Footer.jsx`**

```jsx
import { Link } from 'react-router-dom'

const quickLinks = [
  { label: 'Services', href: '/services' },
  { label: 'Process', href: '/#process' },
  { label: 'Resources', href: '/resources' },
  { label: 'Contact', href: '/StartConversation' },
]

const legalLinks = [
  { label: 'Privacy Policy', href: '/PrivacyPolicy' },
  { label: 'Terms of Service', href: '/Terms' },
  { label: 'Data & Security', href: '/DataSecurity' },
  { label: 'How We Decide', href: '/HowWeDecide' },
  { label: 'Selective Outreach', href: '/SelectiveOutreach' },
]

export default function Footer() {
  return (
    <footer className="bg-noir-deep text-stone px-6 py-20 border-t border-iris-deep/10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div>
            <div className="font-display font-black text-lg mb-3 tracking-tight">
              <span className="text-stone">Tam Tam </span>
              <span className="text-iris">Corp</span>
            </div>
            <p className="text-stone-dim text-sm leading-relaxed mb-4">
              AI-powered business process automation for modern companies.
            </p>
            <p className="text-stone-muted text-xs">© 2026 Tam Tam Corp FZE LLC. All rights reserved.</p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-label text-xs font-semibold text-stone/60 tracking-widest uppercase mb-5">Quick Links</h4>
            <ul className="flex flex-col gap-3">
              {quickLinks.map(link => (
                <li key={link.label}>
                  <Link to={link.href} className="text-stone-dim text-sm hover:text-iris transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-label text-xs font-semibold text-stone/60 tracking-widest uppercase mb-5">Legal</h4>
            <ul className="flex flex-col gap-3">
              {legalLinks.map(link => (
                <li key={link.label}>
                  <Link to={link.href} className="text-stone-dim text-sm hover:text-iris transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-label text-xs font-semibold text-stone/60 tracking-widest uppercase mb-5">Contact</h4>
            <div className="flex flex-col gap-3 text-sm">
              <span className="text-stone-dim">Ajman, United Arab Emirates</span>
              <a href="tel:+971588737467" className="text-stone-dim hover:text-iris transition-colors">Tel: +971 58 873 7467</a>
              <a href="https://wa.me/971588737467" className="text-stone-dim hover:text-iris transition-colors">WhatsApp: +971 58 873 7467</a>
              <a href="mailto:info@tamtamcorp.online" className="text-stone-dim hover:text-iris transition-colors">info@tamtamcorp.online</a>
            </div>
          </div>
        </div>

        <div className="border-t border-iris-deep/10 pt-8 text-center">
          <p className="text-stone-muted text-xs">Trade License No. 262705457888 • Ajman, UAE</p>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/layout/Footer.jsx
git commit -m "feat: update Footer to Stitch dark + purple + correct all links"
```

---

### Task 7: Layout + AnimatedSection

**Files:**
- Modify: `src/components/layout/Layout.jsx`
- Verify: `src/components/ui/AnimatedSection.jsx` (no changes needed — check it still works)

- [ ] **Update `src/components/layout/Layout.jsx` — remove bg-white**

Open the file and change any `bg-white` or `bg-[#fff]` reference on the wrapper div to `bg-noir`. The main wrapper should be:

```jsx
<div className="min-h-screen bg-noir font-sans">
```

- [ ] **Verify dev server — full layout looks correct**

```bash
npm run dev
```

Expected: dark navbar at top, dark footer at bottom, dark body background throughout.

- [ ] **Commit**

```bash
git add src/components/layout/Layout.jsx
git commit -m "feat: update Layout background to Stitch dark"
```

---

### Task 8: Routing — App.jsx

**Files:**
- Modify: `src/App.jsx`
- Create (empty placeholder): `src/pages/ResourcesPage.jsx`, `src/pages/PrivacyPolicyPage.jsx`, `src/pages/TermsPage.jsx`, `src/pages/DataSecurityPage.jsx`, `src/pages/HowWeDecidePage.jsx`, `src/pages/SelectiveOutreachPage.jsx`

- [ ] **Create placeholder for each new page** (replace in Plan C)

Each file:
```jsx
// Placeholder — implemented in Plan C
export default function PlaceholderPage() {
  return <div className="pt-40 px-6 text-center text-stone-dim">Coming soon...</div>
}
```

Create these 6 files:
- `src/pages/ResourcesPage.jsx`
- `src/pages/PrivacyPolicyPage.jsx`
- `src/pages/TermsPage.jsx`
- `src/pages/DataSecurityPage.jsx`
- `src/pages/HowWeDecidePage.jsx`
- `src/pages/SelectiveOutreachPage.jsx`

- [ ] **Replace `src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import ServicesPage from './pages/ServicesPage'
import AboutPage from './pages/AboutPage'
import TeamPage from './pages/TeamPage'
import ContactPage from './pages/ContactPage'
import LeadGeneratorPage from './pages/LeadGeneratorPage'
import ResourcesPage from './pages/ResourcesPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsPage from './pages/TermsPage'
import DataSecurityPage from './pages/DataSecurityPage'
import HowWeDecidePage from './pages/HowWeDecidePage'
import SelectiveOutreachPage from './pages/SelectiveOutreachPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/OurTeam" element={<TeamPage />} />
          <Route path="/StartConversation" element={<ContactPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/LeadGenerator" element={<LeadGeneratorPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/PrivacyPolicy" element={<PrivacyPolicyPage />} />
          <Route path="/Terms" element={<TermsPage />} />
          <Route path="/DataSecurity" element={<DataSecurityPage />} />
          <Route path="/HowWeDecide" element={<HowWeDecidePage />} />
          <Route path="/SelectiveOutreach" element={<SelectiveOutreachPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Run dev server — confirm all routes load without 404**

```bash
npm run dev
```

Visit `/`, `/services`, `/about`, `/OurTeam`, `/StartConversation`, `/LeadGenerator` — all should render (old or placeholder content). No white screens.

- [ ] **Commit**

```bash
git add src/App.jsx src/pages/ResourcesPage.jsx src/pages/PrivacyPolicyPage.jsx src/pages/TermsPage.jsx src/pages/DataSecurityPage.jsx src/pages/HowWeDecidePage.jsx src/pages/SelectiveOutreachPage.jsx
git commit -m "feat: update routing — correct live URLs + add all new routes"
```

---

### Task 9: Build check

- [ ] **Run build to confirm zero errors**

```bash
npm run build
```

Expected: build succeeds with no errors. Warnings about unused variables are OK.

- [ ] **Commit if any fixes needed, otherwise Plan A is complete**

```bash
git commit -m "fix: resolve any build errors from Plan A"
```

**Plan A complete. Proceed to Plan B (priority pages: Homepage, Team, About).**
