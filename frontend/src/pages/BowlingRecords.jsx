import { useState, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { getBowlingLeaderboard, getBowlingMatrix, getSeasons, getTeams } from '../lib/api'
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
          <PlayerNameCell name={playerName} to={`/bowling/${encodeURIComponent(playerName)}`} size={28} />
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
    <GlassTooltipSurface eyebrow="Control profile" className="max-w-[280px]">
      <div className="mb-3">
        <PlayerNameCell name={player?.player} to={player?.player ? `/bowling/${encodeURIComponent(player.player)}` : undefined} size={32} />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-black text-accent-magenta uppercase flex justify-between">Wickets <span className="font-mono">{formatNumber(player?.wickets)}</span></p>
        <p className="text-xs font-black text-accent-cyan uppercase flex justify-between">Avg <span className="font-mono">{formatDecimal(player?.avg)}</span></p>
        <p className="text-xs font-black text-accent-amber uppercase flex justify-between">Econ <span className="font-mono">{formatDecimal(player?.economy)}</span></p>
      </div>
      <p className="text-[10px] font-bold text-text-muted mt-3 uppercase tracking-widest">{player?.innings} innings &bull; {player?.matches} matches</p>
    </GlassTooltipSurface>
  )
}

const SORT_OPTIONS = [
  { value: 'wickets', label: 'Wickets' },
  { value: 'avg', label: 'Average' },
  { value: 'economy', label: 'Economy' },
  { value: 'sr', label: 'Strike Rate' },
  { value: 'five_wickets', label: '5W Hauls' },
  { value: 'four_wickets', label: '4W Hauls' },
  { value: 'matches', label: 'Matches' },
]

const BAR_COLORS = ['#FF2D78', '#8B5CF6', '#00E5FF', '#FFB800', '#B8FF00', '#EF4444', '#22D3EE', '#F472B6', '#A78BFA', '#34D399']

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

