import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import SEO from '../components/SEO'

// ── Animated counter ────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '', duration = 2000 }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const start = Date.now()
          const tick = () => {
            const elapsed = Date.now() - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplay(Math.round(eased * value))
            if (progress < 1) requestAnimationFrame(tick)
          }
          tick()
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, duration])

  return <span ref={ref}>{display.toLocaleString()}{suffix}</span>
}

// ── Feature card ────────────────────────────────────────────────────
function FeatureCard({ icon, title, description, accent, delay }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.15 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`group relative p-[1px] rounded-2xl transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative bg-[#111118] rounded-2xl p-6 h-full border border-white/[0.04] group-hover:border-transparent transition-colors">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center mb-4 text-white shadow-lg`}>
          {icon}
        </div>
        <h3 className="font-heading font-bold text-text-primary text-lg mb-2">{title}</h3>
        <p className="text-text-secondary text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

// ── Floating particle background ────────────────────────────────────
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: ['#00E5FF', '#FF2D78', '#B8FF00', '#FFB800'][i % 4],
            opacity: 0.15 + Math.random() * 0.15,
            animation: `float ${8 + Math.random() * 12}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
    </div>
  )
}

// ── Showcase card with animated screenshot ──────────────────────────
function ShowcaseCard({ title, description, gradient, features, delay }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`relative rounded-2xl border border-white/[0.06] bg-[#111118] overflow-hidden transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Gradient top bar */}
      <div className={`h-1 bg-gradient-to-r ${gradient}`} />
      <div className="p-6 sm:p-8">
        <h3 className="font-heading font-bold text-xl text-text-primary mb-2">{title}</h3>
        <p className="text-text-secondary text-sm mb-5 leading-relaxed">{description}</p>
        <ul className="space-y-2">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
              <svg className="w-4 h-4 text-[#00E5FF] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Main Landing Page ───────────────────────────────────────────────
export default function Landing() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white overflow-x-hidden">
      <SEO
        title="Crickrida | AI-Powered Cricket Intelligence"
        description="Deep-dive into 17+ years of IPL data with AI-powered analytics, real-time insights, and stunning visualizations. Cricket via Stats."
      />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-5px); }
          75% { transform: translateY(-30px) translateX(15px); }
        }
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0,229,255,0.15); }
          50% { box-shadow: 0 0 40px rgba(0,229,255,0.3), 0 0 80px rgba(0,229,255,0.1); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-slide-up { animation: slide-up 0.8s ease-out forwards; }
        .animate-slide-up-delay-1 { animation: slide-up 0.8s ease-out 0.15s forwards; opacity: 0; }
        .animate-slide-up-delay-2 { animation: slide-up 0.8s ease-out 0.3s forwards; opacity: 0; }
        .animate-slide-up-delay-3 { animation: slide-up 0.8s ease-out 0.45s forwards; opacity: 0; }
      `}</style>

      {/* ══════════ NAVBAR ══════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Crickrida" className="w-9 h-9 rounded-xl object-cover" />
            <div>
              <span className="font-heading font-bold text-lg text-white tracking-tight">Crickrida</span>
              <span className="hidden sm:inline text-[10px] text-text-muted font-mono ml-2 uppercase tracking-widest">Cricket via Stats</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <a href="https://twitter.com/Rkjat65" target="_blank" rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-text-muted hover:text-white text-sm transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span className="font-mono text-xs">@Rkjat65</span>
            </a>
            <Link to="/login"
              className="px-4 py-2 rounded-lg border border-white/10 text-sm font-medium text-text-secondary hover:text-white hover:border-white/20 transition-all">
              Sign In
            </Link>
            <Link to="/login"
              className="px-4 py-2 rounded-lg bg-[#00E5FF] text-black text-sm font-bold hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)]">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        <ParticleField />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(0,229,255,0.08)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(255,45,120,0.06)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="animate-slide-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#00E5FF]/20 bg-[#00E5FF]/5 mb-8">
            <div className="w-2 h-2 rounded-full bg-[#B8FF00] animate-pulse" />
            <span className="text-xs font-mono text-[#00E5FF] uppercase tracking-wider">IPL 2026 Live Scores &bull; 17+ Years of Data</span>
          </div>

          <h1 className="animate-slide-up-delay-1 font-heading font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-[1.05] mb-6">
            Cricket Intelligence,{' '}
            <span className="bg-gradient-to-r from-[#00E5FF] via-[#FF2D78] to-[#B8FF00] bg-clip-text text-transparent bg-[length:200%_200%]"
              style={{ animation: 'gradient-x 4s ease infinite' }}>
              Reimagined
            </span>
          </h1>

          <p className="animate-slide-up-delay-2 text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            Live scores, AI-powered analytics, social-ready content studio, and deep-dive insights across every IPL match, player, and season.
          </p>

          <div className="animate-slide-up-delay-3 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login"
              className="group relative px-8 py-3.5 rounded-xl bg-[#00E5FF] text-black font-bold text-base hover:brightness-110 transition-all shadow-[0_0_30px_rgba(0,229,255,0.25)]"
              style={{ animation: 'pulse-glow 3s ease-in-out infinite' }}>
              <span className="flex items-center gap-2">
                Explore Dashboard
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>
            <a href="#features"
              className="px-8 py-3.5 rounded-xl border border-white/10 text-text-secondary font-medium text-base hover:border-white/25 hover:text-white transition-all">
              See Features
            </a>
          </div>

          <div className="mt-16 animate-slide-up-delay-3 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { value: 1169, suffix: '+', label: 'Matches Analyzed', color: 'text-[#00E5FF]' },
              { value: 600, suffix: '+', label: 'Players Tracked', color: 'text-[#FF2D78]' },
              { value: 17, suffix: '+', label: 'IPL Seasons', color: 'text-[#B8FF00]' },
              { value: 20, suffix: '+', label: 'Analytics Views', color: 'text-[#FFB800]' },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm">
                <div className={`text-3xl font-heading font-extrabold ${s.color}`}>
                  <AnimatedNumber value={s.value} suffix={s.suffix} />
                </div>
                <div className="text-xs text-text-muted font-mono mt-1 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Scroll</span>
          <div className="w-5 h-8 rounded-full border border-white/10 flex justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-[#00E5FF] animate-bounce" />
          </div>
        </div>
      </section>

      {/* ══════════ FEATURES ══════════ */}
      <section id="features" className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-mono text-[#00E5FF] uppercase tracking-widest">Features</span>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-text-primary mt-3 mb-4">
              Everything You Need for IPL Analysis
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              From live scores to AI insights — a complete toolkit for cricket analysts, fans, and content creators.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              delay={0}
              accent="from-[#FF2D78]/20 to-[#FF2D78]/5"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
                </svg>
              }
              title="Live Scores & Schedule"
              description="Real-time cricket scores via CricAPI with IPL 2026 full schedule, countdown to next match, and team filtering."
            />
            <FeatureCard
              delay={80}
              accent="from-[#00E5FF]/20 to-[#00E5FF]/5"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              }
              title="Interactive Dashboard"
              description="KPIs, leaderboards, win charts, and season trends — all filterable with multi-season selection and animated counters."
            />
            <FeatureCard
              delay={160}
              accent="from-[#B8FF00]/20 to-[#B8FF00]/5"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              }
              title="Ask Cricket AI"
              description="Ask any question in plain English. Powered by Gemini AI with context-aware SQL generation and instant chart rendering."
            />
            <FeatureCard
              delay={240}
              accent="from-[#FFB800]/20 to-[#FFB800]/5"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              }
              title="Content Studio"
              description="Generate share-ready stat cards for Twitter, Instagram, and LinkedIn. Player stats, match summaries, and comparison templates with AI captions."
            />
            <FeatureCard
              delay={320}
              accent="from-[#FF2D78]/20 to-[#FF2D78]/5"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              }
              title="Player Impact Scores"
              description="Proprietary impact scoring with 15+ weighted metrics. Auto-detects player roles and ranks across batting, bowling, and all-round ability."
            />
            <FeatureCard
              delay={400}
              accent="from-[#8B5CF6]/20 to-[#8B5CF6]/5"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              }
              title="Head-to-Head Analysis"
              description="Compare any two teams or players across all dimensions with super over resolution and historical matchup records."
            />
          </div>
        </div>
      </section>

      {/* ══════════ DEEP DIVE SHOWCASES ══════════ */}
      <section className="relative py-24 sm:py-32 border-t border-white/[0.04]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(184,255,0,0.03)_0%,transparent_60%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-mono text-[#B8FF00] uppercase tracking-widest">Deep Dive</span>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-text-primary mt-3 mb-4">
              Explore Every Angle of IPL Cricket
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <ShowcaseCard
              delay={0}
              title="Innings DNA & Six Evolution"
              description="Animated area charts that draw in real-time, perfect for recording screen captures."
              gradient="from-[#00E5FF] to-[#00E5FF]/50"
              features={[
                'Slow-draw animation with replay button',
                'Zoom in/out controls with data overlays',
                'Avg runs per over across 1-20 with powerplay markers',
                'Sixes per match evolution across all seasons',
              ]}
            />
            <ShowcaseCard
              delay={100}
              title="Batting & Bowling Matrix"
              description="Scatter plot impact analysis with player avatar bubbles and one-by-one reveal animations."
              gradient="from-[#FF2D78] to-[#FF2D78]/50"
              features={[
                'Strike Rate vs Average scatter with player images',
                'Economy vs Bowling Avg impact quadrants',
                'Animated player reveal with zoom controls',
                'Season filtering across all matrix views',
              ]}
            />
            <ShowcaseCard
              delay={200}
              title="Orange & Purple Cap Tracker"
              description="Complete season-by-season cap winners list with clickable player profiles."
              gradient="from-[#FFB800] to-[#8B5CF6]"
              features={[
                'Most runs scorer per season (Orange Cap)',
                'Most wickets taker per season (Purple Cap)',
                'Click any player to view full career stats',
                'Chase analysis and dismissal breakdowns',
              ]}
            />
            <ShowcaseCard
              delay={300}
              title="Interactive Venue Map"
              description="India map with all IPL grounds plotted as clickable markers with match counts."
              gradient="from-[#B8FF00] to-[#B8FF00]/50"
              features={[
                'Zoomable India map with venue markers',
                'Click any ground to see venue profile',
                'Multi-venue city navigation (top venue auto-select)',
                '30+ venue name normalizations for clean data',
              ]}
            />
            <ShowcaseCard
              delay={400}
              title="Season Explorer"
              description="Points table, results, and performance deep-dive for every IPL season since 2008."
              gradient="from-[#00E5FF] to-[#FF2D78]"
              features={[
                'Points table with super over resolution',
                'Cap race charts with cumulative match data',
                'Season summary with key stats and milestones',
                'Team season breakdowns with W/L/T/NR tracking',
              ]}
            />
            <ShowcaseCard
              delay={500}
              title="Cricket Pulse & Trends"
              description="AI-generated trending stories, on-this-day moments, and social content."
              gradient="from-[#8B5CF6] to-[#FF2D78]"
              features={[
                'On-this-day historical IPL moments',
                'Trending stat highlights auto-generated',
                'Social media ready content blocks',
                'Neon Noir styled card layouts',
              ]}
            />
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section className="relative py-24 sm:py-32 border-t border-white/[0.04]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,229,255,0.03)_0%,transparent_70%)] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-mono text-[#FF2D78] uppercase tracking-widest">How It Works</span>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-text-primary mt-3 mb-4">
              From Raw Data to Insights in Seconds
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Sign Up Free', desc: 'Create an account with email or Google. Takes 10 seconds.', color: '#00E5FF' },
              { step: '02', title: 'Explore & Query', desc: 'Browse the dashboard, check live scores, or ask AI anything about IPL.', color: '#B8FF00' },
              { step: '03', title: 'Create & Share', desc: 'Generate branded stat cards and infographics ready for Twitter/Instagram.', color: '#FF2D78' },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                {i < 2 && (
                  <div className="hidden sm:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-white/10 to-transparent" />
                )}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 border border-white/[0.06]"
                  style={{ background: `linear-gradient(135deg, ${item.color}15, transparent)` }}>
                  <span className="font-heading font-extrabold text-2xl" style={{ color: item.color }}>{item.step}</span>
                </div>
                <h3 className="font-heading font-bold text-text-primary text-lg mb-2">{item.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TECH STRIP ══════════ */}
      <section className="py-16 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <span className="text-xs font-mono text-text-muted uppercase tracking-widest">Powered By</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-text-muted">
            {['React', 'FastAPI', 'DuckDB', 'Gemini AI', 'CricAPI', 'Tailwind CSS', 'Recharts'].map(tech => (
              <div key={tech} className="flex items-center gap-2 text-sm font-mono opacity-50 hover:opacity-100 transition-opacity">
                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                {tech}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section className="relative py-24 sm:py-32 border-t border-white/[0.04]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(255,45,120,0.05)_0%,transparent_60%)] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-heading font-extrabold text-3xl sm:text-5xl text-text-primary mb-6 leading-tight">
            Ready to unlock the{' '}
            <span className="bg-gradient-to-r from-[#00E5FF] to-[#B8FF00] bg-clip-text text-transparent">
              full power
            </span>{' '}
            of IPL data?
          </h2>
          <p className="text-text-secondary text-lg mb-10 max-w-xl mx-auto">
            Join cricket enthusiasts, analysts, and content creators who use Crickrida every day.
          </p>
          <Link to="/login"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#00E5FF] text-black font-bold text-lg hover:brightness-110 transition-all shadow-[0_0_40px_rgba(0,229,255,0.25)]">
            Get Started — It's Free
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="border-t border-white/[0.04] py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Crickrida" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-heading font-bold text-sm text-text-primary">Crickrida</span>
            <span className="text-text-muted text-xs font-mono">Cricket via Stats</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="https://twitter.com/Rkjat65" target="_blank" rel="noopener noreferrer"
              className="text-text-muted hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="https://github.com/rkjat65" target="_blank" rel="noopener noreferrer"
              className="text-text-muted hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
            </a>
          </div>

          <p className="text-text-muted text-xs font-mono">
            &copy; {new Date().getFullYear()} Crickrida. All data from public sources.
          </p>
        </div>
      </footer>
    </div>
  )
}
