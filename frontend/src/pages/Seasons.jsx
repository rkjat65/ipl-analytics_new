import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import SEO from '../components/SEO'
import {
  getSeasons,
  getSeasonSummary,
  getPointsTable,
  getCapRace,
} from '../lib/api'
import StatCard from '../components/ui/StatCard'
import DataTable from '../components/ui/DataTable'
import Loading from '../components/ui/Loading'
import LeaderboardShowcaseModal from '../components/ui/LeaderboardShowcaseModal'
import { formatNumber, formatDecimal } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const CHART_COLORS = [
  '#00E5FF', // cyan
  '#76FF03', // lime
  '#FF4081', // magenta
  '#FFAB00', // amber
  '#B388FF', // purple
  '#FF6E40', // deep orange
  '#64FFDA', // teal
  '#FFD740', // yellow
]

function CustomTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#16161F] border border-[#2A2A3A] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-text-muted text-xs mb-1 font-mono">Match {label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: <span className="font-mono font-semibold">{entry.value}{unit}</span>
        </p>
      ))}
    </div>
  )
}

export default function Seasons() {
  const { year } = useParams()
  const navigate = useNavigate()
  const [showcaseConfig, setShowcaseConfig] = useState(null)

  const { data: seasons, loading: seasonsLoading } = useFetch(() => getSeasons(), [])

  // If no year param, redirect to latest season once loaded
  const selectedYear = year || (seasons && seasons.length > 0 ? String(seasons[seasons.length - 1]) : '')

  const { data: summary, loading: summaryLoading, error: summaryError } = useFetch(
    () => (selectedYear ? getSeasonSummary(selectedYear) : Promise.resolve(null)),
    [selectedYear]
  )

  const { data: pointsTable, loading: ptLoading } = useFetch(
    () => (selectedYear ? getPointsTable(selectedYear) : Promise.resolve(null)),
    [selectedYear]
  )

  const { data: capRace, loading: capLoading } = useFetch(
    () => (selectedYear ? getCapRace(selectedYear) : Promise.resolve(null)),
    [selectedYear]
  )

  const seasonOptions = (seasons || []).map((s) => ({ value: String(s), label: String(s) }))

  const selectClass =
    'bg-bg-card border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary font-body focus:outline-none focus:border-accent-cyan transition-colors appearance-none cursor-pointer pr-8'
  const selectStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238888A0' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
  }

  // Points table columns
  const ptColumns = [
    {
      key: 'pos',
      label: 'Pos',
      align: 'center',
      render: (val, row) => {
        const pos = val ?? 0
        const isPlayoff = pos <= 4
        return (
          <span className={`font-mono font-semibold ${isPlayoff ? 'text-accent-lime' : 'text-text-primary'}`}>
            {pos}
          </span>
        )
      },
    },
    {
      key: 'team',
      label: 'Team',
      render: (val, row) => {
        const pos = row.pos ?? 99
        return (
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getTeamColor(val) }}
            />
            <span className={`font-heading font-semibold ${pos <= 4 ? 'text-text-primary' : 'text-text-secondary'}`}>
              {val}
            </span>
          </div>
        )
      },
    },
    { key: 'played', label: 'Mat', align: 'right', render: (val) => <span className="font-mono">{val}</span> },
    { key: 'won', label: 'W', align: 'right', render: (val) => <span className="font-mono text-accent-lime">{val}</span> },
    { key: 'lost', label: 'L', align: 'right', render: (val) => <span className="font-mono text-danger">{val}</span> },
    { key: 'no_result', label: 'NR', align: 'right', render: (val) => <span className="font-mono text-text-muted">{val ?? 0}</span> },
    {
      key: 'points',
      label: 'Pts',
      align: 'right',
      render: (val) => <span className="font-mono font-bold text-accent-cyan">{val}</span>,
    },
    {
      key: 'nrr',
      label: 'NRR',
      align: 'right',
      render: (val) => {
        const n = parseFloat(val)
        const color = n > 0 ? 'text-accent-lime' : n < 0 ? 'text-danger' : 'text-text-muted'
        return <span className={`font-mono ${color}`}>{n > 0 ? '+' : ''}{formatDecimal(val, 3)}</span>
      },
    },
  ]

  // Add position to points table data
  const ptData = (pointsTable || []).map((row, i) => ({ ...row, pos: i + 1 }))

  // Process cap race data for charts
  function buildCapChartData(capData, valueKey) {
    if (!capData?.length) return { chartData: [], players: [] }

    // Get unique players (top 5)
    const playerTotals = {}
    capData.forEach((d) => {
      const key = d.player
      const val = d[valueKey] ?? d.cumulative_runs ?? d.cumulative_wickets ?? 0
      if (!playerTotals[key] || val > playerTotals[key]) {
        playerTotals[key] = val
      }
    })
    const topPlayers = Object.entries(playerTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)

    // Get unique dates sorted chronologically, assign match numbers
    const uniqueDates = [...new Set(capData.map((d) => d.date))].sort()
    const dateToMatchNum = {}
    uniqueDates.forEach((date, i) => { dateToMatchNum[date] = i + 1 })

    // Build chart data: one row per unique date
    const chartData = uniqueDates.map((date) => {
      const mn = dateToMatchNum[date]
      const row = { match_number: mn }
      topPlayers.forEach((player) => {
        const entry = capData.find((d) => d.player === player && d.date === date)
        row[player] = entry ? (entry[valueKey] ?? entry.cumulative_runs ?? entry.cumulative_wickets ?? 0) : undefined
      })
      return row
    })

    // Fill gaps: carry forward last known value
    topPlayers.forEach((player) => {
      let last = 0
      chartData.forEach((row) => {
        if (row[player] !== undefined) {
          last = row[player]
        } else {
          row[player] = last || undefined
        }
      })
    })

    return { chartData, players: topPlayers }
  }

  const orangeCapData = buildCapChartData(capRace?.orange_cap_race, 'cumulative_runs')
  const purpleCapData = buildCapChartData(capRace?.purple_cap_race, 'cumulative_wickets')

  const buildCapShowcaseItems = (capData) => {
    if (!capData?.players?.length || !capData?.chartData?.length) return []
    return capData.players
      .map((player) => {
        const lastRow = [...capData.chartData].reverse().find((row) => row[player] !== undefined)
        return {
          player,
          value: lastRow?.[player] ?? 0,
          latestMatch: lastRow?.match_number ?? capData.chartData.length,
        }
      })
      .sort((a, b) => b.value - a.value)
      .map((entry, index) => ({ ...entry, rank: index + 1 }))
  }

  const pointsShowcaseData = ptData
    .map((row) => ({
      rank: row.pos,
      player: row.team,
      value: row.points,
      played: row.played,
      nrr: row.nrr,
      wins: row.won,
    }))
    .sort((a, b) => b.value - a.value)

  const orangeCapShowcaseData = buildCapShowcaseItems(orangeCapData)
  const purpleCapShowcaseData = buildCapShowcaseItems(purpleCapData)

  if (summaryError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-heading text-lg">Failed to load season data</p>
        <p className="text-text-secondary text-sm">{summaryError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SEO
        title="IPL Seasons"
        description="Explore IPL season-by-season analytics with points tables, top performers, orange and purple cap races, and season summaries."
      />
      {/* Header + Season Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">
            IPL {selectedYear || ''}
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Season overview, standings, and cap races
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm font-body">Season</label>
          <select
            value={selectedYear}
            onChange={(e) => navigate(`/seasons/${e.target.value}`)}
            className={selectClass}
            style={selectStyle}
          >
            {seasonOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Season Summary Stats */}
      {summaryLoading ? (
        <Loading message="Loading season summary..." />
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label="Matches" value={formatNumber(summary.total_matches)} color="cyan" />
            <StatCard label="Cities" value={formatNumber(summary.cities)} color="lime" />
            <StatCard label="Venues" value={formatNumber(summary.venues)} color="magenta" />
            <StatCard label="Winner" value={summary.winner ?? '-'} color="amber" />
            <StatCard label="Season" value={`${summary.start_date ?? ''} - ${summary.end_date ?? ''}`} color="lime" />
          </div>

          {/* Highlight cards */}
          {(summary.orange_cap || summary.purple_cap) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary.orange_cap && (
                <div className="card flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-accent-amber/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-accent-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-1">Orange Cap</p>
                    <span className="text-xl font-heading font-bold text-accent-amber stat-glow-amber">
                      {summary.orange_cap.player}
                    </span>
                    <span className="text-text-muted text-sm ml-2">({summary.orange_cap.runs} runs)</span>
                  </div>
                </div>
              )}
              {summary.purple_cap && (
                <div className="card flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-accent-magenta/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-accent-magenta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-1">Purple Cap</p>
                    <span className="text-xl font-heading font-bold text-accent-magenta stat-glow-magenta">
                      {summary.purple_cap.player}
                    </span>
                    <span className="text-text-muted text-sm ml-2">({summary.purple_cap.wickets} wickets)</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}

      {/* Points Table */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-accent-cyan rounded-full" />
          <h2 className="text-xl font-heading font-bold text-text-primary">Points Table</h2>
        </div>

        {/* Points Bar Chart */}
        {!ptLoading && ptData.length > 0 && (
          <div className="card mb-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-heading font-semibold text-text-secondary">Standings by Points</h3>
              <button
                type="button"
                onClick={() => setShowcaseConfig({
                  title: `IPL ${selectedYear} points table`,
                  subtitle: 'Fullscreen presentation mode for the season standings with reverse playback and a full team summary at the end.',
                  items: pointsShowcaseData,
                  metricLabel: 'Points',
                  accent: '#00E5FF',
                  detailFields: [
                    { key: 'wins', label: 'Wins', formatter: (value) => formatNumber(value) },
                    { key: 'played', label: 'Played', formatter: (value) => formatNumber(value) },
                    { key: 'nrr', label: 'NRR', formatter: (value) => formatDecimal(value, 3) },
                  ],
                })}
                className="rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1.5 text-xs font-semibold text-accent-cyan hover:bg-accent-cyan/20"
              >
                Enter animation mode
              </button>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(250, ptData.length * 36)}>
              <BarChart
                data={ptData.map((row) => ({
                  name: getTeamAbbr(row.team),
                  points: row.points,
                  team: row.team,
                }))}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#8888A0', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#1E1E2A' }}
                  tickLine={{ stroke: '#1E1E2A' }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={55}
                  tick={{ fill: '#8888A0', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#1E1E2A' }}
                  tickLine={{ stroke: '#1E1E2A' }}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: '#1E1E2A' }}
                />
                <Bar
                  dataKey="points"
                  name="Points"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                  label={{ position: 'right', fill: '#E8E8F0', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}
                >
                  {ptData.map((row) => (
                    <Cell key={row.team} fill={getTeamColor(row.team)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {ptLoading ? (
          <Loading message="Loading points table..." />
        ) : ptData.length > 0 ? (
          <DataTable columns={ptColumns} data={ptData} />
        ) : (
          <p className="text-text-muted text-sm py-8 text-center">No points table data available</p>
        )}
      </section>

      {/* Orange Cap Race */}
      {!capLoading && orangeCapData.chartData.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-accent-amber rounded-full" />
            <h2 className="text-xl font-heading font-bold text-text-primary">Orange Cap Race</h2>
          </div>
          <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-text-secondary">Track the final leaders, then switch to animation mode for the cinematic reveal.</p>
              <button
                type="button"
                onClick={() => setShowcaseConfig({
                  title: `IPL ${selectedYear} Orange Cap race`,
                  subtitle: 'A fullscreen final-standings reveal for the orange-cap leaderboard.',
                  items: orangeCapShowcaseData,
                  metricLabel: 'Runs',
                  accent: '#FFB800',
                  detailFields: [
                    { key: 'latestMatch', label: 'Latest match', formatter: (value) => formatNumber(value) },
                  ],
                })}
                className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-1.5 text-xs font-semibold text-accent-amber hover:bg-accent-amber/20"
              >
                Enter animation mode
              </button>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={orangeCapData.chartData}>
                <CartesianGrid stroke="#1E1E2A" strokeDasharray="3 3" />
                <XAxis
                  dataKey="match_number"
                  tick={{ fill: '#8888A0', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#1E1E2A' }}
                  tickLine={{ stroke: '#1E1E2A' }}
                  label={{ value: 'Match #', position: 'insideBottomRight', offset: -5, fill: '#8888A0', fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: '#8888A0', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#1E1E2A' }}
                  tickLine={{ stroke: '#1E1E2A' }}
                  label={{ value: 'Runs', angle: -90, position: 'insideLeft', fill: '#8888A0', fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono' }}
                />
                {orangeCapData.players.map((player, i) => (
                  <Line
                    key={player}
                    type="monotone"
                    dataKey={player}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Purple Cap Race */}
      {!capLoading && purpleCapData.chartData.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-accent-magenta rounded-full" />
            <h2 className="text-xl font-heading font-bold text-text-primary">Purple Cap Race</h2>
          </div>
          <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-text-secondary">Purple-cap finishers can also be replayed in the same fullscreen reveal mode.</p>
              <button
                type="button"
                onClick={() => setShowcaseConfig({
                  title: `IPL ${selectedYear} Purple Cap race`,
                  subtitle: 'A fullscreen final-standings reveal for the purple-cap leaderboard.',
                  items: purpleCapShowcaseData,
                  metricLabel: 'Wickets',
                  accent: '#FF2D78',
                  detailFields: [
                    { key: 'latestMatch', label: 'Latest match', formatter: (value) => formatNumber(value) },
                  ],
                })}
                className="rounded-lg border border-accent-magenta/30 bg-accent-magenta/10 px-3 py-1.5 text-xs font-semibold text-accent-magenta hover:bg-accent-magenta/20"
              >
                Enter animation mode
              </button>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={purpleCapData.chartData}>
                <CartesianGrid stroke="#1E1E2A" strokeDasharray="3 3" />
                <XAxis
                  dataKey="match_number"
                  tick={{ fill: '#8888A0', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#1E1E2A' }}
                  tickLine={{ stroke: '#1E1E2A' }}
                  label={{ value: 'Match #', position: 'insideBottomRight', offset: -5, fill: '#8888A0', fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: '#8888A0', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#1E1E2A' }}
                  tickLine={{ stroke: '#1E1E2A' }}
                  label={{ value: 'Wickets', angle: -90, position: 'insideLeft', fill: '#8888A0', fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono' }}
                />
                {purpleCapData.players.map((player, i) => (
                  <Line
                    key={player}
                    type="monotone"
                    dataKey={player}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {capLoading && <Loading message="Loading cap race data..." />}

      <LeaderboardShowcaseModal
        open={Boolean(showcaseConfig)}
        onClose={() => setShowcaseConfig(null)}
        title={showcaseConfig?.title || 'Animation mode'}
        subtitle={showcaseConfig?.subtitle || 'Fullscreen presentation mode'}
        items={showcaseConfig?.items || []}
        metricLabel={showcaseConfig?.metricLabel || 'Value'}
        accent={showcaseConfig?.accent || '#00E5FF'}
        valueFormatter={showcaseConfig?.valueFormatter}
        detailFields={showcaseConfig?.detailFields || []}
        defaultOrder={showcaseConfig?.defaultOrder || 'desc'}
      />
    </div>
  )
}
