import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { getBowlingLeaderboard, getSeasons, getTeams } from '../lib/api'
import SEO from '../components/SEO'
import DataTable from '../components/ui/DataTable'
import Select from '../components/ui/Select'
import Loading from '../components/ui/Loading'
import MultiSeasonSelect from '../components/ui/MultiSeasonSelect'
import { formatDecimal } from '../utils/format'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

const SORT_OPTIONS = [
  { value: 'wickets', label: 'Wickets' },
  { value: 'avg', label: 'Average' },
  { value: 'economy', label: 'Economy' },
  { value: 'sr', label: 'Strike Rate' },
]

const rankAccent = (rank) => {
  if (rank === 1) return 'bg-amber-500/10 border-l-2 border-l-amber-400'
  if (rank === 2) return 'bg-gray-400/5 border-l-2 border-l-gray-400'
  if (rank === 3) return 'bg-amber-700/10 border-l-2 border-l-amber-700'
  return ''
}

export default function BowlingRecords() {
  const [season, setSeason] = useState('')
  const [team, setTeam] = useState('')
  const [sortBy, setSortBy] = useState('wickets')

  const { data: seasons } = useFetch(() => getSeasons(), [])
  const { data: teams } = useFetch(() => getTeams(), [])

  const { data: bowlers, loading, error } = useFetch(
    () => getBowlingLeaderboard({ season, team, sort_by: sortBy, limit: 50 }),
    [season, team, sortBy]
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
        <Link to={`/bowling/${encodeURIComponent(val)}`} className="flex items-center gap-2 text-accent-cyan hover:underline font-medium">
          <PlayerAvatar name={val} size={28} showBorder={false} />
          {val}
        </Link>
      ),
    },
    { key: 'matches', label: 'Mat', align: 'right', render: (val) => <span className="font-mono">{val}</span> },
    { key: 'innings', label: 'Inn', align: 'right', render: (val) => <span className="font-mono">{val}</span> },
    { key: 'overs', label: 'Overs', align: 'right', render: (val) => <span className="font-mono">{formatDecimal(val, 1)}</span> },
    {
      key: 'wickets',
      label: 'Wkts',
      align: 'right',
      render: (val) => <span className="font-mono font-semibold text-accent-magenta">{val}</span>,
    },
    { key: 'avg', label: 'Avg', align: 'right', render: (val) => <span className="font-mono">{formatDecimal(val)}</span> },
    { key: 'economy', label: 'Econ', align: 'right', render: (val) => <span className="font-mono">{formatDecimal(val)}</span> },
    { key: 'sr', label: 'SR', align: 'right', render: (val) => <span className="font-mono">{formatDecimal(val)}</span> },
    { key: 'best_figures', label: 'BBI', align: 'right', render: (val) => <span className="font-mono">{val || '-'}</span> },
    { key: 'four_w', label: '4W', align: 'right', render: (val) => <span className="font-mono">{val}</span> },
    { key: 'five_w', label: '5W', align: 'right', render: (val) => <span className="font-mono">{val}</span> },
  ]

  const dataWithRank = (Array.isArray(bowlers) ? bowlers : []).map((b, i) => ({
    ...b,
    rank: i + 1,
    _rowClass: rankAccent(i + 1),
  }))

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-heading text-lg">Failed to load bowling records</p>
        <p className="text-text-secondary text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SEO
        title="Bowling Records & Leaderboard"
        description="IPL bowling records and leaderboard. Top wicket-takers, best economy rates, bowling averages, and bowling figures across all IPL seasons."
      />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-text-primary">Bowling Records</h1>
        <p className="text-text-secondary text-sm mt-1">Top wicket takers across IPL seasons</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm">Season</label>
          <MultiSeasonSelect seasons={seasons || []} value={season} onChange={setSeason} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm">Team</label>
          <Select options={teamOptions} value={team} onChange={setTeam} placeholder="" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm">Sort by</label>
          <Select options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} placeholder="" />
        </div>
      </div>

      {/* Top 15 Bar Chart */}
      {!loading && dataWithRank.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-heading font-semibold text-text-secondary mb-3">
            Top 15 — {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || sortBy}
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={dataWithRank.slice(0, 15).map((b) => ({ name: b.player, value: b[sortBy] ?? 0 }))}
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
                fill="#FF2D78"
                name={SORT_OPTIONS.find((o) => o.value === sortBy)?.label || sortBy}
                radius={[0, 4, 4, 0]}
                barSize={18}
                label={{
                  position: 'right',
                  fill: '#FF2D78',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  formatter: (v) => typeof v === 'number' ? v.toLocaleString('en-IN') : v,
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <Loading message="Loading bowling leaderboard..." />
      ) : (
        <DataTable columns={columns} data={dataWithRank} />
      )}
    </div>
  )
}
