import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { getTeamStats, getTeamSeasons, getTeamH2H, getTeams, getBattingMatrix, getBowlingMatrix } from '../lib/api'
import Loading from '../components/ui/Loading'
import LeaderboardShowcaseModal from '../components/ui/LeaderboardShowcaseModal'
import { formatNumber, formatDecimal } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import SEO from '../components/SEO'
import PlayerNameCell from '../components/ui/PlayerNameCell'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from 'recharts'

/* ── Custom Components ────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#16161F] border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-black flex items-center gap-2" style={{ color: entry.color || '#E8E8ED' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-mono">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </p>
      ))}
    </div>
  )
}

function SeasonMetricCard({ row, accent, index }) {
  const wins = Number(row?.wins || 0)
  const losses = Number(row?.losses || 0)
  const total = Math.max(wins + losses, 1)
  const winPct = Math.round((wins / total) * 100)
  
  return (
    <div 
      className="relative overflow-hidden rounded-[28px] border border-white/5 bg-[#0B0E16] p-6 transition-all duration-500 hover:border-white/10 group"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center justify-between mb-6">
        <span className="text-2xl font-black font-heading text-white tracking-tighter italic">{row?.season}</span>
        <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">{row.matches} Mat</span>
      </div>
      
      <div className="flex items-end gap-2 mb-6">
        <span className="text-4xl font-black font-heading leading-[0.8] tracking-tighter" style={{ color: accent }}>{winPct}%</span>
        <span className="text-[9px] text-text-muted uppercase font-black pb-1 tracking-[0.2em]">Efficiency</span>
      </div>

      <div className="space-y-2">
        <div className="flex h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div className="h-full transition-all duration-1000" style={{ width: `${(wins/total)*100}%`, backgroundColor: accent }} />
        </div>
        <div className="flex justify-between font-mono text-[10px] font-black uppercase">
          <span style={{ color: accent }}>{wins} Wins</span>
          <span className="text-white/20">{losses} Losses</span>
        </div>
      </div>
    </div>
  )
}

function ProfileStat({ label, value, color, meta = "" }) {
  return (
    <div className="bg-[#0B0E16] border border-white/5 rounded-3xl p-8 transition-all hover:border-white/10 group">
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted mb-3">{label}</p>
      <p className="text-4xl font-black font-heading tracking-tighter text-white group-hover:scale-105 transition-transform origin-left">{value}<span className="text-sm font-black ml-1 text-white/20">{meta}</span></p>
      <div className="h-1 w-12 rounded-full mt-4" style={{ backgroundColor: color }} />
    </div>
  )
}

export default function TeamProfile() {
  const { teamName } = useParams()
  const decoded = decodeURIComponent(teamName)
  const color = getTeamColor(decoded)
  const [showcaseConfig, setShowcaseConfig] = useState(null)

  const { data: stats, loading: statsLoading, error: statsError } = useFetch(() => getTeamStats(decoded), [decoded])
  const { data: seasons, loading: seasonsLoading } = useFetch(() => getTeamSeasons(decoded), [decoded])
  const { data: h2h, loading: h2hLoading } = useFetch(() => getTeamH2H(decoded), [decoded])
  const { data: teams } = useFetch(() => getTeams(), [])
  
  // High-fidelity Performers
  const { data: batters, loading: batLoad } = useFetch(() => getBattingMatrix(null, 1, decoded), [decoded])
  const { data: bowlers, loading: bowlLoad } = useFetch(() => getBowlingMatrix(null, 1, decoded), [decoded])

  const sortedSeasons = useMemo(() => (seasons || []).slice().reverse(), [seasons])
  const topBatters = useMemo(() => (batters || []).slice(0, 5), [batters])
  const topBowlers = useMemo(() => (bowlers || []).slice(0, 5), [bowlers])

  if (statsError) return <div className="py-20 text-center text-danger font-black font-heading">Franchise Data Sync Error</div>

  return (
    <div className="space-y-16 pb-24">
      <SEO title={`${decoded} - Franchise HQ`} />

      {/* ── CINEMATIC FRANCHISE HEADER ───────────────────────── */}
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0B0E16] p-10 md:p-20">
        <div 
          className="absolute inset-0 opacity-10 blur-[120px] animate-pulse"
          style={{ background: `radial-gradient(circle at 20% 30%, ${color}, transparent), radial-gradient(circle at 80% 70%, #00F0FF, transparent)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E16] via-transparent to-transparent" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-end justify-between gap-12">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="relative group shrink-0">
              <div className="absolute inset-0 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity" style={{ backgroundColor: color }} />
              <TeamLogo team={decoded} size={160} className="relative drop-shadow-[0_0_40px_rgba(255,255,255,0.1)] group-hover:scale-105 transition-transform duration-700" />
            </div>
            <div className="text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-6">
                <span className="px-4 py-1.5 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-[10px] font-black uppercase tracking-[0.3em] text-accent-cyan">
                  Franchise Mainframe
                </span>
                {stats?.titles > 0 && (
                  <span className="px-4 py-1.5 rounded-full bg-accent-amber/10 border border-accent-amber/20 text-[10px] font-black uppercase tracking-[0.3em] text-accent-amber animate-pulse">
                    {stats.titles}x Championship Legacy
                  </span>
                )}
              </div>
              <h1 className="text-5xl md:text-8xl font-black font-heading text-white tracking-tighter leading-[0.8]">
                {decoded}
              </h1>
            </div>
          </div>
        </div>
      </section>

      {/* ── PERFORMANCE GRID ─────────────────────────────────── */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           <ProfileStat label="Deployments" value={stats.matches} color="cyan" meta="Matches" />
           <ProfileStat label="Win Index" value={formatDecimal(stats.win_pct, 1)} color={color} meta="%" />
           <ProfileStat label="Scoring Peak" value={formatDecimal(stats.avg_score, 0)} color="lime" meta="Avg" />
           <ProfileStat label="Legacy Titles" value={stats.titles || 0} color="amber" meta="🏆" />
        </div>
      )}

      {/* ── ELITE STRIKE FORCE ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
         {/* Batting Unit */}
         <section className="space-y-8">
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 rounded-full bg-accent-lime" />
                  <div>
                     <h2 className="text-2xl font-black font-heading text-white tracking-tighter uppercase">Firepower Matrix</h2>
                     <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">Leading Batting Units</p>
                  </div>
               </div>
               <button 
                  onClick={() => setShowcaseConfig({
                    title: `${decoded} Firepower`,
                    items: topBatters.map(b => ({ player: b.player, value: b.runs, sr: b.sr })),
                    metricLabel: 'Runs', accent: '#B8FF00',
                    detailFields: [{ key: 'sr', label: 'SR', formatter: (v) => formatDecimal(v, 1) }]
                  })}
                  className="px-4 py-2 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-accent-lime hover:bg-accent-lime hover:text-black transition-all"
               >
                 Launch Intel
               </button>
            </div>
            <div className="space-y-3">
               {batLoad ? <Loading message="Syncing batting data..." /> : topBatters.map((b, i) => (
                 <div key={b.player} className="group relative overflow-hidden rounded-[24px] border border-white/5 bg-[#0B0E16] p-5 flex items-center justify-between transition-all hover:border-white/20">
                    <div className="flex items-center gap-6">
                       <span className="text-[10px] font-black text-white/20 italic">{i + 1}</span>
                       <PlayerNameCell name={b.player} to={`/batting/${encodeURIComponent(b.player)}`} size={40} />
                    </div>
                    <div className="text-right">
                       <p className="text-2xl font-black font-heading text-accent-lime tracking-tighter">{b.runs}</p>
                       <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">{b.innings} Innings &bull; {formatDecimal(b.sr, 0)} SR</p>
                    </div>
                 </div>
               ))}
            </div>
         </section>

         {/* Bowling Unit */}
         <section className="space-y-8">
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 rounded-full bg-accent-magenta" />
                  <div>
                     <h2 className="text-2xl font-black font-heading text-white tracking-tighter uppercase">Execution Matrix</h2>
                     <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">Strategic Bowling Assets</p>
                  </div>
               </div>
               <button 
                  onClick={() => setShowcaseConfig({
                    title: `${decoded} Execution`,
                    items: topBowlers.map(b => ({ player: b.player, value: b.wickets, econ: b.economy })),
                    metricLabel: 'Wickets', accent: '#FF2D78',
                    detailFields: [{ key: 'econ', label: 'Econ', formatter: (v) => formatDecimal(v, 1) }]
                  })}
                  className="px-4 py-2 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-accent-magenta hover:bg-accent-magenta hover:text-black transition-all"
               >
                 Launch Intel
               </button>
            </div>
            <div className="space-y-3">
               {bowlLoad ? <Loading message="Syncing bowling data..." /> : topBowlers.map((b, i) => (
                 <div key={b.player} className="group relative overflow-hidden rounded-[24px] border border-white/5 bg-[#0B0E16] p-5 flex items-center justify-between transition-all hover:border-white/20">
                    <div className="flex items-center gap-6">
                       <span className="text-[10px] font-black text-white/20 italic">{i + 1}</span>
                       <PlayerNameCell name={b.player} to={`/bowling/${encodeURIComponent(b.player)}`} size={40} />
                    </div>
                    <div className="text-right">
                       <p className="text-2xl font-black font-heading text-accent-magenta tracking-tighter">{b.wickets}</p>
                       <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">{b.innings} Innings &bull; {formatDecimal(b.economy, 1)} Econ</p>
                    </div>
                 </div>
               ))}
            </div>
         </section>
      </div>

      {/* ── SEASON TIMELINE ──────────────────────────────────── */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-2 h-8 rounded-full bg-accent-cyan" />
              <div>
                 <h2 className="text-3xl font-black font-heading text-white tracking-tighter uppercase">Era DNA</h2>
                 <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1">Historical Efficiency Matrix</p>
              </div>
           </div>
        </div>

        {seasonsLoading ? (
          <Loading message="Decoding era intelligence..." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sortedSeasons.map((row, idx) => (
              <SeasonMetricCard key={row.season} row={row} accent={color} index={idx} />
            ))}
          </div>
        )}
      </section>

      {/* ── ANALYTICS HUB ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#0B0E16] rounded-[40px] border border-white/5 p-10">
           <h3 className="text-2xl font-black font-heading text-white mb-2 uppercase tracking-tighter italic">Combat Record</h3>
           <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-10">Outcome distribution across seasons</p>
           <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={seasons}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="season" axisLine={false} tickLine={false} tick={{ fill: '#ffffff20', fontSize: 10, fontWeight: 900 }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff05' }} />
                    <Bar dataKey="wins" stackId="a" fill={color} radius={[0, 0, 0, 0]} barSize={32} />
                    <Bar dataKey="losses" stackId="a" fill="#FF2D78" opacity={0.4} radius={[8, 8, 0, 0]} barSize={32} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-[#0B0E16] rounded-[40px] border border-white/5 p-10">
           <h3 className="text-2xl font-black font-heading text-white mb-2 uppercase tracking-tighter italic">Consistency Peak</h3>
           <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-10">Win probability trend analysis</p>
           <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={seasons}>
                    <defs>
                       <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={color} stopOpacity={0} />
                       </linearGradient>
                    </defs>
                    <XAxis dataKey="season" axisLine={false} tickLine={false} tick={{ fill: '#ffffff20', fontSize: 10, fontWeight: 900 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="win_pct" stroke={color} strokeWidth={4} fill="url(#areaGrad)" dot={{ r: 6, fill: color, stroke: '#0B0E16', strokeWidth: 3 }} />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* ── RIVALRY MATRIX ───────────────────────────────────── */}
      <section className="space-y-8">
        <div className="flex items-center gap-3">
           <div className="w-2 h-8 rounded-full bg-accent-magenta" />
           <div>
              <h2 className="text-3xl font-black font-heading text-white tracking-tighter uppercase">Rivalry Ops</h2>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1">Head-to-Head Tactical Matrix</p>
           </div>
        </div>

        {h2hLoading ? <Loading /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(h2h || []).sort((a,b) => b.played - a.played).map((rival, idx) => {
              const winPct = (rival.won / rival.played) * 100
              return (
                <Link 
                  key={rival.opponent} 
                  to={`/h2h?team1=${encodeURIComponent(decoded)}&team2=${encodeURIComponent(rival.opponent)}`}
                  className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#0B0E16] p-6 flex flex-col justify-between transition-all hover:border-white/20 hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-8">
                    <TeamLogo team={rival.opponent} size={56} className="grayscale group-hover:grayscale-0 transition-all duration-700 drop-shadow-lg group-hover:scale-110" />
                    <div className="text-right">
                       <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">{rival.played} Ops</p>
                       <p className="text-xl font-black font-heading text-white tracking-tighter mt-1">{rival.won}-{rival.lost}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                     <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-cyan transition-all duration-1000 shadow-[0_0_10px_rgba(0,229,255,0.5)]" style={{ width: `${winPct}%` }} />
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-[8px] font-black uppercase text-accent-cyan">Win Ratio</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white">{Math.round(winPct)}%</p>
                     </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <LeaderboardShowcaseModal
        open={Boolean(showcaseConfig)}
        onClose={() => setShowcaseConfig(null)}
        {...showcaseConfig}
      />
    </div>
  )
}
