import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { getVenueStats, getVenueTopPerformers } from '../lib/api'
import Loading from '../components/ui/Loading'
import LeaderboardShowcaseModal from '../components/ui/LeaderboardShowcaseModal'
import PlayerNameCell from '../components/ui/PlayerNameCell'
import TeamLogo from '../components/ui/TeamLogo'
import { formatDecimal, formatNumber } from '../utils/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area
} from 'recharts'
import SEO from '../components/SEO'
import {
  GlassTooltipSurface,
  CHART_ANIMATION,
  cartesianGridProps,
  axisTickPrimary,
  useChartGradientIds,
} from '../components/charts'

/* ── Custom Tooltip ───────────────────────────────────────── */
function DashboardTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <GlassTooltipSurface eyebrow={label}>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-black flex items-center gap-2" style={{ color: entry.color }}>
          {entry.name}: <span className="font-mono">{entry.value}</span>
        </p>
      ))}
    </GlassTooltipSurface>
  )
}

/* ── Metric Card ─────────────────────────────────────────── */
function MetricCard({ label, value, color, hint }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/5 bg-[#0B0E16] p-6 group transition-all hover:border-white/10">
      <div className="relative z-10">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted mb-2">{label}</p>
        <p className="text-3xl font-black font-heading text-white">{value}</p>
        {hint && <p className="mt-2 text-[10px] font-bold text-white/30 uppercase tracking-tighter">{hint}</p>}
      </div>
      <div className="absolute bottom-0 left-0 h-1 w-full opacity-20" style={{ backgroundColor: color }} />
    </div>
  )
}

