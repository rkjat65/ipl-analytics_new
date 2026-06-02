import { useState, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { getBattingLeaderboard, getBattingMatrix, getSeasons, getTeams } from '../lib/api'
import SEO from '../components/SEO'
import DataTable from '../components/ui/DataTable'
import Select from '../components/ui/Select'
import Loading from '../components/ui/Loading'
import { formatNumber, formatDecimal } from '../utils/format'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import PlayerNameCell from '../components/ui/PlayerNameCell'
import {
  AnimatedPresentationSection,
  PresentationControls,
  usePresentationDeck,
} from '../components/ui/ChartPresentation'
import LeaderboardShowcaseModal from '../components/ui/LeaderboardShowcaseModal'
import PlayerCompare from '../components/ui/PlayerCompare'
import { exportAsImage, downloadImage } from '../utils/exportCard'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine, ComposedChart, Line, Legend
} from 'recharts'
import {
  AnalyticsChartShell,
  GlassTooltipSurface,
  cartesianGridProps,
  cartesianGridFull,
  CHART_ANIMATION,
  axisTickPrimary,
  cursorBand,
} from '../components/charts'

/* ── Custom Tooltips ─────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const playerName = payload?.[0]?.payload?.fullName || payload?.[0]?.payload?.player || null
  return (
    <GlassTooltipSurface eyebrow={playerName ? 'Leaderboard row' : 'Metric'} title={!playerName ? label : undefined}>
      {playerName ? (
        <div className="mb-2">
          <PlayerNameCell name={playerName} to={`/batting/${encodeURIComponent(playerName)}`} size={28} />
        </div>
      ) : null}
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-black flex items-center gap-2" style={{ color: entry.color || '#E8E8ED' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-mono">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </p>
      ))}
    </GlassTooltipSurface>
  )
}

function MatrixTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const player = payload[0]?.payload
  return (
    <GlassTooltipSurface eyebrow="Impact profile" className="max-w-[280px]">
      <div className="mb-3">
        <PlayerNameCell name={player?.player} to={player?.player ? `/batting/${encodeURIComponent(player.player)}` : undefined} size={32} />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-black text-accent-lime uppercase flex justify-between">Runs <span className="font-mono">{formatNumber(player?.runs)}</span></p>
        <p className="text-xs font-black text-accent-cyan uppercase flex justify-between">Avg <span className="font-mono">{formatDecimal(player?.avg)}</span></p>
        <p className="text-xs font-black text-accent-amber uppercase flex justify-between">SR <span className="font-mono">{formatDecimal(player?.sr)}</span></p>
      </div>
      <p className="text-[10px] font-bold text-text-muted mt-3 uppercase tracking-widest">{player?.innings} innings &bull; {player?.sixes} sixes</p>
    </GlassTooltipSurface>
  )
}

const SORT_OPTIONS = [
  { value: 'runs', label: 'Runs' },
  { value: 'avg', label: 'Average' },
  { value: 'sr', label: 'Strike Rate' },
  { value: 'tsr', label: 'True SR (TSR)' },
  { value: 'fifties', label: '50s' },
  { value: 'hundreds', label: '100s' },
  { value: 'sixes', label: 'Sixes' },
  { value: 'fours', label: 'Fours' },
  { value: 'matches', label: 'Matches' },
]

const BAR_COLORS = ['#00E5FF', '#B8FF00', '#FFB800', '#FF2D78', '#8B5CF6', '#22D3EE', '#22C55E', '#FBBF24', '#EF4444', '#A78BFA']

function HeroStat({ label, value, accent = 'cyan', meta = '' }) {
  const accentColor = {
    cyan: '#00E5FF',
    lime: '#B8FF00',
    amber: '#FFB800',
    magenta: '#FF2D78',
  }[accent] || '#00E5FF'

  return (
    <div className="rounded-[24px] border border-white/5 bg-[#0B0E16] px-6 py-5 group transition-all hover:border-white/10">
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted mb-2">{label}</p>
      <p className="text-3xl font-black font-heading tracking-tighter" style={{ color: accentColor }}>{value}</p>
      {meta && <p className="mt-2 text-[10px] font-black text-white/30 uppercase tracking-widest">{meta}</p>}
    </div>
  )
}

export default function BattingRecords() {
  const chartRef = useRef(null)
  const [season, setSeason] = useState('')
  const [team, setTeam] = useState('')
  const [sortBy, setSortBy] = useState('runs')
  const [minBalls, setMinBalls] = useState(0)
  const [showGlossary, setShowGlossary] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showcaseOpen, setShowcaseOpen] = useState(false)
  const [comparePlayers, setComparePlayers] = useState([])
  const deck = usePresentationDeck(3, { autoStart: true, baseDelay: 900 })

  const handleDownloadChart = useCallback(async () => {
    if (!chartRef.current) return
    setDownloading(true)
    try {
      const dataUrl = await exportAsImage(chartRef.current, 'crickrida-batting-records', 'png')
      downloadImage(dataUrl, 'crickrida-batting-records.png')
    } catch (err) { console.error(err) }
    finally { setDownloading(false) }
  }, [])

  const { data: seasons } = useFetch(() => getSeasons(), [])
  const { data: teams } = useFetch(() => getTeams(), [])

  const { data: batters, loading, error } = useFetch(
    () => getBattingLeaderboard({ season, team, sort_by: sortBy, limit: 500, min_balls: minBalls || undefined }),
    [season, team, sortBy, minBalls]
  )

  const { data: battingMatrix, loading: matrixLoading } = useFetch(
    () => getBattingMatrix(season, season ? 8 : 16, team),
    [season, team]
  )

  const seasonOptions = [{ value: '', label: 'All Eras' }, ...(seasons || []).map((s) => ({ value: s, label: s }))]
  const teamOptions = [{ value: '', label: 'All Teams' }, ...(teams || []).map((t) => ({ value: t, label: t }))]

  const columns = [
    {
      key: 'rank',
      label: '#',
      align: 'center',
      render: (val) => <span className="font-mono font-black text-white/20 italic">{val}</span>,
    },
    {
      key: 'player',
      label: 'Player',
      render: (val) => <PlayerNameCell name={val} to={`/batting/${encodeURIComponent(val)}`} size={32} />,
    },
    { key: 'matches', label: 'Mat', align: 'right', tooltip: 'Total matches played', render: (val) => <span className="font-mono font-bold text-text-muted">{val}</span> },
    {
      key: 'runs',
      label: 'Runs',
      align: 'right',
      tooltip: 'Total career runs scored in IPL',
      render: (val) => <span className="font-mono font-black text-accent-lime text-base">{formatNumber(val)}</span>,
    },
    { key: 'avg', label: 'Avg', align: 'right', tooltip: 'Batting Average: Runs scored per dismissal (runs / dismissals)', render: (val) => <span className="font-mono font-bold">{formatDecimal(val)}</span> },
    { key: 'sr', label: 'SR', align: 'right', tooltip: 'Strike Rate: Runs scored per 100 balls faced', render: (val) => <span className="font-mono font-bold">{formatDecimal(val)}</span> },
    {
      key: 'tsr',
      label: 'TSR',
      align: 'right',
      tooltip: "True Strike Rate: Player's strike rate compared to the average strike rate of other batters in the same matches and phases. Positive means faster scoring than average.",
      render: (val) => {
        const num = parseFloat(val) || 0
        const colorClass = num >= 0 ? 'text-[#00E5FF] font-black' : 'text-[#FF2D78] opacity-80'
        return <span className={`font-mono ${colorClass}`}>{num >= 0 ? `+${formatDecimal(num)}` : formatDecimal(num)}</span>
      }
    },
    { key: 'sixes', label: '6s', align: 'right', tooltip: 'Total number of sixes hit by the batter', render: (val) => <span className="font-mono font-black text-accent-amber">{val}</span> },
    {
      key: 'compare',
      label: 'Intel',
      align: 'center',
      render: (_, row) => {
        const isSelected = comparePlayers.some(p => p.player === row.player)
        return (
          <button
            onClick={() => {
              if (isSelected) setComparePlayers(prev => prev.filter(p => p.player !== row.player))
              else if (comparePlayers.length < 3) setComparePlayers(prev => [...prev, row])
            }}
            className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center ${
              isSelected 
                ? 'bg-accent-cyan border-accent-cyan text-black shadow-lg' 
                : 'border-white/5 bg-white/5 text-text-muted hover:border-accent-cyan hover:text-white'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-5 h-5">
              {isSelected ? <path d="M5 13l4 4L19 7" /> : <path d="M12 4v16m8-8H4" />}
            </svg>
          </button>
        )
      }
    }
  ]

  const dataWithRank = (Array.isArray(batters) ? batters : []).map((b, i) => ({ ...b, rank: i + 1 }))
  const leader = dataWithRank[0] || null
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || sortBy
  const barInsight = useMemo(() => {
    if (!leader) return null
    const v = leader[sortBy]
    const formatted =
      typeof v === 'number' && ['avg', 'sr'].includes(sortBy) ? formatDecimal(v) : formatNumber(v)
    return `${leader.player} leads this view on ${sortLabel} (${formatted}). Compare bar lengths for how quickly value drops through the top 15.`
  }, [leader, sortBy])

  return (
    <div className="space-y-12 pb-20">
      <SEO title="Batting Elite - Career Leaderboards" />

      <PlayerCompare 
        players={comparePlayers} 
        onRemove={(name) => setComparePlayers(prev => prev.filter(p => p.player !== name))} 
      />

      {/* ── CINEMATIC HEADER ──────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0B0E16] p-10 md:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(184,255,0,0.08),transparent_40%)]" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-12">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-lime/25 bg-accent-lime/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-accent-lime mb-6">
              Elite Database
            </span>
            <h1 className="text-5xl md:text-7xl font-black font-heading text-text-primary tracking-tighter leading-none mb-6">
              Batting <br /> Strongholds
            </h1>
            <p className="text-lg text-text-secondary leading-relaxed max-w-lg">
              Analyze the distinct DNA of every IPL batter. From career run-volume peaks to high-tempo strike rate specialists.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4 w-full lg:w-72">
            <HeroStat label="Leader" value={leader ? formatNumber(leader.runs) : '—'} accent="lime" meta={leader ? leader.player : 'Runs Leader'} />
            <HeroStat label="Peak SR" value={leader ? formatDecimal(leader.sr) : '—'} accent="amber" meta="Tempo Benchmark" />
            <HeroStat label="Avg Score" value={leader ? formatDecimal(leader.avg) : '—'} accent="cyan" meta="Consistency Index" />
          </div>
        </div>
      </section>

      {/* ── FAN GLOSSARY BANNER ──────────────────────────────────── */}
      <section className="bg-white/[0.02] rounded-[32px] border border-white/5 p-6 backdrop-blur-md relative overflow-hidden transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-cyan/10 text-accent-cyan">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4.5 h-4.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </span>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Understanding Batting Analytics</h3>
              <p className="text-xs text-text-muted">New to advanced cricket stats? Expand this guide to learn how we evaluate batters.</p>
            </div>
          </div>
          <button
            onClick={() => setShowGlossary(!showGlossary)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black text-text-secondary hover:border-accent-cyan hover:text-white transition-all flex items-center gap-1"
          >
            {showGlossary ? 'Hide Guide' : 'Explain Stats'}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`w-3.5 h-3.5 transition-transform duration-300 ${showGlossary ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {showGlossary && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/5 animate-fadeIn">
            <div className="space-y-2">
              <h4 className="text-xs font-black text-accent-lime uppercase tracking-widest">True Strike Rate (TSR)</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                TSR measures how much faster or slower a player scores compared to the expectation for the matches/phases they played in.
              </p>
              <p className="text-[10px] text-text-muted italic bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                <strong>Example:</strong> If a player's TSR is <span className="text-accent-cyan font-bold">+12.5</span>, it means they score 12.5 runs more per 100 balls than an average batter would in those exact situations.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-black text-accent-cyan uppercase tracking-widest">Batting Average (Avg)</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Runs scored divided by the number of times dismissed. Represents a batter's consistency and ability to hold their wicket.
              </p>
              <p className="text-[10px] text-text-muted italic bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                <strong>Rule of thumb:</strong> An average over 35 is considered excellent in T20, indicating the player anchors the innings reliably.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-black text-accent-amber uppercase tracking-widest">Strike Rate (SR)</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                The average runs scored per 100 balls faced. Represents a batter's raw scoring speed (tempo).
              </p>
              <p className="text-[10px] text-text-muted italic bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                <strong>Rule of thumb:</strong> A strike rate above 140 is strong. Above 160 is elite, typically belonging to finishers or aggressive powerplay openers.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── COMMAND CENTER FILTERS ───────────────────────────── */}
      <section className="bg-[#0B0E16] rounded-[32px] border border-white/5 p-6 md:p-8 flex flex-wrap items-center gap-6 shadow-2xl">
        <div className="space-y-2">
           <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Era</label>
           <Select options={seasonOptions} value={season} onChange={setSeason} />
        </div>
        <div className="space-y-2">
           <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Franchise</label>
           <Select options={teamOptions} value={team} onChange={setTeam} />
        </div>
        <div className="space-y-2">
           <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Metric</label>
           <Select options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
        </div>
        <div className="space-y-2">
           <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Threshold (Balls)</label>
           <Select
             options={[
               { value: 0, label: 'No Limit' },
               { value: 50, label: '50+' },
               { value: 200, label: '200+' },
               { value: 500, label: '500+' },
               { value: 1000, label: '1k+' },
             ]}
             value={minBalls}
             onChange={(v) => setMinBalls(Number(v))}
           />
        </div>
      </section>

      <PresentationControls deck={deck} title="Leaderboard Playback" />

      {/* ── VISUAL ANALYTICS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Top 15 Bar */}
         {!loading && dataWithRank.length > 0 && (
           <AnimatedPresentationSection deck={deck} index={0}>
             <AnalyticsChartShell
               title="Top 15 performance"
               subtitle={`Sorted by ${sortLabel}`}
               insight={barInsight}
               accent="lime"
               badge="Leaderboard lens"
               chartClassName="h-96"
               actions={
                 <button
                   type="button"
                   onClick={() => setShowcaseOpen(true)}
                   className="rounded-xl border border-accent-lime/25 bg-accent-lime/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-accent-lime transition-all hover:bg-accent-lime hover:text-black"
                 >
                   Showcase
                 </button>
               }
             >
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dataWithRank.slice(0, 15).sort((a,b) => b[sortBy] - a[sortBy])} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                         <CartesianGrid {...cartesianGridProps} />
                         <XAxis type="number" tick={axisTickPrimary} axisLine={{ stroke: '#2A2A3A' }} tickLine={false} />
                         <YAxis type="category" dataKey="player" width={100} axisLine={false} tickLine={false} tick={{ fill: '#ffffff40', fontSize: 10, fontWeight: 900 }} />
                         <Tooltip content={<ChartTooltip />} cursor={cursorBand('rgba(184,255,0,0.06)')} />
                         <Bar dataKey={sortBy} radius={[0, 10, 10, 0]} barSize={22} {...CHART_ANIMATION}>
                            {dataWithRank.slice(0, 15).map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                         </Bar>
                      </BarChart>
                   </ResponsiveContainer>
             </AnalyticsChartShell>
           </AnimatedPresentationSection>
         )}

         {/* Matrix */}
         {!loading && (
           <AnimatedPresentationSection deck={deck} index={2}>
              <AnalyticsChartShell
                title="Impact matrix"
                subtitle="Average × strike rate • bubble size ∝ runs"
                insight="Upper-right is the premium quadrant — high average with destructive tempo. Dot scale reflects run volume in the sample."
                accent="cyan"
                badge="Scatter intelligence"
                chartClassName="h-80"
              >
                    <ResponsiveContainer width="100%" height="100%">
                       <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 8 }}>
                          <CartesianGrid {...cartesianGridFull} />
                          <XAxis type="number" dataKey="avg" name="Average" domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#8888A0', fontSize: 10 }} label={{ value: 'Average', position: 'bottom', fill: '#555566', fontSize: 10 }} />
                          <YAxis type="number" dataKey="sr" name="Strike Rate" domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#8888A0', fontSize: 10 }} label={{ value: 'SR', angle: -90, position: 'insideLeft', fill: '#555566', fontSize: 10 }} />
                          <ZAxis type="number" dataKey="runs" range={[60, 420]} />
                          <Tooltip content={<MatrixTooltip />} cursor={{ strokeDasharray: '4 4', stroke: '#00E5FF', strokeOpacity: 0.35 }} />
                          <Scatter data={(battingMatrix || []).slice(0, 20)} fill="#B8FF00" isAnimationActive>
                             {(battingMatrix || []).slice(0, 20).map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                             ))}
                          </Scatter>
                       </ScatterChart>
                    </ResponsiveContainer>
              </AnalyticsChartShell>
           </AnimatedPresentationSection>
         )}
      </div>

      {/* ── LEADERBOARD TABLE ────────────────────────────────── */}
      {loading ? (
        <Loading message="Syncing leaderboard data..." />
      ) : (
        <div className="bg-[#0B0E16] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-white/5 flex justify-between items-center">
             <h3 className="text-2xl font-black font-heading text-white">Global Leaderboard</h3>
             <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">{dataWithRank.length} Batters Listed</span>
          </div>
          <DataTable columns={columns} data={dataWithRank} />
        </div>
      )}

      <LeaderboardShowcaseModal
        open={showcaseOpen}
        onClose={() => setShowcaseOpen(false)}
        title={`Elite ${sortLabel}`}
        items={dataWithRank.slice(0, 10).map(b => ({ ...b, value: b[sortBy] }))}
        metricLabel={sortLabel}
        accent="#B8FF00"
      />
    </div>
  )
}
