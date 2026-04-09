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
import { exportAsImage, downloadImage } from '../utils/exportCard'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  ComposedChart,
  Line,
  Legend,
} from 'recharts'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#16161F] border border-[#2A2A3A] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[#8888A0] text-xs mb-1 font-mono">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color || '#E8E8ED' }}>
          {entry.name}: <span className="font-mono font-semibold">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </p>
      ))}
    </div>
  )
}

function MatrixTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const player = payload[0]?.payload
  return (
    <div className="bg-[#16161F] border border-[#2A2A3A] rounded-lg px-3 py-2 shadow-lg max-w-[240px]">
      <div className="flex items-center gap-2 mb-1">
        <PlayerAvatar name={player?.player} size={26} showBorder={false} />
        <p className="text-text-primary text-xs font-semibold">{player?.player}</p>
      </div>
      <p className="text-xs text-accent-lime">Runs: <span className="font-mono font-semibold">{formatNumber(player?.runs)}</span></p>
      <p className="text-xs text-accent-cyan">Average: <span className="font-mono font-semibold">{formatDecimal(player?.avg)}</span></p>
      <p className="text-xs text-accent-amber">Strike rate: <span className="font-mono font-semibold">{formatDecimal(player?.sr)}</span></p>
      <p className="text-[11px] text-text-muted mt-1">{player?.innings} innings • {player?.sixes} sixes • {player?.fours} fours</p>
    </div>
  )
}

const SORT_OPTIONS = [
  { value: 'runs', label: 'Runs' },
  { value: 'avg', label: 'Average' },
  { value: 'sr', label: 'Strike Rate' },
  { value: 'fifties', label: '50s' },
  { value: 'hundreds', label: '100s' },
  { value: 'sixes', label: 'Sixes' },
  { value: 'fours', label: 'Fours' },
  { value: 'matches', label: 'Matches' },
]

const BAR_COLORS = [
  '#00E5FF', '#B8FF00', '#FFB800', '#FF2D78', '#8B5CF6',
  '#22D3EE', '#22C55E', '#FBBF24', '#EF4444', '#A78BFA',
  '#F472B6', '#34D399', '#FB923C', '#60A5FA', '#E879F9',
]

const rankAccent = (rank) => {
  if (rank === 1) return 'bg-amber-500/10 border-l-2 border-l-amber-400'
  if (rank === 2) return 'bg-gray-400/5 border-l-2 border-l-gray-400'
  if (rank === 3) return 'bg-amber-700/10 border-l-2 border-l-amber-700'
  return ''
}

function HeroStat({ label, value, accent = 'cyan', meta = '' }) {
  const accentClass = {
    cyan: 'text-accent-cyan stat-glow-cyan',
    lime: 'text-accent-lime stat-glow-lime',
    amber: 'text-accent-amber stat-glow-amber',
    magenta: 'text-accent-magenta stat-glow-magenta',
  }[accent] || 'text-accent-cyan stat-glow-cyan'

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{label}</p>
      <p className={`mt-1 text-lg font-heading font-bold ${accentClass}`}>{value}</p>
      {meta ? <p className="mt-1 text-[11px] text-text-muted">{meta}</p> : null}
    </div>
  )
}

