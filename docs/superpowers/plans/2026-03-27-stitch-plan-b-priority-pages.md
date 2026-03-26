# Stitch Redesign — Plan B: Priority Pages (Homepage, Team, About)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Run Plan A first.

**Goal:** Implement the three highest-priority pages in the Stitch dark/purple design with all content verbatim from tamtamcorp.tech.

**Architecture:** Each page is a standalone JSX file. No new shared components needed — use Button, PageHero, AnimatedSection from Plan A.

**Tech Stack:** Vite + React JSX, Tailwind CSS v3 (with Stitch tokens from Plan A), Framer Motion, Lucide React
**Project root:** `C:\Users\ibrah\Documents\tamtamcorp-website\`

---

### Task 1: Homepage

**Files:**
- Modify: `src/pages/HomePage.jsx` (full rewrite — no longer delegates to ScrollTheaterPage)

- [ ] **Replace `src/pages/HomePage.jsx`**

```jsx
import { motion } from 'framer-motion'
import { ArrowRight, Zap, MessageSquare, Calendar, BarChart3, Shield, Eye } from 'lucide-react'
import AnimatedSection from '../components/ui/AnimatedSection'
import { Link } from 'react-router-dom'

// ─── Hero ────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen bg-noir-deep flex flex-col items-center justify-center px-6 pt-16 overflow-hidden">
      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(rgba(211,187,255,0.05) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      {/* Radial purple glow */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[900px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(109,40,217,0.14) 0%, transparent 65%)' }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-3 mb-8 px-4 py-2 rounded-full bg-noir-card border border-iris-deep/30"
        >
          <span className="flex items-center gap-1.5 font-label text-[11px] tracking-[0.2em] text-stone-muted uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-iris-deep" />
            System Alpha
          </span>
          <span className="w-px h-3 bg-stone-muted/30" />
          <span className="font-label text-[11px] tracking-[0.2em] text-iris uppercase">Active Nodes: 1,024</span>
          <span className="w-px h-3 bg-stone-muted/30" />
          <span className="flex items-center gap-1 font-label text-[11px] text-emerald-400 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Operational
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="font-display font-black text-[clamp(52px,8vw,96px)] text-stone leading-[0.95] mb-6 glow-primary"
          style={{ letterSpacing: '-0.04em' }}
        >
          Intelligence<br />
          <span className="text-iris">Redefined</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="text-[clamp(16px,2vw,20px)] text-stone-dim leading-relaxed max-w-2xl mx-auto mb-10"
        >
          Synthesizing raw data into autonomous revenue engines.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/StartConversation"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-label font-semibold text-[14px] tracking-wide text-white bg-iris-gradient hover:brightness-110 hover:shadow-[0_0_28px_rgba(109,40,217,0.55)] transition-all duration-200"
          >
            Request Live Demo <ArrowRight size={16} />
          </Link>
          <Link
            to="/services"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-label font-semibold text-[14px] tracking-wide text-iris border border-iris/30 hover:bg-iris/10 transition-all duration-200"
          >
            View the System
          </Link>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #131313)' }} />
    </section>
  )
}

// ─── Three Systems ────────────────────────────────────────────────────────────
const systems = [
  {
    number: '01',
    title: 'AI Lead Engine',
    description: 'Captures website visitors and converts them into qualified leads automatically.',
    insight: 'Never miss a prospect — your site works 24/7.',
    icon: Zap,
  },
  {
    number: '02',
    title: 'Conversation AI',
    description: 'Handles inquiries, qualifies prospects, and routes them to the right team.',
    insight: 'Every conversation moves toward a decision.',
    icon: MessageSquare,
  },
  {
    number: '03',
    title: 'Revenue Orchestration',
    description: 'Automates scheduling, follow-ups, and lead routing so sales teams focus only on high-value prospects.',
    insight: 'Your pipeline fills itself. Your team closes.',
    icon: Calendar,
  },
]

