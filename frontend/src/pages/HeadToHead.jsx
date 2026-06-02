import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import SEO from '../components/SEO'
import { useFetch } from '../hooks/useFetch'
import { getTeams, compareTeams, getPlayerMatchup, searchPlayers } from '../lib/api'
import Loading from '../components/ui/Loading'
import { formatNumber, formatDecimal, formatDate } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import PlayerNameCell from '../components/ui/PlayerNameCell'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts'
import {
  GlassTooltipSurface,
  CHART_ANIMATION,
  cartesianGridProps,
  axisTickPrimary,
  useChartGradientIds,
} from '../components/charts'

/* ── Custom Tooltip ───────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <GlassTooltipSurface eyebrow={label}>
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
    </GlassTooltipSurface>
  )
}

/* ── Player Autocomplete Input ─────────────────────────────────── */
function PlayerSearchInput({ label, placeholder, value, onChange, onSelect }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    setQuery(value || '')
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchSuggestions = async (val) => {
    if (!val.trim()) {
      setSuggestions([])
      return
    }
    try {
      const res = await searchPlayers(val)
      setSuggestions(Array.isArray(res) ? res : [])
    } catch (e) {
      setSuggestions([])
    }
  }

  const handleInputChange = (e) => {
    const val = e.target.value
    setQuery(val)
    onChange(val)
    setIsOpen(true)
    fetchSuggestions(val)
  }

  const handleSelect = (name) => {
    setQuery(name)
    onSelect(name)
    setIsOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative w-full space-y-2">
      <label className="text-[9px] font-black text-text-muted uppercase tracking-widest px-1">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleInputChange}
        onFocus={() => {
          setIsOpen(true)
          if (query) fetchSuggestions(query)
        }}
        className="w-full bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent-cyan/60"
      />
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-bg-elevated border border-border-subtle rounded-xl max-h-60 overflow-y-auto shadow-2xl backdrop-blur-md">
          {suggestions.map((name) => (
            <button
              key={name}
              onClick={() => handleSelect(name)}
              className="w-full text-left px-4 py-3 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors font-semibold"
            >
              {name}
            </button>
          ))}
        </div>
      )}
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
  const [tab, setTab] = useState(searchParams.get('tab') === 'player' ? 'player' : 'team')
  const [team1, setTeam1] = useState(searchParams.get('team1') || '')
  const [team2, setTeam2] = useState(searchParams.get('team2') || '')
  const [batter, setBatter] = useState(searchParams.get('batter') || '')
  const [bowler, setBowler] = useState(searchParams.get('bowler') || '')
  const rivalryRef = useRef(null)
  const cg = useChartGradientIds('h2h')

  const { data: teams } = useFetch(() => getTeams(), [])
  const bothSelected = team1 && team2 && team1 !== team2
  const playerSelected = batter && bowler

  const { data: comparison, loading: compLoading, error: compError } = useFetch(
    () => (bothSelected && tab === 'team' ? compareTeams(team1, team2) : Promise.resolve(null)),
    [team1, team2, tab]
  )

  const { data: matchupData, loading: matchupLoading, error: matchupError } = useFetch(
    () => (playerSelected && tab === 'player' ? getPlayerMatchup(batter, bowler) : Promise.resolve(null)),
    [batter, bowler, tab]
  )

  useEffect(() => {
    const params = new URLSearchParams()
    if (tab === 'player') {
      params.set('tab', 'player')
      if (batter) params.set('batter', batter)
      if (bowler) params.set('bowler', bowler)
    } else {
      if (team1) params.set('team1', team1)
      if (team2) params.set('team2', team2)
    }
    setSearchParams(params, { replace: true })
  }, [tab, team1, team2, batter, bowler, setSearchParams])

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

  const matchupPhases = useMemo(() => {
    if (!matchupData?.phases) return []
    return matchupData.phases.map(p => ({
      phase: p.phase.toUpperCase(),
      SR: p.sr,
      'Dot %': p.dot_pct,
      Runs: p.runs,
      Balls: p.balls
    }))
  }, [matchupData])

  const matchupSeasons = useMemo(() => {
    if (!matchupData?.seasons) return []
    return matchupData.seasons.map(s => ({
      season: String(s.season),
      Runs: s.runs,
      SR: s.sr,
      Dismissals: s.dismissals
    }))
  }, [matchupData])

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24">
      <SEO title="Head to Head - Team & Player Rivalry Analytics" />

      {/* SUB-NAVIGATION TOGGLE */}
      <div className="flex border border-border-subtle bg-bg-card/40 backdrop-blur-md rounded-2xl p-1 max-w-[320px] mx-auto">
        <button
          onClick={() => setTab('team')}
          className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
            tab === 'team'
              ? 'bg-bg-elevated text-accent-cyan shadow-lg'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Team H2H
        </button>
        <button
          onClick={() => setTab('player')}
          className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
            tab === 'player'
              ? 'bg-bg-elevated text-accent-cyan shadow-lg'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Player Matchups
        </button>
      </div>

      {/* ── PROFESSIONAL HEADER ──────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[32px] border border-border-subtle bg-bg-card p-10 md:p-16">
        <div className="absolute inset-0 bg-gradient-to-br from-bg-elevated to-transparent opacity-50" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-12">
          <div className="max-w-2xl space-y-8 w-full">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/20 bg-accent-cyan/5 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-accent-cyan mb-6">
                {tab === 'player' ? 'Batter vs Bowler Matchups' : 'Comparative Analytics Module'}
              </span>
              <h1 className="text-5xl md:text-7xl font-black font-heading text-text-primary tracking-tighter leading-none">
                {tab === 'player' ? (
                  <>
                    BATTER VS <br /> <span className="text-text-muted">BOWLER H2H</span>
                  </>
                ) : (
                  <>
                    H2H <br /> <span className="text-text-muted">INSIGHTS</span>
                  </>
                )}
              </h1>
            </div>
            
            {tab === 'player' ? (
              <div className="flex flex-col md:flex-row gap-6 items-center w-full max-w-xl">
                 <div className="w-full md:flex-1">
                   <PlayerSearchInput
                     label="Batter"
                     placeholder="Search batter (e.g. Virat Kohli)..."
                     value={batter}
                     onChange={setBatter}
                     onSelect={setBatter}
                   />
                 </div>
                 <div className="text-text-muted font-black italic opacity-20 mt-4 md:mt-6">VS</div>
                 <div className="w-full md:flex-1">
                   <PlayerSearchInput
                     label="Bowler"
                     placeholder="Search bowler (e.g. Rashid Khan)..."
                     value={bowler}
                     onChange={setBowler}
                     onSelect={setBowler}
                   />
                 </div>
              </div>
            ) : (
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
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 w-full lg:w-96">
             <div className="bg-bg-elevated border border-border-subtle rounded-2xl p-6 transition-colors hover:border-accent-cyan/40">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2">
                  {tab === 'player' ? 'Matches Faced' : 'Matches Played'}
                </p>
                <p className="text-4xl font-black font-heading text-text-primary">
                  {tab === 'player'
                    ? (matchupData?.summary?.matches ?? '—')
                    : (comparison?.head_to_head?.played ?? '—')}
                </p>
             </div>
             <div className="bg-bg-elevated border border-border-subtle rounded-2xl p-6 transition-colors hover:border-accent-magenta/40">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2">
                  {tab === 'player' ? 'Dismissals' : 'Win Gap'}
                </p>
                <p className="text-4xl font-black font-heading text-text-primary">
                  {tab === 'player'
                    ? (matchupData?.summary?.dismissals ?? '—')
                    : (comparison?.head_to_head ? Math.abs(comparison.head_to_head.team1_wins - comparison.head_to_head.team2_wins) : '—')}
                </p>
             </div>
          </div>
        </div>
      </section>

      {/* ── STATUS ──────────────────────────────────── */}
      {tab === 'team' && bothSelected && compLoading && <Loading message="Calculating historical metrics..." />}
      {tab === 'team' && bothSelected && compError && (
        <div className="text-center py-20 bg-bg-card rounded-3xl border border-border-subtle">
           <h2 className="text-xl font-black text-danger uppercase tracking-tight">Data Retrieval Failed</h2>
           <p className="text-text-muted mt-2 text-sm">{compError}</p>
        </div>
      )}

      {tab === 'player' && playerSelected && matchupLoading && <Loading message="Loading batter vs bowler matchup..." />}
      {tab === 'player' && playerSelected && matchupError && (
        <div className="text-center py-20 bg-bg-card rounded-3xl border border-border-subtle">
           <h2 className="text-xl font-black text-danger uppercase tracking-tight">Data Retrieval Failed</h2>
           <p className="text-text-muted mt-2 text-sm">{matchupError}</p>
        </div>
      )}

      {/* ── TEAM COMPARISON DASHBOARD ─────────────────────────────────── */}
      {tab === 'team' && bothSelected && comparison && !compLoading && (
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
                          <PolarGrid stroke="#2A2A3A" strokeDasharray="4 6" />
                          <PolarAngleAxis dataKey="phase" tick={{ fill: '#8888A0', fontSize: 10, fontWeight: 700 }} />
                          <Radar name={abbr1} dataKey={abbr1} stroke={color1} fill={color1} fillOpacity={0.22} strokeWidth={2.5} {...CHART_ANIMATION} />
                          <Radar name={abbr2} dataKey={abbr2} stroke={color2} fill={color2} fillOpacity={0.22} strokeWidth={2.5} {...CHART_ANIMATION} />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                       </RadarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="bg-bg-card rounded-[32px] border border-border-subtle p-10 shadow-lg">
                 <h3 className="text-lg font-black text-text-primary mb-2 uppercase tracking-tight">Historical Growth</h3>
                 <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-10">Cumulative Victory Points</p>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={cumulativeData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                          <defs>
                             <linearGradient id={cg.area} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color1} stopOpacity={0.28}/><stop offset="95%" stopColor={color1} stopOpacity={0}/></linearGradient>
                             <linearGradient id={cg.areaAlt} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color2} stopOpacity={0.28}/><stop offset="95%" stopColor={color2} stopOpacity={0}/></linearGradient>
                          </defs>
                          <CartesianGrid {...cartesianGridProps} />
                          <XAxis dataKey="season" axisLine={false} tickLine={false} tick={axisTickPrimary} />
                          <YAxis axisLine={false} tickLine={false} tick={axisTickPrimary} width={36} />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend />
                          <Area type="monotone" dataKey={abbr1} name={`${abbr1} wins`} stroke={color1} strokeWidth={3} fill={`url(#${cg.area})`} dot={false} activeDot={{ r: 5 }} {...CHART_ANIMATION} />
                          <Area type="monotone" dataKey={abbr2} name={`${abbr2} wins`} stroke={color2} strokeWidth={3} fill={`url(#${cg.areaAlt})`} dot={false} activeDot={{ r: 5 }} {...CHART_ANIMATION} />
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

      {/* ── PLAYER MATCHUP DASHBOARD ─────────────────────────────────── */}
      {tab === 'player' && playerSelected && matchupData && !matchupLoading && (
        <div className="space-y-12 animate-in">
           {/* Faceoff Card */}
           <div className="bg-bg-card rounded-[32px] border border-border-subtle p-8 md:p-12 shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-accent-cyan/5 via-transparent to-accent-magenta/5 pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                 
                 {/* Batter */}
                 <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left gap-4">
                    <PlayerAvatar name={matchupData.batter} size={110} />
                    <div>
                       <span className="text-[10px] font-black text-accent-cyan uppercase tracking-widest">BATTER</span>
                       <h2 className="text-3xl font-black font-heading tracking-tight text-text-primary mt-1">
                          <Link to={`/players/${encodeURIComponent(matchupData.batter)}`} className="hover:text-accent-cyan transition-colors">
                             {matchupData.batter}
                          </Link>
                       </h2>
                    </div>
                 </div>

                 {/* Center VS Indicator */}
                 <div className="flex-shrink-0 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-bg-elevated border-2 border-border-subtle flex items-center justify-center shadow-lg">
                       <span className="font-heading font-black italic text-xl text-text-muted tracking-tighter">VS</span>
                    </div>
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-3">Head to Head</p>
                 </div>

                 {/* Bowler */}
                 <div className="flex-1 flex flex-col items-center md:items-end text-center md:text-right gap-4">
                    <PlayerAvatar name={matchupData.bowler} size={110} />
                    <div>
                       <span className="text-[10px] font-black text-accent-magenta uppercase tracking-widest">BOWLER</span>
                       <h2 className="text-3xl font-black font-heading tracking-tight text-text-primary mt-1">
                          <Link to={`/players/${encodeURIComponent(matchupData.bowler)}`} className="hover:text-accent-magenta transition-colors">
                             {matchupData.bowler}
                          </Link>
                       </h2>
                    </div>
                 </div>
              </div>
           </div>

           {/* Battle Arena Grid of Metrics */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 transition-colors hover:border-white/15">
                 <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Runs Scored</p>
                 <p className="text-4xl font-black font-heading text-text-primary">{matchupData.summary.runs}</p>
                 <p className="text-[10px] text-text-muted mt-1">off {matchupData.summary.balls} balls</p>
              </div>

              <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 transition-colors hover:border-white/15">
                 <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Strike Rate</p>
                 <p className="text-4xl font-black font-heading text-accent-cyan">{formatDecimal(matchupData.summary.sr, 1)}</p>
                 <p className="text-[10px] text-text-muted mt-1">runs per 100 balls</p>
              </div>

              <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 transition-colors hover:border-white/15">
                 <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Dismissals</p>
                 <p className="text-4xl font-black font-heading text-accent-magenta">{matchupData.summary.dismissals}</p>
                 <p className="text-[10px] text-text-muted mt-1">
                    {matchupData.summary.bowler_wickets} bowler-credited
                 </p>
              </div>

              <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 transition-colors hover:border-white/15">
                 <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Average</p>
                 <p className="text-4xl font-black font-heading text-text-primary">
                    {matchupData.summary.avg !== null ? formatDecimal(matchupData.summary.avg, 1) : '∞'}
                 </p>
                 <p className="text-[10px] text-text-muted mt-1">runs per dismissal</p>
              </div>

              <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 transition-colors hover:border-white/15">
                 <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Dot Ball %</p>
                 <p className="text-4xl font-black font-heading text-text-primary">{formatDecimal(matchupData.summary.dot_pct, 1)}%</p>
                 <p className="text-[10px] text-text-muted mt-1">{matchupData.summary.dots} dots total</p>
              </div>

              <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 transition-colors hover:border-white/15">
                 <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Boundary %</p>
                 <p className="text-4xl font-black font-heading text-text-primary">{formatDecimal(matchupData.summary.boundary_pct, 1)}%</p>
                 <p className="text-[10px] text-text-muted mt-1">{matchupData.summary.fours}x4, {matchupData.summary.sixes}x6</p>
              </div>

              <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 transition-colors hover:border-white/15">
                 <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Fours / Sixes</p>
                 <p className="text-4xl font-black font-heading text-text-primary">
                    {matchupData.summary.fours} <span className="text-text-muted text-2xl">/</span> {matchupData.summary.sixes}
                 </p>
                 <p className="text-[10px] text-text-muted mt-1">boundary hits</p>
              </div>

              <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 transition-colors hover:border-white/15">
                 <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Faceoffs</p>
                 <p className="text-4xl font-black font-heading text-text-primary">{matchupData.summary.matches}</p>
                 <p className="text-[10px] text-text-muted mt-1">matches faced</p>
              </div>
           </div>

           {/* Matchup Charts */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Phase Splits chart */}
              <div className="bg-bg-card rounded-[32px] border border-border-subtle p-8 shadow-lg">
                 <h3 className="text-lg font-black text-text-primary mb-2 uppercase tracking-tight">Phase Performance</h3>
                 <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-10">Strike Rate & Dot % across game phases</p>
                 {matchupPhases.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-text-muted text-sm">No phase matchup data</div>
                 ) : (
                    <div className="h-64">
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={matchupPhases} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                             <CartesianGrid {...cartesianGridProps} />
                             <XAxis dataKey="phase" axisLine={false} tickLine={false} tick={axisTickPrimary} />
                             <YAxis axisLine={false} tickLine={false} tick={axisTickPrimary} />
                             <Tooltip content={<ChartTooltip />} />
                             <Legend />
                             <Bar dataKey="SR" name="Strike Rate" fill="#00E5FF" radius={[4, 4, 0, 0]} {...CHART_ANIMATION} />
                             <Bar dataKey="Dot %" name="Dot Ball %" fill="#FF2D78" radius={[4, 4, 0, 0]} {...CHART_ANIMATION} />
                          </BarChart>
                       </ResponsiveContainer>
                    </div>
                 )}
              </div>

              {/* Season Splits progression */}
              <div className="bg-bg-card rounded-[32px] border border-border-subtle p-8 shadow-lg">
                 <h3 className="text-lg font-black text-text-primary mb-2 uppercase tracking-tight">Season Progression</h3>
                 <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-10">Runs scored & Strike Rate over seasons</p>
                 {matchupSeasons.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-text-muted text-sm">No season matchup data</div>
                 ) : (
                    <div className="h-64">
                       <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={matchupSeasons} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                             <defs>
                                <linearGradient id="matchupRunsGrad" x1="0" y1="0" x2="0" y2="1">
                                   <stop offset="5%" stopColor="#B8FF00" stopOpacity={0.28}/>
                                   <stop offset="95%" stopColor="#B8FF00" stopOpacity={0}/>
                                </linearGradient>
                             </defs>
                             <CartesianGrid {...cartesianGridProps} />
                             <XAxis dataKey="season" axisLine={false} tickLine={false} tick={axisTickPrimary} />
                             <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={axisTickPrimary} />
                             <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={axisTickPrimary} />
                             <Tooltip content={<ChartTooltip />} />
                             <Legend />
                             <Area yAxisId="left" type="monotone" dataKey="Runs" name="Runs" stroke="#B8FF00" strokeWidth={3} fill="url(#matchupRunsGrad)" dot={{ r: 4 }} {...CHART_ANIMATION} />
                             <Area yAxisId="right" type="monotone" dataKey="SR" name="Strike Rate" stroke="#00E5FF" strokeWidth={2} fill="transparent" dot={{ r: 4 }} {...CHART_ANIMATION} />
                          </AreaChart>
                       </ResponsiveContainer>
                    </div>
                 )}
              </div>
           </div>

           {/* Match History Table */}
           <div className="bg-bg-card rounded-[32px] border border-border-subtle overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-border-subtle bg-bg-elevated/50 flex justify-between items-center">
                 <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Encounter History Logs</h3>
                 <span className="px-3 py-1 rounded-md bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">Every ball-by-ball encounter</span>
              </div>
              {matchupData.history.length === 0 ? (
                 <div className="p-12 text-center text-text-muted text-sm">No match encounters recorded</div>
              ) : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="border-b border-border-subtle bg-bg-card">
                             <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Season / Date</th>
                             <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Teams & Venue</th>
                             <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">Runs Scored</th>
                             <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">Balls Faced</th>
                             <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">Strike Rate</th>
                             <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">Dismissal</th>
                             <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">Boundaries (4s/6s)</th>
                          </tr>
                       </thead>
                       <tbody className="text-sm">
                          {matchupData.history.map((m, idx) => (
                             <tr key={idx} className="border-b border-border-subtle hover:bg-bg-card-hover transition-colors group">
                                <td className="px-8 py-5">
                                   <p className="font-bold text-text-primary">{m.season}</p>
                                   <p className="text-[10px] text-text-muted uppercase">{formatDate(m.date)}</p>
                                </td>
                                <td className="px-8 py-5">
                                   <p className="font-bold text-text-primary">{m.team1} vs {m.team2}</p>
                                   <p className="text-[10px] text-text-muted uppercase">{m.venue}</p>
                                </td>
                                <td className="px-8 py-5 text-center font-mono font-bold text-text-primary">{m.runs}</td>
                                <td className="px-8 py-5 text-center font-mono font-bold text-text-primary">{m.balls}</td>
                                <td className="px-8 py-5 text-center font-mono font-bold text-accent-cyan">
                                   {m.balls > 0 ? formatDecimal((m.runs * 100) / m.balls, 1) : '—'}
                                </td>
                                <td className="px-8 py-5 text-center">
                                   {m.dismissals > 0 ? (
                                      <span className="px-2.5 py-0.5 rounded bg-accent-magenta/10 border border-accent-magenta/30 text-accent-magenta text-[10px] font-black uppercase">
                                         OUT
                                      </span>
                                   ) : (
                                      <span className="text-text-muted font-bold text-xs">—</span>
                                   )}
                                </td>
                                <td className="px-8 py-5 text-center font-mono text-text-secondary">
                                   {m.fours} <span className="opacity-30">/</span> {m.sixes}
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  )
}
