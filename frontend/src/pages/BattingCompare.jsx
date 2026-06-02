import { useState, useCallback, useMemo } from 'react'
import { useFetch } from '../hooks/useFetch'
import { searchPlayers, getPlayerBatting, getPlayerBowling } from '../lib/api'
import Loading from '../components/ui/Loading'
import { formatNumber, formatDecimal } from '../utils/format'
import SEO from '../components/SEO'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'
import {
  AnalyticsChartShell,
  GlassTooltipSurface,
  CHART_ANIMATION,
  cartesianGridProps,
  axisTickPrimary,
} from '../components/charts'

const PLAYER_COLORS = ['#00E5FF', '#FF2D78', '#B8FF00', '#FFB800', '#8B5CF6']

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <GlassTooltipSurface eyebrow={label}>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-black flex items-center gap-2" style={{ color: entry.color || '#E8E8ED' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-mono">{entry.value}</span>
        </p>
      ))}
    </GlassTooltipSurface>
  )
}

export default function BattingCompare() {
  const [compareMode, setCompareMode] = useState('batting') // 'batting' or 'bowling'
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [playerData, setPlayerData] = useState({})
  const [loadingPlayer, setLoadingPlayer] = useState(null)

  const handleModeChange = useCallback((mode) => {
    setCompareMode(mode)
    setSelectedPlayers([])
    setPlayerData({})
    setQuery('')
    setSearchResults([])
  }, [])

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const results = await searchPlayers(query.trim())
      setSearchResults(Array.isArray(results) ? results : [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [query])

  const addPlayer = useCallback(async (name) => {
    if (selectedPlayers.includes(name) || selectedPlayers.length >= 5) return
    setSelectedPlayers((prev) => [...prev, name])
    setSearchResults([])
    setQuery('')
    setLoadingPlayer(name)
    try {
      const data = compareMode === 'batting' ? await getPlayerBatting(name) : await getPlayerBowling(name)
      setPlayerData((prev) => ({ ...prev, [name]: data }))
    } catch {
      setPlayerData((prev) => ({ ...prev, [name]: null }))
    } finally {
      setLoadingPlayer(null)
    }
  }, [selectedPlayers, compareMode])

  const removePlayer = useCallback((name) => {
    setSelectedPlayers((prev) => prev.filter((p) => p !== name))
    setPlayerData((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  const playersWithData = selectedPlayers.filter((p) => playerData[p]?.career)

  const radarData = useMemo(() => {
    if (playersWithData.length === 0) return []
    
    if (compareMode === 'batting') {
      const metrics = ['Average', 'Strike Rate', 'True SR (TSR)', 'Boundary %', 'Legacy (50s/100s)', 'Experience']
      const rawValues = playersWithData.map((name) => {
        const c = playerData[name].career
        const boundaryPct = c.runs > 0 ? ((c.fours * 4 + c.sixes * 6) / c.runs) * 100 : 0
        const legacy = c.innings > 0 ? ((c.fifties + c.hundreds) / c.innings) * 100 : 0
        return {
          average: c.avg || 0,
          sr: c.sr || 0,
          tsr: c.tsr || 0,
          boundaryPct,
          legacy,
          matches: c.matches || 0
        }
      })

      const maxes = {
        average: Math.max(...rawValues.map(v => v.average), 1),
        sr: Math.max(...rawValues.map(v => v.sr), 1),
        boundaryPct: Math.max(...rawValues.map(v => v.boundaryPct), 1),
        legacy: Math.max(...rawValues.map(v => v.legacy), 1),
        matches: Math.max(...rawValues.map(v => v.matches), 1)
      }

      const minTsr = Math.min(...rawValues.map(v => v.tsr))
      const maxTsr = Math.max(...rawValues.map(v => v.tsr))
      const tsrRange = maxTsr - minTsr

      return metrics.map((metric, mi) => {
        const entry = { metric }
        playersWithData.forEach((name, pi) => {
          const raw = rawValues[pi]
          let val = 0
          if (mi === 0) val = (raw.average / maxes.average) * 100
          else if (mi === 1) val = (raw.sr / maxes.sr) * 100
          else if (mi === 2) val = tsrRange > 0 ? 20 + ((raw.tsr - minTsr) / tsrRange) * 80 : 100
          else if (mi === 3) val = (raw.boundaryPct / maxes.boundaryPct) * 100
          else if (mi === 4) val = (raw.legacy / maxes.legacy) * 100
          else val = (raw.matches / maxes.matches) * 100
          entry[name] = Math.round(val)
        })
        return entry
      })
    } else {
      // Bowling
      const metrics = ['Average', 'Economy', 'True Econ (TER)', 'Strike Rate', 'Lethality', 'Dot %', 'Experience']
      const rawValues = playersWithData.map((name) => {
        const c = playerData[name].career
        const lethality = c.matches > 0 ? c.wickets / c.matches : 0
        const dotPct = c.total_balls > 0 ? (c.dots / c.total_balls) * 100 : 0
        return {
          average: c.avg || 0,
          economy: c.economy || 0,
          ter: c.ter || 0,
          sr: c.sr || 0,
          lethality,
          dots: dotPct,
          matches: c.matches || 0
        }
      })

      const mins = {
        average: Math.min(...rawValues.map(v => v.average).filter(v => v > 0), 1),
        economy: Math.min(...rawValues.map(v => v.economy).filter(v => v > 0), 1),
        sr: Math.min(...rawValues.map(v => v.sr).filter(v => v > 0), 1)
      }

      const maxes = {
        lethality: Math.max(...rawValues.map(v => v.lethality), 1),
        dots: Math.max(...rawValues.map(v => v.dots), 1),
        matches: Math.max(...rawValues.map(v => v.matches), 1)
      }

      const minTer = Math.min(...rawValues.map(v => v.ter))
      const maxTer = Math.max(...rawValues.map(v => v.ter))
      const terRange = maxTer - minTer

      return metrics.map((metric, mi) => {
        const entry = { metric }
        playersWithData.forEach((name, pi) => {
          const raw = rawValues[pi]
          let val = 0
          if (mi === 0) val = raw.average > 0 ? (mins.average / raw.average) * 100 : 0
          else if (mi === 1) val = raw.economy > 0 ? (mins.economy / raw.economy) * 100 : 0
          else if (mi === 2) val = terRange > 0 ? 100 - ((raw.ter - minTer) / terRange) * 80 : 100
          else if (mi === 3) val = raw.sr > 0 ? (mins.sr / raw.sr) * 100 : 0
          else if (mi === 4) val = (raw.lethality / maxes.lethality) * 100
          else if (mi === 5) val = (raw.dots / maxes.dots) * 100
          else val = (raw.matches / maxes.matches) * 100
          entry[name] = Math.round(val)
        })
        return entry
      })
    }
  }, [playersWithData, playerData, compareMode])

  const phaseCompareData = useMemo(() => {
    if (playersWithData.length === 0) return []
    const phases = ['Powerplay', 'Middle', 'Death']
    return phases.map((phase) => {
      const entry = { phase }
      playersWithData.forEach((name) => {
        const phaseArr = playerData[name]?.phase_stats || []
        const phaseEntry = phaseArr.find((p) => p.phase?.toLowerCase() === phase.toLowerCase())
        if (compareMode === 'batting') {
          entry[name] = phaseEntry?.sr || 0
        } else {
          entry[name] = phaseEntry?.economy || 0
        }
      })
      return entry
    })
  }, [playersWithData, playerData, compareMode])

  const accentColor = compareMode === 'batting' ? 'lime' : 'magenta'
  const accentHex = compareMode === 'batting' ? '#B8FF00' : '#FF2D78'

  return (
    <div className="space-y-12 pb-24">
      <SEO title="Comparison Arena - Skill Combat Simulator" />

      {/* SUB-NAVIGATION TOGGLE */}
      <div className="flex border border-white/10 bg-bg-card/40 backdrop-blur-md rounded-2xl p-1 max-w-[360px] mx-auto">
        <button
          onClick={() => handleModeChange('batting')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
            compareMode === 'batting'
              ? 'bg-white/5 text-accent-lime shadow-lg scale-105'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Batting Arena
        </button>
        <button
          onClick={() => handleModeChange('bowling')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
            compareMode === 'bowling'
              ? 'bg-white/5 text-accent-magenta shadow-lg scale-105'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Bowling Arena
        </button>
      </div>

      {/* ── CINEMATIC HEADER ──────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0B0E16] p-10 md:p-16">
        <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at top right, ${accentHex}08, transparent 40%)` }} />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-12">
          <div className="max-w-2xl">
            <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] mb-6`} style={{ borderColor: `${accentHex}40`, backgroundColor: `${accentHex}10`, color: accentHex }}>
              Combatant Comparison Module
            </span>
            <h1 className="text-5xl md:text-8xl font-black font-heading text-text-primary tracking-tighter leading-none mb-8">
              {compareMode === 'batting' ? 'BATTER\'S' : 'BOWLER\'S'} <br /> ARENA
            </h1>
            <div className="relative group w-full lg:w-96">
               <div className="relative flex items-center bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus-within:border-white/30 transition-all" style={{ focusWithinBorderColor: accentHex }}>
                  <input 
                    type="text" 
                    placeholder="Enlist Combatant..." 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="bg-transparent border-none focus:ring-0 text-sm font-bold text-white placeholder:text-white/20 w-full"
                  />
                  <button onClick={handleSearch} className="font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors" style={{ color: accentHex }}>Search</button>
               </div>
               
               {searchResults.length > 0 && (
                 <div className="absolute top-full left-0 w-full mt-2 bg-[#111118] border border-white/10 rounded-2xl p-4 z-50 shadow-2xl max-h-64 overflow-y-auto">
                    {searchResults.map(name => (
                      <button 
                        key={name} 
                        onClick={() => addPlayer(name)}
                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5 text-xs font-black text-white/60 hover:text-white transition-all"
                        style={{ hoverTextColor: accentHex }}
                      >
                        + {name}
                      </button>
                    ))}
                 </div>
               )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
             {selectedPlayers.map((name, i) => (
               <div key={name} className="flex items-center gap-3 px-4 py-2 rounded-full border bg-white/5" style={{ borderColor: `${PLAYER_COLORS[i % PLAYER_COLORS.length]}40`, color: PLAYER_COLORS[i % PLAYER_COLORS.length] }}>
                  <span className="text-[10px] font-black uppercase tracking-widest">{name}</span>
                  <button onClick={() => removePlayer(name)} className="hover:text-white transition-colors">×</button>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* ── ANALYSIS CENTER ──────────────────────────────────── */}
      {playersWithData.length >= 2 ? (
        <div className="space-y-12 animate-in">
           {/* Radar and Comparison Stats */}
           <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <AnalyticsChartShell
                title="Skill DNA"
                subtitle="Normalized radar • length = relative strength within this comparison set"
                insight={compareMode === 'batting' 
                  ? "Spokes scale to best average, strike rate, boundary %, and TSR in comparison set. Peak outward shapes reflect higher batting dominance."
                  : "Spokes scale to best average, economy, TER, dots %, and wickets in comparison set. Larger radar area indicates superior bowling control."}
                accent={accentColor}
                badge="Radar profile"
                className="xl:col-span-2"
                chartClassName="h-[450px]"
              >
                    <ResponsiveContainer width="100%" height="100%">
                       <RadarChart data={radarData}>
                          <PolarGrid stroke="#2A2A3A" strokeDasharray="4 6" />
                          <PolarAngleAxis dataKey="metric" tick={{ fill: '#8888A0', fontSize: 10, fontWeight: 700 }} />
                          <PolarRadiusAxis axisLine={false} tick={false} />
                          {playersWithData.map((name, i) => (
                            <Radar key={name} name={name} dataKey={name} stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]} fill={PLAYER_COLORS[i % PLAYER_COLORS.length]} fillOpacity={0.12} strokeWidth={2.5} {...CHART_ANIMATION} />
                          ))}
                          <Tooltip content={<ChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                       </RadarChart>
                    </ResponsiveContainer>
              </AnalyticsChartShell>

              <div className="bg-[#0B0E16] rounded-[40px] border border-white/5 p-10 overflow-x-auto">
                 <h3 className="text-2xl font-black font-heading text-white mb-10 uppercase tracking-tighter italic">Combat Stats</h3>
                 <div className="space-y-8">
                    {playersWithData.map((name, i) => {
                       const c = playerData[name].career
                       return (
                         <div key={name} className="space-y-4">
                            <div className="flex items-center gap-3">
                               <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
                               <span className="text-xs font-black text-white uppercase tracking-widest truncate">{name}</span>
                            </div>
                            
                            {compareMode === 'batting' ? (
                              <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-4">
                                 <div><p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Avg</p><p className="text-xl font-black font-heading text-white">{formatDecimal(c.avg)}</p></div>
                                 <div><p className="text-[9px] font-black text-text-muted uppercase tracking-widest">SR</p><p className="text-xl font-black font-heading text-white">{formatDecimal(c.sr)}</p></div>
                                 <div><p className="text-[9px] font-black text-text-muted uppercase tracking-widest">True SR (TSR)</p><p className="text-xl font-black font-heading text-accent-cyan">{formatDecimal(c.tsr)}</p></div>
                                 <div><p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Runs</p><p className="text-xl font-black font-heading text-white">{formatNumber(c.runs)}</p></div>
                                 <div><p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Matches</p><p className="text-xl font-black font-heading text-white">{c.matches}</p></div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-4">
                                 <div><p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Wickets</p><p className="text-xl font-black font-heading text-white">{c.wickets}</p></div>
                                 <div><p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Economy</p><p className="text-xl font-black font-heading text-white">{formatDecimal(c.economy)}</p></div>
                                 <div><p className="text-[9px] font-black text-text-muted uppercase tracking-widest">True Econ (TER)</p><p className="text-xl font-black font-heading text-accent-magenta">{formatDecimal(c.ter)}</p></div>
                                 <div><p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Avg</p><p className="text-xl font-black font-heading text-white">{formatDecimal(c.avg)}</p></div>
                                 <div><p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Matches</p><p className="text-xl font-black font-heading text-white">{c.matches}</p></div>
                              </div>
                            )}
                         </div>
                       )
                    })}
                 </div>
              </div>
           </div>

           {/* Phase Strike Rates or Economy Rates */}
           <AnalyticsChartShell
              title={compareMode === 'batting' ? "Phase strike rates" : "Phase economy rates"}
              subtitle={compareMode === 'batting' 
                ? "Strike rate by phase — higher strike rate is better" 
                : "Economy rate by phase — lower economy is better"}
              insight={compareMode === 'batting'
                ? "Thoroughly analyze who anchors middle phases and who dominates the death over boundaries."
                : "Compare phase economy rates to see which bowler is most effective at squeezing runs in the powerplay vs the death overs."}
              accent={accentColor}
              badge="Phase bars"
              chartClassName="h-72"
           >
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={phaseCompareData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                       <CartesianGrid {...cartesianGridProps} />
                       <XAxis dataKey="phase" axisLine={false} tickLine={false} tick={{ fill: '#8888A0', fontSize: 10, fontWeight: 700 }} />
                       <YAxis axisLine={false} tickLine={false} tick={axisTickPrimary} width={36} />
                       <Tooltip content={<ChartTooltip />} />
                       <Legend />
                       {playersWithData.map((name, i) => (
                         <Bar key={name} dataKey={name} name={name} fill={PLAYER_COLORS[i % PLAYER_COLORS.length]} radius={[10, 10, 0, 0]} barSize={26} {...CHART_ANIMATION} />
                       ))}
                    </BarChart>
                 </ResponsiveContainer>
           </AnalyticsChartShell>
        </div>
      ) : (
        <div className="text-center py-32 bg-[#0B0E16] rounded-[40px] border border-white/5">
           <p className="text-text-muted font-black uppercase tracking-widest italic opacity-40">Awaiting multi-combatant enlistment...</p>
        </div>
      )}
    </div>
  )
}