function ThreeSystems() {
  return (
    <section className="py-32 px-6 bg-noir">
      <div className="max-w-6xl mx-auto">
        <AnimatedSection className="text-center mb-20">
          <span className="font-label text-[11px] font-semibold text-iris tracking-[0.25em] uppercase block mb-4">The System</span>
          <h2 className="font-display font-bold text-[clamp(32px,5vw,56px)] text-stone mb-4" style={{ letterSpacing: '-0.03em' }}>
            Three systems.<br />One revenue engine.
          </h2>
          <p className="text-[16px] text-stone-dim max-w-xl mx-auto">
            Built to work together — from first touch to closed deal.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-6">
          {systems.map((s, i) => {
            const Icon = s.icon
            return (
              <AnimatedSection key={i} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="bg-noir-card rounded-2xl p-8 h-full flex flex-col group"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span className="font-label text-[12px] font-semibold text-iris-deep tracking-widest">{s.number}</span>
                    <div className="flex-1 h-px bg-iris-deep/20" />
                    <div className="w-9 h-9 rounded-xl bg-iris-deep/15 flex items-center justify-center">
                      <Icon size={16} className="text-iris" />
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-[20px] text-stone mb-3">{s.title}</h3>
                  <p className="text-[14px] text-stone-dim leading-relaxed flex-1 mb-5">{s.description}</p>
                  <p className="font-label text-[12px] text-iris tracking-wide">→ {s.insight}</p>
                </motion.div>
              </AnimatedSection>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Process ─────────────────────────────────────────────────────────────────
const steps = [
  { number: '01', title: 'Visitor starts a conversation', description: 'A prospect lands on your site and engages — your AI is ready instantly, 24/7.' },
  { number: '02', title: 'AI understands intent', description: 'The system interprets context, asks smart questions, and identifies what the prospect actually needs.' },
  { number: '03', title: 'Lead is qualified automatically', description: 'Scoring, routing rules, and qualification criteria are applied in real time — no manual review.' },
  { number: '04', title: 'Meeting or action is triggered', description: 'A booking is confirmed, a follow-up is sent, or a sales alert fires — whatever fits your workflow.' },
]

function Process() {
  return (
    <section id="process" className="py-32 px-6 bg-noir-low">
      <div className="max-w-6xl mx-auto">
        <AnimatedSection className="text-center mb-20">
          <span className="font-label text-[11px] font-semibold text-iris tracking-[0.25em] uppercase block mb-4">The Process</span>
          <h2 className="font-display font-bold text-[clamp(32px,5vw,52px)] text-stone mb-4" style={{ letterSpacing: '-0.03em' }}>
            How it works
          </h2>
          <p className="text-[16px] text-stone-dim max-w-lg mx-auto">
            From first message to qualified opportunity — fully automated.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <AnimatedSection key={i} delay={i * 0.1}>
              <div className="bg-noir-card rounded-2xl p-7 h-full">
                <span className="font-label text-[28px] font-bold text-iris-deep/30 block mb-4">{step.number}</span>
                <h3 className="font-display font-semibold text-[16px] text-stone mb-3 leading-snug">{step.title}</h3>
                <p className="text-[13px] text-stone-dim leading-relaxed">{step.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard() {
  return (
    <section id="demo" className="py-32 px-6 bg-noir">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <AnimatedSection>
            <span className="font-label text-[11px] font-semibold text-iris tracking-[0.25em] uppercase block mb-4">The Dashboard</span>
            <h2 className="font-display font-bold text-[clamp(28px,4vw,48px)] text-stone mb-6" style={{ letterSpacing: '-0.03em' }}>
              See every conversation become an opportunity.
            </h2>
            <p className="text-[16px] text-stone-dim leading-relaxed mb-8">
              Your dashboard shows every lead, every score, every booked meeting — in real time.
            </p>
            <div className="space-y-3 mb-8">
              {[
                { icon: BarChart3, label: 'Lead Scoring', desc: 'Every lead ranked automatically by intent and fit.' },
                { icon: MessageSquare, label: 'Conversation History', desc: 'Full audit trail of every AI interaction.' },
                { icon: Calendar, label: 'Appointment Scheduling', desc: 'Bookings confirmed without human involvement.' },
                { icon: Eye, label: 'AI Insights', desc: 'Qualification notes and next-step recommendations.' },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-iris-deep/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon size={14} className="text-iris" />
                    </div>
                    <div>
                      <span className="text-[14px] font-semibold text-stone">{item.label}</span>
                      <span className="text-[13px] text-stone-dim ml-2">{item.desc}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <Link
              to="/StartConversation"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-label font-semibold text-[13px] tracking-wide text-white bg-iris-gradient hover:brightness-110 hover:shadow-[0_0_24px_rgba(109,40,217,0.5)] transition-all"
            >
              Book a Live Demo <ArrowRight size={14} />
            </Link>
          </AnimatedSection>

          {/* Mock dashboard card */}
          <AnimatedSection delay={0.15}>
            <div className="bg-noir-card rounded-2xl p-6 border border-iris-deep/20">
              <div className="flex items-center justify-between mb-6">
                <span className="font-label text-[11px] text-iris tracking-widest uppercase">TamTam · Live Dashboard</span>
                <span className="flex items-center gap-1.5 font-label text-[11px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Leads Today', value: '24', change: '+12%' },
                  { label: 'Qualified', value: '11', change: '+8%' },
                  { label: 'Meetings', value: '5', change: '+3' },
                ].map((stat, i) => (
                  <div key={i} className="bg-noir-high rounded-xl p-4">
                    <p className="font-display font-black text-[26px] text-stone leading-none mb-1">{stat.value}</p>
                    <p className="font-label text-[10px] text-stone-dim tracking-wide uppercase mb-1">{stat.label}</p>
                    <p className="font-label text-[11px] text-emerald-400">{stat.change}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-label text-[11px] text-stone-muted tracking-widest uppercase">Recent Leads</span>
                  <span className="font-label text-[11px] text-iris">View all →</span>
                </div>
                {[
                  { name: 'Sarah M.', industry: 'Real Estate', score: 'hot' },
                  { name: 'James K.', industry: 'Healthcare', score: 'warm' },
                  { name: 'Priya N.', industry: 'SaaS', score: 'warm' },
                  { name: 'Omar F.', industry: 'Consulting', score: 'cold' },
                ].map((lead, i) => {
                  const scoreColor = lead.score === 'hot' ? 'text-orange-400 bg-orange-400/10' : lead.score === 'warm' ? 'text-yellow-400 bg-yellow-400/10' : 'text-stone-muted bg-noir-high'
                  return (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-iris-deep/10 last:border-0">
                      <div>
                        <p className="text-[13px] font-semibold text-stone">{lead.name}</p>
                        <p className="text-[11px] text-stone-dim">{lead.industry}</p>
                      </div>
                      <span className={`font-label text-[10px] px-2 py-1 rounded-full tracking-wide uppercase ${scoreColor}`}>{lead.score}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  )
}

// ─── Industries ───────────────────────────────────────────────────────────────
const industries = [
  { tag: 'Professional Services', title: 'Convert consultations into clients', description: 'Law firms, accounting practices, and advisory firms use TamTam to qualify inbound leads before any human time is spent.' },
  { tag: 'Real Estate', title: 'Qualify buyers before your agents engage', description: 'Developers and brokers automate initial property inquiries, schedule viewings, and route high-intent prospects instantly.' },
  { tag: 'Clinics & Healthcare', title: 'Fill your schedule without admin overhead', description: 'Clinics and wellness centres capture patient inquiries, pre-qualify bookings, and reduce front-desk workload.' },
  { tag: 'Consultants & Agencies', title: 'Stop losing leads after hours', description: 'Agencies deploy TamTam to handle inbound overnight, qualify project fit, and book discovery calls automatically.' },
]

function Industries() {
  return (
    <section className="py-32 px-6 bg-noir-low">
      <div className="max-w-6xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <span className="font-label text-[11px] font-semibold text-iris tracking-[0.25em] uppercase block mb-4">Built For</span>
          <h2 className="font-display font-bold text-[clamp(28px,4vw,48px)] text-stone" style={{ letterSpacing: '-0.03em' }}>
            Industries where leads matter most.
          </h2>
        </AnimatedSection>
        <div className="grid md:grid-cols-2 gap-6">
          {industries.map((ind, i) => (
            <AnimatedSection key={i} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -3 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="bg-noir-card rounded-2xl p-8"
              >
                <span className="font-label text-[11px] font-semibold text-iris tracking-[0.2em] uppercase block mb-4">{ind.tag}</span>
                <h3 className="font-display font-bold text-[20px] text-stone mb-3 leading-snug">{ind.title}</h3>
                <p className="text-[14px] text-stone-dim leading-relaxed">{ind.description}</p>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Trust ────────────────────────────────────────────────────────────────────
function Trust() {
  return (
    <section className="py-24 px-6 bg-noir">
      <div className="max-w-4xl mx-auto">
        <AnimatedSection className="text-center mb-12">
          <h2 className="font-display font-bold text-[clamp(24px,3vw,36px)] text-stone mb-2" style={{ letterSpacing: '-0.02em' }}>
            Built with trust in mind.
          </h2>
          <p className="text-[14px] text-stone-dim mb-1">Enterprise-grade responsibility without enterprise complexity.</p>
          <Link to="/DataSecurity" className="font-label text-[12px] text-iris tracking-wide hover:text-iris-dim transition-colors">
            View Data & Security policy →
          </Link>
        </AnimatedSection>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Shield, title: 'Human oversight', desc: 'AI handles intake and qualification. All final decisions remain with your team.' },
            { icon: Eye, title: 'Data protection', desc: 'Conversation data is handled responsibly, stored securely, and never shared with third parties.' },
            { icon: Zap, title: 'Responsible AI', desc: 'Every automation is explainable and auditable. No black boxes in our systems.' },
          ].map((item, i) => {
            const Icon = item.icon
            return (
              <AnimatedSection key={i} delay={i * 0.08}>
                <div className="bg-noir-card rounded-2xl p-7">
                  <div className="w-10 h-10 rounded-xl bg-iris-deep/15 flex items-center justify-center mb-4">
                    <Icon size={18} className="text-iris" />
                  </div>
                  <h3 className="font-display font-semibold text-[15px] text-stone mb-2">{item.title}</h3>
                  <p className="text-[13px] text-stone-dim leading-relaxed">{item.desc}</p>
                </div>
              </AnimatedSection>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Philosophy ───────────────────────────────────────────────────────────────
function Philosophy() {
  return (
    <section className="py-32 px-6 bg-noir-low">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <AnimatedSection>
            <span className="font-label text-[11px] font-semibold text-iris tracking-[0.25em] uppercase block mb-4">The Philosophy</span>
            <h2 className="font-display font-bold text-[clamp(28px,4vw,48px)] text-stone mb-6" style={{ letterSpacing: '-0.03em' }}>
              Built on principles,<br />not promises.
            </h2>
            <p className="text-[16px] text-stone-dim leading-relaxed">
              TamTam is founder-led. Systems are designed and implemented personally — not delegated. One accountable point of responsibility from idea to execution.
            </p>
          </AnimatedSection>
          <div className="space-y-5">
            {[
              { number: '01', title: 'Automation follows clarity', desc: 'We define the process before automating it. Unclear workflows become expensive automations.' },
              { number: '02', title: 'AI executes — humans decide', desc: 'Our systems handle repetitive intelligence. Strategic decisions stay with your team.' },
              { number: '03', title: 'Systems must be explainable', desc: "If you can't understand why it works, you can't trust it. Every system we build is transparent." },
            ].map((p, i) => (
              <AnimatedSection key={i} delay={i * 0.1}>
                <div className="flex gap-5 bg-noir-card rounded-2xl p-6">
                  <span className="font-label font-bold text-[13px] text-iris-deep/60 flex-shrink-0 mt-0.5">{p.number}</span>
                  <div>
                    <h3 className="font-display font-semibold text-[15px] text-stone mb-1.5">{p.title}</h3>
                    <p className="text-[13px] text-stone-dim leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="py-32 px-6 bg-noir relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(109,40,217,0.12) 0%, transparent 65%)' }} />
      </div>
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <AnimatedSection>
          <span className="font-label text-[11px] font-semibold text-iris tracking-[0.25em] uppercase block mb-6">Start in days, not months</span>
          <h2 className="font-display font-black text-[clamp(32px,5vw,60px)] text-stone mb-5" style={{ letterSpacing: '-0.04em' }}>
            Turn your website into a<br />
            <span className="text-iris">24/7 sales system.</span>
          </h2>
          <p className="text-[17px] text-stone-dim leading-relaxed mb-10">
            Start capturing and qualifying leads automatically — no manual effort required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/LeadGenerator"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-label font-semibold text-[14px] tracking-wide text-white bg-iris-gradient hover:brightness-110 hover:shadow-[0_0_28px_rgba(109,40,217,0.55)] transition-all"
            >
              Start Free Demo <ArrowRight size={16} />
            </Link>
            <Link
              to="/StartConversation"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-label font-semibold text-[14px] tracking-wide text-iris border border-iris/30 hover:bg-iris/10 transition-all"
            >
              Talk to Sales
            </Link>
          </div>
        </AnimatedSection>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <>
      <Hero />
      <ThreeSystems />
      <Process />
      <Dashboard />
      <Industries />
      <Trust />
      <Philosophy />
      <FinalCTA />
    </>
  )
}
```

- [ ] **Run dev server — visit `/` and verify**

```bash
npm run dev
```

Expected: Dark homepage with purple hero "Intelligence Redefined", three systems cards, process steps, dashboard mockup, industries, trust, philosophy, and CTA.

- [ ] **Commit**

```bash
git add src/pages/HomePage.jsx
git commit -m "feat: implement Stitch homepage — Cinematic Intelligence dark design"
```

---

### Task 2: Team page (`/OurTeam`) ⭐ PRIORITY

**Files:**
- Modify: `src/pages/TeamPage.jsx` (full rewrite)
- Create: `src/assets/team/` (directory — photos go here when ready)

- [ ] **Replace `src/pages/TeamPage.jsx`**

```jsx
import { motion } from 'framer-motion'
import PageHero from '../components/ui/PageHero'
import AnimatedSection from '../components/ui/AnimatedSection'

// Photo imports — add real photos to src/assets/team/ with these filenames
// import ceoPic from '../assets/team/role-ceo.jpg'
// import aiPic from '../assets/team/role-ai.jpg'
// etc. Uncomment and replace null below when photos are ready.

const roles = [
  {
    id: 'ceo',
    role: 'CEO & Founder',
    focus: 'Strategy · Vision · Responsibility',
    description: 'Strategy, vision, and responsibility come together here. Every decision, every system, and every project carries my personal signature.',
    quote: 'If something works, I stand behind it. If it doesn\'t — I do too.',
    photo: null, // replace with ceoPic
    featured: true,
  },
  {
    id: 'ai',
    role: 'Head of AI',
    focus: 'Automation · Agents · Systems Design',
    description: 'AI is not a buzzword here — it\'s a tool. This is where automation, agents, and systems are designed to solve real problems, reliably and at scale.',
    quote: 'Nothing is automated unless I fully understand it.',
    photo: null, // replace with aiPic
    featured: false,
  },
  {
    id: 'analyst',
    role: 'Analyst & Strategy',
    focus: 'Data · Processes · Structures',
    description: 'Data, processes, and structures are analyzed before decisions are made. No guesswork — only clarity and informed choices.',
    quote: 'Without analysis, every idea is just a feeling.',
    photo: null,
    featured: false,
  },
  {
    id: 'ops',
    role: 'Operations & Project Lead',
    focus: 'Architecture · Coordination · Delivery',
    description: 'Ideas mean nothing without execution. This role ensures projects are planned, coordinated, and delivered — consistently and reliably.',
    quote: 'A promise made is a promise kept.',
    photo: null,
    featured: false,
  },
  {
    id: 'support',
    role: 'Support',
    focus: 'Direct · Reachable · Problem-solving',
    description: 'Support is not a ticket system — it\'s a person. Direct, reachable, and focused on solving problems without detours.',
    quote: 'Yes, that\'s really me. And yes, I do answer.',
    photo: null,
    featured: false,
  },
  {
    id: 'aibo',
    role: 'AI.bo – Assisted Intake',
    focus: 'Intake · Classification · Routing',
    description: 'AI.bo handles first intake, classification, and routing. Decisions and approvals remain human. Available as part of consulting engagements.',
    quote: 'I assist. I don\'t decide.',
    photo: null,
    featured: false,
  },
  {
    id: 'office',
    role: 'Office Care',
    focus: 'Structure · Cleanliness · Order',
    description: 'Structure, cleanliness, and order are part of professional responsibility. Nothing here is outsourced — not even the basics.',
    quote: 'Yes. I handle this personally too.',
    photo: null,
    featured: false,
  },
]

function RoleCard({ item, index }) {
  return (
    <AnimatedSection delay={index * 0.08}>
      <motion.div
        whileHover={{ y: -6 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        className="bg-noir-card rounded-2xl overflow-hidden group h-full flex flex-col"
      >
        {/* Photo area */}
        <div className="relative h-72 overflow-hidden flex-shrink-0" style={{ background: '#1a1020' }}>
          {item.photo ? (
            <img
              src={item.photo}
              alt={item.role}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            // Placeholder — cinematic dark gradient with initials
            <div className="w-full h-full flex flex-col items-center justify-center"
              style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(109,40,217,0.25) 0%, #131313 70%)' }}>
              <div className="w-20 h-20 rounded-full border border-iris/20 bg-iris-deep/10 flex items-center justify-center mb-3">
                <span className="font-display font-black text-2xl text-iris">IS</span>
              </div>
              <span className="font-label text-[10px] text-stone-muted tracking-[0.25em] uppercase">Photo coming soon</span>
            </div>
          )}
          {/* Role badge overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4"
            style={{ background: 'linear-gradient(to top, rgba(10,6,20,0.95) 0%, transparent 100%)' }}>
            <span className="inline-flex items-center gap-2 font-label text-[11px] font-semibold text-iris tracking-[0.18em] uppercase">
              <span className="w-1 h-1 rounded-full bg-iris-deep" />
              {item.role}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-7 flex flex-col flex-1">
          <p className="font-label text-[11px] text-stone-muted tracking-widest uppercase mb-4">{item.focus}</p>
          <p className="text-[14px] text-stone-dim leading-relaxed flex-1 mb-5">{item.description}</p>
          {/* Quote */}
          <div className="flex gap-3 pt-5 border-t border-iris-deep/15">
            <div className="w-0.5 bg-iris-deep rounded-full flex-shrink-0" style={{ minHeight: '36px' }} />
            <p className="text-[13px] font-medium text-stone italic">"{item.quote}"</p>
          </div>
        </div>
      </motion.div>
    </AnimatedSection>
  )
}

export default function TeamPage() {
  const [featured, ...rest] = roles

  return (
    <>
      <PageHero
        label="Our Team"
        title="Many roles. One responsibility."
        subtitle="Tam Tam Corp is not an anonymous agency with interchangeable faces. Here, you always know who thinks, who builds, and who is accountable."
      />

      <section className="py-32 px-6 bg-noir">
        <div className="max-w-6xl mx-auto">

          {/* Featured card — CEO full width */}
          <AnimatedSection className="mb-8">
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="bg-noir-card rounded-2xl overflow-hidden group"
            >
              <div className="grid md:grid-cols-2">
                {/* Photo */}
                <div className="relative h-80 md:h-full overflow-hidden flex-shrink-0" style={{ background: '#100a1e', minHeight: '320px' }}>
                  {featured.photo ? (
                    <img
                      src={featured.photo}
                      alt={featured.role}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center"
                      style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(109,40,217,0.3) 0%, #0e0e0e 65%)' }}>
                      <div className="w-28 h-28 rounded-full border border-iris/25 bg-iris-deep/15 flex items-center justify-center mb-4">
                        <span className="font-display font-black text-4xl text-iris">IS</span>
                      </div>
                      <span className="font-label text-[11px] text-stone-muted tracking-[0.25em] uppercase">Photo coming soon</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-5"
                    style={{ background: 'linear-gradient(to top, rgba(10,6,20,0.95) 0%, transparent 100%)' }}>
                    <span className="inline-flex items-center gap-2 font-label text-[12px] font-semibold text-iris tracking-[0.18em] uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-iris-deep" />
                      {featured.role}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-10 flex flex-col justify-center">
                  <span className="font-label text-[11px] text-stone-muted tracking-widest uppercase mb-5">{featured.focus}</span>
                  <p className="text-[16px] text-stone-dim leading-relaxed mb-8">{featured.description}</p>
                  <div className="flex gap-4 pt-6 border-t border-iris-deep/15">
                    <div className="w-0.5 h-full bg-iris-deep rounded-full flex-shrink-0" style={{ minHeight: '44px' }} />
                    <div>
                      <p className="text-[16px] font-medium text-stone italic mb-2">"{featured.quote}"</p>
                      <p className="font-label text-[11px] text-stone-muted tracking-widest uppercase">Ibrahim Surucu — Founder</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatedSection>

          {/* Remaining 6 roles — 3 col grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
            {rest.map((item, i) => (
              <RoleCard key={item.id} item={item} index={i} />
            ))}
          </div>

          {/* Closing statement */}
          <AnimatedSection>
            <div className="relative bg-noir-card rounded-2xl px-12 py-16 text-center overflow-hidden">
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(109,40,217,0.12) 0%, transparent 60%)' }} />
              <p className="relative z-10 font-display font-bold text-[clamp(20px,3vw,32px)] text-stone leading-relaxed" style={{ letterSpacing: '-0.02em' }}>
                In the end, it's not about how big a team is —<br />
                <span className="text-iris">it's about how responsibly it works.</span>
              </p>
            </div>
          </AnimatedSection>

        </div>
      </section>
    </>
  )
}
```

- [ ] **Create assets/team directory for photos**

```bash
mkdir -p "C:\Users\ibrah\Documents\tamtamcorp-website\src\assets\team"
echo "# Add role photos here" > "C:\Users\ibrah\Documents\tamtamcorp-website\src\assets\team\README.md"
```

Expected filenames: `role-ceo.jpg`, `role-ai.jpg`, `role-analyst.jpg`, `role-ops.jpg`, `role-support.jpg`, `role-aibo.jpg`, `role-office.jpg`

- [ ] **Run dev server — visit `/OurTeam` and verify**

Expected: Dark page, CEO card full width on top with photo placeholder, then 2×3 grid of 6 role cards. Each card has large photo area (dark gradient with IS initials), role badge, focus line, description, and quote.

- [ ] **Commit**

```bash
git add src/pages/TeamPage.jsx src/assets/team/
git commit -m "feat: implement Team page — 7 roles with photo slots, Stitch dark design"
```

---

### Task 3: About page (`/about`)

**Files:**
- Modify: `src/pages/AboutPage.jsx` (full rewrite with exact live content)

- [ ] **Replace `src/pages/AboutPage.jsx`**

```jsx
import { motion } from 'framer-motion'
import { MessageSquare, Shield, Zap } from 'lucide-react'
import PageHero from '../components/ui/PageHero'
import AnimatedSection from '../components/ui/AnimatedSection'
import { Link } from 'react-router-dom'

const clientBenefits = [
  {
    icon: MessageSquare,
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

export default function AboutPage() {
  return (
    <>
      <PageHero
        label="About Tam Tam Corp"
        title="Founder-led. Detail-driven. Built from the inside."
        subtitle="Tam Tam Corp FZE LLC is a founder-led consultancy built and operated by Ibrahim Surucu, focusing on AI automation, systems design, and hands-on implementation."
      />

      {/* Origin story */}
      <section className="py-32 px-6 bg-noir">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
            <AnimatedSection>
              <h2 className="font-display font-bold text-[clamp(28px,4vw,44px)] text-stone mb-8 leading-tight" style={{ letterSpacing: '-0.03em' }}>
                From idea to implementation.
              </h2>
              <div className="space-y-5 text-[16px] text-stone-dim leading-relaxed">
                <p>
                  Tam Tam Corp FZE LLC is a founder-led consultancy built and operated by Ibrahim Surucu, focusing on AI automation, systems design, and hands-on implementation.
                </p>
                <p>
                  Systems are built personally by the founder, not delegated to teams. This means one identifiable human remains responsible for system design, decisions, and implementation from strategy to deployment — maintaining consistency between what is recommended and what is delivered.
                </p>
                <p>
                  Systems are designed to solve operational problems, not to showcase technology. The focus is on bridging business requirements with technical execution — building tools that teams actually use in daily operations. No theoretical solutions. Only implementations tested and maintained in production environments.
                </p>
              </div>

              {/* Accent callout */}
              <div className="mt-10 pt-8 border-t border-iris-deep/20">
                <p className="font-label font-semibold text-[11px] text-iris tracking-[0.25em] uppercase">
                  This is how we scale without losing responsibility.
                </p>
              </div>
            </AnimatedSection>

            {/* Client benefits */}
            <div className="space-y-5">
              {clientBenefits.map((b, i) => {
                const Icon = b.icon
                return (
                  <AnimatedSection key={i} delay={i * 0.1}>
                    <motion.div
                      whileHover={{ x: 6 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      className="flex gap-5 p-6 rounded-2xl bg-noir-card"
                    >
                      <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-iris-deep/15 flex items-center justify-center">
                        <Icon size={18} className="text-iris" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-[15px] text-stone mb-1.5">{b.title}</h3>
                        <p className="text-[14px] text-stone-dim leading-relaxed">{b.description}</p>
                      </div>
                    </motion.div>
                  </AnimatedSection>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Human judgment + AI precision */}
      <section className="py-24 px-6 bg-noir-low">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <h2 className="font-display font-bold text-[clamp(24px,3.5vw,40px)] text-stone mb-6 leading-tight" style={{ letterSpacing: '-0.03em' }}>
              Human judgment. <span className="text-iris">AI precision.</span>
            </h2>
            <div className="space-y-4 text-[16px] text-stone-dim leading-relaxed">
              <p>
                AI is used to accelerate execution, not replace human judgment. AI.bo handles drafting, structuring, and processing tasks. But all strategic decisions, system design, and client accountability remain with the founder.
              </p>
              <p>
                Every AI output is reviewed and validated before deployment. Decisions and implementation remain human-led.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Not an agency model */}
      <section className="py-32 px-6 bg-noir">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <AnimatedSection>
              <h2 className="font-display font-bold text-[clamp(24px,3.5vw,40px)] text-stone mb-6 leading-tight" style={{ letterSpacing: '-0.03em' }}>
                This is not an agency model.
              </h2>
              <div className="space-y-4 text-[16px] text-stone-dim leading-relaxed">
                <p>
                  It's a deliberate choice: fewer projects, deeper involvement, and systems maintained in production — not just delivered.
                </p>
                <p>
                  Best suited for founders and operations teams that need hands-on implementation, not layered agencies or advisory-only consulting.
                </p>
                <p>
                  Tam Tam Corp operates in the UAE and globally, serving SMEs and operations-heavy businesses that require clear accountability from design to deployment.
                </p>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/DataSecurity"
                  className="font-label text-[12px] text-iris tracking-wide hover:text-iris-dim transition-colors"
                >
                  Data handling & security →
                </Link>
                <span className="hidden sm:block text-stone-muted">·</span>
                <Link
                  to="/HowWeDecide"
                  className="font-label text-[12px] text-iris tracking-wide hover:text-iris-dim transition-colors"
                >
                  How We Decide →
                </Link>
              </div>
            </AnimatedSection>

            {/* Company details */}
            <AnimatedSection delay={0.1}>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Legal Name', value: 'Tam Tam Corp FZE LLC' },
                  { label: 'Trade License', value: '262705457888' },
                  { label: 'Location', value: 'Ajman, United Arab Emirates' },
                  { label: 'Email', value: 'info@tamtamcorp.online' },
                  { label: 'Phone / WhatsApp', value: '+971 58 873 7467' },
                  { label: 'Model', value: 'Founder-led, project-based' },
                ].map((item, i) => (
                  <div key={i} className="bg-noir-card rounded-xl p-5">
                    <p className="font-label text-[10px] font-semibold text-iris tracking-widest uppercase mb-2">{item.label}</p>
                    <p className="text-[14px] font-medium text-stone">{item.value}</p>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-noir-low">
        <div className="max-w-2xl mx-auto text-center">
          <AnimatedSection>
            <p className="font-display font-bold text-[clamp(22px,3vw,32px)] text-stone mb-6" style={{ letterSpacing: '-0.02em' }}>
              If this approach resonates, let's talk.
            </p>
            <Link
              to="/StartConversation"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-label font-semibold text-[14px] tracking-wide text-white bg-iris-gradient hover:brightness-110 hover:shadow-[0_0_24px_rgba(109,40,217,0.5)] transition-all"
            >
              Start a Conversation
            </Link>
          </AnimatedSection>
        </div>
      </section>
    </>
  )
}
```

- [ ] **Run dev server — visit `/about` and verify**

Expected: Dark page, two-column layout with founder story + benefit cards, Human+AI section, Not an agency section with company detail grid, CTA.

- [ ] **Commit**

```bash
git add src/pages/AboutPage.jsx
git commit -m "feat: implement About page — exact live content, Stitch dark design"
```

---

**Plan B complete. All three priority pages implemented. Proceed to Plan C (remaining pages).**
