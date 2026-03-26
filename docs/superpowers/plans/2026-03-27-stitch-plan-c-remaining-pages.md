# Stitch Redesign — Plan C: Remaining Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Run Plans A and B first.

**Goal:** Implement the remaining 9 pages: Contact, LeadGenerator, Services, Resources, and 5 legal pages.

**Architecture:** Pages use PageHero + AnimatedSection from Plan A. Legal pages share a LegalPage component. All content verbatim from tamtamcorp.tech.

**Tech Stack:** Vite + React JSX, Tailwind CSS v3 (Stitch tokens), Framer Motion, Lucide React
**Project root:** `C:\Users\ibrah\Documents\tamtamcorp-website\`

---

### Task 1: Contact page (`/StartConversation`)

**Files:**
- Modify: `src/pages/ContactPage.jsx`

- [ ] **Replace `src/pages/ContactPage.jsx`**

```jsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Phone, MapPin, MessageSquare, CheckCircle, ArrowRight } from 'lucide-react'
import PageHero from '../components/ui/PageHero'
import AnimatedSection from '../components/ui/AnimatedSection'

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', problem: '' })

  return (
    <>
      <PageHero
        label="Start a Conversation"
        title="Let's understand your problem first."
        subtitle="Tam Tam Corp works with a limited number of clients at a time. Before scheduling any conversation, we first aim to understand the problem clearly."
      />

      <section className="py-32 px-6 bg-noir">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">

            {/* Left: info */}
            <AnimatedSection>
              <div className="space-y-5 text-[16px] text-stone-dim leading-relaxed mb-12">
                <p>This helps ensure that time is spent where meaningful progress is possible.</p>
                <p>Conversations are scheduled only after the problem is understood.</p>
                <p className="flex items-start gap-2">
                  <span className="text-iris mt-1 flex-shrink-0">→</span>
                  <span>AI.bo assists with first intake only. All decisions remain human-led.</span>
                </p>
              </div>

              <div className="space-y-4">
                {[
                  { icon: Mail, label: 'info@tamtamcorp.online', href: 'mailto:info@tamtamcorp.online' },
                  { icon: Phone, label: '+971 58 873 7467', href: 'tel:+971588737467' },
                  { icon: MessageSquare, label: 'WhatsApp', href: 'https://wa.me/971588737467' },
                  { icon: MapPin, label: 'Ajman, United Arab Emirates', href: null },
                ].map((item, i) => {
                  const Icon = item.icon
                  const content = (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-iris-deep/15 flex items-center justify-center flex-shrink-0">
                        <Icon size={16} className="text-iris" />
                      </div>
                      <span className="text-[14px] text-stone-dim">{item.label}</span>
                    </div>
                  )
                  return item.href ? (
                    <a key={i} href={item.href} className="block hover:text-stone transition-colors">{content}</a>
                  ) : (
                    <div key={i}>{content}</div>
                  )
                })}
              </div>
            </AnimatedSection>

            {/* Right: form */}
            <AnimatedSection delay={0.15}>
              <div className="bg-noir-card rounded-2xl p-8 md:p-10">
                <AnimatePresence mode="wait">
                  {!submitted ? (
                    <motion.form
                      key="form"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, y: -20 }}
                      onSubmit={e => { e.preventDefault(); setSubmitted(true) }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="font-display font-bold text-[20px] text-stone mb-1">Submit for review</h3>
                        <p className="text-[14px] text-stone-muted">3–5 sentences are enough. No technical detail required.</p>
                      </div>

                      {[
                        { label: 'Your Name', key: 'name', type: 'text', placeholder: 'Ibrahim Surucu' },
                        { label: 'Your Email', key: 'email', type: 'email', placeholder: 'you@company.com' },
                      ].map(field => (
                        <div key={field.key}>
                          <label className="block font-label text-[12px] font-semibold text-stone-dim tracking-wide uppercase mb-2">{field.label}</label>
                          <input
                            type={field.type}
                            required
                            value={form[field.key]}
                            onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                            className="w-full px-4 py-3 rounded-xl bg-noir-deep border border-iris-deep/20 text-[15px] text-stone placeholder-stone-muted focus:outline-none focus:border-iris-deep focus:ring-1 focus:ring-iris-deep/40 transition-colors"
                          />
                        </div>
                      ))}

                      <div>
                        <label className="block font-label text-[12px] font-semibold text-stone-dim tracking-wide uppercase mb-2">
                          Describe the operational problem you want to solve
                        </label>
                        <textarea
                          required
                          rows={5}
                          value={form.problem}
                          onChange={e => setForm(f => ({ ...f, problem: e.target.value }))}
                          placeholder="We currently process all incoming leads manually via email. The volume has grown to the point where qualified leads are being missed..."
                          className="w-full px-4 py-3 rounded-xl bg-noir-deep border border-iris-deep/20 text-[15px] text-stone placeholder-stone-muted focus:outline-none focus:border-iris-deep focus:ring-1 focus:ring-iris-deep/40 transition-colors resize-none"
                        />
                      </div>

                      <motion.button
                        type="submit"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-label font-semibold text-[14px] tracking-wide text-white bg-iris-gradient hover:brightness-110 hover:shadow-[0_0_24px_rgba(109,40,217,0.45)] transition-all"
                      >
                        Submit for Review <ArrowRight size={16} />
                      </motion.button>
                    </motion.form>
                  ) : (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="py-12 text-center"
                    >
                      <div className="w-16 h-16 rounded-full bg-iris-deep/20 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={32} className="text-iris" />
                      </div>
                      <h3 className="font-display font-bold text-[22px] text-stone mb-3">Submission received</h3>
                      <p className="text-[15px] text-stone-dim leading-relaxed max-w-sm mx-auto">
                        We'll review your problem and be in touch shortly. If you need immediate assistance, reach out via WhatsApp.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>
    </>
  )
}
```

- [ ] **Commit**

```bash
git add src/pages/ContactPage.jsx
git commit -m "feat: implement Contact page — Stitch dark form design"
```

---

### Task 2: Lead Generator page (`/LeadGenerator`)

**Files:**
- Modify: `src/pages/LeadGeneratorPage.jsx`

- [ ] **Replace `src/pages/LeadGeneratorPage.jsx`**

```jsx
import { motion } from 'framer-motion'
import { Bot, BarChart3, Calendar, Palette, TrendingUp, Building2, Check, ArrowRight, Stethoscope, Home, Briefcase, Code } from 'lucide-react'
import PageHero from '../components/ui/PageHero'
import AnimatedSection from '../components/ui/AnimatedSection'
import { Link } from 'react-router-dom'