export default function VenueProfile() {
  const { venueName } = useParams()
  const decoded = decodeURIComponent(venueName)
  const [showcaseConfig, setShowcaseConfig] = useState(null)
  const cg = useChartGradientIds('venue')

  const { data: stats, loading: statsLoading, error: statsError } = useFetch(() => getVenueStats(decoded), [decoded])
  const { data: performers, loading: perfLoading } = useFetch(() => getVenueTopPerformers(decoded), [decoded])

  const topBatters = (performers?.top_batters || []).slice(0, 10)
  const topBowlers = (performers?.top_bowlers || []).slice(0, 10)

  // Scoring Patterns Data
  const scoringData = useMemo(() => {
    if (!stats?.scoring_patterns) return []
    const p = stats.scoring_patterns
    return [
      { name: '< 150', count: p.low_scores || 0, fill: '#64748B' },
      { name: '150-179', count: p.medium_scores || 0, fill: '#00E5FF' },
      { name: '180-199', count: p.high_scores || 0, fill: '#B8FF00' },
      { name: '200+', count: p.massive_scores || 0, fill: '#FF2D78' }
    ]
  }, [stats])

  if (statsError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-heading text-lg font-black uppercase tracking-widest">Ground Connection Failed</p>
        <p className="text-text-secondary text-sm">{statsError}</p>
        <Link to="/venues" className="px-6 py-2 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest">Return to Gallery</Link>
      </div>
    )
  }

  return (
    <div className="space-y-12 pb-20">
      <SEO
        title={`${decoded} IPL Stats — Ground Records & Pitch Analysis | Crickrida`}
        description={`IPL stats at ${decoded} — average first-innings score, chase success rate, toss impact, and complete match results. Full ground-by-ground analysis for ${decoded}.`}
        keywords={`${decoded} IPL, ${decoded} cricket stats, ${decoded} average score, IPL venue stats, cricket ground analysis`}
        url={`https://crickrida.rkjat.in/venues/${encodeURIComponent(decoded)}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SportsActivityLocation",
          "name": decoded,
          "description": `IPL cricket ground profile for ${decoded} with match statistics, average scores, and historical results.`,
          "url": `https://crickrida.rkjat.in/venues/${encodeURIComponent(decoded)}`,
          "sport": "Cricket",
          "address": { "@type": "PostalAddress", "addressCountry": "IN" }
        }}
      />

      {/* ── CINEMATIC HERO ────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0B0E16] min-h-[440px] flex items-end">
        <div className="absolute inset-0">
          <img
            src={`/api/venues/${encodeURIComponent(decoded)}/image`}
            alt={decoded}
            className="w-full h-full object-cover opacity-30"
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E16] via-transparent to-transparent" />
        </div>

        <div className="relative w-full p-10 md:p-16 flex flex-col lg:flex-row lg:items-end justify-between gap-12">
          <div className="max-w-3xl">
            <Link to="/venues" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-accent-cyan hover:text-white transition-colors mb-8">
              &larr; Return to Venue Gallery
            </Link>
            <span className="inline-block px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-[10px] font-black uppercase tracking-[0.4em] text-accent-cyan mb-6">
              Ground Command Center
            </span>
            <h1 className="text-5xl md:text-8xl font-black font-heading text-white tracking-tighter leading-[0.85] mb-4">
               {decoded.split(',')[0]}
            </h1>
            <p className="text-xl text-text-muted font-bold tracking-tight uppercase">{decoded.split(',')[1] || 'Major Hub'}</p>
          </div>

          {!statsLoading && stats?.stats && (
            <div className="flex gap-12 border-t lg:border-t-0 lg:border-l border-white/10 pt-8 lg:pt-0 lg:pl-12">
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Battles</p>
                  <p className="text-5xl font-black font-heading text-white tracking-tighter">{stats.stats.matches}</p>
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Avg 1st Inn</p>
                  <p className="text-5xl font-black font-heading text-accent-cyan tracking-tighter">{Math.round(stats.stats.avg_1st_innings)}</p>
               </div>
            </div>
          )}
        </div>
      </section>

      {/* ── TERRITORY STATS ───────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {!statsLoading && stats?.stats && (
          <>
            <MetricCard label="Avg 2nd Inn" value={Math.round(stats.stats.avg_2nd_innings)} color="#FF2D78" hint="Chasing Temperament" />
            <MetricCard label="Highest Total" value={stats.stats.highest_total || '-'} color="#B8FF00" hint="Scoring Peak" />
            <MetricCard label="Avg Wickets" value={formatDecimal(stats.stats.avg_wickets, 1)} color="#00E5FF" hint="Bowling Threat" />
            <MetricCard label="Defending Edge" value={`${formatDecimal(stats.stats.bat_first_win_pct, 1)}%`} color="#FFB800" hint="Bat First Win Rate" />
          </>
        )}
      </section>

      {/* ── STRATEGY OPS ───────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-[#0B0E16] rounded-[32px] border border-white/5 p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-cyan/5 blur-[60px]" />
          <h3 className="text-xl font-black font-heading text-white mb-6 uppercase tracking-tighter">Strategy Intel</h3>
          <div className="space-y-6">
             <div className="flex justify-between items-end border-b border-white/5 pb-4">
                <div>
                   <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Toss Luck Factor</p>
                   <p className="text-sm font-bold text-white">Win Match after Win Toss</p>
                </div>
                <p className="text-2xl font-black font-heading text-accent-cyan">{stats?.stats?.toss_win_pct}%</p>
             </div>
             <div className="flex justify-between items-end border-b border-white/5 pb-4">
                <div>
                   <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Batting Pressure</p>
                   <p className="text-sm font-bold text-white">Defending 1st Innings</p>
                </div>
                <p className="text-2xl font-black font-heading text-accent-lime">{stats?.stats?.bat_first_win_pct}%</p>
             </div>
             <div className="flex justify-between items-end">
                <div>
                   <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Innings Pace</p>
                   <p className="text-sm font-bold text-white">Avg Score per Innings</p>
                </div>
                <p className="text-2xl font-black font-heading text-accent-magenta">{stats?.stats?.avg_score}</p>
             </div>
          </div>
        </div>

        {/* Scoring Evolution */}
        <div className="lg:col-span-2 bg-[#0B0E16] rounded-[32px] border border-white/5 p-8">
           <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black font-heading text-white uppercase tracking-tighter">Scoring Evolution</h3>
              <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.3em]">Season-wise Trend</span>
           </div>
           <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={stats?.seasons} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    <defs>
                       <linearGradient id={cg.area} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
                       </linearGradient>
                    </defs>
                    <CartesianGrid {...cartesianGridProps} />
                    <XAxis dataKey="season" axisLine={false} tickLine={false} tick={axisTickPrimary} />
                    <YAxis axisLine={false} tickLine={false} tick={axisTickPrimary} width={36} />
                    <Tooltip content={<DashboardTooltip />} />
                    <Area type="monotone" dataKey="avg_score" name="Avg score" stroke="#00E5FF" strokeWidth={3} fill={`url(#${cg.area})`} dot={{ r: 4, fill: '#00E5FF' }} activeDot={{ r: 6 }} {...CHART_ANIMATION} />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>
      </section>

      {/* ── DATA VISUALIZATION CENTER ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Scoring Distribution */}
        <section className="bg-[#0B0E16] rounded-[32px] border border-white/5 p-8 md:p-10">
           <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black font-heading text-white tracking-tight">Scoring Pulse</h3>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Innings-wise bucket distribution</p>
              </div>
           </div>
           <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={scoringData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                    <CartesianGrid {...cartesianGridProps} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8888A0', fontSize: 10, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={axisTickPrimary} width={32} />
                    <Tooltip content={<DashboardTooltip />} />
                    <Bar dataKey="count" radius={[10, 10, 0, 0]} name="Occurrences" {...CHART_ANIMATION}>
                       {scoringData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.fill} />
                       ))}
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </section>

        {/* Team Dominance */}
        <section className="bg-[#0B0E16] rounded-[32px] border border-white/5 p-8 md:p-10">
           <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black font-heading text-white tracking-tight">Territory Ownership</h3>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Franchise performance at this venue</p>
              </div>
           </div>
           <div className="space-y-4 max-h-72 overflow-y-auto scrollbar-hide pr-2">
              {!statsLoading && stats?.team_performance?.map((tp, idx) => (
                <div key={tp.team} className="flex items-center justify-between group p-3 rounded-2xl hover:bg-white/5 transition-all">
                   <div className="flex items-center gap-4">
                      <TeamLogo team={tp.team} size={36} />
                      <div>
                        <p className="text-sm font-black text-white group-hover:text-accent-cyan transition-colors">{tp.team}</p>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">{tp.matches} Matches played</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-lg font-black font-heading text-white">{tp.win_pct}%</p>
                      <div className="flex items-center gap-1.5 justify-end">
                         <span className="w-1 h-1 rounded-full bg-accent-lime" />
                         <p className="text-[9px] font-bold text-accent-lime uppercase tracking-widest">{tp.wins} Wins</p>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </section>
      </div>

      {/* ── TOP PERFORMERS ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Batting */}
        <section className="space-y-8">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                 <div className="w-1.5 h-8 rounded-full bg-accent-lime" />
                 <h2 className="text-3xl font-black font-heading text-white tracking-tighter uppercase">Ground Titans</h2>
              </div>
              <button 
                 onClick={() => setShowcaseConfig({
                   title: `${decoded} Titans`,
                   items: topBatters.map(b => ({ player: b.player, value: b.runs, sr: b.sr })),
                   metricLabel: 'Runs', accent: '#B8FF00',
                   detailFields: [{ key: 'sr', label: 'SR', formatter: (v) => formatDecimal(v, 1) }]
                 })}
                 className="px-4 py-2 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-accent-lime hover:bg-accent-lime hover:text-black transition-all"
              >
                Launch Showcase
              </button>
           </div>
           <div className="space-y-3">
              {perfLoading ? <Loading message="Analyzing batters..." /> : topBatters.map((b, i) => (
                <div key={b.player} className="group relative overflow-hidden rounded-[24px] border border-white/5 bg-[#0B0E16] p-5 flex items-center justify-between transition-all hover:border-white/20">
                   <div className="flex items-center gap-6">
                      <span className="text-[10px] font-black text-white/20 italic">{i + 1}</span>
                      <PlayerNameCell name={b.player} to={`/batting/${encodeURIComponent(b.player)}`} size={40} />
                   </div>
                   <div className="text-right">
                      <p className="text-2xl font-black font-heading text-accent-lime tracking-tighter">{b.runs}</p>
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">{b.matches} Matches &bull; {formatDecimal(b.sr, 0)} SR</p>
                   </div>
                </div>
              ))}
           </div>
        </section>

        {/* Bowling */}
        <section className="space-y-8">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                 <div className="w-1.5 h-8 rounded-full bg-accent-magenta" />
                 <h2 className="text-3xl font-black font-heading text-white tracking-tighter uppercase">Ball Masters</h2>
              </div>
              <button 
                 onClick={() => setShowcaseConfig({
                   title: `${decoded} Masters`,
                   items: topBowlers.map(b => ({ player: b.player, value: b.wickets, econ: b.economy })),
                   metricLabel: 'Wickets', accent: '#FF2D78',
                   detailFields: [{ key: 'econ', label: 'Econ', formatter: (v) => formatDecimal(v, 1) }]
                 })}
                 className="px-4 py-2 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-accent-magenta hover:bg-accent-magenta hover:text-black transition-all"
              >
                Launch Showcase
              </button>
           </div>
           <div className="space-y-3">
              {perfLoading ? <Loading message="Analyzing bowlers..." /> : topBowlers.map((b, i) => (
                <div key={b.player} className="group relative overflow-hidden rounded-[24px] border border-white/5 bg-[#0B0E16] p-5 flex items-center justify-between transition-all hover:border-white/20">
                   <div className="flex items-center gap-6">
                      <span className="text-[10px] font-black text-white/20 italic">{i + 1}</span>
                      <PlayerNameCell name={b.player} to={`/bowling/${encodeURIComponent(b.player)}`} size={40} />
                   </div>
                   <div className="text-right">
                      <p className="text-2xl font-black font-heading text-accent-magenta tracking-tighter">{b.wickets}</p>
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">{b.matches} Matches &bull; {formatDecimal(b.economy, 1)} Econ</p>
                   </div>
                </div>
              ))}
           </div>
        </section>
      </div>

      <LeaderboardShowcaseModal
        open={Boolean(showcaseConfig)}
        onClose={() => setShowcaseConfig(null)}
        {...showcaseConfig}
      />
    </div>
  )
}
