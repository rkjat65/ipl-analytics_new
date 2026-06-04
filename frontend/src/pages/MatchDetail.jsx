import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  GlassTooltipSurface,
  CHART_ANIMATION,
  cartesianGridProps,
  axisTickPrimary,
  useChartGradientIds,
} from '../components/charts'
import { useFetch } from '../hooks/useFetch'
import { getMatch } from '../lib/api'
import Loading from '../components/ui/Loading'
import { formatDate, formatDecimal, formatNumber } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import PlayerNameCell from '../components/ui/PlayerNameCell'
import TeamLogo from '../components/ui/TeamLogo'
import SEO from '../components/SEO'

const TABS = ['Match Summary', 'Full Scorecard', 'Performance Analytics', 'Partnerships']

/* ── Custom Tooltips ─────────────────────────────────── */
function ChartTooltip({ active, payload, label, extra }) {
  if (!active || !payload?.length) return null
  return (
    <GlassTooltipSurface eyebrow={extra || `Over ${label}`}>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-8 mb-1 last:mb-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-xs font-bold text-text-secondary">{entry.name}</span>
          </div>
          <span className="text-xs font-mono font-bold text-text-primary">
            {typeof entry.value === 'number' ? formatDecimal(entry.value, 1) : entry.value}
          </span>
        </div>
      ))}
    </GlassTooltipSurface>
  )
}

