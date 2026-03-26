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

// ── Mini UI Mockups for showcase cards ──────────────────────────────

function MockDashboard({ animate }) {
  return (
    <div className="bg-[#0A0A0F] rounded-lg p-3 border border-white/[0.06]">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {[
          { label: 'Matches', val: '1,169', c: '#00E5FF' },
          { label: 'Runs', val: '3,73,973', c: '#FF2D78' },
          { label: 'Wickets', val: '13,794', c: '#B8FF00' },
          { label: 'Sixes', val: '14,243', c: '#FFB800' },
        ].map((k, i) => (
          <div key={i} className="bg-white/[0.03] rounded p-1.5 text-center" style={{ animationDelay: `${i * 150}ms` }}>
            <div className="text-[8px] uppercase tracking-wider" style={{ color: k.c }}>{k.label}</div>
            <div className={`text-[10px] font-bold text-white font-mono ${animate ? 'animate-pulse' : ''}`}>{k.val}</div>
          </div>
        ))}
      </div>
      {/* Chart mockup */}
      <div className="h-16 flex items-end gap-[3px]">
        {[40, 65, 55, 80, 70, 90, 60, 75, 85, 50, 95, 70].map((h, i) => (
          <div key={i} className="flex-1 rounded-t transition-all duration-1000"
            style={{
              height: animate ? `${h}%` : '4px',
              background: `linear-gradient(to top, #00E5FF${i % 2 ? '40' : '80'}, #00E5FF10)`,
              transitionDelay: `${i * 80}ms`,
            }} />
        ))}
      </div>
    </div>
  )
}

function MockLiveScores({ animate }) {
  return (
    <div className="bg-[#0A0A0F] rounded-lg p-3 border border-white/[0.06]">
      {/* Match cards */}
      {[
        { t1: 'CSK', t2: 'MI', s1: '185/4', s2: '142/8', status: 'CSK won by 43 runs', live: false },
        { t1: 'RCB', t2: 'SRH', s1: '108/3', s2: '', status: 'In Progress', live: true },
      ].map((m, i) => (
        <div key={i} className={`rounded-lg p-2 mb-2 border transition-all duration-700 ${
          m.live ? 'border-[#FF2D78]/30 bg-[#FF2D78]/5' : 'border-white/[0.04] bg-white/[0.02]'
        }`} style={{ opacity: animate ? 1 : 0, transform: animate ? 'translateX(0)' : 'translateX(-20px)', transitionDelay: `${i * 200}ms` }}>
          {m.live && <div className="flex items-center gap-1 mb-1"><span className="w-1.5 h-1.5 rounded-full bg-[#FF2D78] animate-pulse" /><span className="text-[7px] font-bold text-[#FF2D78] uppercase">Live</span></div>}
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-white">{m.t1}</span>
            <span className="text-[8px] font-mono text-[#00E5FF]">{m.s1}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-white">{m.t2}</span>
            <span className="text-[8px] font-mono text-[#00E5FF]">{m.s2 || '—'}</span>
          </div>
          <div className="text-[7px] text-white/40 mt-1">{m.status}</div>
        </div>
      ))}
    </div>
  )
}