export default function BowlingRecords() {
  const chartRef = useRef(null)
  const [season, setSeason] = useState('')
  const [team, setTeam] = useState('')
  const [sortBy, setSortBy] = useState('wickets')
  const [minBalls, setMinBalls] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [showcaseOpen, setShowcaseOpen] = useState(false)
  const [comparePlayers, setComparePlayers] = useState([])
  const deck = usePresentationDeck(3, { autoStart: true, baseDelay: 900 })

  const handleDownloadChart = useCallback(async () => {
    if (!chartRef.current) return
    setDownloading(true)
    try {
      const dataUrl = await exportAsImage(chartRef.current, 'crickrida-bowling-records', 'png')
      downloadImage(dataUrl, 'crickrida-bowling-records.png')
    } catch (err) { console.error(err) }
    finally { setDownloading(false) }
  }, [])

  const { data: seasons } = useFetch(() => getSeasons(), [])
  const { data: teams } = useFetch(() => getTeams(), [])

  const { data: bowlers, loading, error } = useFetch(
    () => getBowlingLeaderboard({ season, team, sort_by: sortBy, limit: 500, min_balls: minBalls || undefined }),
    [season, team, sortBy, minBalls]
  )

  const { data: bowlingMatrix, loading: matrixLoading } = useFetch(
    () => getBowlingMatrix(season, season ? 8 : 16, team),
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
      render: (val) => <PlayerNameCell name={val} to={`/bowling/${encodeURIComponent(val)}`} size={32} />,
    },
    { key: 'matches', label: 'Mat', align: 'right', render: (val) => <span className="font-mono font-bold text-text-muted">{val}</span> },
    {
      key: 'wickets',
      label: 'Wkts',
      align: 'right',
      render: (val) => <span className="font-mono font-black text-accent-magenta text-base">{val}</span>,
    },
    { key: 'avg', label: 'Avg', align: 'right', render: (val) => <span className="font-mono font-bold">{formatDecimal(val)}</span> },
    { key: 'economy', label: 'Econ', align: 'right', render: (val) => <span className="font-mono font-bold">{formatDecimal(val)}</span> },
    { key: 'sr', label: 'SR', align: 'right', render: (val) => <span className="font-mono font-bold">{formatDecimal(val)}</span> },
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
                ? 'bg-accent-magenta border-accent-magenta text-white shadow-lg' 
                : 'border-white/5 bg-white/5 text-text-muted hover:border-accent-magenta hover:text-white'
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

  const dataWithRank = (Array.isArray(bowlers) ? bowlers : []).map((b, i) => ({ ...b, rank: i + 1 }))
  const leader = dataWithRank[0] || null
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || sortBy

  const getMetricValue = (entry) => {
    if (sortBy === 'five_wickets') return entry?.five_w ?? entry?.five_wickets ?? 0
    if (sortBy === 'four_wickets') return entry?.four_w ?? entry?.four_wickets ?? 0
    return entry?.[sortBy] ?? 0
  }

  const barInsight = useMemo(() => {
    if (!leader) return null
    const v = getMetricValue(leader)
    const formatted =
      typeof v === 'number' && ['avg', 'economy', 'sr'].includes(sortBy) ? formatDecimal(v) : formatNumber(v)
    return `${leader.player} is the benchmark on ${sortLabel} (${formatted}). Use the tail of the bars to judge squad depth.`
  }, [leader, sortBy])

  return (
    <div className="space-y-12 pb-20">
      <SEO title="Bowling Elite - Territory Masters" />

      <PlayerCompare 
        players={comparePlayers} 
        onRemove={(name) => setComparePlayers(prev => prev.filter(p => p.player !== name))} 
        mode="bowling"
      />

      {/* ── CINEMATIC HEADER ──────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0B0E16] p-10 md:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,45,120,0.08),transparent_40%)]" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-12">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-magenta/25 bg-accent-magenta/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-accent-magenta mb-6">
              Territory Control
            </span>
            <h1 className="text-5xl md:text-7xl font-black font-heading text-text-primary tracking-tighter leading-none mb-6">
              Bowling <br /> Strongholds
            </h1>
            <p className="text-lg text-text-secondary leading-relaxed max-w-lg">
              Deconstruct the lethal impact of every IPL bowler. From wicket-taking clusters to game-defining economy discipline.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4 w-full lg:w-72">
            <HeroStat label="Leader" value={leader ? leader.wickets : '—'} accent="magenta" meta={leader ? leader.player : 'Wickets Leader'} />
            <HeroStat label="Econ" value={leader ? formatDecimal(leader.economy) : '—'} accent="amber" meta="Control Benchmark" />
            <HeroStat label="Strike Rate" value={leader ? formatDecimal(leader.sr) : '—'} accent="cyan" meta="Lethality Index" />
          </div>
        </div>
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
               title="Top 15 impact"
               subtitle={`Sorted by ${sortLabel}`}
               insight={barInsight}
               accent="magenta"
               badge="Leaderboard lens"
               chartClassName="h-96"
               actions={
                 <button
                   type="button"
                   onClick={() => setShowcaseOpen(true)}
                   className="rounded-xl border border-accent-magenta/25 bg-accent-magenta/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-accent-magenta transition-all hover:bg-accent-magenta hover:text-white"
                 >
                   Showcase
                 </button>
               }
             >
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dataWithRank.slice(0, 15).sort((a,b) => getMetricValue(b) - getMetricValue(a))} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                         <CartesianGrid {...cartesianGridProps} />
                         <XAxis type="number" tick={axisTickPrimary} axisLine={{ stroke: '#2A2A3A' }} tickLine={false} />
                         <YAxis type="category" dataKey="player" width={100} axisLine={false} tickLine={false} tick={{ fill: '#ffffff40', fontSize: 10, fontWeight: 900 }} />
                         <Tooltip content={<ChartTooltip />} cursor={cursorBand('rgba(255,45,120,0.07)')} />
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
                title="Control matrix"
                subtitle="Average × economy • bubble size ∝ wickets"
                insight="Lower economy with respectable average reads as the elite control cluster — bubble size highlights wicket volume."
                accent="cyan"
                badge="Scatter intelligence"
                chartClassName="h-80"
              >
                    <ResponsiveContainer width="100%" height="100%">
                       <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 8 }}>
                          <CartesianGrid {...cartesianGridFull} />
                          <XAxis type="number" dataKey="avg" name="Average" domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#8888A0', fontSize: 10 }} label={{ value: 'Avg conceded', position: 'bottom', fill: '#555566', fontSize: 10 }} />
                          <YAxis type="number" dataKey="economy" name="Economy" domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#8888A0', fontSize: 10 }} label={{ value: 'Economy', angle: -90, position: 'insideLeft', fill: '#555566', fontSize: 10 }} />
                          <ZAxis type="number" dataKey="wickets" range={[60, 420]} />
                          <Tooltip content={<MatrixTooltip />} cursor={{ strokeDasharray: '4 4', stroke: '#FF2D78', strokeOpacity: 0.35 }} />
                          <Scatter data={(bowlingMatrix || []).slice(0, 20)} fill="#FF2D78" isAnimationActive>
                             {(bowlingMatrix || []).slice(0, 20).map((entry, index) => (
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
        <Loading message="Syncing territory data..." />
      ) : (
        <div className="bg-[#0B0E16] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-white/5 flex justify-between items-center">
             <h3 className="text-2xl font-black font-heading text-white">Global Leaderboard</h3>
             <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">{dataWithRank.length} Bowlers Listed</span>
          </div>
          <DataTable columns={columns} data={dataWithRank} />
        </div>
      )}

      <LeaderboardShowcaseModal
        open={showcaseOpen}
        onClose={() => setShowcaseOpen(false)}
        title={`Elite ${sortLabel}`}
        items={dataWithRank.slice(0, 10).map(b => ({ ...b, value: getMetricValue(b) }))}
        metricLabel={sortLabel}
        accent="#FF2D78"
      />
    </div>
  )
}
