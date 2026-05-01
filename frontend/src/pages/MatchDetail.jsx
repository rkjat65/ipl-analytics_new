import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { getMatch, getWinProbability } from '../lib/api'
import Loading from '../components/ui/Loading'
import { formatDate, formatDecimal } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import TeamLogo from '../components/ui/TeamLogo'
import SEO from '../components/SEO'

const TABS = ['Scorecard', 'Match Report', 'Worm', 'Run Rate Battle', 'Partnerships']

/* ── Custom Tooltips ─────────────────────────────────── */
function ChartTooltip({ active, payload, label, extra }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#16161F] border border-white/10 rounded-lg px-3 py-2 shadow-2xl">
      <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-1">{extra || `Over ${label}`}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs font-bold" style={{ color: entry.color }}>
          {entry.name}: <span className="font-mono">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function MatchDetail() {
  const { matchId } = useParams()
  const [activeTab, setActiveTab] = useState('Scorecard')

  const { data: matchData, loading, error } = useFetch(
    () => getMatch(matchId),
    [matchId]
  )

  const { data: winProbData } = useFetch(
    () => getWinProbability(matchId).catch(() => null),
    [matchId]
  )

  const match = matchData?.info
  const scorecards = matchData?.scorecards || []
  const oversData = matchData?.overs_data || []

  const innings = scorecards.map((sc) => ({
    innings_number: sc.innings_number,
    batting_team: sc.batting_team,
    bowling_team: sc.bowling_team,
    total_runs: sc.total_runs,
    total_wickets: sc.total_wickets,
    total_balls: sc.total_balls,
  }))
  const batting = scorecards.flatMap((sc) => sc.batting || [])
  const bowling = scorecards.flatMap((sc) => (sc.bowling || []).map((b) => ({ ...b, runs: b.runs_conceded })))
  const partnerships = scorecards.flatMap((sc) => sc.partnerships || [])
  const fallOfWickets = scorecards.flatMap((sc) => sc.fall_of_wickets || [])
  const overs = oversData

  const team1Color = match ? getTeamColor(match.team1) : '#00E5FF'
  const team2Color = match ? getTeamColor(match.team2) : '#FF00E5'

  const wormData = useMemo(() => {
    if (!overs.length) return []
    const overMap = {}
    for (let i = 0; i <= 20; i++) overMap[i] = { over: i }
    overMap[0].cumulative_1 = 0
    overMap[0].cumulative_2 = 0
    overs.forEach((o) => {
      const key = o.innings_number === 1 ? '1' : '2'
      const overNum = o.over_number + 1
      if (overMap[overNum]) {
        overMap[overNum][`cumulative_${key}`] = o.cumulative_runs
        if (o.wickets > 0) overMap[overNum][`wicket_${key}`] = o.cumulative_runs
      }
    })
    return Object.values(overMap)
  }, [overs])

  const runRateData = useMemo(() => {
    if (!overs.length) return []
    const inn1 = overs.filter((o) => o.innings_number === 1)
    const inn2 = overs.filter((o) => o.innings_number === 2)
    const target = winProbData?.target || null
    const map1 = new Map(inn1.map((o) => [o.over_number + 1, o.cumulative_runs]))
    const map2 = new Map(inn2.map((o) => [o.over_number + 1, o.cumulative_runs]))
    const rows = []
    for (let over = 1; over <= 20; over += 1) {
      const c1 = map1.get(over)
      const c2 = map2.get(over)
      rows.push({
        over,
        rr1: c1 != null ? c1 / over : null,
        rr2: c2 != null ? c2 / over : null,
        required_rr: target && c2 != null && over < 20 ? Math.max((target - c2) / (20 - over), 0) : null,
      })
    }
    return rows
  }, [overs, winProbData])

  if (loading) return <Loading message="Syncing match intelligence..." />

  if (error || !match) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-heading text-lg font-black uppercase">Intercept Failed</p>
        <p className="text-text-secondary text-sm">Match record encrypted or missing.</p>
        <Link to="/matches" className="px-6 py-2 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black">Return to Base</Link>
      </div>
    )
  }

  const inn1 = innings.find(i => i.innings_number === 1)
  const inn2 = innings.find(i => i.innings_number === 2)

  return (
    <div className="space-y-12 pb-20">
      <SEO title={`${getTeamAbbr(match.team1)} vs ${getTeamAbbr(match.team2)} - Match Intel`} />

      {/* ── CINEMATIC HEADER ──────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0B0E16] p-10 md:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.05),transparent_70%)]" />
        
        <div className="relative z-10 flex flex-col items-center text-center space-y-12">
          <div className="flex flex-col items-center gap-4">
             <span className="px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-[10px] font-black uppercase tracking-[0.3em] text-accent-cyan">Match Analysis Center</span>
             <p className="text-xs font-black uppercase tracking-[0.4em] text-text-muted">{formatDate(match.date)} &bull; {match.venue}</p>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-8 md:gap-24 w-full max-w-5xl">
            <div className="flex flex-col items-center gap-6">
              <TeamLogo team={match.team1} size={120} className="drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]" />
              <div>
                <h2 className="text-2xl md:text-4xl font-black font-heading text-white tracking-tighter mb-2">{match.team1}</h2>
                <p className="text-3xl md:text-5xl font-black font-heading text-accent-cyan">{inn1?.total_runs || 0}<span className="text-white/20">/{inn1?.total_wickets || 0}</span></p>
              </div>
            </div>

            <div className="text-4xl md:text-6xl font-black italic text-white/5 select-none">VS</div>

            <div className="flex flex-col items-center gap-6">
              <TeamLogo team={match.team2} size={120} className="drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]" />
              <div>
                <h2 className="text-2xl md:text-4xl font-black font-heading text-white tracking-tighter mb-2">{match.team2}</h2>
                <p className="text-3xl md:text-5xl font-black font-heading text-accent-magenta">{inn2?.total_runs || 0}<span className="text-white/20">/{inn2?.total_wickets || 0}</span></p>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 w-full max-w-2xl text-center">
             <h3 className="text-2xl md:text-3xl font-black font-heading text-white tracking-tight drop-shadow-lg">
                {match.winner ? `${match.winner} won by ${match.win_by_runs || match.win_by_wickets} ${match.win_by_runs ? 'runs' : 'wickets'}` : match.result}
             </h3>
             {match.player_of_match && (
               <div className="mt-6 inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
                  <PlayerAvatar name={match.player_of_match} size={28} ringColor="#FFB800" />
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-accent-amber">Player of Match</p>
                    <p className="text-xs font-black text-white">{match.player_of_match}</p>
                  </div>
               </div>
             )}
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE TABS ──────────────────────────────────── */}
      <section className="space-y-8">
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all border ${
                activeTab === tab 
                ? 'bg-white text-black border-white shadow-2xl' 
                : 'bg-transparent text-text-muted border-white/10 hover:border-white/20 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="min-h-[400px]">
          {activeTab === 'Scorecard' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in">
                {[1, 2].map(num => {
                  const inn = innings.find(i => i.innings_number === num)
                  if (!inn) return null
                  const innBatting = batting.filter(b => b.innings_number === num).sort((a,b) => (a.position || 0) - (b.position || 0))
                  const innBowling = bowling.filter(b => b.innings_number === num)
                  const teamColor = getTeamColor(inn.batting_team)
                  
                  return (
                    <div key={num} className="space-y-6">
                       <div className="flex items-center gap-4 px-4">
                          <TeamLogo team={inn.batting_team} size={32} />
                          <div>
                            <h4 className="text-xl font-black font-heading text-white">{inn.batting_team}</h4>
                            <p className="text-xs font-bold text-text-muted">{inn.total_runs}/{inn.total_wickets} ({Math.floor(inn.total_balls/6)}.{inn.total_balls%6} Ov)</p>
                          </div>
                       </div>
                       
                       <div className="bg-[#0B0E16] rounded-[24px] border border-white/5 overflow-hidden">
                          <table className="w-full text-left">
                            <thead className="bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">
                              <tr>
                                <th className="px-6 py-4">Batter</th>
                                <th className="px-6 py-4 text-right">R</th>
                                <th className="px-6 py-4 text-right">B</th>
                                <th className="px-6 py-4 text-right">SR</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs">
                              {innBatting.map((b, i) => (
                                <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
                                  <td className="px-6 py-4 font-black text-white">{b.batter}</td>
                                  <td className="px-6 py-4 text-right font-black text-accent-cyan">{b.runs}</td>
                                  <td className="px-6 py-4 text-right text-text-muted">{b.balls}</td>
                                  <td className="px-6 py-4 text-right text-text-muted">{formatDecimal(b.strike_rate, 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                       </div>

                       <div className="bg-[#0B0E16] rounded-[24px] border border-white/5 overflow-hidden">
                          <table className="w-full text-left">
                            <thead className="bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">
                              <tr>
                                <th className="px-6 py-4">Bowler</th>
                                <th className="px-6 py-4 text-right">O</th>
                                <th className="px-6 py-4 text-right">W</th>
                                <th className="px-6 py-4 text-right">E</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs">
                              {innBowling.map((b, i) => (
                                <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
                                  <td className="px-6 py-4 font-black text-white">{b.bowler}</td>
                                  <td className="px-6 py-4 text-right text-text-muted">{b.overs}</td>
                                  <td className="px-6 py-4 text-right font-black text-accent-magenta">{b.wickets}</td>
                                  <td className="px-6 py-4 text-right text-text-muted">{formatDecimal(b.economy, 1)}</td>
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

          {activeTab === 'Worm' && (
            <div className="bg-[#0B0E16] rounded-[32px] border border-white/10 p-10 animate-in">
              <h3 className="text-2xl font-black font-heading text-white mb-8">Scoring Progression</h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={wormData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="over" axisLine={false} tickLine={false} tick={{ fill: '#ffffff30', fontSize: 10, fontWeight: 900 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#ffffff30', fontSize: 10, fontWeight: 900 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="cumulative_1" name={getTeamAbbr(match.team1)} stroke={team1Color} strokeWidth={4} dot={false} />
                    <Line type="monotone" dataKey="cumulative_2" name={getTeamAbbr(match.team2)} stroke={team2Color} strokeWidth={4} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'Run Rate Battle' && (
             <div className="bg-[#0B0E16] rounded-[32px] border border-white/10 p-10 animate-in">
                <h3 className="text-2xl font-black font-heading text-white mb-8">Tempo Battle</h3>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={runRateData}>
                      <defs>
                        <linearGradient id="color1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={team1Color} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={team1Color} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="over" axisLine={false} tickLine={false} tick={{ fill: '#ffffff30', fontSize: 10, fontWeight: 900 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#ffffff30', fontSize: 10, fontWeight: 900 }} />
                      <Tooltip content={<ChartTooltip extra="Run Rate" />} />
                      <Area type="monotone" dataKey="rr1" name={`${getTeamAbbr(match.team1)} RR`} stroke={team1Color} fillOpacity={1} fill="url(#color1)" strokeWidth={3} />
                      <Line type="monotone" dataKey="rr2" name={`${getTeamAbbr(match.team2)} RR`} stroke={team2Color} strokeWidth={3} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
             </div>
          )}

          {activeTab === 'Partnerships' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in">
                {[1, 2].map(num => {
                  const innP = partnerships.filter(p => p.innings_number === num)
                  const team = num === 1 ? match.team1 : match.team2
                  const color = getTeamColor(team)
                  return (
                    <div key={num} className="bg-[#0B0E16] rounded-[32px] border border-white/10 p-8 space-y-6">
                       <h4 className="text-xl font-black font-heading text-white flex items-center gap-3">
                          <div className="w-2 h-6 rounded" style={{ backgroundColor: color }} />
                          {team}
                       </h4>
                       <div className="space-y-4">
                          {innP.map((p, i) => (
                            <div key={i} className="space-y-2">
                               <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-text-muted">
                                  <span>{p.pair}</span>
                                  <span>{p.runs} ({p.balls}b)</span>
                               </div>
                               <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-1000" style={{ backgroundColor: color, width: `${(p.runs / 200) * 100}%` }} />
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  )
                })}
             </div>
          )}

          {activeTab === 'Match Report' && (
            <div className="py-12 text-center card bg-white/[0.02] animate-in">
               <p className="text-text-muted font-black uppercase tracking-[0.3em]">Full Match Intelligence Report Ready</p>
               <p className="text-xs text-white/40 mt-2">Historical trends and AI-driven play-by-play available in profile views.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