function MetricCard({ label, value, sub, color = 'cyan', trend }) {
  const colorMap = {
    cyan: 'text-accent-cyan bg-accent-cyan/5 border-accent-cyan/10',
    magenta: 'text-accent-magenta bg-accent-magenta/5 border-accent-magenta/10',
    lime: 'text-accent-lime bg-accent-lime/5 border-accent-lime/10',
    amber: 'text-accent-amber bg-accent-amber/5 border-accent-amber/10',
  }

  return (
    <div className={`rounded-xl border p-4 transition-all hover:scale-[1.01] ${colorMap[color] || colorMap.cyan}`}>
      <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
      <div className="flex items-end justify-between">
        <h4 className="text-2xl font-black font-heading tracking-tight">{value}</h4>
        {trend && (
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${trend > 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {sub && <p className="text-[9px] font-bold opacity-40 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function MatchDetail() {
  const { matchId } = useParams()
  const [activeTab, setActiveTab] = useState('Match Summary')
  const cg = useChartGradientIds('match')

  const { data: matchData, loading, error } = useFetch(
    () => getMatch(matchId),
    [matchId]
  )

  const match = matchData?.info
  const scorecards = matchData?.scorecards || []
  const oversData = matchData?.overs_data || []

  const team1Color = match ? getTeamColor(match.team1) : '#00E5FF'
  const team2Color = match ? getTeamColor(match.team2) : '#FF2D78'

  const wormData = useMemo(() => {
    if (!oversData.length) return []
    const overMap = {}
    for (let i = 0; i <= 20; i++) overMap[i] = { over: i }
    overMap[0].cumulative_1 = 0
    overMap[0].cumulative_2 = 0
    oversData.forEach((o) => {
      const key = o.innings_number === 1 ? '1' : '2'
      const overNum = o.over_number + 1
      if (overMap[overNum]) {
        overMap[overNum][`cumulative_${key}`] = o.cumulative_runs
        if (o.wickets > 0) overMap[overNum][`wicket_${key}`] = o.cumulative_runs
      }
    })
    return Object.values(overMap)
  }, [oversData])

  const phaseData = useMemo(() => {
    if (!oversData.length) return []
    const phases = [
      { name: 'Powerplay (0-6)', start: 0, end: 5 },
      { name: 'Middle (7-15)', start: 6, end: 14 },
      { name: 'Death (16-20)', start: 15, end: 19 }
    ]
    return phases.map(p => {
      const inn1 = oversData.filter(o => o.innings_number === 1 && o.over_number >= p.start && o.over_number <= p.end)
      const inn2 = oversData.filter(o => o.innings_number === 2 && o.over_number >= p.start && o.over_number <= p.end)
      const r1 = inn1.reduce((sum, o) => sum + o.runs, 0)
      const r2 = inn2.reduce((sum, o) => sum + o.runs, 0)
      const w1 = inn1.reduce((sum, o) => sum + (o.wickets || 0), 0)
      const w2 = inn2.reduce((sum, o) => sum + (o.wickets || 0), 0)
      return { 
        name: p.name, 
        [getTeamAbbr(match.team1)]: r1, 
        [getTeamAbbr(match.team2)]: r2,
        [`${getTeamAbbr(match.team1)}_W`]: w1,
        [`${getTeamAbbr(match.team2)}_W`]: w2
      }
    })
  }, [oversData, match])

  if (loading) return <Loading message="Loading match analytics..." />
  if (error || !match) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-6 animate-in">
        <div className="w-20 h-20 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger text-4xl">!</div>
        <div className="text-center">
          <h2 className="text-3xl font-black font-heading text-white tracking-tighter uppercase">Match Not Found</h2>
          <p className="text-text-secondary mt-2">The requested match data could not be retrieved from the archives.</p>
        </div>
        <Link to="/matches" className="px-10 py-4 rounded-xl bg-bg-card border border-border-subtle text-text-primary font-black uppercase tracking-widest text-xs hover:border-accent-cyan transition-all">Return to Matches</Link>
      </div>
    )
  }

  const inn1 = scorecards.find(i => i.innings_number === 1)
  const inn2 = scorecards.find(i => i.innings_number === 2)

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <SEO
        title={`${match.team1} vs ${match.team2} — IPL ${match.season} Match Scorecard | Crickrida`}
        description={`IPL ${match.season} match scorecard: ${match.team1} vs ${match.team2} at ${match.venue}. Full innings breakdown, ball-by-ball stats, player performances, and match result.`}
        keywords={`${match.team1} vs ${match.team2}, IPL ${match.season} match, IPL scorecard, cricket match result`}
        url={`https://crickrida.rkjat.in/matches/${match.id}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          "name": `${match.team1} vs ${match.team2} — IPL ${match.season}`,
          "sport": "Cricket",
          "description": `IPL ${match.season} match between ${match.team1} and ${match.team2} at ${match.venue}.`,
          "url": `https://crickrida.rkjat.in/matches/${match.id}`,
          "location": { "@type": "Place", "name": match.venue, "address": { "@type": "PostalAddress", "addressCountry": "IN" } },
          "startDate": match.date,
          "competitor": [
            { "@type": "SportsTeam", "name": match.team1, "sport": "Cricket" },
            { "@type": "SportsTeam", "name": match.team2, "sport": "Cricket" }
          ]
        }}
      />

      {/* ── PROFESSIONAL HEADER ────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-border-subtle bg-bg-card p-6 md:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-bg-elevated to-transparent opacity-50" />
        
        <div className="relative z-10 space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="flex items-center gap-3">
               <div className="w-1.5 h-10 bg-accent-cyan rounded-full" />
               <div>
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted">{match.season} Season &bull; Match {match.match_number}</p>
                 <h1 className="text-2xl font-black text-text-primary tracking-tight">{match.venue}, {match.city}</h1>
               </div>
             </div>
             <p className="text-xs font-bold text-text-secondary bg-white/5 px-4 py-2 rounded-full border border-white/5">{formatDate(match.date)}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-8 md:gap-16">
            {/* Team 1 */}
            <div className="flex items-center gap-6 justify-center md:justify-end">
              <div className="text-center md:text-right space-y-1">
                <h2 className="text-xl md:text-2xl font-black font-heading text-text-primary tracking-tighter uppercase">{match.team1}</h2>
                <div className="flex flex-col md:items-end">
                  <span className="text-3xl md:text-4xl font-black font-heading text-text-primary">
                    {inn1?.total_runs || 0}<span className="text-text-muted">/{inn1?.total_wickets || 0}</span>
                  </span>
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{Math.floor((inn1?.total_balls || 0)/6)}.{ (inn1?.total_balls || 0)%6 } Overs</span>
                </div>
              </div>
              <TeamLogo team={match.team1} size={70} className="drop-shadow-2xl" />
            </div>

            {/* VS */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-text-muted italic">VS</div>
            </div>

            {/* Team 2 */}
            <div className="flex items-center gap-6 justify-center md:justify-start">
              <TeamLogo team={match.team2} size={70} className="drop-shadow-2xl" />
              <div className="text-center md:text-left space-y-1">
                <h2 className="text-xl md:text-2xl font-black font-heading text-text-primary tracking-tighter uppercase">{match.team2}</h2>
                <div className="flex flex-col md:items-start">
                  <span className="text-3xl md:text-4xl font-black font-heading text-text-primary">
                    {inn2?.total_runs || 0}<span className="text-text-muted">/{inn2?.total_wickets || 0}</span>
                  </span>
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{Math.floor((inn2?.total_balls || 0)/6)}.{ (inn2?.total_balls || 0)%6 } Overs</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 text-center">
             <p className="text-xl md:text-2xl font-black font-heading text-accent-cyan tracking-tight uppercase">
                {match.winner ? `${match.winner} won by ${match.win_by_runs || match.win_by_wickets} ${match.win_by_runs ? 'runs' : 'wickets'}` : match.result}
             </p>
             <div className="mt-6 flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-bg-elevated border border-border-subtle group hover:border-accent-amber transition-colors">
                   <PlayerAvatar name={match.player_of_match} size={32} ringColor="#FFB800" />
                   <div className="text-left">
                     <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Player of Match</p>
                     <p className="text-base font-black text-text-primary">{match.player_of_match}</p>
                   </div>
                </div>
                <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-bg-elevated border border-border-subtle">
                   <div className="text-left">
                     <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Toss Winner</p>
                     <p className="text-base font-black text-text-primary">{match.toss_winner} <span className="text-[10px] text-text-secondary font-medium uppercase tracking-widest">({match.toss_decision})</span></p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* ── KEY PERFORMANCE INDICATORS ────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in">
         <MetricCard label="Innings 1 Run Rate" value={formatDecimal((inn1?.total_runs || 0) * 6 / (inn1?.total_balls || 1), 2)} sub="Runs per 6 balls" />
         <MetricCard label="Innings 2 Run Rate" value={formatDecimal((inn2?.total_runs || 0) * 6 / (inn2?.total_balls || 1), 2)} sub="Runs per 6 balls" color="magenta" />
         <MetricCard label="Boundary Efficiency" value={formatDecimal(20 / ( ( (inn1?.total_runs||0)/10 ) + ( (inn2?.total_runs||0)/10 ) || 1), 1)} sub="Balls per boundary" color="lime" />
         <MetricCard label="Match Intensity" value="High" sub="Analytics Score" color="amber" />
      </section>

      {/* ── DATA TABS ────────────────────────────────────────── */}
      <section className="space-y-8">
        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide px-2">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all border ${
                activeTab === tab 
                ? 'bg-text-primary text-bg-primary border-text-primary shadow-glow-cyan' 
                : 'bg-bg-card text-text-muted border-border-subtle hover:border-text-muted hover:text-text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="min-h-[600px] animate-in-fast">
          {activeTab === 'Match Summary' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                   <div className="bg-bg-card rounded-3xl border border-border-subtle p-8 shadow-xl">
                      <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-8">Match Progression</h3>
                      <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={wormData} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
                            <defs>
                              <linearGradient id={cg.area} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={team1Color} stopOpacity={0.38}/><stop offset="95%" stopColor={team1Color} stopOpacity={0}/></linearGradient>
                              <linearGradient id={cg.areaAlt} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={team2Color} stopOpacity={0.38}/><stop offset="95%" stopColor={team2Color} stopOpacity={0}/></linearGradient>
                            </defs>
                            <CartesianGrid {...cartesianGridProps} />
                            <XAxis dataKey="over" axisLine={false} tickLine={false} tick={axisTickPrimary} />
                            <YAxis axisLine={false} tickLine={false} tick={axisTickPrimary} width={36} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ color: '#8888A0', fontSize: 11 }} />
                            <Area type="monotone" dataKey="cumulative_1" name={getTeamAbbr(match.team1)} stroke={team1Color} strokeWidth={3} fill={`url(#${cg.area})`} dot={false} activeDot={{ r: 5 }} {...CHART_ANIMATION} />
                            <Area type="monotone" dataKey="cumulative_2" name={getTeamAbbr(match.team2)} stroke={team2Color} strokeWidth={3} fill={`url(#${cg.areaAlt})`} dot={false} activeDot={{ r: 5 }} {...CHART_ANIMATION} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                   </div>
                   
                   <div className="bg-bg-card rounded-3xl border border-border-subtle p-8 shadow-xl">
                      <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-8">Phase Dominance</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={phaseData} barGap={12} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                             <CartesianGrid {...cartesianGridProps} />
                             <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8888A0', fontSize: 10, fontWeight: 700 }} />
                             <YAxis axisLine={false} tickLine={false} tick={axisTickPrimary} width={32} />
                             <Tooltip content={<ChartTooltip extra="Phase Total" />} />
                             <Legend />
                             <Bar dataKey={getTeamAbbr(match.team1)} name={getTeamAbbr(match.team1)} fill={team1Color} radius={[6, 6, 0, 0]} {...CHART_ANIMATION} />
                             <Bar dataKey={getTeamAbbr(match.team2)} name={getTeamAbbr(match.team2)} fill={team2Color} radius={[6, 6, 0, 0]} {...CHART_ANIMATION} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                   </div>
                </div>

                <div className="space-y-8">
                   <div className="bg-bg-card rounded-3xl border border-border-subtle p-8 shadow-xl">
                      <h3 className="text-lg font-black text-text-primary uppercase tracking-tight mb-6">Top Performers</h3>
                      <div className="space-y-6">
                         <p className="text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-border-subtle pb-2">Best Batting</p>
                         {scorecards.flatMap(sc => sc.batting).sort((a,b) => b.runs - a.runs).slice(0, 3).map((b, i) => (
                            <div key={i} className="flex items-center justify-between gap-3">
                               <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-xs font-black text-text-muted shrink-0">#{i+1}</span>
                                  <PlayerNameCell name={b.batter} to={`/batting/${encodeURIComponent(b.batter)}`} size={36} className="min-w-0" />
                               </div>
                               <p className="text-lg font-black text-accent-cyan shrink-0">{b.runs} <span className="text-[10px] text-text-muted font-mono">({b.balls})</span></p>
                            </div>
                         ))}

                         <p className="text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-border-subtle pb-2 mt-8">Best Bowling</p>
                         {scorecards.flatMap(sc => sc.bowling).sort((a,b) => b.wickets - a.wickets || a.economy - b.economy).slice(0, 3).map((b, i) => (
                            <div key={i} className="flex items-center justify-between gap-3">
                               <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-xs font-black text-text-muted shrink-0">#{i+1}</span>
                                  <PlayerNameCell name={b.bowler} to={`/bowling/${encodeURIComponent(b.bowler)}`} size={36} className="min-w-0" />
                               </div>
                               <p className="text-lg font-black text-accent-magenta shrink-0">{b.wickets} <span className="text-[10px] text-text-muted font-mono">({b.overs})</span></p>
                            </div>
                         ))}
                      </div>
                   </div>

                   <div className="bg-accent-cyan/5 border border-accent-cyan/10 rounded-3xl p-8">
                      <h4 className="text-sm font-black text-accent-cyan uppercase tracking-widest mb-4">Match Note</h4>
                      <p className="text-xs text-text-secondary leading-relaxed font-medium italic">
                        "A critical encounter at {match.venue} where {match.winner || 'both teams'} showcased high tactical discipline. The {match.win_by_runs ? 'first innings total proved decisive' : 'chase was executed with precision'}."
                      </p>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'Full Scorecard' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in-fast">
                {[1, 2].map(num => {
                  const inn = scorecards.find(i => i.innings_number === num)
                  if (!inn) return null
                  
                  return (
                    <div key={num} className="space-y-6">
                       <div className="flex items-center justify-between p-6 bg-bg-card rounded-2xl border border-border-subtle">
                          <div className="flex items-center gap-4">
                             <TeamLogo team={inn.batting_team} size={48} />
                             <div>
                                <h4 className="text-xl font-black text-text-primary">{inn.batting_team}</h4>
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Innings {num}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-3xl font-black text-text-primary">{inn.total_runs}/{inn.total_wickets}</p>
                             <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{Math.floor(inn.total_balls/6)}.{inn.total_balls%6} Overs</p>
                          </div>
                       </div>
                       
                       <div className="bg-bg-card rounded-2xl border border-border-subtle overflow-hidden">
                          <table className="w-full text-left">
                            <thead className="bg-bg-elevated border-b border-border-subtle">
                               <tr className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                                 <th className="px-6 py-4">Batter</th>
                                 <th className="px-6 py-4 text-right">R</th>
                                 <th className="px-6 py-4 text-right">B</th>
                                 <th className="px-6 py-4 text-right">SR</th>
                               </tr>
                            </thead>
                            <tbody className="text-sm">
                              {inn.batting.map((b, i) => (
                                <tr key={i} className="border-b border-border-subtle hover:bg-bg-card-hover transition-colors">
                                  <td className="px-4 py-3">
                                     <div className="flex items-start gap-3">
                                       <PlayerNameCell name={b.batter} to={`/batting/${encodeURIComponent(b.batter)}`} size={40} className="min-w-0 flex-1" />
                                     </div>
                                     <p className="text-[10px] text-text-muted italic line-clamp-2 mt-2 pl-[52px]">{b.dismissal ? `${b.dismissal} b ${b.dismissed_by}` : 'Not Out'}</p>
                                  </td>
                                  <td className="px-6 py-4 text-right font-black text-text-primary">{b.runs}</td>
                                  <td className="px-6 py-4 text-right font-mono text-text-secondary">{b.balls}</td>
                                  <td className="px-6 py-4 text-right font-mono text-accent-cyan">{formatDecimal(b.strike_rate, 1)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                       </div>

                       <div className="bg-bg-card rounded-2xl border border-border-subtle overflow-hidden">
                          <table className="w-full text-left">
                            <thead className="bg-bg-elevated border-b border-border-subtle">
                               <tr className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                                 <th className="px-6 py-4">Bowler</th>
                                 <th className="px-6 py-4 text-right">O</th>
                                 <th className="px-6 py-4 text-right">R</th>
                                 <th className="px-6 py-4 text-right">W</th>
                                 <th className="px-6 py-4 text-right">EC</th>
                               </tr>
                            </thead>
                            <tbody className="text-sm">
                              {inn.bowling.map((b, i) => (
                                <tr key={i} className="border-b border-border-subtle hover:bg-bg-card-hover transition-colors">
                                  <td className="px-4 py-3">
                                    <PlayerNameCell name={b.bowler} to={`/bowling/${encodeURIComponent(b.bowler)}`} size={36} />
                                  </td>
                                  <td className="px-6 py-4 text-right font-mono text-text-secondary">{b.overs}</td>
                                  <td className="px-6 py-4 text-right font-mono text-text-secondary">{b.runs_conceded}</td>
                                  <td className="px-6 py-4 text-right font-black text-accent-magenta">{b.wickets}</td>
                                  <td className="px-6 py-4 text-right font-mono text-text-muted">{formatDecimal(b.economy, 1)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                       </div>
                    </div>
                  )
                })}
             </div>
          )}

          {activeTab === 'Performance Analytics' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in-fast">
                <div className="bg-bg-card rounded-3xl border border-border-subtle p-8 shadow-xl">
                   <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-8">Over-by-Over Matrix</h3>
                   <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={oversData.filter(o => o.innings_number === 1)} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid {...cartesianGridProps} />
                            <XAxis dataKey="over_number" axisLine={false} tickLine={false} tick={axisTickPrimary} />
                            <YAxis axisLine={false} tickLine={false} tick={axisTickPrimary} />
                            <Tooltip content={<ChartTooltip extra="Over Runs" />} />
                            <Bar dataKey="runs" name="Runs" fill={team1Color} radius={[6, 6, 0, 0]} {...CHART_ANIMATION} />
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                <div className="bg-bg-card rounded-3xl border border-border-subtle p-8 shadow-xl">
                   <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-8">Strike Rate Breakdown</h3>
                   <div className="space-y-6">
                      {scorecards.flatMap(sc => sc.batting).sort((a,b) => b.runs - a.runs).slice(0, 6).map((b, i) => (
                         <div key={i} className="space-y-2">
                            <div className="flex justify-between items-center text-xs font-bold gap-2">
                               <PlayerNameCell name={b.batter} to={`/batting/${encodeURIComponent(b.batter)}`} size={28} className="min-w-0 flex-1" />
                               <span className="text-accent-cyan shrink-0">{formatDecimal(b.strike_rate, 1)} <span className="text-text-muted text-[10px]">SR</span></span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                               <div className="h-full bg-accent-cyan rounded-full transition-all duration-1000" style={{ width: `${Math.min((b.strike_rate / 250) * 100, 100)}%` }} />
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'Partnerships' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in-fast">
                {[1, 2].map(num => {
                  const inn = scorecards.find(i => i.innings_number === num)
                  if (!inn) return null
                  return (
                    <div key={num} className="bg-bg-card rounded-3xl border border-border-subtle p-8 shadow-xl space-y-8">
                       <div className="flex items-center gap-4">
                          <TeamLogo team={inn.batting_team} size={40} />
                          <h4 className="text-lg font-black text-text-primary uppercase tracking-tight">{inn.batting_team} Partnerships</h4>
                       </div>
                       <div className="space-y-6">
                          {inn.partnerships.map((p, i) => (
                            <div key={i} className="group">
                               <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-bold text-text-primary group-hover:text-accent-cyan transition-colors">{p.pair}</span>
                                  <span className="text-sm font-black text-text-primary">{p.runs} <span className="text-[10px] text-text-muted font-mono">({p.balls}b)</span></span>
                               </div>
                               <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-accent-cyan/40 group-hover:bg-accent-cyan transition-all duration-500" style={{ width: `${Math.min((p.runs / 150) * 100, 100)}%` }} />
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  )
                })}
             </div>
          )}

        </div>
      </section>
    </div>
  )
}