const features = [
  { icon: Bot, title: '24/7 Intelligent Responses', description: 'Answers visitor questions instantly based on your knowledge base' },
  { icon: TrendingUp, title: 'Lead Qualification', description: 'Qualifies prospects against your criteria before any human contact' },
  { icon: Calendar, title: 'Meeting Preparation', description: 'Captures meeting preferences and availability automatically' },
  { icon: Palette, title: 'Fully Branded', description: 'White-label solution that matches your corporate identity' },
  { icon: BarChart3, title: 'Conversation Analytics', description: 'Track engagement, lead quality, and conversion metrics' },
  { icon: Building2, title: 'Multi-Tenant Ready', description: 'Enterprise-grade SaaS architecture with full customisation' },
]

const industries = [
  { icon: Briefcase, title: 'Professional Services', description: 'Law firms, consulting agencies, accountants' },
  { icon: Home, title: 'Real Estate', description: 'Developers, brokers, rental agencies' },
  { icon: Stethoscope, title: 'Healthcare', description: 'Clinics, medical centres, wellness practices' },
  { icon: Code, title: 'B2B SaaS', description: 'Software companies, technology providers' },
]

const plans = [
  {
    name: 'Starter',
    price: '€49.90',
    period: '/month',
    tagline: 'For small businesses & local service providers',
    ideal: 'Sole traders, coaches, local businesses',
    features: [
      '1 Website Integration',
      'Up to 1,000 conversations / month',
      'Automatic website import (Knowledge Base)',
      'Intelligent Q&A responses',
      'Basic lead capture (email / phone)',
      'Simple lead overview in dashboard',
      'Email support',
    ],
    highlighted: false,
    cta: 'Start Starter Plan',
  },
  {
    name: 'Growth',
    price: '€149',
    period: '/month',
    tagline: 'For growing businesses with a clear lead strategy',
    ideal: 'Agencies, practices, real estate, SMEs',
    badge: 'Most Popular',
    features: [
      'Everything in Starter',
      'Up to 5,000 conversations / month',
      'Advanced Knowledge Base',
      'Multi-step lead qualification',
      'Lead scoring (Cold / Warm / Hot)',
      'Custom branding (colours & logo)',
      'Up to 3 websites',
      'Priority support',
    ],
    highlighted: true,
    cta: 'Start Growth Plan',
  },
  {
    name: 'Pro',
    price: '€399',
    period: '/month',
    tagline: 'For scaling businesses & performance-driven teams',
    ideal: 'High-ticket services, multi-location, SaaS',
    features: [
      'Everything in Growth',
      'Up to 20,000 conversations / month',
      'Full white-label branding',
      'API access',
      'Advanced lead analytics',
      'CRM export (CSV / API-ready)',
      'Multi-location support',
      'Priority premium support',
    ],
    highlighted: false,
    cta: 'Start Pro Plan',
  },
  {
    name: 'Custom',
    price: 'Custom',
    period: '',
    tagline: 'For businesses with special requirements',
    ideal: 'Enterprise, white-label resellers, custom integrations',
    features: [
      'Unlimited conversations',
      'Dedicated infrastructure',
      'Advanced integrations',
      'White-label reselling',
      'Multi-tenant management',
      'SLA guarantees',
      'Dedicated support',
      'Custom development',
    ],
    highlighted: false,
    cta: 'Get in Touch',
  },
]