export default function BattingRecords() {
  const chartRef = useRef(null)
  const [season, setSeason] = useState('')
  const [team, setTeam] = useState('')
  const [sortBy, setSortBy] = useState('runs')
  const [minBalls, setMinBalls] = useState(0)
  const [downloading, setDownloading] = useState(false)

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

  const seasonOptions = [{ value: '', label: 'All Seasons' }, ...(seasons || []).map((s) => ({ value: s, label: s }))]
  const teamOptions = [{ value: '', label: 'All Teams' }, ...(teams || []).map((t) => ({ value: t, label: t }))]

  const columns = [
    {
      key: 'rank',
      label: '#',
      align: 'center',
      render: (val) => {
        const badges = { 1: 'text-amber-400', 2: 'text-gray-400', 3: 'text-amber-700' }
        return <span className={`font-mono font-bold ${badges[val] || 'text-text-muted'}`}>{val}</span>
      },
    },
    {
      key: 'player',
      label: 'Player',
      render: (val) => (
        <Link to={`/batting/${encodeURIComponent(val)}`} className="flex items-center gap-2 text-accent-cyan hover:underline font-medium">
          <PlayerAvatar name={val} size={28} showBorder={false} />
          {val}
        </Link>
      ),
    },
    { key: 'matches', label: 'Mat', align: 'right', render: (val) => <span className="font-mono">{val}</span> },
    { key: 'innings', label: 'Inn', align: 'right', render: (val) => <span className="font-mono">{val}</span> },
    {
      key: 'runs',
      label: 'Runs',
      align: 'right',
      render: (val) => <span className="font-mono font-semibold text-accent-lime">{formatNumber(val)}</span>,
    },
    { key: 'avg', label: 'Avg', align: 'right', render: (val) => <span className="font-mono">{formatDecimal(val)}</span> },
    { key: 'sr', label: 'SR', align: 'right', render: (val) => <span className="font-mono">{formatDecimal(val)}</span> },
    { key: 'highest', label: 'HS', align: 'right', render: (val) => <span className="font-mono">{val}</span> },
    { key: 'fifties', label: '50s', align: 'right', render: (val) => <span className="font-mono">{val}</span> },
    { key: 'hundreds', label: '100s', align: 'right', render: (val) => <span className="font-mono">{val}</span> },
    { key: 'fours', label: '4s', align: 'right', render: (val) => <span className="font-mono">{val}</span> },
    { key: 'sixes', label: '6s', align: 'right', render: (val) => <span className="font-mono">{val}</span> },
  ]

  const dataWithRank = (Array.isArray(batters) ? batters : []).map((b, i) => ({
    ...b,
    rank: i + 1,
    _rowClass: rankAccent(i + 1),
  }))
  const leader = dataWithRank[0] || null
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || sortBy
  const matrixPoints = useMemo(() => (Array.isArray(battingMatrix) ? battingMatrix : [])
    .filter((entry) => Number(entry?.avg) > 0 && Number(entry?.sr) > 0 && Number(entry?.runs) > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 24)
    .map((entry) => ({
      ...entry,
      shortName: entry.player?.length > 12 ? `${entry.player.slice(0, 11)}…` : entry.player,
    })), [battingMatrix])
  const eliteBatters = matrixPoints.filter((entry) => entry.avg >= 30 && entry.sr >= 135).length
  const powerBatters = matrixPoints.filter((entry) => entry.sr >= 145).length
  const anchorBatters = matrixPoints.filter((entry) => entry.avg >= 35).length
  const battingStyleData = dataWithRank.slice(0, 8).map((entry) => ({
    name: entry.player?.length > 12 ? `${entry.player.slice(0, 11)}…` : entry.player,
    fullName: entry.player,
    fours: entry.fours,
    sixes: entry.sixes,
    sr: entry.sr,
    avg: entry.avg,
  }))

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-heading text-lg">Failed to load batting records</p>
        <p className="text-text-secondary text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SEO
        title="Batting Records & Leaderboard"
        description="IPL batting records and leaderboard. Top run scorers, highest strike rates, centuries, and batting averages across all IPL seasons."
      />
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(184,255,0,0.16),transparent_0%,transparent_36%),radial-gradient(circle_at_bottom_right,rgba(0,229,255,0.12),transparent_0%,transparent_34%),linear-gradient(135deg,#0B0E16_0%,#101726_42%,#130F1D_100%)] p-5 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] animate-in">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-lime/25 bg-accent-lime/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-accent-lime">
              <span className="h-2 w-2 rounded-full bg-accent-lime animate-pulse" />
              Batting command centre
            </span>
            <div>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-text-primary">Batting Records</h1>
              <p className="mt-2 text-sm text-text-secondary max-w-2xl leading-relaxed">
                Premium batting filters, stronger highlights, and leaderboard context for run volume, tempo, and consistency.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
              <span className="rounded-full border border-accent-lime/20 bg-accent-lime/10 px-3 py-1 text-accent-lime">Sorted by {sortLabel}</span>
              {team && <span className="rounded-full border border-accent-cyan/20 bg-accent-cyan/10 px-3 py-1 text-accent-cyan">Team: {team}</span>}
              {season && <span className="rounded-full border border-accent-amber/20 bg-accent-amber/10 px-3 py-1 text-accent-amber">Season filter active</span>}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <HeroStat label="Leader" value={leader ? formatNumber(leader.runs) : '—'} accent="lime" meta={leader ? leader.player : 'Runs leader'} />
            <HeroStat label="Strike rate" value={leader ? formatDecimal(leader.sr) : '—'} accent="amber" meta={leader ? `${leader.sixes} sixes` : 'Top tempo'} />
            <HeroStat label="Average" value={leader ? formatDecimal(leader.avg) : '—'} accent="cyan" meta={leader ? `${leader.matches} matches` : 'Current sample'} />
          </div>
        </div>
      </section>

      <div className="card overflow-visible flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm">Season</label>
          <Select options={seasonOptions} value={season} onChange={setSeason} placeholder="" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm">Team</label>
          <Select options={teamOptions} value={team} onChange={setTeam} placeholder="" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm">Sort by</label>
          <Select options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} placeholder="" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm">Min Balls</label>
          <Select
            options={[
              { value: 0, label: 'All' },
              { value: 50, label: '50+' },
              { value: 100, label: '100+' },
              { value: 200, label: '200+' },
              { value: 500, label: '500+' },
              { value: 1000, label: '1000+' },
            ]}
            value={minBalls}
            onChange={(v) => setMinBalls(Number(v))}
            placeholder=""
          />
        </div>
      </div>

      {/* Top 15 Bar Chart */}
      {!loading && dataWithRank.length > 0 && (
        <div className="card animate-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-heading font-semibold text-text-secondary">
              Top 15 — {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || sortBy}
            </h3>
            <button
              onClick={handleDownloadChart}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border-subtle text-text-secondary hover:text-accent-cyan hover:border-accent-cyan/40 transition-colors disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {downloading ? 'Saving...' : 'Download'}
            </button>
          </div>
          <div ref={chartRef} className="bg-bg-primary rounded-lg p-2">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={dataWithRank.slice(0, 15).map((b) => ({ name: b.player, value: b[sortBy] ?? 0 })).sort((a, b) => b.value - a.value)}
              layout="vertical"
              margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#8888A0', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: '#1E1E2A' }}
                tickLine={{ stroke: '#1E1E2A' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fill: '#8888A0', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: '#1E1E2A' }}
                tickLine={{ stroke: '#1E1E2A' }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#1E1E2A' }} />
              <Bar
                dataKey="value"
                name={SORT_OPTIONS.find((o) => o.value === sortBy)?.label || sortBy}
                radius={[0, 4, 4, 0]}
                barSize={18}
                label={{
                  position: 'right',
                  fill: '#E8E8F0',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  formatter: (v) => ['avg', 'sr'].includes(sortBy) ? formatDecimal(v) : formatNumber(v),
                }}
              >
                {dataWithRank.slice(0, 15).map((_, idx) => (
                  <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {!loading && battingStyleData.length > 0 && (
        <div className="card animate-in">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-4">
            <div>
              <h3 className="text-lg font-heading font-bold text-text-primary">Boundary Profile & Tempo</h3>
              <p className="text-xs text-text-secondary">A meaningful batting-style view: how top batters mix fours, sixes, and strike rate.</p>
            </div>
            <span className="rounded-full border border-accent-amber/20 bg-accent-amber/10 px-3 py-1 text-[10px] font-semibold text-accent-amber">
              Top 8 style lens
            </span>
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={battingStyleData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" />
              <XAxis dataKey="name" tick={{ fill: '#8888A0', fontSize: 11 }} axisLine={{ stroke: '#2A2A3A' }} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: '#8888A0', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#8888A0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div className="bg-[#16161F] border border-[#2A2A3A] rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-text-primary text-xs font-semibold mb-1">{d?.fullName || label}</p>
                    <p className="text-xs text-accent-cyan">Fours: <span className="font-mono font-semibold">{d?.fours}</span></p>
                    <p className="text-xs text-accent-amber">Sixes: <span className="font-mono font-semibold">{d?.sixes}</span></p>
                    <p className="text-xs text-accent-lime">SR: <span className="font-mono font-semibold">{formatDecimal(d?.sr)}</span></p>
                    <p className="text-xs text-text-muted">Avg: <span className="font-mono">{formatDecimal(d?.avg)}</span></p>
                  </div>
                )
              }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8888A0' }} />
              <Bar yAxisId="left" dataKey="fours" stackId="boundaries" name="Fours" fill="#00E5FF" radius={[0, 0, 4, 4]} />
              <Bar yAxisId="left" dataKey="sixes" stackId="boundaries" name="Sixes" fill="#FFB800" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="sr" name="Strike Rate" stroke="#B8FF00" strokeWidth={2.5} dot={{ r: 3, fill: '#B8FF00' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && (
        <div className="card animate-in">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-4">
            <div>
              <h3 className="text-lg font-heading font-bold text-text-primary">Batting Impact Matrix</h3>
              <p className="text-xs text-text-secondary">Average vs strike rate • bubble size = total runs • top-right is the premium zone.</p>
            </div>
            <span className="rounded-full border border-accent-lime/20 bg-accent-lime/10 px-3 py-1 text-[10px] font-semibold text-accent-lime">
              {season ? 'Season scoped matrix' : 'All-time matrix'}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 mb-4">
            <HeroStat label="Elite profiles" value={eliteBatters} accent="lime" meta="Avg 30+ and SR 135+" />
            <HeroStat label="Power hitters" value={powerBatters} accent="amber" meta="SR 145+" />
            <HeroStat label="Anchors" value={anchorBatters} accent="cyan" meta="Avg 35+" />
          </div>

          {matrixLoading ? (
            <Loading message="Building batting matrix..." />
          ) : !matrixPoints.length ? (
            <p className="text-text-muted text-sm py-8 text-center">No batting matrix data available</p>
          ) : (() => {
            const maxRuns = Math.max(...matrixPoints.map((entry) => entry.runs))
            const labelThreshold = [...matrixPoints].sort((a, b) => b.runs - a.runs)[Math.min(5, matrixPoints.length - 1)]?.runs || 0
            const avgAvg = matrixPoints.reduce((sum, entry) => sum + entry.avg, 0) / matrixPoints.length
            const avgSR = matrixPoints.reduce((sum, entry) => sum + entry.sr, 0) / matrixPoints.length
            return (
              <>
                <ResponsiveContainer width="100%" height={380}>
                  <ScatterChart margin={{ top: 15, right: 24, left: 8, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" />
                    <XAxis dataKey="avg" type="number" name="Average" domain={[20, 'auto']} tick={{ fill: '#8888A0', fontSize: 11 }} axisLine={{ stroke: '#2A2A3A' }} tickLine={false} />
                    <YAxis dataKey="sr" type="number" name="Strike Rate" domain={[100, 'auto']} tick={{ fill: '#8888A0', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <ZAxis dataKey="runs" range={[60, 340]} name="Runs" />
                    <ReferenceLine x={avgAvg} stroke="#2A2A3A" strokeDasharray="4 4" />
                    <ReferenceLine y={avgSR} stroke="#2A2A3A" strokeDasharray="4 4" />
                    <Tooltip content={<MatrixTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#8888A0' }} />
                    <Scatter
                      data={matrixPoints}
                      shape={(props) => {
                        const { cx, cy, payload } = props
                        const radius = 5 + (payload.runs / maxRuns) * 12
                        const stroke = payload.avg >= 30 && payload.sr >= 135
                          ? '#B8FF00'
                          : payload.sr >= 145
                            ? '#FFB800'
                            : payload.avg >= 35
                              ? '#00E5FF'
                              : '#8B5CF6'
                        return (
                          <g>
                            <circle cx={cx} cy={cy} r={radius} fill="rgba(11,14,22,0.88)" stroke={stroke} strokeWidth={2} />
                            <circle cx={cx} cy={cy} r={Math.max(2, radius * 0.35)} fill={stroke} fillOpacity={0.9} />
                            {payload.runs >= labelThreshold && (
                              <text x={cx} y={cy - radius - 6} textAnchor="middle" fill="#E8E8F0" fontSize={10} fontWeight={600} fontFamily="monospace">
                                {payload.shortName}
                              </text>
                            )}
                          </g>
                        )
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-text-muted">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#B8FF00' }} /> Elite</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FFB800' }} /> Power hitter</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#00E5FF' }} /> Anchor</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#8B5CF6' }} /> Others</span>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <Loading message="Loading batting leaderboard..." />
      ) : (
        <div className="card">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-accent-lime/20 bg-accent-lime/10 px-3 py-1 text-[10px] font-semibold text-accent-lime">{dataWithRank.length} batters</span>
            <span className="rounded-full border border-accent-cyan/20 bg-accent-cyan/10 px-3 py-1 text-[10px] font-semibold text-accent-cyan">Sorted by {sortLabel}</span>
          </div>
          <DataTable columns={columns} data={dataWithRank} />
        </div>
      )}
    </div>
  )
}