function MockAIChat({ animate }) {
  return (
    <div className="bg-[#0A0A0F] rounded-lg p-3 border border-white/[0.06]">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-4 h-4 rounded bg-[#B8FF00]/20 flex items-center justify-center"><span className="text-[6px] text-[#B8FF00]">AI</span></div>
        <span className="text-[8px] text-white/60 font-mono">Ask Cricket AI</span>
      </div>
      <div className={`bg-white/[0.03] rounded p-2 mb-2 border border-white/[0.04] transition-all duration-500 ${animate ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-[8px] text-white/80">Who hit most sixes in IPL 2023?</span>
      </div>
      <div className={`bg-[#B8FF00]/5 rounded p-2 border border-[#B8FF00]/10 transition-all duration-700 ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '400ms' }}>
        <span className="text-[7px] text-[#B8FF00]">AI Response</span>
        <div className="mt-1 space-y-0.5">
          {['1. F du Plessis — 37', '2. SA Yadav — 35', '3. HH Pandya — 30'].map((r, i) => (
            <div key={i} className="text-[7px] text-white/70 font-mono">{r}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MockContentStudio({ animate }) {
  return (
    <div className="bg-[#0A0A0F] rounded-lg p-3 border border-white/[0.06]">
      <div className="flex gap-2">
        {/* Left config panel */}
        <div className="w-1/3 space-y-1.5">
          <div className="text-[7px] text-white/40 uppercase">Template</div>
          <div className="flex gap-1">
            {['Stats', 'H2H'].map((t, i) => (
              <div key={i} className={`text-[6px] px-1.5 py-0.5 rounded ${i === 0 ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'bg-white/[0.04] text-white/30'}`}>{t}</div>
            ))}
          </div>
          <div className="text-[7px] text-white/40 uppercase mt-1">Format</div>
          <div className="flex gap-1">
            {['16:9', '1:1', '9:16'].map((f, i) => (
              <div key={i} className={`text-[5px] px-1 py-0.5 rounded ${i === 0 ? 'bg-[#FFB800]/20 text-[#FFB800]' : 'bg-white/[0.04] text-white/30'}`}>{f}</div>
            ))}
          </div>
        </div>
        {/* Right preview */}
        <div className={`flex-1 bg-[#111118] rounded border border-white/[0.06] p-2 transition-all duration-700 ${animate ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
          <div className="text-[6px] text-[#00E5FF] uppercase mb-1">Batting Stats</div>
          <div className="text-[9px] font-bold text-white mb-1">V Kohli</div>
          <div className="grid grid-cols-3 gap-1">
            {[{ l: 'Mat', v: '259' }, { l: 'Runs', v: '8,661' }, { l: 'SR', v: '133' }].map((s, i) => (
              <div key={i} className="bg-white/[0.04] rounded p-0.5 text-center">
                <div className="text-[5px] text-[#FF2D78]">{s.l}</div>
                <div className="text-[7px] font-bold text-white font-mono">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MockVenueMap({ animate }) {
  // Simplified India outline with venue dots
  const venues = [
    { x: 25, y: 30, name: 'Delhi', size: 4 },
    { x: 72, y: 72, name: 'Kolkata', size: 5 },
    { x: 22, y: 55, name: 'Mumbai', size: 6 },
    { x: 38, y: 78, name: 'Bengaluru', size: 5 },
    { x: 35, y: 70, name: 'Hyderabad', size: 4 },
    { x: 42, y: 85, name: 'Chennai', size: 5 },
    { x: 30, y: 45, name: 'Ahmedabad', size: 4 },
    { x: 52, y: 22, name: 'Chandigarh', size: 3 },
  ]
  return (
    <div className="bg-[#0A0A0F] rounded-lg p-3 border border-white/[0.06] relative overflow-hidden" style={{ height: 120 }}>
      {/* Map background shape */}
      <svg viewBox="0 0 100 100" className="absolute inset-2 opacity-10" fill="none" stroke="#00E5FF" strokeWidth="0.5">
        <path d="M45,5 L55,8 L65,15 L70,25 L72,35 L75,50 L70,65 L60,80 L50,90 L45,95 L35,85 L25,75 L20,60 L18,45 L20,30 L25,20 L35,10 Z" />
      </svg>
      {/* Venue dots */}
      {venues.map((v, i) => (
        <div key={i} className="absolute transition-all duration-500"
          style={{
            left: `${v.x}%`, top: `${v.y}%`,
            opacity: animate ? 1 : 0,
            transform: animate ? 'scale(1)' : 'scale(0)',
            transitionDelay: `${i * 120}ms`,
          }}>
          <div className="relative">
            <div className="rounded-full bg-[#B8FF00] animate-ping absolute inset-0 opacity-20" style={{ width: v.size * 2, height: v.size * 2 }} />
            <div className="rounded-full bg-[#B8FF00]" style={{ width: v.size * 2, height: v.size * 2 }} />
            <span className="absolute left-3 top-[-2px] text-[5px] text-white/60 whitespace-nowrap">{v.name}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function MockCapTracker({ animate }) {
  const caps = [
    { season: '2024', orange: 'V Kohli', runs: '741', purple: 'H Patel', wkts: '24' },
    { season: '2023', orange: 'S Gill', runs: '890', purple: 'M Shami', wkts: '28' },
    { season: '2022', orange: 'J Buttler', runs: '863', purple: 'YS Chahal', wkts: '27' },
  ]
  return (
    <div className="bg-[#0A0A0F] rounded-lg p-3 border border-white/[0.06]">
      <div className="flex gap-3">
        {/* Orange Cap */}
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#FFB800]" />
            <span className="text-[7px] font-bold text-[#FFB800] uppercase">Orange Cap</span>
          </div>
          {caps.map((c, i) => (
            <div key={i} className={`flex justify-between items-center py-0.5 border-b border-white/[0.03] transition-all duration-500 ${animate ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
              style={{ transitionDelay: `${i * 150}ms` }}>
              <div><span className="text-[6px] text-white/30 mr-1">{c.season}</span><span className="text-[7px] text-white">{c.orange}</span></div>
              <span className="text-[7px] font-mono text-[#FFB800]">{c.runs}</span>
            </div>
          ))}
        </div>
        {/* Purple Cap */}
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6]" />
            <span className="text-[7px] font-bold text-[#8B5CF6] uppercase">Purple Cap</span>
          </div>
          {caps.map((c, i) => (
            <div key={i} className={`flex justify-between items-center py-0.5 border-b border-white/[0.03] transition-all duration-500 ${animate ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
              style={{ transitionDelay: `${i * 150}ms` }}>
              <div><span className="text-[6px] text-white/30 mr-1">{c.season}</span><span className="text-[7px] text-white">{c.purple}</span></div>
              <span className="text-[7px] font-mono text-[#8B5CF6]">{c.wkts}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MockPointsTable({ animate }) {
  const teams = [
    { name: 'CSK', w: 10, l: 4, pts: 20, c: '#FFB800' },
    { name: 'GT', w: 9, l: 5, pts: 18, c: '#1C3F6E' },
    { name: 'MI', w: 8, l: 6, pts: 16, c: '#004BA0' },
    { name: 'RCB', w: 7, l: 7, pts: 14, c: '#E3262A' },
  ]
  return (
    <div className="bg-[#0A0A0F] rounded-lg p-3 border border-white/[0.06]">
      <div className="text-[7px] text-white/40 uppercase mb-1.5">Points Table — IPL 2024</div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 text-[7px]">
        <div className="text-white/30">Team</div><div className="text-white/30">W</div><div className="text-white/30">L</div><div className="text-white/30">Pts</div>
        {teams.map((t, i) => (
          <div key={i} className={`contents transition-all duration-500 ${animate ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: `${i * 120}ms` }}>
            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ background: t.c }} /><span className="text-white font-medium">{t.name}</span></div>
            <div className="text-[#B8FF00] font-mono text-center">{t.w}</div>
            <div className="text-[#FF2D78] font-mono text-center">{t.l}</div>
            <div className="text-[#00E5FF] font-mono font-bold text-center">{t.pts}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Showcase card with visual mockup ────────────────────────────────
function ShowcaseCard({ title, description, gradient, features, delay, mockup }) {
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
      className={`group relative rounded-2xl border border-white/[0.06] bg-[#111118] overflow-hidden transition-all duration-700 hover:border-white/[0.12] ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Gradient top bar */}
      <div className={`h-1 bg-gradient-to-r ${gradient}`} />

      {/* Visual mockup */}
      {mockup && (
        <div className="px-4 pt-4 transition-transform duration-500 group-hover:scale-[1.02]">
          {mockup(visible)}
        </div>
      )}

      <div className="p-5 sm:p-6">
        <h3 className="font-heading font-bold text-lg text-text-primary mb-2">{title}</h3>
        <p className="text-text-secondary text-sm mb-4 leading-relaxed">{description}</p>
        <ul className="space-y-1.5">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-text-secondary">
              <svg className="w-3.5 h-3.5 text-[#00E5FF] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
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
              title="Interactive Dashboard"
              description="Real-time KPIs, leaderboards, and animated trend charts in one glance."
              gradient="from-[#00E5FF] to-[#00E5FF]/50"
              mockup={(vis) => <MockDashboard animate={vis} />}
              features={[
                'Animated counters for matches, runs, wickets, sixes',
                'Season-filterable bar charts and leaderboards',
                'Top batters, bowlers, and team win charts',
                'Downloadable chart images for sharing',
              ]}
            />
            <ShowcaseCard
              delay={100}
              title="Live Scores & Schedule"
              description="Real-time scores via CricAPI with IPL 2026 complete schedule and countdown."
              gradient="from-[#FF2D78] to-[#FF2D78]/50"
              mockup={(vis) => <MockLiveScores animate={vis} />}
              features={[
                'Live match scores with auto-refresh every 15 min',
                'IPL 2026 full 70-match schedule with team filter',
                'Countdown timer to next upcoming match',
                'IPL matches highlighted and sorted first',
              ]}
            />
            <ShowcaseCard
              delay={200}
              title="Ask Cricket AI"
              description="Natural language queries powered by Gemini AI with instant chart responses."
              gradient="from-[#B8FF00] to-[#B8FF00]/50"
              mockup={(vis) => <MockAIChat animate={vis} />}
              features={[
                'Ask any question in plain English',
                'Context-aware SQL generation from your data',
                'Instant table and chart rendering',
                'Powered by Gemini AI model',
              ]}
            />
            <ShowcaseCard
              delay={300}
              title="Content Studio"
              description="Generate share-ready stat cards in branded templates for social media."
              gradient="from-[#FFB800] to-[#FFB800]/50"
              mockup={(vis) => <MockContentStudio animate={vis} />}
              features={[
                'Player stats, match summary, comparison templates',
                'Twitter, Instagram, LinkedIn, Portrait formats',
                'Download PNG or copy to clipboard',
                'AI-generated captions for each platform',
              ]}
            />
            <ShowcaseCard
              delay={400}
              title="Orange & Purple Cap Tracker"
              description="Season-by-season cap winners with clickable player profiles."
              gradient="from-[#FFB800] to-[#8B5CF6]"
              mockup={(vis) => <MockCapTracker animate={vis} />}
              features={[
                'Most runs scorer per season (Orange Cap)',
                'Most wickets taker per season (Purple Cap)',
                'Click any player to view full career stats',
                'Chase analysis and dismissal breakdowns',
              ]}
            />
            <ShowcaseCard
              delay={500}
              title="Interactive Venue Map"
              description="India map with all IPL grounds plotted as animated, clickable markers."
              gradient="from-[#B8FF00] to-[#B8FF00]/50"
              mockup={(vis) => <MockVenueMap animate={vis} />}
              features={[
                'Zoomable India map with venue markers',
                'Click any ground to see venue profile',
                'Multi-venue city auto-navigation',
                '30+ venue name normalizations for clean data',
              ]}
            />
            <ShowcaseCard
              delay={600}
              title="Season Explorer & Points Table"
              description="Full season breakdown with points table, cap races, and team stats."
              gradient="from-[#00E5FF] to-[#FF2D78]"
              mockup={(vis) => <MockPointsTable animate={vis} />}
              features={[
                'Points table with super over resolution',
                'Cap race charts with cumulative match data',
                'Team breakdowns with W/L/T/NR tracking',
                'Every season from 2008 to present',
              ]}
            />
            <ShowcaseCard
              delay={700}
              title="Batting & Bowling Matrix"
              description="Scatter plot impact analysis with player avatars and animated reveal."
              gradient="from-[#FF2D78] to-[#00E5FF]"
              mockup={(vis) => (
                <div className="bg-[#0A0A0F] rounded-lg p-3 border border-white/[0.06] h-[120px] relative overflow-hidden">
                  {/* Quadrant lines */}
                  <div className="absolute left-1/2 top-2 bottom-2 w-px bg-white/[0.06]" />
                  <div className="absolute top-1/2 left-2 right-2 h-px bg-white/[0.06]" />
                  <div className="absolute top-1 right-2 text-[5px] text-[#B8FF00]/60">High SR</div>
                  <div className="absolute bottom-1 left-2 text-[5px] text-[#FF2D78]/60">Low SR</div>
                  {/* Player dots */}
                  {[
                    { x: 70, y: 20, c: '#00E5FF', n: 'VK' },
                    { x: 80, y: 30, c: '#FF2D78', n: 'AB' },
                    { x: 60, y: 25, c: '#B8FF00', n: 'RS' },
                    { x: 45, y: 40, c: '#FFB800', n: 'MS' },
                    { x: 30, y: 60, c: '#8B5CF6', n: 'KL' },
                    { x: 75, y: 45, c: '#00E5FF', n: 'HP' },
                  ].map((p, i) => (
                    <div key={i} className="absolute transition-all duration-700"
                      style={{ left: `${p.x}%`, top: `${p.y}%`, opacity: vis ? 1 : 0, transform: vis ? 'scale(1)' : 'scale(0)', transitionDelay: `${i * 150}ms` }}>
                      <div className="w-4 h-4 rounded-full border flex items-center justify-center" style={{ background: `${p.c}30`, borderColor: `${p.c}60` }}>
                        <span className="text-[5px] font-bold text-white">{p.n}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              features={[
                'Strike Rate vs Average with player images',
                'Economy vs Bowling Avg impact quadrants',
                'Animated one-by-one player reveal',
                'Zoom in/out and data overlays',
              ]}
            />
            <ShowcaseCard
              delay={800}
              title="Cricket Pulse & Trends"
              description="AI-generated trending stories, on-this-day moments, and social content."
              gradient="from-[#8B5CF6] to-[#FF2D78]"
              mockup={(vis) => (
                <div className="bg-[#0A0A0F] rounded-lg p-3 border border-white/[0.06]">
                  {[
                    { tag: 'ON THIS DAY', text: 'Sachin scored his only IPL century (2012)', c: '#FFB800' },
                    { tag: 'TRENDING', text: 'Most expensive over in IPL history', c: '#FF2D78' },
                    { tag: 'RECORD', text: 'Fastest fifty: 14 balls by KL Rahul', c: '#B8FF00' },
                  ].map((s, i) => (
                    <div key={i} className={`mb-1.5 p-1.5 rounded bg-white/[0.02] border border-white/[0.04] transition-all duration-500 ${vis ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}`}
                      style={{ transitionDelay: `${i * 200}ms` }}>
                      <span className="text-[6px] font-bold uppercase tracking-wider" style={{ color: s.c }}>{s.tag}</span>
                      <div className="text-[8px] text-white/80 mt-0.5">{s.text}</div>
                    </div>
                  ))}
                </div>
              )}
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
