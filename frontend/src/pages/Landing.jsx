import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import SEO from '../components/SEO'

/* ── Hero Background ───────────────────────────────────────── */
function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-accent-cyan/10 blur-[120px] animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-accent-magenta/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
    </div>
  )
}

/* ── Animated Number ────────────────────────────────────────── */
function AnimatedNumber({ value, suffix = '', duration = 2000 }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
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
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, duration])

  return <span ref={ref}>{display.toLocaleString()}{suffix}</span>
}

/* ── Mock Gallery (Replacing Map) ───────────────────────────── */
function MockVenueGallery({ animate }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-2 bg-[#0A0A0F] rounded-2xl border border-white/5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`relative h-16 rounded-xl overflow-hidden transition-all duration-700 ${animate ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`} style={{ transitionDelay: `${i * 100}ms` }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
          <div className="absolute bottom-2 left-2 h-1 w-4 bg-accent-cyan rounded-full" />
        </div>
      ))}
    </div>
  )
}

/* ── Feature Card ───────────────────────────────────────────── */
function FeatureCard({ icon, title, description, accent, delay }) {
  return (
    <div 
      className="group relative p-8 rounded-[32px] border border-white/5 bg-white/[0.02] transition-all duration-500 hover:bg-white/[0.05] hover:border-white/10"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center mb-6 text-white shadow-2xl group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-xl font-black font-heading text-white mb-3 tracking-tight">{title}</h3>
      <p className="text-text-secondary text-sm leading-relaxed">{description}</p>
    </div>
  )
}

export function LandingContent() {
  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-8">
        <HeroBackground />
        
        <div className="relative z-10 max-w-6xl mx-auto text-center space-y-12">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-accent-lime animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Season 2026 Ready &bull; Live Intelligence</span>
          </div>

          <h1 className="text-6xl md:text-8xl lg:text-[120px] font-black font-heading tracking-[-0.05em] leading-[0.85] text-white">
            CRICKET <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan via-accent-magenta to-accent-amber bg-[length:200%_200%] animate-[gradient-x_4s_ease_infinite]">INTELLIGENCE</span>
          </h1>

          <p className="text-xl md:text-2xl text-text-secondary max-w-3xl mx-auto leading-relaxed font-medium">
            The command center for elite IPL analysis. Deep-dive into 17 years of history with AI-powered insights and high-fidelity visualizations.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6">
            <Link to="/login" className="px-12 py-5 bg-accent-cyan text-black font-black uppercase tracking-[0.2em] text-xs rounded-full hover:scale-105 transition-transform shadow-[0_0_50px_rgba(0,240,255,0.3)]">
              Launch Dashboard
            </Link>
            <Link to="/login" className="px-12 py-5 border border-white/10 text-white font-black uppercase tracking-[0.2em] text-xs rounded-full hover:bg-white/5 transition-colors">
              Explore History
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto pt-12">
            {[
              { label: 'Battles', val: 1169, color: 'text-accent-cyan' },
              { label: 'Legends', val: 600, color: 'text-accent-magenta' },
              { label: 'Seasons', val: 17, color: 'text-accent-lime' },
              { label: 'Metrics', val: 40, color: 'text-accent-amber' }
            ].map(s => (
              <div key={s.label} className="space-y-1">
                <p className={`text-4xl md:text-5xl font-black font-heading tracking-tighter ${s.color}`}>
                  <AnimatedNumber value={s.val} suffix="+" />
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 animate-bounce">
           <div className="w-[1px] h-12 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </section>

      {/* ── FEATURES GRID ─────────────────────────────────────── */}
      <section className="py-32 px-8 max-w-7xl mx-auto">
        <div className="text-center mb-24 space-y-4">
           <span className="text-[10px] font-black uppercase tracking-[0.4em] text-accent-cyan">The Ecosystem</span>
           <h2 className="text-4xl md:text-6xl font-black font-heading tracking-tighter">Advanced Analytics Suite</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard 
            delay={0} accent="from-accent-cyan/40 to-transparent" 
            title="Command Center" description="A unified dashboard featuring real-time KPIs, leaderboards, and seasonal trends for every team."
            icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          />
          <FeatureCard 
            delay={100} accent="from-accent-magenta/40 to-transparent" 
            title="Ask Cricket AI" description="Natural language queries powered by Gemini. Ask any question and get instant data-driven charts."
            icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
          />
          <FeatureCard 
            delay={200} accent="from-accent-lime/40 to-transparent" 
            title="Stadium Postcards" description="High-fidelity venue profiles featuring cinematic night shots and deep ground-level insights."
            icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="py-20 px-8 border-t border-white/5 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-text-muted mb-4">Crickrida Intelligence &copy; 2026</p>
        <div className="flex justify-center gap-8">
           {['Archive', 'Teams', 'Venues', 'Rivalries'].map(l => <span key={l} className="text-xs font-bold text-text-muted hover:text-white cursor-pointer transition-colors">{l}</span>)}
        </div>
      </footer>
    </>
  )
}

export default function Landing() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white overflow-x-hidden selection:bg-accent-cyan selection:text-black">
      <SEO 
        title="Crickrida - Elite IPL Intelligence" 
        description="The ultimate command center for IPL analytics. 17+ years of data, AI insights, and cinematic stadium profiles." 
      />

      {/* ── NAVBAR ────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/60 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-magenta p-[1px]">
               <div className="w-full h-full rounded-[11px] bg-[#0A0A0F] flex items-center justify-center font-black text-xl italic tracking-tighter">C</div>
            </div>
            <span className="text-xl font-black font-heading tracking-tighter">Crickrida</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link to="/login" className="text-sm font-black uppercase tracking-widest text-text-muted hover:text-white transition-colors">Sign In</Link>
            <Link to="/login" className="px-6 py-2.5 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:scale-105 transition-transform shadow-2xl">Get Started</Link>
          </div>
        </div>
      </nav>

      <LandingContent />

      <style>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  )
}
