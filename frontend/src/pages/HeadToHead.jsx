import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import SEO from '../components/SEO'
import { useFetch } from '../hooks/useFetch'
import { getTeams, compareTeams } from '../lib/api'
import Loading from '../components/ui/Loading'
import { formatNumber, formatDecimal, formatDate } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import PlayerNameCell from '../components/ui/PlayerNameCell'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts'

/* ── Custom Tooltip ───────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md">
      <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-6 mb-1 last:mb-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-xs font-bold text-text-secondary">{entry.name}</span>
          </div>
          <span className="text-xs font-mono font-bold text-text-primary">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function MetricRow({ label, val1, val2, color1, color2, isDecimal = false }) {
  const n1 = parseFloat(val1) || 0
  const n2 = parseFloat(val2) || 0
  const maxVal = Math.max(n1, n2, 1)
  
  return (
    <div className="py-6 border-b border-border-subtle last:border-b-0 group">
      <p className="text-center text-[10px] font-black text-text-muted uppercase tracking-widest mb-4 transition-colors group-hover:text-text-secondary">{label}</p>
      <div className="flex items-center gap-6">
        <div className="flex-1 flex flex-col items-end gap-2">
           <span className="font-mono text-xl font-black" style={{ color: n1 >= n2 ? color1 : '#ffffff20' }}>{isDecimal ? formatDecimal(n1, 1) : n1}</span>
           <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex justify-end">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(n1/maxVal)*100}%`, backgroundColor: color1 }} />
           </div>
        </div>
        <div className="flex-1 flex flex-col items-start gap-2">
           <span className="font-mono text-xl font-black" style={{ color: n2 >= n1 ? color2 : '#ffffff20' }}>{isDecimal ? formatDecimal(n2, 1) : n2}</span>
           <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(n2/maxVal)*100}%`, backgroundColor: color2 }} />
           </div>
        </div>
      </div>
    </div>
  )
}

export default function HeadToHead() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [team1, setTeam1] = useState(searchParams.get('team1') || '')
  const [team2, setTeam2] = useState(searchParams.get('team2') || '')
  const rivalryRef = useRef(null)

  const { data: teams } = useFetch(() => getTeams(), [])
  const bothSelected = team1 && team2 && team1 !== team2

  const { data: comparison, loading: compLoading, error: compError } = useFetch(
    () => (bothSelected ? compareTeams(team1, team2) : Promise.resolve(null)),
    [team1, team2]
  )

  useEffect(() => {
    const params = new URLSearchParams()
    if (team1) params.set('team1', team1)
    if (team2) params.set('team2', team2)
    setSearchParams(params, { replace: true })
  }, [team1, team2, setSearchParams])

  const color1 = team1 ? getTeamColor(team1) : '#00E5FF'
  const color2 = team2 ? getTeamColor(team2) : '#FF2D78'
  const abbr1 = team1 ? getTeamAbbr(team1) : 'T1'
  const abbr2 = team2 ? getTeamAbbr(team2) : 'T2'

  const cumulativeData = useMemo(() => {
    if (!comparison?.season_wise_h2h) return []
    let cum1 = 0, cum2 = 0
    return comparison.season_wise_h2h.map(s => {
      cum1 += s.team1_wins || 0
      cum2 += s.team2_wins || 0
      return { season: String(s.season), [abbr1]: cum1, [abbr2]: cum2 }
    })
  }, [comparison, abbr1, abbr2])

  const phaseData = useMemo(() => {
    if (!comparison) return []
    const phases = ['powerplay', 'middle', 'death']
    return phases.map(p => ({
      phase: p.toUpperCase(),
      [abbr1]: comparison.team1.phases[p] || 0,
      [abbr2]: comparison.team2.phases[p] || 0
    }))
  }, [comparison, abbr1, abbr2])

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24">
      <SEO title="Head to Head - Team Comparison & Rivalry Analytics" />

      {/* ── PROFESSIONAL HEADER ──────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[32px] border border-border-subtle bg-bg-card p-10 md:p-16">
        <div className="absolute inset-0 bg-gradient-to-br from-bg-elevated to-transparent opacity-50" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-12">
          <div className="max-w-2xl space-y-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/20 bg-accent-cyan/5 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-accent-cyan mb-6">
                Comparative Analytics Module
              </span>
              <h1 className="text-5xl md:text-7xl font-black font-heading text-text-primary tracking-tighter leading-none">
                H2H <br /> <span className="text-text-muted">INSIGHTS</span>
              </h1>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6 items-center">
               <div className="w-full md:w-64 space-y-2">
                  <label className="text-[9px] font-black text-text-muted uppercase tracking-widest px-1">Primary Team</label>
                  <select 
                    value={team1} 
                    onChange={(e) => setTeam1(e.target.value)}
                    className="w-full"
                  >
                     <option value="">Select Team</option>
                     {teams?.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
               </div>
               <div className="text-text-muted font-black italic opacity-20">VS</div>
               <div className="w-full md:w-64 space-y-2">
                  <label className="text-[9px] font-black text-text-muted uppercase tracking-widest px-1">Comparison Team</label>
                  <select 
                    value={team2} 
                    onChange={(e) => setTeam2(e.target.value)}
                    className="w-full"
                  >
                     <option value="">Select Team</option>
                     {teams?.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 w-full lg:w-96">
             <div className="bg-bg-elevated border border-border-subtle rounded-2xl p-6 transition-colors hover:border-accent-cyan/40">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2">Matches Played</p>
                <p className="text-4xl font-black font-heading text-text-primary">{comparison?.head_to_head?.played || '—'}</p>
             </div>
             <div className="bg-bg-elevated border border-border-subtle rounded-2xl p-6 transition-colors hover:border-accent-magenta/40">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2">Win Gap</p>
                <p className="text-4xl font-black font-heading text-text-primary">
                   {comparison?.head_to_head ? Math.abs(comparison.head_to_head.team1_wins - comparison.head_to_head.team2_wins) : '—'}
                </p>
             </div>
          </div>
        </div>
      </section>

      {/* ── STATUS ──────────────────────────────────── */}
      {bothSelected && compLoading && <Loading message="Calculating historical metrics..." />}
      {bothSelected && compError && (
        <div className="text-center py-20 bg-bg-card rounded-3xl border border-border-subtle">
           <h2 className="text-xl font-black text-danger uppercase tracking-tight">Data Retrieval Failed</h2>
           <p className="text-text-muted mt-2 text-sm">{compError}</p>
        </div>
      )}

      {/* ── COMPARISON DASHBOARD ─────────────────────────────────── */}
      {bothSelected && comparison && !compLoading && (
        <div ref={rivalryRef} className="space-y-12 animate-in">
           
           {/* 1. WIN DISTRIBUTION */}
           <div className="bg-bg-card rounded-[32px] border border-border-subtle p-8 md:p-12 shadow-xl">
              <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-12">
                 <div className="flex flex-col items-center md:items-start gap-4">
                    <TeamLogo team={team1} size={90} />
                    <h2 className="text-3xl font-black font-heading tracking-tighter" style={{ color: color1 }}>{abbr1}</h2>
                 </div>
                 <div className="text-center">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">Historical Win Split</p>
                    <div className="flex items-center gap-8">
                       <span className="text-6xl md:text-8xl font-black font-heading text-text-primary">{comparison.head_to_head.team1_wins}</span>
                       <span className="text-2xl font-black text-text-muted italic opacity-20">/</span>
                       <span className="text-6xl md:text-8xl font-black font-heading text-text-primary">{comparison.head_to_head.team2_wins}</span>
                    </div>
                 </div>
                 <div className="flex flex-col items-center md:items-end gap-4">
                    <TeamLogo team={team2} size={90} />
                    <h2 className="text-3xl font-black font-heading tracking-tighter" style={{ color: color2 }}>{abbr2}</h2>
                 </div>
              </div>

              <div className="relative h-3 w-full bg-white/5 rounded-full overflow-hidden flex">
                 <div className="h-full transition-all duration-1000 shadow-glow-cyan" style={{ width: `${(comparison.head_to_head.team1_wins/comparison.head_to_head.played)*100}%`, backgroundColor: color1 }} />
                 <div className="h-full transition-all duration-1000 shadow-glow-magenta" style={{ width: `${(comparison.head_to_head.team2_wins/comparison.head_to_head.played)*100}%`, backgroundColor: color2 }} />
              </div>
           </div>

           {/* 2. ANALYTICS GRID */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-bg-card rounded-[32px] border border-border-subtle p-10 shadow-lg">
                 <h3 className="text-lg font-black text-text-primary mb-10 uppercase tracking-tight">Core Metrics</h3>
                 <div className="space-y-4">
                    <MetricRow label="Avg Score" val1={comparison.avg_h2h_scores.team1_avg} val2={comparison.avg_h2h_scores.team2_avg} color1={color1} color2={color2} isDecimal />
                    <MetricRow label="Peak Score" val1={comparison.team1.highest_total} val2={comparison.team2.highest_total} color1={color1} color2={color2} />
                    <MetricRow label="Toss Advantage" val1={comparison.toss_stats.team1_toss_wins} val2={comparison.toss_stats.team2_toss_wins} color1={color1} color2={color2} />
                    <MetricRow label="Chase Efficiency" val1={comparison.toss_stats.chase_wins} val2={comparison.head_to_head.played - comparison.toss_stats.chase_wins} color1="#00E5FF" color2="#FF2D78" />
                 </div>
              </div>

              <div className="bg-bg-card rounded-[32px] border border-border-subtle p-10 shadow-lg">
                 <h3 className="text-lg font-black text-text-primary mb-2 uppercase tracking-tight">Phase Performance</h3>
                 <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-10">Run Rate Index</p>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <RadarChart cx="50%" cy="50%" outerRadius="80%" data={phaseData}>
                          <PolarGrid stroke="#ffffff05" />
                          <PolarAngleAxis dataKey="phase" tick={{fill: '#555566', fontSize: 10, fontWeight: 900}} />
                          <Radar name={abbr1} dataKey={abbr1} stroke={color1} fill={color1} fillOpacity={0.2} />
                          <Radar name={abbr2} dataKey={abbr2} stroke={color2} fill={color2} fillOpacity={0.2} />
                          <Tooltip content={<ChartTooltip />} />
                       </RadarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="bg-bg-card rounded-[32px] border border-border-subtle p-10 shadow-lg">
                 <h3 className="text-lg font-black text-text-primary mb-2 uppercase tracking-tight">Historical Growth</h3>
                 <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-10">Cumulative Victory Points</p>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={cumulativeData}>
                          <defs>
                             <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color1} stopOpacity={0.2}/><stop offset="95%" stopColor={color1} stopOpacity={0}/></linearGradient>
                             <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color2} stopOpacity={0.2}/><stop offset="95%" stopColor={color2} stopOpacity={0}/></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                          <XAxis dataKey="season" axisLine={false} tickLine={false} tick={{fill: '#555566', fontSize: 10, fontWeight: 900}} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey={abbr1} stroke={color1} strokeWidth={3} fill="url(#g1)" />
                          <Area type="monotone" dataKey={abbr2} stroke={color2} strokeWidth={3} fill="url(#g2)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           {/* 3. TOP PERFORMERS */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <section className="space-y-8">
                 <h2 className="text-xl font-black text-text-primary tracking-tight uppercase border-l-4 border-accent-lime pl-4">H2H Batting Leaders</h2>
                 <div className="space-y-4">
                    {comparison.top_batters.map((b, i) => (
                       <div key={b.player} className="group bg-bg-card border border-border-subtle rounded-2xl p-5 flex items-center justify-between transition-all hover:border-accent-lime/40">
                          <div className="flex items-center gap-6">
                             <span className="text-xs font-black text-text-muted">{i + 1}</span>
                             <PlayerNameCell name={b.player} size={40} />
                          </div>
                          <div className="text-right">
                             <p className="text-2xl font-black text-text-primary tracking-tighter">{b.runs}</p>
                             <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">{b.matches} matches &bull; {formatDecimal(b.sr, 1)} SR</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </section>

              <section className="space-y-8">
                 <h2 className="text-xl font-black text-text-primary tracking-tight uppercase border-l-4 border-accent-magenta pl-4">H2H Bowling Leaders</h2>
                 <div className="space-y-4">
                    {comparison.top_bowlers.map((b, i) => (
                       <div key={b.player} className="group bg-bg-card border border-border-subtle rounded-2xl p-5 flex items-center justify-between transition-all hover:border-accent-magenta/40">
                          <div className="flex items-center gap-6">
                             <span className="text-xs font-black text-text-muted">{i + 1}</span>
                             <PlayerNameCell name={b.player} size={40} />
                          </div>
                          <div className="text-right">
                             <p className="text-2xl font-black text-text-primary tracking-tighter">{b.wickets}</p>
                             <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">{b.matches} matches &bull; {formatDecimal(b.economy, 1)} Econ</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </section>
           </div>

           {/* 4. RECENT ENCOUNTERS */}
           <div className="bg-bg-card rounded-[32px] border border-border-subtle overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-border-subtle bg-bg-elevated/50 flex justify-between items-center">
                 <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Match History</h3>
                 <span className="px-3 py-1 rounded-md bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">Last 10 Encounters</span>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="border-b border-border-subtle bg-bg-card">
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Season</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Winner</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">{abbr1} Score</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">{abbr2} Score</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Result</th>
                       </tr>
                    </thead>
                    <tbody className="text-sm">
                       {comparison.recent_matches.map((m, idx) => (
                          <tr key={idx} className="border-b border-border-subtle hover:bg-bg-card-hover transition-colors group">
                             <td className="px-8 py-5">
                                <p className="font-bold text-text-primary">{m.season}</p>
                                <p className="text-[10px] text-text-muted uppercase">{formatDate(m.date)}</p>
                             </td>
                             <td className="px-8 py-5">
                                <span className="px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-white/5 bg-white/5 text-text-primary">
                                   {m.winner ? getTeamAbbr(m.winner) : 'No Result'}
                                </span>
                             </td>
                             <td className="px-8 py-5 text-center font-mono font-bold text-text-primary">{m.team1_score}</td>
                             <td className="px-8 py-5 text-center font-mono font-bold text-text-primary">{m.team2_score}</td>
                             <td className="px-8 py-5 text-xs font-medium text-text-secondary">{m.margin}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