export default function LeadGeneratorPage() {
  return (
    <>
      <PageHero
        label="AI.bo Lead Generator"
        title="Turn website visitors into qualified leads — automatically."
        subtitle="Our AI assistant answers questions, qualifies prospects, and captures contact data 24/7 — fully branded in your company design."
      >
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {['Set up in 5 minutes', 'No coding required', 'Live Demo Active'].map(badge => (
            <span key={badge} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-noir-card border border-iris-deep/25 text-stone-dim text-[12px] font-label tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-iris-deep" />
              {badge}
            </span>
          ))}
        </div>
      </PageHero>

      {/* Features */}
      <section className="py-24 px-6 bg-noir">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="font-label text-[11px] font-semibold text-iris tracking-[0.25em] uppercase block mb-4">Features</span>
            <h2 className="font-display font-bold text-[clamp(28px,4vw,44px)] text-stone mb-4" style={{ letterSpacing: '-0.03em' }}>
              Everything you need to capture and qualify leads
            </h2>
            <p className="text-[16px] text-stone-dim max-w-xl mx-auto">
              Intelligent conversation flows that turn anonymous visitors into qualified prospects.
            </p>
          </AnimatedSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon
              return (
                <AnimatedSection key={i} delay={i * 0.07}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="bg-noir-card rounded-2xl p-7"
                  >
                    <div className="w-11 h-11 rounded-xl bg-iris-deep/15 flex items-center justify-center mb-4">
                      <Icon size={20} className="text-iris" />
                    </div>
                    <h3 className="font-display font-semibold text-[16px] text-stone mb-2">{f.title}</h3>
                    <p className="text-[14px] text-stone-dim leading-relaxed">{f.description}</p>
                  </motion.div>
                </AnimatedSection>
              )
            })}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-20 px-6 bg-noir-low">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-12">
            <h2 className="font-display font-bold text-[clamp(24px,3vw,36px)] text-stone" style={{ letterSpacing: '-0.03em' }}>
              Built for businesses that value qualified leads
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {industries.map((ind, i) => {
              const Icon = ind.icon
              return (
                <AnimatedSection key={i} delay={i * 0.08}>
                  <div className="bg-noir-card rounded-2xl p-6 text-center">
                    <div className="w-10 h-10 rounded-xl bg-iris-deep/15 flex items-center justify-center mx-auto mb-3">
                      <Icon size={18} className="text-iris" />
                    </div>
                    <h3 className="font-display font-semibold text-[14px] text-stone mb-1">{ind.title}</h3>
                    <p className="text-[12px] text-stone-muted">{ind.description}</p>
                  </div>
                </AnimatedSection>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6 bg-noir">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="font-label text-[11px] font-semibold text-iris tracking-[0.25em] uppercase block mb-4">Pricing</span>
            <h2 className="font-display font-bold text-[clamp(28px,4vw,44px)] text-stone mb-4" style={{ letterSpacing: '-0.03em' }}>
              Simple, transparent pricing
            </h2>
            <p className="text-[16px] text-stone-dim">Start small, scale with growth. All plans include core features.</p>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {plans.map((plan, i) => (
              <AnimatedSection key={i} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`relative rounded-2xl p-8 h-full flex flex-col ${
                    plan.highlighted
                      ? 'bg-iris-deep border border-iris/30'
                      : 'bg-noir-card'
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-iris text-noir-deep text-[11px] font-label font-black px-4 py-1.5 rounded-full tracking-wide">
                      {plan.badge}
                    </span>
                  )}
                  <div className="mb-6">
                    <h3 className="font-display font-bold text-[18px] text-stone mb-1">{plan.name}</h3>
                    <p className="text-[12px] text-stone-dim mb-4">{plan.tagline}</p>
                    <div className="flex items-end gap-1 mb-1">
                      <span className="font-display font-black text-[clamp(28px,4vw,36px)] text-stone leading-none">{plan.price}</span>
                      {plan.period && <span className="text-[13px] text-stone-dim mb-1">{plan.period}</span>}
                    </div>
                    <p className="text-[12px] text-stone-muted">Ideal for: {plan.ideal}</p>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feat, fi) => (
                      <li key={fi} className="flex items-start gap-2.5">
                        <Check size={13} className="mt-0.5 flex-shrink-0 text-iris" />
                        <span className="text-[13px] text-stone-dim">{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/StartConversation"
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-label font-semibold text-[13px] tracking-wide transition-all ${
                      plan.highlighted
                        ? 'bg-iris text-noir-deep hover:bg-iris-dim'
                        : 'bg-iris-gradient text-white hover:brightness-110'
                    }`}
                  >
                    {plan.cta} <ArrowRight size={14} />
                  </Link>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 bg-noir-low">
        <div className="max-w-3xl mx-auto text-center">
          <AnimatedSection>
            <h2 className="font-display font-black text-[clamp(28px,4vw,44px)] text-stone mb-4" style={{ letterSpacing: '-0.03em' }}>
              Start converting leads today
            </h2>
            <p className="text-[16px] text-stone-dim mb-8">No credit card required. Setup takes 5 minutes.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/StartConversation"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-label font-semibold text-[14px] tracking-wide text-white bg-iris-gradient hover:brightness-110 hover:shadow-[0_0_24px_rgba(109,40,217,0.5)] transition-all"
              >
                Get started now <ArrowRight size={16} />
              </Link>
              <Link
                to="/StartConversation"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-label font-semibold text-[14px] tracking-wide text-iris border border-iris/30 hover:bg-iris/10 transition-all"
              >
                Contact Sales
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </>
  )
}
```

- [ ] **Commit**

```bash
git add src/pages/LeadGeneratorPage.jsx
git commit -m "feat: implement LeadGenerator page — Stitch dark design, full pricing"
```

---

### Task 3: Services page (`/services`)

**Files:**
- Modify: `src/pages/ServicesPage.jsx`

- [ ] **Replace `src/pages/ServicesPage.jsx`**

```jsx
import { motion } from 'framer-motion'
import { Bot, MessageSquare, Phone, LayoutDashboard, Cpu, Handshake, Image, Users, ArrowRight, Zap } from 'lucide-react'
import PageHero from '../components/ui/PageHero'
import AnimatedSection from '../components/ui/AnimatedSection'
import { Link } from 'react-router-dom'

const services = [
  { icon: Bot, title: 'AI Automation & Workflows', description: 'Automate manual processes that waste hours — data entry, reports, copy-paste between systems, repetitive responses. Built personally, runs in production.', tag: null, href: null },
  { icon: MessageSquare, title: 'AI.bo — Lead Generator', description: 'AI assistant that answers questions, qualifies prospects and captures contact details 24/7. Fully branded, white-label, setup in 5 minutes.', tag: 'SaaS Product', href: '/LeadGenerator', price: 'From €49.90/mo' },
  { icon: Phone, title: 'WhatsApp Agents', description: 'Intelligent WhatsApp bots that handle customer communication, lead qualification, and appointment scheduling — in the channel your clients already use.', tag: null, href: null },
  { icon: Users, title: 'Persona Campaign Engine', description: 'AI-driven outreach campaigns built around specific buyer personas. Selective, targeted, and built to convert — not mass-blast.', tag: null, href: null },
  { icon: Image, title: 'AI Product Imagery', description: 'Professional product visuals generated with AI. Faster than a photoshoot, cheaper than a studio — consistent quality at scale.', tag: null, href: null },
  { icon: Zap, title: 'Lead Qualification Systems', description: 'Automated qualification pipelines that score and route leads before your team touches them. No more wasted calls on cold contacts.', tag: null, href: null },
  { icon: LayoutDashboard, title: 'Internal Tools & Dashboards', description: 'Custom operational dashboards built around your specific workflow. No generic SaaS — purpose-built for how your team actually works.', tag: null, href: null },
  { icon: Cpu, title: 'System Architecture & Integrations', description: 'Architecture decisions, integration logic, deployment pipelines. We connect your existing tools and build the missing pieces.', tag: null, href: null },
  { icon: Handshake, title: 'Consulting with Implementation', description: 'Not advisory-only. Every recommendation comes with hands-on execution. The person who advises is the same person who builds.', tag: null, href: null },
]

function ServiceCard({ service, index }) {
  const Icon = service.icon
  const inner = (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="relative bg-noir-card rounded-2xl p-8 h-full flex flex-col group overflow-hidden"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(109,40,217,0.08) 0%, transparent 60%)' }} />
      <div className="relative z-10 flex flex-col h-full">
        <div className="w-12 h-12 rounded-xl bg-iris-deep/15 flex items-center justify-center mb-5 flex-shrink-0">
          <Icon size={22} className="text-iris" />
        </div>
        {service.tag && (
          <span className="inline-block font-label text-[11px] font-semibold text-iris tracking-widest uppercase mb-3 bg-iris-deep/15 px-3 py-1 rounded-full w-fit">
            {service.tag}
          </span>
        )}
        <h3 className="font-display font-bold text-[18px] text-stone mb-3 leading-snug">{service.title}</h3>
        <p className="text-[14px] text-stone-dim leading-relaxed flex-1">{service.description}</p>
        {service.price && (
          <div className="mt-4 mb-4 font-label text-[13px] font-semibold text-iris">{service.price}</div>
        )}
        <div className="mt-5 pt-5 border-t border-iris-deep/15">
          {service.href ? (
            <span className="inline-flex items-center gap-1.5 font-label text-[13px] font-semibold text-iris group-hover:gap-3 transition-all">
              View pricing & details <ArrowRight size={14} />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-label text-[13px] font-semibold text-stone-muted group-hover:text-stone group-hover:gap-3 transition-all">
              Discuss this service <ArrowRight size={14} />
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )

  return (
    <AnimatedSection delay={index * 0.07}>
      {service.href ? <Link to={service.href} className="block h-full">{inner}</Link> : inner}
    </AnimatedSection>
  )
}

export default function ServicesPage() {
  return (
    <>
      <PageHero
        label="What We Build"
        title="Systems that run in production"
        subtitle="Every service is designed and built personally by the founder. No delegation, no middlemen — direct from problem to working system."
      />

      <section className="py-24 px-6 bg-noir">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <h2 className="font-display font-bold text-[clamp(28px,4vw,42px)] text-stone mb-4" style={{ letterSpacing: '-0.03em' }}>
              Full service portfolio
            </h2>
            <p className="text-[16px] text-stone-dim max-w-xl mx-auto">
              From SaaS products to bespoke automation. Most projects combine 2–3 of these.
            </p>
          </AnimatedSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s, i) => <ServiceCard key={i} service={s} index={i} />)}
          </div>
        </div>
      </section>

      {/* AI.bo Spotlight */}
      <section className="py-20 px-6 bg-noir-low">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <AnimatedSection>
              <span className="font-label text-[12px] font-semibold text-iris tracking-[0.2em] uppercase block mb-5">SaaS Product</span>
              <h2 className="font-display font-bold text-[clamp(28px,4vw,44px)] text-stone mb-5 leading-tight" style={{ letterSpacing: '-0.03em' }}>
                AI.bo Lead Generator
              </h2>
              <p className="text-[16px] text-stone-dim leading-relaxed mb-8">
                The only service with a fixed monthly price. A fully branded AI assistant embedded on your website — qualifying leads and capturing contacts 24/7.
              </p>
              <Link
                to="/LeadGenerator"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-label font-semibold text-[14px] tracking-wide text-white bg-iris-gradient hover:brightness-110 hover:shadow-[0_0_24px_rgba(109,40,217,0.5)] transition-all"
              >
                See pricing & live demo <ArrowRight size={16} />
              </Link>
            </AnimatedSection>
            <div className="grid grid-cols-2 gap-4">
              {[
                { price: '€49.90/mo', plan: 'Starter', desc: '1 site · 1,000 conversations' },
                { price: '€149/mo', plan: 'Growth', desc: '3 sites · 5,000 conversations', highlight: true },
                { price: '€399/mo', plan: 'Pro', desc: '20,000 conversations · API' },
                { price: 'Custom', plan: 'Enterprise', desc: 'Unlimited · White-label' },
              ].map((tier, i) => (
                <AnimatedSection key={i} delay={i * 0.08}>
                  <div className={`rounded-2xl p-5 ${tier.highlight ? 'bg-iris-deep border border-iris/30' : 'bg-noir-card'}`}>
                    <p className="font-display font-black text-[22px] text-stone mb-1">{tier.price}</p>
                    <p className="font-label text-[12px] font-semibold text-stone-dim mb-1">{tier.plan}</p>
                    <p className="text-[12px] text-stone-muted">{tier.desc}</p>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-6 bg-noir">
        <div className="max-w-3xl mx-auto text-center">
          <AnimatedSection>
            <h2 className="font-display font-bold text-[clamp(28px,4vw,40px)] text-stone mb-6" style={{ letterSpacing: '-0.03em' }}>
              Not sure which service fits?
            </h2>
            <p className="text-[16px] text-stone-dim leading-relaxed mb-8">
              Describe the operational challenge and we'll identify the right approach together — before any commitment.
            </p>
            <Link
              to="/StartConversation"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-label font-semibold text-[14px] tracking-wide text-white bg-iris-gradient hover:brightness-110 hover:shadow-[0_0_24px_rgba(109,40,217,0.5)] transition-all"
            >
              Describe Your Problem <ArrowRight size={16} />
            </Link>
          </AnimatedSection>
        </div>
      </section>
    </>
  )
}
```

- [ ] **Commit**

```bash
git add src/pages/ServicesPage.jsx
git commit -m "feat: implement Services page — Stitch dark design, 9 services"
```

---

### Task 4: Resources page (`/resources`)

**Files:**
- Modify: `src/pages/ResourcesPage.jsx`

- [ ] **Replace `src/pages/ResourcesPage.jsx`**

```jsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import PageHero from '../components/ui/PageHero'
import AnimatedSection from '../components/ui/AnimatedSection'

const articles = [
  { category: 'AI Implementation', readTime: '6 min', title: 'Why AI Systems Fail Without Human Accountability', description: 'Most AI implementations fail not because of technology, but because no one is accountable when things break. Founder-led execution ensures one person owns the outcome.' },
  { category: 'Business Operations', readTime: '5 min', title: 'The Hidden Cost of "Set and Forget" Automation', description: 'Automation vendors promise systems that run themselves. In practice, unmaintained automation creates operational debt that compounds silently until it breaks visibly.' },
  { category: 'Decision Framework', readTime: '7 min', title: 'When to Build vs. When to Buy: A Founder\'s Framework', description: 'SaaS tools are fast but constrained. Custom builds are flexible but slow. Founders must decide based on operational context, not industry trends.' },
  { category: 'AI Implementation', readTime: '5 min', title: 'AI.bo as Assisted Execution: No Autonomy, Full Control', description: 'AI.bo is not an autonomous agent. It is an execution layer that operates within boundaries defined by humans. No decisions. No creativity. Pure execution.' },
  { category: 'Persona Systems', readTime: '6 min', title: 'The Persona Engine: Controlled Digital Representation', description: 'Digital representation is not about automation. It is about consistent presence under defined boundaries. Humans set strategy. AI executes within constraints.' },
  { category: 'System Design', readTime: '6 min', title: 'Why Internal Tools Fail: The Maintenance Problem', description: 'Most internal tools are built once and maintained poorly. They drift from operational needs until teams stop using them. Founder-led maintenance prevents this decay.' },
]

const categories = ['All', 'AI Implementation', 'Business Operations', 'Decision Framework', 'Persona Systems', 'System Design']

export default function ResourcesPage() {
  const [active, setActive] = useState('All')
  const filtered = active === 'All' ? articles : articles.filter(a => a.category === active)

  return (
    <>
      <PageHero
        label="Resources & Insights"
        title="Real-world implementation guidance."
        subtitle="Practical insights on AI implementation, founder-led execution, and operational efficiency. No theory. No hype."
      />

      <section className="py-24 px-6 bg-noir">
        <div className="max-w-6xl mx-auto">
          {/* Category filter */}
          <AnimatedSection className="flex flex-wrap gap-2 mb-14">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`font-label text-[12px] font-semibold tracking-widest uppercase px-4 py-2 rounded-full transition-all ${
                  active === cat
                    ? 'bg-iris-deep text-stone'
                    : 'bg-noir-card text-stone-muted hover:text-stone'
                }`}
              >
                {cat}
              </button>
            ))}
          </AnimatedSection>

          {/* Articles grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((article, i) => (
              <AnimatedSection key={i} delay={i * 0.07}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="bg-noir-card rounded-2xl p-8 h-full flex flex-col group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-5">
                    <span className="font-label text-[11px] font-semibold text-iris tracking-[0.2em] uppercase">{article.category}</span>
                    <span className="font-label text-[11px] text-stone-muted">{article.readTime} read</span>
                  </div>
                  <h3 className="font-display font-bold text-[17px] text-stone mb-3 leading-snug flex-1">{article.title}</h3>
                  <p className="text-[13px] text-stone-dim leading-relaxed mb-6">{article.description}</p>
                  <span className="inline-flex items-center gap-1.5 font-label text-[12px] font-semibold text-stone-muted group-hover:text-iris group-hover:gap-3 transition-all">
                    Read Article <ArrowRight size={13} />
                  </span>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
```

- [ ] **Commit**

```bash
git add src/pages/ResourcesPage.jsx
git commit -m "feat: implement Resources page — 6 articles, category filter, Stitch design"
```

---

### Task 5: Shared LegalPage component + 5 legal pages

**Files:**
- Create: `src/components/ui/LegalPage.jsx`
- Modify: `src/pages/PrivacyPolicyPage.jsx`
- Modify: `src/pages/TermsPage.jsx`
- Modify: `src/pages/DataSecurityPage.jsx`
- Modify: `src/pages/HowWeDecidePage.jsx`
- Modify: `src/pages/SelectiveOutreachPage.jsx`

- [ ] **Create `src/components/ui/LegalPage.jsx`**

```jsx
import { motion } from 'framer-motion'
import PageHero from './PageHero'

export default function LegalPage({ label, title, lastUpdated, sections }) {
  return (
    <>
      <PageHero
        label={label}
        title={title}
        subtitle={lastUpdated ? `Last updated: ${lastUpdated}` : undefined}
      />
      <section className="py-24 px-6 bg-noir">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-12">
            {sections.map((section, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
              >
                {section.number && (
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="font-label text-[13px] font-bold text-iris-deep/50">{section.number}.</span>
                    <h2 className="font-display font-bold text-[20px] text-stone leading-tight">{section.title}</h2>
                  </div>
                )}
                {!section.number && section.title && (
                  <h2 className="font-display font-bold text-[20px] text-stone mb-4 leading-tight">{section.title}</h2>
                )}
                {section.intro && (
                  <p className="text-[15px] text-stone-dim leading-relaxed mb-4">{section.intro}</p>
                )}
                {section.paragraphs && section.paragraphs.map((p, pi) => (
                  <p key={pi} className="text-[15px] text-stone-dim leading-relaxed mb-3">{p}</p>
                ))}
                {section.items && (
                  <ul className="space-y-2 mt-3">
                    {section.items.map((item, ii) => (
                      <li key={ii} className="flex items-start gap-3 text-[14px] text-stone-dim">
                        <span className="text-iris mt-1 flex-shrink-0">·</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.subsections && section.subsections.map((sub, si) => (
                  <div key={si} className="mt-5">
                    <h3 className="font-display font-semibold text-[16px] text-stone mb-2">{sub.title}</h3>
                    {sub.paragraphs && sub.paragraphs.map((p, pi) => (
                      <p key={pi} className="text-[14px] text-stone-dim leading-relaxed mb-2">{p}</p>
                    ))}
                    {sub.items && (
                      <ul className="space-y-1.5 mt-2">
                        {sub.items.map((item, ii) => (
                          <li key={ii} className="flex items-start gap-3 text-[14px] text-stone-dim">
                            <span className="text-iris mt-1 flex-shrink-0">·</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
```

- [ ] **Replace `src/pages/PrivacyPolicyPage.jsx`**

```jsx
import LegalPage from '../components/ui/LegalPage'

const sections = [
  { number: '1', title: 'Who We Are', paragraphs: ['Legal entity: Tam Tam Corp FZE LLC', 'Jurisdiction: United Arab Emirates', 'Free zone: Ajman Free Zone', 'Contact email: info@tamtamcorp.online', 'Tam Tam Corp is a founder-led consultancy providing AI automation, systems consulting, and implementation services.'] },
  { number: '2', title: 'Information We Collect', intro: 'We collect only the information necessary to operate our website and deliver our services.', subsections: [
    { title: 'a) Information you provide directly', paragraphs: ['This may include: Name, Email address, Company name, Message content.', 'This information is collected when you submit a contact form, contact us via email, or initiate contact via WhatsApp or similar communication tools.'] },
    { title: 'b) Information collected automatically', paragraphs: ['When you visit our website, we may collect: IP address, Browser type and version, Device information, Pages visited and interaction data.', 'This data is collected through cookies and analytics tools to understand how our website is used and to improve performance.'] },
  ]},
  { number: '3', title: 'Cookies & Analytics', paragraphs: ['We use cookies and similar technologies to: Ensure basic website functionality, Analyze traffic and usage patterns, Improve user experience.'], items: ['Essential cookies', 'Analytics cookies'] },
  { number: '4', title: 'Use of WhatsApp & Communication Tools', items: ['Your communication data is processed only to respond to your inquiry', 'Conversations are not used for marketing purposes', 'Data is not shared or sold'] },
  { number: '5', title: 'How We Use Your Data', intro: 'We use personal data only to: Respond to inquiries, Communicate about our services, Operate and improve our website, Deliver consulting and implementation services.', paragraphs: ['We do not: Sell personal data, Rent or trade personal information, Use personal data for advertising networks.'] },
  { number: '6', title: 'AI Systems & Human Oversight', items: ['AI systems operate under defined rules', 'They support execution and efficiency', 'Human oversight and responsibility always remain in place', 'AI systems do not make autonomous business decisions about users.'] },
  { number: '7', title: 'Data Storage & Third-Party Services', paragraphs: ['Personal data may be processed using trusted third-party tools (e.g. analytics, communication platforms). These providers act only as data processors and are required to protect your data.', 'We store data only for as long as necessary to fulfill its purpose.'] },
  { number: '8', title: 'Your Rights', intro: 'Depending on applicable laws, you may have the right to:', items: ['Request access to your personal data', 'Request correction or deletion', 'Withdraw consent for data processing', 'Requests can be sent to: info@tamtamcorp.online'] },
  { number: '9', title: 'Data Security', paragraphs: ['We take reasonable technical and organizational measures to protect personal data against unauthorized access, misuse, loss or disclosure.', 'No system is completely secure, but we prioritize responsible handling and protection of data.'] },
  { number: '10', title: 'International Visitors', paragraphs: ['Our business operates from the United Arab Emirates and serves clients globally. If you access our website from outside the UAE, your data may be processed in accordance with this policy.'] },
  { number: '11', title: 'Changes to This Policy', paragraphs: ['We may update this Privacy Policy from time to time. The latest version will always be published on this page.'] },
  { number: '12', title: 'Contact', paragraphs: ['Tam Tam Corp FZE LLC', 'info@tamtamcorp.online'] },
]

export default function PrivacyPolicyPage() {
  return <LegalPage label="Legal" title="Privacy Policy" lastUpdated="30 December 2025" sections={sections} />
}
```

- [ ] **Replace `src/pages/TermsPage.jsx`**

```jsx
import LegalPage from '../components/ui/LegalPage'

const sections = [
  { number: '1', title: 'Company Information', paragraphs: ['Legal entity: Tam Tam Corp FZE LLC', 'Jurisdiction: United Arab Emirates — Free zone: Ajman Free Zone', 'Contact email: info@tamtamcorp.online', 'Tam Tam Corp provides consulting, system design, automation, and AI-related implementation services.'] },
  { number: '2', title: 'Scope of Services', intro: 'Tam Tam Corp offers:', items: ['AI automation consulting', 'System design and implementation', 'Internal tools and workflow automation', 'WhatsApp bots and conversational systems', 'Founder-led advisory and execution services'], paragraphs: ['All services are provided based on individual agreements, project scopes, or written confirmations.'] },
  { number: '3', title: 'No Guarantee of Outcomes', paragraphs: ['While we apply professional care, experience, and best practices, results may vary depending on business context, data quality, and external factors. We do not guarantee specific financial, operational, or performance outcomes.', 'Our obligation is professional execution, not guaranteed business results.'] },
  { number: '4', title: 'Client Responsibilities', intro: 'Clients agree to:', items: ['Provide accurate and complete information', 'Ensure they have rights to any data shared', 'Review deliverables in a timely manner', 'Comply with applicable laws and regulations'] },
  { number: '5', title: 'AI Systems & Human Responsibility', items: ['AI systems operate within predefined parameters', 'They support execution, speed, and automation', 'Final decisions, approvals, and responsibility remain human-led', 'AI systems do not act autonomously beyond their defined scope.'] },
  { number: '6', title: 'Intellectual Property', paragraphs: ['Unless otherwise agreed in writing: All methodologies, frameworks, and know-how developed by Tam Tam Corp remain our intellectual property. Clients receive usage rights to deliverables created specifically for them. No transfer of ownership occurs without explicit agreement.', 'Website content may not be copied or reused without permission.'] },
  { number: '7', title: 'Confidentiality', intro: 'Both parties agree to treat non-public business information as confidential. This includes:', items: ['Technical details', 'Business strategies', 'Internal processes', 'Client data'], paragraphs: ['Confidentiality obligations survive the end of any engagement.'] },
  { number: '8', title: 'Limitation of Liability', paragraphs: ['To the maximum extent permitted by law: Tam Tam Corp is not liable for indirect, incidental, or consequential damages. Liability is limited to fees paid for the specific service giving rise to the claim.', 'Nothing in these Terms excludes liability where exclusion is not permitted by law.'] },
  { number: '9', title: 'Third-Party Tools & Services', paragraphs: ['Services may involve third-party platforms (e.g. hosting, analytics, messaging tools). Tam Tam Corp is not responsible for outages, policy changes, or failures caused by third-party providers.'] },
  { number: '10', title: 'Governing Law', paragraphs: ['These Terms are governed by the laws of the United Arab Emirates. Any disputes shall be subject to the competent courts of the UAE.'] },
  { number: '11', title: 'Changes to These Terms', paragraphs: ['We may update these Terms from time to time. The current version will always be available on this page.'] },
  { number: '12', title: 'Contact', paragraphs: ['For questions regarding these Terms: info@tamtamcorp.online'] },
]

export default function TermsPage() {
  return <LegalPage label="Legal" title="Terms of Service" lastUpdated="30 December 2025" sections={sections} />
}
```

- [ ] **Replace `src/pages/DataSecurityPage.jsx`**

```jsx
import LegalPage from '../components/ui/LegalPage'

const sections = [
  { number: '1', title: 'Our Approach to Data', intro: 'We collect and process only the data required to: Deliver our services, Operate systems reliably, Communicate with clients.', paragraphs: ['We do not: Sell personal or business data, Trade data with third parties, Use data for advertising networks.', 'Data is used strictly for operational and service-related purposes.'] },
  { number: '2', title: 'Human Responsibility & AI Systems', intro: 'AI systems are powerful execution tools — but they do not replace human responsibility. At Tam Tam Corp:', items: ['AI operates within predefined rules', 'Automation handles execution and repetition', 'Strategic decisions, approvals, and accountability remain human-led', 'AI systems do not make autonomous business decisions on behalf of clients.'] },
  { number: '3', title: 'Data Processing & Storage', intro: 'Depending on the project, data may be processed using:', items: ['Secure cloud infrastructure', 'Communication platforms (e.g. messaging tools)', 'Analytics or monitoring systems'], paragraphs: ['Third-party tools are used only as data processors and are selected based on security standards, reliability, and relevance to the task.', 'Data is stored only for as long as necessary to fulfill its purpose.'] },
  { number: '4', title: 'Client Data Confidentiality', intro: 'All non-public client information is treated as confidential. This includes:', items: ['Business data', 'Operational workflows', 'Technical configurations', 'Internal documentation'], paragraphs: ['Access is limited to what is necessary for system design, implementation, and maintenance.'] },
  { number: '5', title: 'Security Measures', intro: 'We apply reasonable technical and organizational measures to protect data, including:', items: ['Access controls', 'Environment separation', 'Secure authentication where applicable', 'Responsible handling of credentials and API keys'], paragraphs: ['While no system can be guaranteed to be completely risk-free, security is treated as a continuous responsibility.'] },
  { number: '6', title: 'WhatsApp & Communication Security', items: ['Communication data is processed only to enable the service', 'Conversations are not reused for marketing', 'No data is resold or shared outside the intended scope', 'Platform-specific policies and limitations may apply.'] },
  { number: '7', title: 'Client Responsibilities', intro: 'Clients are responsible for:', items: ['Providing data they are authorized to share', 'Complying with applicable data protection laws', 'Defining internal approval processes where required'], paragraphs: ['Tam Tam Corp designs systems to support compliance but does not replace legal or regulatory obligations.'] },
  { number: '8', title: 'Incident Handling', items: ['We act promptly to assess and contain impact', 'Affected parties are informed where appropriate', 'Corrective measures are implemented to prevent recurrence'] },
  { number: '9', title: 'Transparency', paragraphs: ['We believe trust is built through clarity. If you have questions about how data is handled, how AI systems operate, or how security is managed — you can contact us at any time.', 'Contact: info@tamtamcorp.online'] },
]

export default function DataSecurityPage() {
  return <LegalPage label="Legal" title="Data & Security" lastUpdated="30 December 2025" sections={sections} />
}
```

- [ ] **Replace `src/pages/HowWeDecidePage.jsx`**

```jsx
import LegalPage from '../components/ui/LegalPage'

const sections = [
  { title: 'Responsibility Comes First', paragraphs: ['Automation never removes accountability. Every system has a clear human owner. When something breaks or behaves unexpectedly, one person is responsible for the decision and the outcome.'] },
  { title: 'Automation Follows Clarity', paragraphs: ['We do not automate unclear or unstable processes. Structure comes before speed. If a workflow cannot be documented clearly, it should not be automated yet.'] },
  { title: 'AI Executes, Humans Decide', paragraphs: ['AI supports execution and availability. Decisions remain human-led. Every output from AI is validated before it impacts operations or reaches customers.'] },
  { title: 'Failure Modes Are Designed Early', paragraphs: ['We consider what happens when systems fail before deploying them. Fallback paths, error handling, and recovery processes are not afterthoughts.'] },
  { title: 'Simplicity Scales Better Than Complexity', paragraphs: ['We prefer systems that can be understood, maintained, and adjusted over time. A system that cannot be explained clearly to its users will eventually fail in production.'] },
  { title: 'No System Without a Human Override', paragraphs: ['Every automated workflow includes a path back to human control. Automation improves efficiency, but humans must retain the ability to intervene when necessary.'] },
  { title: "If It Can't Be Explained, It's Not Ready", paragraphs: ['Systems deployed to clients must be understandable. If the logic behind a decision or recommendation cannot be explained in plain language, the system requires more work before deployment.'] },
  { title: null, paragraphs: ['These principles guide how systems are designed, tested, and deployed. They exist to ensure reliability, maintain accountability, and prevent predictable failures.'] },
]

export default function HowWeDecidePage() {
  return (
    <LegalPage
      label="Principles"
      title="Automation and AI are not the hard part. Decisions are."
      sections={sections}
    />
  )
}
```

- [ ] **Replace `src/pages/SelectiveOutreachPage.jsx`**

```jsx
import LegalPage from '../components/ui/LegalPage'

const sections = [
  { title: 'Our Approach', paragraphs: ['Tam Tam Corp does not engage in mass outreach. Outbound contact is limited and intentional.', 'Outreach occurs only when a specific operational relevance is identified. Conversations are optional and never assumed.', 'We reach out only when there is a clear reason to believe a conversation could be mutually relevant.', 'Silence is always respected as a valid response.'] },
  { title: 'Outbound Principles', items: ['No sequences', 'No pressure', 'No follow-ups without invitation', 'Same qualification standards as inbound', 'Human-led communication only'] },
  { title: null, paragraphs: ['Tam Tam Corp values relevance over reach, clarity over conversion, and judgment over scale.', 'This framework exists to ensure that any outbound communication reflects the same standards applied to inbound work.'] },
]

export default function SelectiveOutreachPage() {
  return (
    <LegalPage
      label="Outreach Policy"
      title="Selective Outreach"
      sections={sections}
    />
  )
}
```

- [ ] **Run dev server — verify all legal pages render correctly**

```bash
npm run dev
```

Visit `/PrivacyPolicy`, `/Terms`, `/DataSecurity`, `/HowWeDecide`, `/SelectiveOutreach` — all should show dark page with numbered sections and correct content.

- [ ] **Commit**

```bash
git add src/components/ui/LegalPage.jsx src/pages/PrivacyPolicyPage.jsx src/pages/TermsPage.jsx src/pages/DataSecurityPage.jsx src/pages/HowWeDecidePage.jsx src/pages/SelectiveOutreachPage.jsx
git commit -m "feat: implement all legal pages via shared LegalPage component"
```

---

### Task 6: Final build check

- [ ] **Run full build**

```bash
cd C:\Users\ibrah\Documents\tamtamcorp-website
npm run build
```

Expected: Build completes with 0 errors. Bundle size warnings are OK.

- [ ] **Spot-check all routes in dev**

Visit each route and confirm dark background, purple accents, correct content:
- `/` — Stitch hero + all sections
- `/services` — 9 service cards
- `/about` — two columns, founder story
- `/OurTeam` — CEO featured card + 6-card grid
- `/StartConversation` — dark form
- `/LeadGenerator` — features + pricing
- `/resources` — 6 articles + filter
- `/PrivacyPolicy`, `/Terms`, `/DataSecurity`, `/HowWeDecide`, `/SelectiveOutreach` — legal content

- [ ] **Commit final**

```bash
git add -A
git commit -m "feat: complete Stitch redesign — all 12 pages in Cinematic Intelligence dark design"
```

**Plan C complete. Full redesign done.**

---

## Adding photos to the Team page

When you have the 7 role photos ready, add them to `src/assets/team/` with these exact filenames:

| Role | Filename |
|---|---|
| CEO & Founder | `role-ceo.jpg` |
| Head of AI | `role-ai.jpg` |
| Analyst & Strategy | `role-analyst.jpg` |
| Operations & Project Lead | `role-ops.jpg` |
| Support | `role-support.jpg` |
| AI.bo – Assisted Intake | `role-aibo.jpg` |
| Office Care | `role-office.jpg` |

Then in `src/pages/TeamPage.jsx`, uncomment the import lines at the top and replace `photo: null` with the imported variable for each role.
