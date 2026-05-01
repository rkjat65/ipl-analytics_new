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

function MetricRow({ label, val1, val2, color1, color2, isDecimal = false }) {
  const n1 = parseFloat(val1) || 0
  const n2 = parseFloat(val2) || 0
  const maxVal = Math.max(n1, n2, 1)
  
  return (
    <div className="py-5 border-b border-white/5 last:border-b-0">
      <p className="text-center text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4">{label}</p>
      <div className="flex items-center gap-6">
        <div className="flex-1 flex flex-col items-end gap-2">
           <span className="font-mono text-xl font-black" style={{ color: n1 >= n2 ? color1 : '#ffffff40' }}>{isDecimal ? formatDecimal(n1, 1) : n1}</span>
           <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex justify-end">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(n1/maxVal)*100}%`, backgroundColor: color1 }} />
           </div>
        </div>
        <div className="flex-1 flex flex-col items-start gap-2">
           <span className="font-mono text-xl font-black" style={{ color: n2 >= n1 ? color2 : '#ffffff40' }}>{isDecimal ? formatDecimal(n2, 1) : n2}</span>
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
  }, [team1, team2])

  const color1 = getTeamColor(team1)
  const color2 = getTeamColor(team2)
  const abbr1 = getTeamAbbr(team1)
  const abbr2 = getTeamAbbr(team2)

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
    <div className="space-y-12 pb-24">
      <SEO title="Rivalry Lab - Combat Intelligence" />

      {/* ── CINEMATIC HEADER ──────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0B0E16] p-10 md:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,229,255,0.08),transparent_40%)]" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-12">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-accent-cyan mb-6">
              Combat Simulation Unit
            </span>
            <h1 className="text-5xl md:text-8xl font-black font-heading text-text-primary tracking-tighter leading-none mb-8">
              RIVALRY <br /> LAB
            </h1>
            <div className="flex flex-col md:flex-row gap-6 items-center">
               <div className="w-full md:w-64 space-y-2">
                  <label className="text-[9px] font-black text-text-muted uppercase tracking-widest px-2">Unit A</label>
                  <select 
                    value={team1} 
                    onChange={(e) => setTeam1(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-black text-xs uppercase tracking-widest outline-none focus:border-accent-cyan transition-all appearance-none"
                  >
                     <option value="">Select Team</option>
                     {teams?.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
               </div>
               <div className="text-white/20 font-black italic">VS</div>
               <div className="w-full md:w-64 space-y-2">
                  <label className="text-[9px] font-black text-text-muted uppercase tracking-widest px-2">Unit B</label>
                  <select 
                    value={team2} 
                    onChange={(e) => setTeam2(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-black text-xs uppercase tracking-widest outline-none focus:border-accent-magenta transition-all appearance-none"
                  >
                     <option value="">Select Team</option>
                     {teams?.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full lg:w-80">
             <div className="bg-[#0B0E16] border border-white/5 rounded-3xl p-6">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">Total Battles</p>
                <p className="text-3xl font-black font-heading text-accent-cyan">{comparison?.head_to_head?.played || '—'}</p>
             </div>
             <div className="bg-[#0B0E16] border border-white/5 rounded-3xl p-6">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">Lead Margin</p>
                <p className="text-3xl font-black font-heading text-accent-lime">
                   {comparison?.head_to_head ? Math.abs(comparison.head_to_head.team1_wins - comparison.head_to_head.team2_wins) : '—'}
                </p>
             </div>
          </div>
        </div>
      </section>

      {/* ── ERROR / LOADING ──────────────────────────────────── */}
      {bothSelected && compLoading && <Loading message="Synthesizing historical matchup DNA..." />}
      {bothSelected && compError && (
        <div className="text-center py-12">
           <h2 className="text-2xl font-black font-heading text-danger uppercase tracking-tighter">Simulation Failure</h2>
           <p className="text-text-secondary mt-2">{compError}</p>
        </div>
      )}

      {/* ── COMBAT ANALYTICS ─────────────────────────────────── */}
      {bothSelected && comparison && !compLoading && (
        <div ref={rivalryRef} className="space-y-12 animate-in">
           
           {/* 1. DOMINANCE OVERLAY */}
           <div className="bg-[#0B0E16] rounded-[40px] border border-white/10 p-8 md:p-12">
              <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-12">
                 <div className="flex flex-col items-center md:items-start gap-4">
                    <TeamLogo team={team1} size={100} />
                    <h2 className="text-4xl font-black font-heading tracking-tighter" style={{ color: color1 }}>{abbr1}</h2>
                 </div>
                 <div className="text-center">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.4em] mb-2">Battle Pulse</p>
                    <div className="flex items-center gap-6">
                       <span className="text-7xl font-black font-heading text-white">{comparison.head_to_head.team1_wins}</span>
                       <span className="text-2xl font-black text-white/10 italic">vs</span>
                       <span className="text-7xl font-black font-heading text-white">{comparison.head_to_head.team2_wins}</span>
                    </div>
                 </div>
                 <div className="flex flex-col items-center md:items-end gap-4">
                    <TeamLogo team={team2} size={100} />
                    <h2 className="text-4xl font-black font-heading tracking-tighter" style={{ color: color2 }}>{abbr2}</h2>
                 </div>
              </div>

              <div className="relative h-4 w-full bg-white/5 rounded-full overflow-hidden flex">
                 <div className="h-full transition-all duration-1000" style={{ width: `${(comparison.head_to_head.team1_wins/comparison.head_to_head.played)*100}%`, backgroundColor: color1, boxShadow: `0 0 40px ${color1}` }} />
                 <div className="h-full transition-all duration-1000" style={{ width: `${(comparison.head_to_head.team2_wins/comparison.head_to_head.played)*100}%`, backgroundColor: color2, boxShadow: `0 0 40px ${color2}` }} />
              </div>
           </div>

           {/* 2. CORE METRICS & PHASE DOMINANCE */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-[#0B0E16] rounded-[40px] border border-white/5 p-10">
                 <h3 className="text-2xl font-black font-heading text-white mb-10 uppercase tracking-tighter italic">Combat Metrics</h3>
                 <div className="space-y-4">
                    <MetricRow label="Avg H2H Score" val1={comparison.avg_h2h_scores.team1_avg} val2={comparison.avg_h2h_scores.team2_avg} color1={color1} color2={color2} isDecimal />
                    <MetricRow label="Highest Total" val1={comparison.team1.highest_total} val2={comparison.team2.highest_total} color1={color1} color2={color2} />
                    <MetricRow label="Toss Advantage" val1={comparison.toss_stats.team1_toss_wins} val2={comparison.toss_stats.team2_toss_wins} color1={color1} color2={color2} />
                    <MetricRow label="Chase Dominance" val1={comparison.toss_stats.chase_wins} val2={comparison.head_to_head.played - comparison.toss_stats.chase_wins} color1="#00E5FF" color2="#FF2D78" />
                 </div>
              </div>

              <div className="lg:col-span-1 bg-[#0B0E16] rounded-[40px] border border-white/5 p-10">
                 <h3 className="text-2xl font-black font-heading text-white mb-2 uppercase tracking-tighter italic">Phase DNA</h3>
                 <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-10">Run Rate by Match Phase</p>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <RadarChart cx="50%" cy="50%" outerRadius="80%" data={phaseData}>
                          <PolarGrid stroke="#ffffff10" />
                          <PolarAngleAxis dataKey="phase" tick={{fill: '#ffffff40', fontSize: 10, fontWeight: 900}} />
                          <Radar name={abbr1} dataKey={abbr1} stroke={color1} fill={color1} fillOpacity={0.3} />
                          <Radar name={abbr2} dataKey={abbr2} stroke={color2} fill={color2} fillOpacity={0.3} />
                          <Tooltip content={<ChartTooltip />} />
                       </RadarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="lg:col-span-1 bg-[#0B0E16] rounded-[40px] border border-white/5 p-10">
                 <h3 className="text-2xl font-black font-heading text-white mb-2 uppercase tracking-tighter italic">Legacy Growth</h3>
                 <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-10">Cumulative Win Trajectory</p>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={cumulativeData}>
                          <defs>
                             <linearGradient id="c1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color1} stopOpacity={0.3}/><stop offset="95%" stopColor={color1} stopOpacity={0}/></linearGradient>
                             <linearGradient id="c2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color2} stopOpacity={0.3}/><stop offset="95%" stopColor={color2} stopOpacity={0}/></linearGradient>
                          </defs>
                          <XAxis dataKey="season" axisLine={false} tickLine={false} tick={{fill: '#ffffff20', fontSize: 10, fontWeight: 900}} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey={abbr1} stroke={color1} strokeWidth={4} fill="url(#c1)" />
                          <Area type="monotone" dataKey={abbr2} stroke={color2} strokeWidth={4} fill="url(#c2)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           {/* 4. ELITE PERFORMERS IN H2H */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <section className="space-y-6">
                 <div className="flex items-center gap-3 px-2">
                    <div className="w-1.5 h-8 rounded-full bg-accent-lime" />
                    <h2 className="text-2xl font-black font-heading text-white tracking-tighter uppercase">Rivalry Titans</h2>
                 </div>
                 <div className="space-y-3">
                    {comparison.top_batters.map((b, i) => (
                       <div key={b.player} className="group relative overflow-hidden rounded-[24px] border border-white/5 bg-[#0B0E16] p-5 flex items-center justify-between transition-all hover:border-white/20">
                          <div className="flex items-center gap-6">
                             <span className="text-[10px] font-black text-white/20 italic">{i + 1}</span>
                             <PlayerNameCell name={b.player} size={40} />
                          </div>
                          <div className="text-right">
                             <p className="text-2xl font-black font-heading text-accent-lime tracking-tighter">{b.runs}</p>
                             <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">{b.matches} Matches &bull; {formatDecimal(b.sr, 0)} SR</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </section>

              <section className="space-y-6">
                 <div className="flex items-center gap-3 px-2">
                    <div className="w-1.5 h-8 rounded-full bg-accent-magenta" />
                    <h2 className="text-2xl font-black font-heading text-white tracking-tighter uppercase">Strike Masters</h2>
                 </div>
                 <div className="space-y-3">
                    {comparison.top_bowlers.map((b, i) => (
                       <div key={b.player} className="group relative overflow-hidden rounded-[24px] border border-white/5 bg-[#0B0E16] p-5 flex items-center justify-between transition-all hover:border-white/20">
                          <div className="flex items-center gap-6">
                             <span className="text-[10px] font-black text-white/20 italic">{i + 1}</span>
                             <PlayerNameCell name={b.player} size={40} />
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

           {/* 5. RECENT CONFLICTS TABLE */}
           <div className="bg-[#0B0E16] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                 <h3 className="text-2xl font-black font-heading text-white italic uppercase tracking-tighter">Combat Log</h3>
                 <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">Last 10 Tactical Encounters</span>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                    <thead>
                       <tr className="border-b border-white/5 bg-white/[0.02]">
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Season</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Victor</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">{abbr1} Score</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">{abbr2} Score</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Margin</th>
                       </tr>
                    </thead>
                    <tbody>
                       {comparison.recent_matches.map((m, idx) => (
                          <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.03] transition-all group">
                             <td className="px-8 py-5">
                                <p className="text-sm font-black text-white">{m.season}</p>
                                <p className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">{formatDate(m.date)}</p>
                             </td>
                             <td className="px-8 py-5">
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border" style={{ 
                                   color: m.winner === team1 ? color1 : (m.winner === team2 ? color2 : '#ffffff'),
                                   borderColor: m.winner === team1 ? `${color1}40` : (m.winner === team2 ? `${color2}40` : '#ffffff20'),
                                   backgroundColor: m.winner === team1 ? `${color1}10` : (m.winner === team2 ? `${color2}10` : '#ffffff05')
                                }}>
                                   {m.winner ? getTeamAbbr(m.winner) : 'Tied'}
                                </span>
                             </td>
                             <td className="px-8 py-5 text-center font-mono text-xl font-black" style={{ color: m.winner === team1 ? color1 : '#ffffff40' }}>{m.team1_score}</td>
                             <td className="px-8 py-5 text-center font-mono text-xl font-black" style={{ color: m.winner === team2 ? color2 : '#ffffff40' }}>{m.team2_score}</td>
                             <td className="px-8 py-5 text-sm font-bold text-text-secondary">{m.margin}</td>
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
