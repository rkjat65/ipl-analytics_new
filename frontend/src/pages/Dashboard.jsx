import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import SEO from '../components/SEO'
import { useFetch } from '../hooks/useFetch'
import Select from '../components/ui/Select'
import {
  getKPIs,
  getSeasons,
  getBattingLeaderboard,
  getBowlingLeaderboard,
  getMatches,
  getTopTotals,
  getTopSixes,
  getTopFours,
  getMostWins,
  getTeams,
  getManOfTheMatch,
  getInningsDNA,
  getSixEvolution,
  getDismissalTypes,
  getPhaseDominance,
  getBattingMatrix,
  getBowlingMatrix,
  searchPlayers,
} from '../lib/api'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import {
  BarChart, Bar, Cell, AreaChart, Area, PieChart, Pie,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, ReferenceLine, ScatterChart, Scatter, ZAxis,
} from 'recharts'
import StatCard from '../components/ui/StatCard'
import DataTable from '../components/ui/DataTable'
import Loading from '../components/ui/Loading'
import PlayerNameCell from '../components/ui/PlayerNameCell'
import MultiSeasonSelect from '../components/ui/MultiSeasonSelect'
import { formatNumber, formatDecimal, formatDate, getMatchResult } from '../utils/format'

/* ── Custom Recharts Tooltip ────────────────────────────── */
function NeonTooltip({ active, payload, label, valueLabel }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-xl border"
      style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
      <p className="text-text-primary font-semibold mb-0.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {valueLabel || p.name}: <span className="font-mono font-bold">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

const AVATAR_BASE = 'https://ui-avatars.com/api/'
function playerAvatarUrl(name, size = 28) {
  const initials = (name || '??').split(' ').map((word) => word[0]).join('').slice(0, 2)
  return `${AVATAR_BASE}?name=${encodeURIComponent(initials)}&size=${size}&background=16161F&color=00E5FF&bold=true&font-size=0.45`
}

function realPlayerImageUrl(name) {
  return `/api/players/${encodeURIComponent(name)}/image`
}

function usePlayerReveal(totalPlayers) {
  const [revealCount, setRevealCount] = useState(totalPlayers)
  const [revealing, setRevealing] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!revealing) {
      setRevealCount(totalPlayers)
    }
  }, [totalPlayers, revealing])

  const startReveal = useCallback(() => {
    setRevealCount(0)
    setRevealing(true)
  }, [])

  useEffect(() => {
    if (!revealing) return
    if (revealCount >= totalPlayers) {
      setRevealing(false)
      return
    }
    timerRef.current = setTimeout(() => {
      setRevealCount((count) => count + 1)
    }, 250)
    return () => clearTimeout(timerRef.current)
  }, [revealing, revealCount, totalPlayers])

  const reset = useCallback(() => {
    setRevealing(false)
    setRevealCount(totalPlayers)
    clearTimeout(timerRef.current)
  }, [totalPlayers])

  return { revealCount, revealing, startReveal, reset }
}

function PlayerRevealBtn({ revealer }) {
  return (
    <button
      onClick={revealer.revealing ? revealer.reset : revealer.startReveal}
      title={revealer.revealing ? 'Show all players' : 'Reveal players one by one'}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
        revealer.revealing
          ? 'bg-accent-amber/20 border border-accent-amber/40 text-accent-amber'
          : 'bg-accent-magenta/10 border border-accent-magenta/30 text-accent-magenta hover:bg-accent-magenta/20 cursor-pointer'
      }`}
    >
      {revealer.revealing ? (
        <>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
          Show All
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><circle cx="12" cy="8" r="4" /><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7" /></svg>
          Reveal Players
        </>
      )}
    </button>
  )
}

function ZoomControls({ zoom, setZoom }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
        title="Zoom out"
        className="w-7 h-7 flex items-center justify-center rounded bg-bg-card border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-cyan/40 transition-all text-sm font-bold"
      >
        −
      </button>
      <span className="text-[10px] text-text-muted font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
      <button
        onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
        title="Zoom in"
        className="w-7 h-7 flex items-center justify-center rounded bg-bg-card border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-cyan/40 transition-all text-sm font-bold"
      >
        +
      </button>
      {zoom !== 1 && (
        <button
          onClick={() => setZoom(1)}
          title="Reset zoom"
          className="px-2 py-1 rounded text-[10px] bg-bg-card border border-border-subtle text-text-muted hover:text-text-primary transition-all"
        >
          Reset
        </button>
      )}
    </div>
  )
}

const DISMISS_COLORS = ['#FF2D78', '#00E5FF', '#B8FF00', '#FFB800', '#8B5CF6', '#22D3EE', '#F472B6', '#34D399']
const INSIGHT_TABS = [
  { key: 'dna', label: 'Innings DNA', accent: 'cyan' },
  { key: 'sixes', label: 'Six evolution', accent: 'amber' },
  { key: 'phase', label: 'Phase dominance', accent: 'lime' },
  { key: 'matrix', label: 'Player matrices', accent: 'magenta' },
  { key: 'dismissal', label: 'Dismissal mix', accent: 'magenta' },
]

const ACCENT_STYLES = {
  cyan: {
    text: 'text-accent-cyan stat-glow-cyan',
    chip: 'border-accent-cyan/25 bg-accent-cyan/10 text-accent-cyan',
    line: 'from-accent-cyan/80 via-accent-cyan/20 to-transparent',
    dot: 'bg-accent-cyan',
  },
  lime: {
    text: 'text-accent-lime stat-glow-lime',
    chip: 'border-accent-lime/25 bg-accent-lime/10 text-accent-lime',
    line: 'from-accent-lime/80 via-accent-lime/20 to-transparent',
    dot: 'bg-accent-lime',
  },
  amber: {
    text: 'text-accent-amber stat-glow-amber',
    chip: 'border-accent-amber/25 bg-accent-amber/10 text-accent-amber',
    line: 'from-accent-amber/80 via-accent-amber/20 to-transparent',
    dot: 'bg-accent-amber',
  },
  magenta: {
    text: 'text-accent-magenta stat-glow-magenta',
    chip: 'border-accent-magenta/25 bg-accent-magenta/10 text-accent-magenta',
    line: 'from-accent-magenta/80 via-accent-magenta/20 to-transparent',
    dot: 'bg-accent-magenta',
  },
}

function DashboardPanel({ children, accent = 'cyan', className = '' }) {
  const tone = ACCENT_STYLES[accent] || ACCENT_STYLES.cyan
  return (
    <div className={`group relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(17,20,31,0.96),rgba(10,12,18,0.96))] p-4 sm:p-5 shadow-[0_18px_45px_rgba(0,0,0,0.28)] transition-all duration-300 hover:-translate-y-0.5 ${className}`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${tone.line}`} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_42%)] opacity-80" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function SectionHeader({ title, description, accent = 'cyan', action = null }) {
  const tone = ACCENT_STYLES[accent] || ACCENT_STYLES.cyan
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] ${tone.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          Dashboard focus
        </span>
        <h2 className="mt-3 text-xl sm:text-2xl font-heading font-bold text-text-primary">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-text-secondary leading-relaxed">{description}</p>
        )}
      </div>
      {action ? <div className="sm:shrink-0">{action}</div> : null}
    </div>
  )
}

function InsightCard({ eyebrow, title, value, meta, accent = 'cyan', to = '' }) {
  const tone = ACCENT_STYLES[accent] || ACCENT_STYLES.cyan
  const body = (
    <div className="group relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(17,20,31,0.96),rgba(10,12,18,0.96))] p-4 shadow-[0_16px_34px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-0.5">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${tone.line}`} />
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${tone.chip}`}>
        {eyebrow}
      </span>
      <p className="mt-3 text-sm font-semibold text-text-primary">{title}</p>
      <p className={`mt-1 text-xl font-heading font-bold ${tone.text}`}>{value}</p>
      {meta && <p className="mt-2 text-xs text-text-muted leading-relaxed">{meta}</p>}
    </div>
  )

  return to ? <Link to={to} className="block h-full">{body}</Link> : body
}

function QuickJump({ href, label }) {
  return (
    <a
      href={href}
      className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-accent-cyan/30 hover:text-accent-cyan"
    >
      {label}
    </a>
  )
}

function AccentPill({ accent = 'cyan', children, className = '' }) {
  const tone = ACCENT_STYLES[accent] || ACCENT_STYLES.cyan
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone.chip} ${className}`}>
      {children}
    </span>
  )
}

function MiniGlowStat({ label, value, meta, accent = 'cyan' }) {
  const tone = ACCENT_STYLES[accent] || ACCENT_STYLES.cyan
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className={`mt-1 text-lg font-heading font-bold ${tone.text}`}>{value}</p>
      {meta ? <p className="mt-1 text-[11px] text-text-muted">{meta}</p> : null}
    </div>
  )
}

export default function Dashboard() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [season, setSeason] = useState('')
  const [showTopTotals, setShowTopTotals] = useState(false)
  const [showTopSixes, setShowTopSixes] = useState(false)
  const [showTopFours, setShowTopFours] = useState(false)
  const [showTopWickets, setShowTopWickets] = useState(false)
  const [batSort, setBatSort] = useState('runs')
  const [bowlSort, setBowlSort] = useState('wickets')
  const [motmChartType, setMotmChartType] = useState('top_players')
  const [motmTeam, setMotmTeam] = useState('')
  const [motmPlayer, setMotmPlayer] = useState('')
  const [motmRole, setMotmRole] = useState('all')
  const [motmPlayerQuery, setMotmPlayerQuery] = useState('')
  const [motmPlayerResults, setMotmPlayerResults] = useState([])
  const [insightView, setInsightView] = useState('dna')
  const [showBatTable, setShowBatTable] = useState(false)
  const [showBowlTable, setShowBowlTable] = useState(false)
  const [batMatrixZoom, setBatMatrixZoom] = useState(1)
  const [bowlMatrixZoom, setBowlMatrixZoom] = useState(1)

  const { data: seasons, loading: seasonsLoading } = useFetch(() => getSeasons(), [])

  const { data: kpis, loading: kpisLoading, error: kpisError } = useFetch(
    () => getKPIs(season),
    [season]
  )

  const { data: batters, loading: battersLoading } = useFetch(
    () => getBattingLeaderboard({ season, limit: 10, sort_by: batSort, order: 'desc' }),
    [season, batSort]
  )

  const { data: bowlers, loading: bowlersLoading } = useFetch(
    () => getBowlingLeaderboard({ season, limit: 10, sort_by: bowlSort, order: 'desc' }),
    [season, bowlSort]
  )

  const { data: matchesData, loading: matchesLoading } = useFetch(
    () => getMatches({ season, limit: 10, offset: 0 }),
    [season]
  )

  const { data: topTotals, loading: topTotalsLoading } = useFetch(
    () => getTopTotals(season),
    [season]
  )

  const { data: topSixes, loading: topSixesLoading } = useFetch(
    () => getTopSixes(season),
    [season]
  )

  const { data: topFours, loading: topFoursLoading } = useFetch(
    () => getTopFours(season),
    [season]
  )

  const { data: mostWins, loading: mostWinsLoading } = useFetch(
    () => getMostWins(season),
    [season]
  )

  const { data: inningsDNA, loading: inningsDnaLoading } = useFetch(
    () => getInningsDNA(season),
    [season]
  )

  const { data: sixEvolution, loading: sixEvolutionLoading } = useFetch(
    () => getSixEvolution(),
    []
  )

  const { data: dismissalTypes, loading: dismissalLoading } = useFetch(
    () => getDismissalTypes(season),
    [season]
  )

  const { data: phaseDominance, loading: phaseLoading } = useFetch(
    () => getPhaseDominance(season),
    [season]
  )

  const { data: battingMatrix, loading: matrixLoading } = useFetch(
    () => getBattingMatrix(season, season ? 10 : 20),
    [season]
  )

  const { data: bowlingMatrix, loading: bowlMatrixLoading } = useFetch(
    () => getBowlingMatrix(season, season ? 10 : 20),
    [season]
  )

  const { data: allTeams } = useFetch(() => getTeams(), [])
  const { data: motmData, loading: motmLoading } = useFetch(
    () => getManOfTheMatch({ season, team: motmTeam, player: motmPlayer, role: motmRole !== 'all' ? motmRole : undefined }),
    [season, motmTeam, motmPlayer, motmRole]
  )

  useEffect(() => {
    if (motmPlayerQuery.length < 2) {
      setMotmPlayerResults([])
      return
    }
    const timer = setTimeout(() => {
      searchPlayers(motmPlayerQuery)
        .then(setMotmPlayerResults)
        .catch(() => {})
    }, 250)
    return () => clearTimeout(timer)
  }, [motmPlayerQuery])

  const seasonOptions = (seasons || []).map((s) => ({ value: s, label: s }))
  const teamOptions = [{ value: '', label: 'All Teams' }, ...(Array.isArray(allTeams) ? allTeams.map((t) => ({ value: t, label: t })) : [])]

  // Batting leaderboard columns
  const battingColumns = [
    { key: 'rank', label: '#', align: 'center' },
    {
      key: 'player',
      label: 'Player',
      render: (val) => <PlayerNameCell name={val} to={`/batting/${encodeURIComponent(val)}`} size={26} />,
    },
    { key: 'matches', label: 'Mat', align: 'right' },
    { key: 'innings', label: 'Inn', align: 'right' },
    { key: 'runs', label: 'Runs', align: 'right', render: (val) => <span className="font-mono font-semibold text-accent-lime">{formatNumber(val)}</span> },
    { key: 'avg', label: 'Avg', align: 'right', render: (val) => <span className="font-mono">{formatDecimal(val)}</span> },
    { key: 'sr', label: 'SR', align: 'right', render: (val) => <span className="font-mono">{formatDecimal(val)}</span> },
    { key: 'fifties', label: '50s', align: 'right' },
    { key: 'hundreds', label: '100s', align: 'right' },
  ]

  // Bowling leaderboard columns
  const bowlingColumns = [
    { key: 'rank', label: '#', align: 'center' },
    {
      key: 'player',
      label: 'Player',
      render: (val) => <PlayerNameCell name={val} to={`/bowling/${encodeURIComponent(val)}`} size={26} />,
    },
    { key: 'matches', label: 'Mat', align: 'right' },
    { key: 'innings', label: 'Inn', align: 'right' },
    { key: 'wickets', label: 'Wkts', align: 'right', render: (val) => <span className="font-mono font-semibold text-accent-magenta">{val}</span> },
    { key: 'avg', label: 'Avg', align: 'right', render: (val) => <span className="font-mono">{formatDecimal(val)}</span> },
    { key: 'economy', label: 'Econ', align: 'right', render: (val) => <span className="font-mono">{formatDecimal(val)}</span> },
    { key: 'sr', label: 'SR', align: 'right', render: (val) => <span className="font-mono">{formatDecimal(val)}</span> },
  ]

  const battersWithRank = (Array.isArray(batters) ? batters : []).map((b, i) => ({
    ...b,
    rank: i + 1,
  }))

  const bowlersWithRank = (Array.isArray(bowlers) ? bowlers : []).map((b, i) => ({
    ...b,
    rank: i + 1,
  }))

  const recentMatches = matchesData?.matches || []

  /* ── Chart data transforms ─────────────────────────────── */
  const BAT_SORT_OPTIONS = [
    { key: 'runs', label: 'Runs' },
    { key: 'avg', label: 'Average' },
    { key: 'sr', label: 'Strike Rate' },
    { key: 'fifties', label: '50s' },
    { key: 'hundreds', label: '100s' },
    { key: 'sixes', label: 'Sixes' },
    { key: 'fours', label: 'Fours' },
    { key: 'matches', label: 'Matches' },
  ]
  const BOWL_SORT_OPTIONS = [
    { key: 'wickets', label: 'Wickets' },
    { key: 'economy', label: 'Economy' },
    { key: 'avg', label: 'Average' },
    { key: 'sr', label: 'Strike Rate' },
    { key: 'five_wickets', label: '5W Hauls' },
    { key: 'four_wickets', label: '4W Hauls' },
    { key: 'matches', label: 'Matches' },
  ]

  const MOTM_CHART_OPTIONS = [
    { key: 'top_players', label: 'Top Players' },
    { key: 'season_trend', label: 'Season Trend' },
    { key: 'player_timeline', label: 'Player Timeline' },
  ]
  const MOTM_ROLE_OPTIONS = [
    { value: 'all', label: 'All Roles' },
    { value: 'batsman', label: 'Batsman' },
    { value: 'bowler', label: 'Bowler' },
    { value: 'allrounder', label: 'All-Rounder' },
  ]

  const BAT_BAR_COLORS = ['#00E5FF', '#B8FF00', '#FFB800', '#FF2D78', '#8B5CF6', '#22D3EE', '#22C55E', '#FBBF24', '#EF4444', '#A78BFA']
  const BOWL_BAR_COLORS = ['#FF2D78', '#8B5CF6', '#00E5FF', '#FFB800', '#B8FF00', '#EF4444', '#22D3EE', '#F472B6', '#A78BFA', '#34D399']

  const batSortLabel = BAT_SORT_OPTIONS.find(o => o.key === batSort)?.label || batSort
  const bowlSortLabel = BOWL_SORT_OPTIONS.find(o => o.key === bowlSort)?.label || bowlSort

  const batterChartData = [...battersWithRank].map((b) => ({
    name: b.player?.length > 14 ? b.player.slice(0, 13) + '\u2026' : b.player,
    fullName: b.player,
    value: b[batSort] ?? b.runs,
    runs: b.runs,
    avg: b.avg,
    sr: b.sr,
  })).sort((a, b) => b.value - a.value)

  const bowlerChartData = [...bowlersWithRank].map((b) => ({
    name: b.player?.length > 14 ? b.player.slice(0, 13) + '\u2026' : b.player,
    fullName: b.player,
    value: (bowlSort === 'five_wickets' ? b.five_w : bowlSort === 'four_wickets' ? b.four_w : b[bowlSort]) ?? b.wickets,
    wickets: b.wickets,
    economy: b.economy,
  })).sort((a, b) => b.value - a.value)

  const motmPlayerData = useMemo(() => Array.isArray(motmData?.player_counts) ? motmData.player_counts : [], [motmData])
  const motmSeasonData = useMemo(() => Array.isArray(motmData?.season_counts) ? motmData.season_counts : [], [motmData])
  const motmMatches = useMemo(() => Array.isArray(motmData?.matches) ? motmData.matches : [], [motmData])

  /* ── Most Wins chart data ──────────────────────────────── */
  const winsChartData = useMemo(() => {
    if (!Array.isArray(mostWins) || mostWins.length === 0) return []
    return [...mostWins]
      .sort((a, b) => b.wins - a.wins)
      .map((t) => ({
        team: getTeamAbbr(t.team),
        fullTeam: t.team,
        wins: t.wins,
        matches: t.matches,
        win_pct: t.win_pct,
        fill: getTeamColor(t.team),
      }))
  }, [mostWins])

  const phaseInsightData = useMemo(() => {
    if (!Array.isArray(phaseDominance)) return []
    return phaseDominance
      .filter((d) => d.powerplay && d.middle && d.death)
      .slice(0, 8)
      .map((d) => ({
        ...d,
        team: getTeamAbbr(d.team),
        fullTeam: d.team,
      }))
  }, [phaseDominance])

  const dismissalBreakup = useMemo(() => {
    if (!Array.isArray(dismissalTypes)) return []
    return dismissalTypes.map((d, idx) => ({
      ...d,
      fill: DISMISS_COLORS[idx % DISMISS_COLORS.length],
    }))
  }, [dismissalTypes])

  const batMatrixData = useMemo(() => {
    if (!Array.isArray(battingMatrix)) return []
    return battingMatrix
      .filter((entry) => entry.avg && entry.sr && entry.runs > 0)
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 25)
      .map((entry) => ({
        ...entry,
        shortName: entry.player?.length > 12 ? `${entry.player.slice(0, 11)}…` : entry.player,
      }))
  }, [battingMatrix])

  const bowlMatrixData = useMemo(() => {
    if (!Array.isArray(bowlingMatrix)) return []
    return bowlingMatrix
      .filter((entry) => entry.avg && entry.economy && entry.wickets > 0)
      .sort((a, b) => b.wickets - a.wickets)
      .slice(0, 25)
      .map((entry) => ({
        ...entry,
        shortName: entry.player?.length > 12 ? `${entry.player.slice(0, 11)}…` : entry.player,
      }))
  }, [bowlingMatrix])

  const batRevealer = usePlayerReveal(batMatrixData.length)
  const bowlRevealer = usePlayerReveal(bowlMatrixData.length)

  /* ── Safe array helpers for expandable cards ───────────── */
  const topTotalsList = Array.isArray(topTotals) ? topTotals : []
  const topSixesList = Array.isArray(topSixes) ? topSixes : []
  const topFoursList = Array.isArray(topFours) ? topFours : []

  const selectedSeasonCount = useMemo(() => {
    if (!season) return Array.isArray(seasons) ? seasons.length : 0
    return season.split(',').map((s) => s.trim()).filter(Boolean).length
  }, [season, seasons])

  const seasonSummary = season
    ? `${selectedSeasonCount} season${selectedSeasonCount === 1 ? '' : 's'} selected`
    : 'All IPL seasons in view'

  const featuredBatter = battersWithRank[0] || null
  const featuredBowler = bowlersWithRank[0] || null
  const featuredTeam = winsChartData[0] || null
  const latestResult = recentMatches[0] || null
  const motmLeader = motmPlayerData[0] || null

  const kpiCards = useMemo(() => {
    if (!kpis) return []
    const matches = Number(kpis.total_matches || 0)
    const runsPerMatch = matches ? kpis.total_runs / matches : 0
    const wicketsPerMatch = matches ? kpis.total_wickets / matches : 0
    const boundaryPct = kpis.total_runs ? (kpis.total_boundaries * 100) / kpis.total_runs : 0
    const sixesPerMatch = matches ? kpis.total_sixes / matches : 0

    return [
      {
        label: 'Total Matches',
        value: formatNumber(kpis.total_matches),
        color: 'cyan',
        hint: seasonSummary,
      },
      {
        label: 'Total Runs',
        value: formatNumber(kpis.total_runs),
        color: 'lime',
        hint: `${formatDecimal(runsPerMatch, 1)} per match`,
      },
      {
        label: 'Total Wickets',
        value: formatNumber(kpis.total_wickets),
        color: 'magenta',
        hint: `${formatDecimal(wicketsPerMatch, 1)} per match`,
      },
      {
        label: 'Boundary %',
        value: `${formatDecimal(boundaryPct, 1)}%`,
        color: 'amber',
        hint: `${formatNumber(kpis.total_boundaries)} boundary shots`,
      },
      {
        label: 'Avg Score',
        value: formatDecimal(kpis.avg_score, 1),
        color: 'cyan',
        hint: 'average first-innings total',
      },
      {
        label: 'Total Sixes',
        value: formatNumber(kpis.total_sixes),
        color: 'magenta',
        hint: `${formatDecimal(sixesPerMatch, 1)} per match`,
      },
    ]
  }, [kpis, seasonSummary])

  const heroInsights = [
    featuredBatter && {
      eyebrow: 'Batting pace',
      title: featuredBatter.player,
      value: `${formatNumber(featuredBatter.runs)} runs`,
      meta: `Avg ${formatDecimal(featuredBatter.avg)} • SR ${formatDecimal(featuredBatter.sr)}`,
      accent: 'lime',
      to: `/batting/${encodeURIComponent(featuredBatter.player)}`,
    },
    featuredBowler && {
      eyebrow: 'Bowling edge',
      title: featuredBowler.player,
      value: `${featuredBowler.wickets} wickets`,
      meta: `Economy ${formatDecimal(featuredBowler.economy)} across ${featuredBowler.matches} matches`,
      accent: 'magenta',
      to: `/bowling/${encodeURIComponent(featuredBowler.player)}`,
    },
    featuredTeam && {
      eyebrow: 'Team dominance',
      title: featuredTeam.fullTeam,
      value: `${featuredTeam.wins} wins`,
      meta: `${formatDecimal(featuredTeam.win_pct, 1)}% win rate in ${featuredTeam.matches} matches`,
      accent: 'cyan',
      to: '/teams',
    },
    latestResult && {
      eyebrow: 'Latest result',
      title: `${getTeamAbbr(latestResult.team1)} vs ${getTeamAbbr(latestResult.team2)}`,
      value: latestResult.winner || 'Result pending',
      meta: getMatchResult(latestResult),
      accent: 'amber',
      to: `/matches/${latestResult.match_id}`,
    },
  ].filter(Boolean)

  if (kpisError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-heading text-lg">Failed to load dashboard</p>
        <p className="text-text-secondary text-sm">{kpisError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SEO
        title="Dashboard"
        description="Crickrida — Cricket analytics dashboard with real-time stats, batting and bowling leaderboards, match results, and season trends."
      />
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.18),transparent_0%,transparent_38%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.18),transparent_0%,transparent_36%),linear-gradient(135deg,#0B0E16_0%,#101726_42%,#130F1D_100%)] p-5 sm:p-6 lg:p-7 shadow-[0_24px_70px_rgba(0,0,0,0.32)] animate-in">
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-accent-cyan/0 via-accent-cyan/50 to-accent-cyan/0" />
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-accent-cyan">
              <span className="h-2 w-2 rounded-full bg-accent-cyan animate-pulse" />
              Season intelligence hub
            </span>

            <div>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-text-primary">
                IPL Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm sm:text-base text-text-secondary leading-relaxed">
                A richer command center for leaderboards, recent results, team dominance, and season-wide scoring patterns.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-text-secondary">
                {seasonSummary}
              </span>
              {featuredTeam && (
                <span className="inline-flex items-center rounded-full border border-accent-lime/20 bg-accent-lime/10 px-3 py-1.5 text-xs font-semibold text-accent-lime">
                  Most wins: {getTeamAbbr(featuredTeam.fullTeam)}
                </span>
              )}
              {motmLeader && (
                <span className="inline-flex items-center rounded-full border border-accent-amber/20 bg-accent-amber/10 px-3 py-1.5 text-xs font-semibold text-accent-amber">
                  MOTM leader: {motmLeader.player}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to="/live" className="inline-flex items-center rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1.5 text-xs font-semibold text-accent-cyan hover:bg-accent-cyan/15 transition-colors">
                Live centre
              </Link>
              <Link to="/matches" className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors">
                Matches
              </Link>
              <Link to="/players" className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors">
                Players
              </Link>
              <QuickJump href="#dashboard-leaders" label="Leaders" />
              <QuickJump href="#dashboard-results" label="Recent results" />
            </div>
          </div>

          <DashboardPanel accent="cyan" className="h-full">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-muted">Season lens</p>
                  <h2 className="mt-1 text-lg font-heading font-bold text-text-primary">
                    {season ? 'Focused comparison mode' : 'All-time snapshot'}
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                    {season
                      ? `Currently comparing ${seasonSummary.toLowerCase()} across every chart and leaderboard.`
                      : 'Use the multi-season filter to compare eras, rival peaks, or one specific campaign.'}
                  </p>
                </div>
                <div className="min-w-[220px]">
                  <label className="mb-2 block text-xs font-medium text-text-muted">Season filter</label>
                  <MultiSeasonSelect seasons={seasons || []} value={season} onChange={setSeason} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Matches</p>
                  <p className="mt-1 text-xl font-heading font-bold text-accent-cyan">{kpis ? formatNumber(kpis.total_matches) : '—'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Runs</p>
                  <p className="mt-1 text-xl font-heading font-bold text-accent-lime">{kpis ? formatNumber(kpis.total_runs) : '—'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Avg score</p>
                  <p className="mt-1 text-xl font-heading font-bold text-accent-amber">{kpis ? formatDecimal(kpis.avg_score, 1) : '—'}</p>
                </div>
              </div>
            </div>
          </DashboardPanel>
        </div>

        {!isAuthenticated && (
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-accent-cyan/15 bg-accent-cyan/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-accent-cyan shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-text-secondary text-sm">
                <span className="text-text-primary font-medium">Sign in</span> to unlock full analytics, player profiles, and match details.
              </p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="shrink-0 px-4 py-1.5 rounded-lg bg-accent-cyan text-black text-xs font-bold hover:brightness-110 transition-all"
            >
              Login
            </button>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Season pulse"
          description="Premium KPI cards with more context on scoring pace, wickets, and boundary pressure."
          accent="cyan"
        />
        {kpisLoading ? (
          <Loading message="Loading KPIs..." />
        ) : kpiCards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 stagger-children">
            {kpiCards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                color={card.color}
                hint={card.hint}
                className="h-full"
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Storylines at a glance"
          description="Quick insight cards for form, team dominance, and the latest result so the dashboard feels more alive."
          accent="amber"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 stagger-children">
          {heroInsights.map((item) => (
            <InsightCard key={`${item.eyebrow}-${item.title}`} {...item} />
          ))}
        </div>
      </section>

      <section id="dashboard-highlights" className="space-y-4">
        <SectionHeader
          title="Power numbers"
          description="Surface the biggest totals, boundary hitters, and wicket-taking leaders in a single high-energy strip."
          accent="lime"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Highest Totals */}
        <div className="bg-[#111118] border border-[#1E1E2A] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-lime/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-lime" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-xs uppercase tracking-wider text-text-muted font-medium">Highest Totals</p>
          </div>
          {topTotalsLoading ? (
            <Loading message="Loading..." />
          ) : topTotalsList.length === 0 ? (
            <p className="text-text-muted text-sm">No data</p>
          ) : (
            <>
              {/* #1 always visible */}
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-text-muted font-mono text-xs w-5 text-right">#1</span>
                <Link to={`/matches/${topTotalsList[0].match_id}`} className="hover:underline flex-1 min-w-0">
                  <span className="text-xl font-heading font-bold text-accent-lime stat-glow-lime">
                    {topTotalsList[0].total_runs}
                  </span>
                  <span className="text-text-secondary ml-2 text-sm">
                    {topTotalsList[0].batting_team}
                  </span>
                  <span className="text-text-muted ml-1 text-xs">
                    vs {topTotalsList[0].opponent}
                  </span>
                </Link>
              </div>

              {/* Expandable list */}
              {showTopTotals && topTotalsList.slice(1, 10).map((item, idx) => (
                <div key={item.match_id || idx} className="flex items-baseline gap-2 py-1.5 border-t border-[#1E1E2A]">
                  <span className="text-text-muted font-mono text-xs w-5 text-right">#{idx + 2}</span>
                  <Link to={`/matches/${item.match_id}`} className="hover:underline flex-1 min-w-0">
                    <span className="font-mono font-bold text-accent-lime text-sm">{item.total_runs}</span>
                    <span className="text-text-secondary ml-2 text-xs">{item.batting_team}</span>
                    <span className="text-text-muted ml-1 text-xs">vs {item.opponent}</span>
                  </Link>
                </div>
              ))}

              {topTotalsList.length > 1 && (
                <button
                  onClick={() => setShowTopTotals(!showTopTotals)}
                  className="text-accent-cyan text-xs mt-2 hover:underline cursor-pointer"
                >
                  {showTopTotals ? 'Collapse \u25B2' : 'View Top 10 \u25BC'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Most Sixes */}
        <div className="bg-[#111118] border border-[#1E1E2A] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-amber/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <p className="text-xs uppercase tracking-wider text-text-muted font-medium">Most Sixes</p>
          </div>
          {topSixesLoading ? (
            <Loading message="Loading..." />
          ) : topSixesList.length === 0 ? (
            <p className="text-text-muted text-sm">No data</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-text-muted font-mono text-xs w-5 text-right">#1</span>
                <Link to={`/batting/${encodeURIComponent(topSixesList[0].player)}`} className="hover:underline flex-1 min-w-0">
                  <span className="text-xl font-heading font-bold text-accent-amber stat-glow-amber">
                    {topSixesList[0].sixes}
                  </span>
                  <span className="text-text-secondary ml-2 text-sm">
                    {topSixesList[0].player}
                  </span>
                  <span className="text-text-muted ml-1 text-xs">
                    ({topSixesList[0].matches} mat)
                  </span>
                </Link>
              </div>

              {showTopSixes && topSixesList.slice(1, 10).map((item, idx) => (
                <div key={item.player || idx} className="flex items-baseline gap-2 py-1.5 border-t border-[#1E1E2A]">
                  <span className="text-text-muted font-mono text-xs w-5 text-right">#{idx + 2}</span>
                  <Link to={`/batting/${encodeURIComponent(item.player)}`} className="hover:underline flex-1 min-w-0">
                    <span className="font-mono font-bold text-accent-amber text-sm">{item.sixes}</span>
                    <span className="text-text-secondary ml-2 text-xs">{item.player}</span>
                    <span className="text-text-muted ml-1 text-xs">({item.matches} mat)</span>
                  </Link>
                </div>
              ))}

              {topSixesList.length > 1 && (
                <button
                  onClick={() => setShowTopSixes(!showTopSixes)}
                  className="text-accent-cyan text-xs mt-2 hover:underline cursor-pointer"
                >
                  {showTopSixes ? 'Collapse \u25B2' : 'View Top 10 \u25BC'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Most Fours */}
        <div className="bg-[#111118] border border-[#1E1E2A] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
            </div>
            <p className="text-xs uppercase tracking-wider text-text-muted font-medium">Most Fours</p>
          </div>
          {topFoursLoading ? (
            <Loading message="Loading..." />
          ) : topFoursList.length === 0 ? (
            <p className="text-text-muted text-sm">No data</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-text-muted font-mono text-xs w-5 text-right">#1</span>
                <Link to={`/batting/${encodeURIComponent(topFoursList[0].player)}`} className="hover:underline flex-1 min-w-0">
                  <span className="text-xl font-heading font-bold text-accent-cyan stat-glow-cyan">
                    {topFoursList[0].fours}
                  </span>
                  <span className="text-text-secondary ml-2 text-sm">
                    {topFoursList[0].player}
                  </span>
                  <span className="text-text-muted ml-1 text-xs">
                    ({topFoursList[0].matches} mat)
                  </span>
                </Link>
              </div>

              {showTopFours && topFoursList.slice(1, 10).map((item, idx) => (
                <div key={item.player || idx} className="flex items-baseline gap-2 py-1.5 border-t border-[#1E1E2A]">
                  <span className="text-text-muted font-mono text-xs w-5 text-right">#{idx + 2}</span>
                  <Link to={`/batting/${encodeURIComponent(item.player)}`} className="hover:underline flex-1 min-w-0">
                    <span className="font-mono font-bold text-accent-cyan text-sm">{item.fours}</span>
                    <span className="text-text-secondary ml-2 text-xs">{item.player}</span>
                    <span className="text-text-muted ml-1 text-xs">({item.matches} mat)</span>
                  </Link>
                </div>
              ))}

              {topFoursList.length > 1 && (
                <button
                  onClick={() => setShowTopFours(!showTopFours)}
                  className="text-accent-cyan text-xs mt-2 hover:underline cursor-pointer"
                >
                  {showTopFours ? 'Collapse \u25B2' : 'View Top 10 \u25BC'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Most Wickets */}
        <div className="bg-[#111118] border border-[#1E1E2A] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-magenta/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-magenta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <p className="text-xs uppercase tracking-wider text-text-muted font-medium">Most Wickets</p>
          </div>
          {bowlersLoading ? (
            <Loading message="Loading..." />
          ) : bowlersWithRank.length === 0 ? (
            <p className="text-text-muted text-sm">No data</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-text-muted font-mono text-xs w-5 text-right">#1</span>
                <Link to={`/bowling/${encodeURIComponent(bowlersWithRank[0].player)}`} className="hover:underline flex-1 min-w-0">
                  <span className="text-xl font-heading font-bold text-accent-magenta stat-glow-magenta">
                    {bowlersWithRank[0].wickets}
                  </span>
                  <span className="text-text-secondary ml-2 text-sm">
                    {bowlersWithRank[0].player}
                  </span>
                  <span className="text-text-muted ml-1 text-xs">
                    ({bowlersWithRank[0].matches} mat)
                  </span>
                </Link>
              </div>

              {showTopWickets && bowlersWithRank.slice(1, 10).map((item, idx) => (
                <div key={item.player || idx} className="flex items-baseline gap-2 py-1.5 border-t border-[#1E1E2A]">
                  <span className="text-text-muted font-mono text-xs w-5 text-right">#{idx + 2}</span>
                  <Link to={`/bowling/${encodeURIComponent(item.player)}`} className="hover:underline flex-1 min-w-0">
                    <span className="font-mono font-bold text-accent-magenta text-sm">{item.wickets}</span>
                    <span className="text-text-secondary ml-2 text-xs">{item.player}</span>
                    <span className="text-text-muted ml-1 text-xs">({item.matches} mat)</span>
                  </Link>
                </div>
              ))}

              {bowlersWithRank.length > 1 && (
                <button
                  onClick={() => setShowTopWickets(!showTopWickets)}
                  className="text-accent-cyan text-xs mt-2 hover:underline cursor-pointer"
                >
                  {showTopWickets ? 'Collapse \u25B2' : 'View Top 10 \u25BC'}
                </button>
              )}
            </>
          )}
        </div>
        </div>
      </section>

      <section id="dashboard-control-room" className="space-y-4">
        <SectionHeader
          title="League control room"
          description="Compare team dominance and award trends without leaving the main dashboard flow."
          accent="amber"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Wins (All Teams) */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-accent-lime rounded-full" />
            <h2 className="text-xl font-heading font-bold text-text-primary">Most Wins (All Teams)</h2>
          </div>
          <DashboardPanel accent="lime">
            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <MiniGlowStat
                accent="lime"
                label="Team on top"
                value={featuredTeam ? getTeamAbbr(featuredTeam.fullTeam) : '—'}
                meta={featuredTeam ? `${featuredTeam.wins} total wins` : 'Current selection'}
              />
              <MiniGlowStat
                accent="cyan"
                label="Best win rate"
                value={featuredTeam ? `${formatDecimal(featuredTeam.win_pct, 1)}%` : '—'}
                meta="League conversion rate"
              />
              <MiniGlowStat
                accent="amber"
                label="Matches tracked"
                value={featuredTeam ? formatNumber(featuredTeam.matches) : '—'}
                meta="Sample size in view"
              />
            </div>
            {mostWinsLoading ? (
              <Loading message="Loading team wins..." />
            ) : winsChartData.length === 0 ? (
              <p className="text-text-muted text-sm py-8 text-center">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(380, winsChartData.length * 36)}>
                <BarChart
                  data={winsChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fill: '#8888A0', fontSize: 11 }}
                    axisLine={{ stroke: '#2A2A3A' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="team"
                    width={60}
                    tick={{ fill: '#C8C8D8', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="rounded-lg px-3 py-2 text-xs shadow-xl border"
                          style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
                          <p className="text-text-primary font-semibold mb-0.5">{d.fullTeam}</p>
                          <p style={{ color: d.fill }}>
                            Wins: <span className="font-mono font-bold">{d.wins}</span>
                          </p>
                          <p className="text-text-secondary">
                            Matches: <span className="font-mono">{d.matches}</span> | Win%: <span className="font-mono">{formatDecimal(d.win_pct, 1)}%</span>
                          </p>
                        </div>
                      )
                    }}
                    cursor={{ fill: 'rgba(184,255,0,0.05)' }}
                  />
                  <Bar
                    dataKey="wins"
                    radius={[0, 4, 4, 0]}
                    barSize={22}
                    label={{
                      position: 'right',
                      fill: '#E8E8F0',
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                    }}
                  >
                    {winsChartData.map((entry, idx) => (
                      <rect key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </DashboardPanel>
        </section>

        {/* Man of the Match Explorer */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-accent-amber rounded-full" />
            <h2 className="text-xl font-heading font-bold text-text-primary">Man of the Match Explorer</h2>
          </div>
          <DashboardPanel accent="amber">
            <div className="mb-4 flex flex-wrap gap-2">
              {motmLeader && <AccentPill accent="amber">Leader: {motmLeader.player} • {motmLeader.awards}</AccentPill>}
              <AccentPill accent="cyan">{motmMatches.length} match stories</AccentPill>
              <AccentPill accent="lime">{motmSeasonData.length} season snapshots</AccentPill>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-2">Chart type</label>
                  <Select
                    options={MOTM_CHART_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label }))}
                    value={motmChartType}
                    onChange={setMotmChartType}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-2">Team</label>
                  <Select
                    options={teamOptions}
                    value={motmTeam}
                    onChange={setMotmTeam}
                  />
                </div>
                <div className="relative">
                  <label className="block text-xs text-text-muted mb-2">Player</label>
                  <input
                    type="text"
                    value={motmPlayerQuery}
                    onChange={(e) => {
                      setMotmPlayerQuery(e.target.value)
                      setMotmPlayer('')
                    }}
                    placeholder="Search player..."
                    className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/50"
                  />
                  {motmPlayerResults.length > 0 && motmPlayerQuery && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-bg-elevated border border-border-subtle rounded-lg max-h-56 overflow-y-auto shadow-xl">
                      {motmPlayerResults.slice(0, 8).map((player) => (
                        <button
                          key={player}
                          type="button"
                          onClick={() => {
                            setMotmPlayer(player)
                            setMotmPlayerQuery('')
                            setMotmPlayerResults([])
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors"
                        >
                          {player}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-2">Role</label>
                  <Select
                    options={MOTM_ROLE_OPTIONS}
                    value={motmRole}
                    onChange={setMotmRole}
                  />
                </div>
              </div>
            </div>

            <div className="min-h-[320px]">
              {motmLoading ? (
                <Loading message="Loading Man of the Match analytics..." />
              ) : motmPlayerData.length === 0 && motmSeasonData.length === 0 ? (
                <p className="text-text-muted text-sm py-8 text-center">No Man of the Match analytics available</p>
              ) : (
                <div className="h-full">
                  {motmChartType === 'top_players' && (
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart
                        data={motmPlayerData}
                        layout="vertical"
                        margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                        barCategoryGap="16%"
                      >
                        <XAxis
                          type="number"
                          tick={{ fill: '#8888A0', fontSize: 11 }}
                          axisLine={{ stroke: '#2A2A3A' }}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="player"
                          width={180}
                          interval={0}
                          tick={{ fill: '#E8E8F0', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload
                          return (
                            <div className="rounded-lg px-3 py-2 text-xs shadow-xl border" style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
                              <p className="text-text-primary font-semibold mb-0.5">{d.player}</p>
                              <p className="text-text-secondary">Awards: <span className="font-mono font-bold">{d.awards}</span></p>
                            </div>
                          )
                        }} />
                        <Bar dataKey="awards" radius={[0, 6, 6, 0]} barSize={22}>
                          {motmPlayerData.map((_, idx) => (
                            <Cell key={idx} fill={['#FFB800', '#00E5FF', '#B8FF00', '#FF2D78', '#8B5CF6'][idx % 5]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {motmChartType === 'season_trend' && (
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart
                        data={motmSeasonData}
                        margin={{ top: 15, right: 30, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid stroke="#2A2A3A" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="season"
                          tick={{ fill: '#C8C8D8', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: '#8888A0', fontSize: 11 }}
                          axisLine={{ stroke: '#2A2A3A' }}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="rounded-lg px-3 py-2 text-xs shadow-xl border" style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
                                <p className="text-text-primary font-semibold mb-0.5">Season {label}</p>
                                <p className="text-text-secondary">Awards: <span className="font-mono font-bold">{d.awards}</span></p>
                              </div>
                            )
                          }}
                        />
                        <Line type="monotone" dataKey="awards" stroke="#00E5FF" strokeWidth={3} dot={{ r: 4, fill: '#00E5FF' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}

                  {motmChartType === 'player_timeline' && (
                    motmPlayer ? (
                      <ResponsiveContainer width="100%" height={340}>
                        <BarChart
                          data={motmSeasonData}
                          margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                        >
                          <XAxis
                            dataKey="season"
                            tick={{ fill: '#C8C8D8', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: '#8888A0', fontSize: 11 }}
                            axisLine={{ stroke: '#2A2A3A' }}
                            tickLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0].payload
                              return (
                                <div className="rounded-lg px-3 py-2 text-xs shadow-xl border" style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
                                  <p className="text-text-primary font-semibold mb-0.5">{motmPlayer} in {label}</p>
                                  <p className="text-text-secondary">Awards: <span className="font-mono font-bold">{d.awards}</span></p>
                                </div>
                              )
                            }}
                          />
                          <Bar dataKey="awards" radius={[4, 4, 0, 0]} fill="#B8FF00" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-80 items-center justify-center text-text-muted text-sm">
                        Search and select a player to view their Man of the Match timeline.
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </DashboardPanel>
        </section>
        </div>
      </section>

      <section id="dashboard-insights" className="space-y-4">
        <SectionHeader
          title="Insights, merged into the dashboard"
          description="The strongest trend views now live here together — including the player matrices you asked to keep on the main dashboard."
          accent="cyan"
        />
        <DashboardPanel accent="cyan">
          <div className="flex flex-wrap gap-2 mb-4">
            {INSIGHT_TABS.map((tab) => {
              const tone = ACCENT_STYLES[tab.accent] || ACCENT_STYLES.cyan
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setInsightView(tab.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    insightView === tab.key
                      ? `${tone.chip} shadow-[0_0_0_1px_rgba(255,255,255,0.02)]`
                      : 'border-white/10 bg-white/5 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {insightView === 'dna' && (
            inningsDnaLoading ? (
              <Loading message="Loading innings DNA..." />
            ) : !inningsDNA?.length ? (
              <p className="text-text-muted text-sm py-8 text-center">No innings trend data available</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-text-secondary leading-relaxed">
                  Average scoring tempo through a T20 innings, with the powerplay and death overs highlighted.
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={inningsDNA} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="dashboardDnaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#00E5FF" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" />
                    <XAxis dataKey="over_num" tick={{ fill: '#8888A0', fontSize: 11 }} axisLine={{ stroke: '#2A2A3A' }} tickLine={false} />
                    <YAxis tick={{ fill: '#8888A0', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <ReferenceLine x={6} stroke="#2A2A3A" strokeDasharray="5 5" label={{ value: 'PP', fill: '#00E5FF', fontSize: 9, position: 'top' }} />
                    <ReferenceLine x={15} stroke="#2A2A3A" strokeDasharray="5 5" label={{ value: 'Death', fill: '#FF2D78', fontSize: 9, position: 'top' }} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="rounded-lg px-3 py-2 text-xs shadow-xl border" style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
                          <p className="text-text-primary font-semibold mb-1">Over {label}</p>
                          <p style={{ color: '#00E5FF' }}>Avg Runs: <span className="font-mono font-bold">{d?.avg_runs}</span></p>
                          <p style={{ color: '#FFB800' }}>Sixes/over: <span className="font-mono font-bold">{d?.sixes_per_over}</span></p>
                          <p className="text-text-muted">Dot%: <span className="font-mono">{d?.dot_pct}%</span></p>
                        </div>
                      )
                    }} />
                    <Area type="monotone" dataKey="avg_runs" stroke="#00E5FF" strokeWidth={2.5} fill="url(#dashboardDnaGradient)" />
                    <Line type="monotone" dataKey="sixes_per_over" stroke="#FFB800" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )
          )}

          {insightView === 'sixes' && (
            sixEvolutionLoading ? (
              <Loading message="Loading six evolution..." />
            ) : !sixEvolution?.length ? (
              <p className="text-text-muted text-sm py-8 text-center">No six-evolution data available</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-text-secondary leading-relaxed">
                  One of the clearest IPL macro trends: six-hitting growth by season, now embedded right into the dashboard.
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={sixEvolution} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="dashboardSixEvolutionGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFB800" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#FFB800" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" />
                    <XAxis dataKey="season" tick={{ fill: '#8888A0', fontSize: 11 }} axisLine={{ stroke: '#2A2A3A' }} tickLine={false} />
                    <YAxis tick={{ fill: '#8888A0', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="rounded-lg px-3 py-2 text-xs shadow-xl border" style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
                          <p className="text-text-primary font-semibold mb-1">IPL {d?.season}</p>
                          <p style={{ color: '#FFB800' }}>Sixes/match: <span className="font-mono font-bold">{d?.sixes_per_match}</span></p>
                          <p style={{ color: '#B8FF00' }}>Fours/match: <span className="font-mono font-bold">{d?.fours_per_match}</span></p>
                          <p className="text-text-muted">Matches: <span className="font-mono">{d?.matches}</span></p>
                        </div>
                      )
                    }} />
                    <Area type="monotone" dataKey="sixes_per_match" stroke="#FFB800" strokeWidth={2.5} fill="url(#dashboardSixEvolutionGradient)" />
                    <Line type="monotone" dataKey="fours_per_match" stroke="#B8FF00" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )
          )}

          {insightView === 'phase' && (
            phaseLoading ? (
              <Loading message="Loading phase dominance..." />
            ) : !phaseInsightData.length ? (
              <p className="text-text-muted text-sm py-8 text-center">No phase dominance data available</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-text-secondary leading-relaxed">
                  Team run-rate shape across powerplay, middle overs, and death overs — a compact version of the insights tab, now directly on the dashboard.
                </p>
                <ResponsiveContainer width="100%" height={Math.max(320, phaseInsightData.length * 34)}>
                  <BarChart data={phaseInsightData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" />
                    <XAxis type="number" tick={{ fill: '#8888A0', fontSize: 11 }} axisLine={{ stroke: '#2A2A3A' }} tickLine={false} />
                    <YAxis type="category" dataKey="team" width={48} tick={{ fill: '#C8C8D8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="rounded-lg px-3 py-2 text-xs shadow-xl border" style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
                          <p className="text-text-primary font-semibold mb-1">{d?.fullTeam}</p>
                          <p style={{ color: '#00E5FF' }}>Powerplay: <span className="font-mono font-bold">{d?.powerplay}</span></p>
                          <p style={{ color: '#B8FF00' }}>Middle: <span className="font-mono font-bold">{d?.middle}</span></p>
                          <p style={{ color: '#FF2D78' }}>Death: <span className="font-mono font-bold">{d?.death}</span></p>
                        </div>
                      )
                    }} />
                    <Legend wrapperStyle={{ color: '#8888A0', fontSize: 11 }} />
                    <Bar dataKey="powerplay" name="Powerplay" fill="#00E5FF" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="middle" name="Middle" fill="#B8FF00" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="death" name="Death" fill="#FF2D78" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          )}

          {insightView === 'matrix' && (
            <div className="space-y-5">
              <p className="text-xs text-text-secondary leading-relaxed">
                The batting and bowling impact matrices are now embedded directly in the dashboard, so you can spot elite profiles without switching to a separate insights page.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-accent-lime/15 bg-accent-lime/5 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-accent-lime">Batting sweet spot</p>
                  <p className="mt-1 text-lg font-heading font-bold text-text-primary">
                    {batMatrixData.filter((entry) => entry.avg >= 30 && entry.sr >= 135).length} elite batters
                  </p>
                  <p className="text-xs text-text-muted">Avg 30+ and strike rate 135+ in the current view.</p>
                </div>
                <div className="rounded-xl border border-accent-magenta/15 bg-accent-magenta/5 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-accent-magenta">Bowling sweet spot</p>
                  <p className="mt-1 text-lg font-heading font-bold text-text-primary">
                    {bowlMatrixData.filter((entry) => entry.avg <= 22 && entry.economy <= 7.5).length} elite bowlers
                  </p>
                  <p className="text-xs text-text-muted">Average 22 or lower with economy under 7.5.</p>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-base font-heading font-bold text-text-primary">Batting Impact Matrix</h3>
                    <p className="text-xs text-text-muted">Strike rate vs average • bubble size = total runs • top-right is the premium zone.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PlayerRevealBtn revealer={batRevealer} />
                    <ZoomControls zoom={batMatrixZoom} setZoom={setBatMatrixZoom} />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {matrixLoading ? <Loading message="Plotting batting matrix..." /> :
                   !batMatrixData.length ? <p className="text-text-muted text-sm py-8 text-center">No batting matrix data available</p> : (() => {
                    const visibleData = batMatrixData.slice(0, batRevealer.revealCount)
                    const maxRuns = Math.max(...batMatrixData.map((entry) => entry.runs))
                    const runsThreshold = [...batMatrixData].sort((a, b) => b.runs - a.runs)[Math.min(7, batMatrixData.length - 1)]?.runs || 0
                    const avgAvg = batMatrixData.reduce((sum, entry) => sum + entry.avg, 0) / batMatrixData.length
                    const avgSR = batMatrixData.reduce((sum, entry) => sum + entry.sr, 0) / batMatrixData.length
                    const chartHeight = Math.round(420 * Math.min(batMatrixZoom, 1.5))
                    return (
                      <>
                        <div style={{ width: `${Math.max(100, batMatrixZoom * 100)}%`, minWidth: '100%' }}>
                          <ResponsiveContainer width="100%" height={chartHeight}>
                            <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" />
                              <XAxis
                                dataKey="avg"
                                type="number"
                                name="Average"
                                domain={[20, 'auto']}
                                tick={{ fill: '#8888A0', fontSize: 11 }}
                                axisLine={{ stroke: '#2A2A3A' }}
                                tickLine={false}
                                label={{ value: 'Batting Average', position: 'insideBottom', offset: -10, fill: '#8888A0', fontSize: 11 }}
                              />
                              <YAxis
                                dataKey="sr"
                                type="number"
                                name="Strike Rate"
                                domain={[100, 'auto']}
                                tick={{ fill: '#8888A0', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                                label={{ value: 'Strike Rate', angle: -90, position: 'insideLeft', fill: '#8888A0', fontSize: 11 }}
                              />
                              <ZAxis dataKey="runs" range={[40, 400]} name="Runs" />
                              <ReferenceLine x={avgAvg} stroke="#2A2A3A" strokeDasharray="4 4" />
                              <ReferenceLine y={avgSR} stroke="#2A2A3A" strokeDasharray="4 4" />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null
                                  const player = payload[0]?.payload
                                  return (
                                    <div className="rounded-lg px-3 py-2 text-xs shadow-xl border" style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
                                      <div className="flex items-center gap-2 mb-1">
                                        <img
                                          src={realPlayerImageUrl(player?.player)}
                                          alt={player?.player ? `${player.player} — player photo` : 'Player photo'}
                                          className="w-6 h-6 rounded-full border border-border-subtle object-cover"
                                          onError={(event) => { event.target.src = playerAvatarUrl(player?.player, 24) }}
                                        />
                                        <p className="text-text-primary font-semibold">{player?.player}</p>
                                      </div>
                                      <p style={{ color: '#B8FF00' }}>Runs: <span className="font-mono font-bold">{formatNumber(player?.runs)}</span></p>
                                      <p style={{ color: '#00E5FF' }}>Average: <span className="font-mono font-bold">{formatDecimal(player?.avg)}</span></p>
                                      <p style={{ color: '#FFB800' }}>SR: <span className="font-mono font-bold">{formatDecimal(player?.sr)}</span></p>
                                      <p className="text-text-muted">Innings: <span className="font-mono">{player?.innings}</span> | 6s: <span className="font-mono">{player?.sixes}</span> | 4s: <span className="font-mono">{player?.fours}</span></p>
                                    </div>
                                  )
                                }}
                                cursor={{ strokeDasharray: '3 3', stroke: '#8888A0' }}
                              />
                              <Scatter
                                data={visibleData}
                                isAnimationActive={batRevealer.revealing}
                                animationDuration={300}
                                shape={(props) => {
                                  const { cx, cy, payload } = props
                                  const radius = 5 + (payload.runs / maxRuns) * 18
                                  const isElite = payload.avg >= 30 && payload.sr >= 135
                                  const showLabel = payload.runs >= runsThreshold
                                  const clipId = `dashboard-bat-clip-${payload.player?.replace(/[^a-zA-Z0-9]/g, '')}`
                                  return (
                                    <g>
                                      <circle
                                        cx={cx}
                                        cy={cy}
                                        r={radius + 2}
                                        fill="none"
                                        stroke={isElite ? '#B8FF00' : payload.sr >= 140 ? '#FFB800' : payload.avg >= 30 ? '#00E5FF' : '#8B5CF6'}
                                        strokeWidth={isElite ? 2.5 : 1.5}
                                        strokeOpacity={0.9}
                                      />
                                      <defs>
                                        <clipPath id={clipId}>
                                          <circle cx={cx} cy={cy} r={radius} />
                                        </clipPath>
                                      </defs>
                                      <image
                                        href={realPlayerImageUrl(payload.player)}
                                        x={cx - radius}
                                        y={cy - radius}
                                        width={radius * 2}
                                        height={radius * 2}
                                        clipPath={`url(#${clipId})`}
                                        preserveAspectRatio="xMidYMid slice"
                                        aria-label={payload.player ? `${payload.player} — player photo` : 'Player photo'}
                                        onError={(event) => { event.target.setAttribute('href', playerAvatarUrl(payload.player, Math.round(radius * 3))) }}
                                      >
                                        <title>{payload.player || 'Player'}</title>
                                      </image>
                                      {showLabel && (
                                        <text x={cx} y={cy - radius - 7} textAnchor="middle" fill="#E8E8F0" fontSize={10} fontWeight={600} fontFamily="monospace">
                                          {payload.shortName}
                                        </text>
                                      )}
                                    </g>
                                  )
                                }}
                              />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                        {batRevealer.revealing && (
                          <div className="text-center mt-2">
                            <span className="text-accent-amber font-mono text-sm font-bold animate-pulse">
                              {batRevealer.revealCount} / {batMatrixData.length} players
                            </span>
                            {batRevealer.revealCount > 0 && (
                              <span className="ml-3 text-text-primary text-xs font-semibold">
                                {batMatrixData[batRevealer.revealCount - 1]?.player}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>

                <div className="flex flex-wrap gap-4 text-[10px] text-text-muted">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#B8FF00' }} /> Elite (Avg 30+ & SR 135+)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FFB800' }} /> Power hitter (SR 140+)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#00E5FF' }} /> Consistent (Avg 30+)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#8B5CF6' }} /> Others</span>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-base font-heading font-bold text-text-primary">Bowling Impact Matrix</h3>
                    <p className="text-xs text-text-muted">Economy vs average • bubble size = wickets • bottom-left is the premium zone.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PlayerRevealBtn revealer={bowlRevealer} />
                    <ZoomControls zoom={bowlMatrixZoom} setZoom={setBowlMatrixZoom} />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {bowlMatrixLoading ? <Loading message="Plotting bowling matrix..." /> :
                   !bowlMatrixData.length ? <p className="text-text-muted text-sm py-8 text-center">No bowling matrix data available</p> : (() => {
                    const visibleData = bowlMatrixData.slice(0, bowlRevealer.revealCount)
                    const maxWickets = Math.max(...bowlMatrixData.map((entry) => entry.wickets))
                    const wicketsThreshold = [...bowlMatrixData].sort((a, b) => b.wickets - a.wickets)[Math.min(7, bowlMatrixData.length - 1)]?.wickets || 0
                    const avgAvg = bowlMatrixData.reduce((sum, entry) => sum + entry.avg, 0) / bowlMatrixData.length
                    const avgEcon = bowlMatrixData.reduce((sum, entry) => sum + entry.economy, 0) / bowlMatrixData.length
                    const chartHeight = Math.round(420 * Math.min(bowlMatrixZoom, 1.5))
                    return (
                      <>
                        <div style={{ width: `${Math.max(100, bowlMatrixZoom * 100)}%`, minWidth: '100%' }}>
                          <ResponsiveContainer width="100%" height={chartHeight}>
                            <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" />
                              <XAxis
                                dataKey="avg"
                                type="number"
                                name="Bowling Average"
                                domain={[10, 'auto']}
                                tick={{ fill: '#8888A0', fontSize: 11 }}
                                axisLine={{ stroke: '#2A2A3A' }}
                                tickLine={false}
                                label={{ value: 'Bowling Average', position: 'insideBottom', offset: -10, fill: '#8888A0', fontSize: 11 }}
                              />
                              <YAxis
                                dataKey="economy"
                                type="number"
                                name="Economy"
                                domain={[5, 'auto']}
                                tick={{ fill: '#8888A0', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                                label={{ value: 'Economy Rate', angle: -90, position: 'insideLeft', fill: '#8888A0', fontSize: 11 }}
                              />
                              <ZAxis dataKey="wickets" range={[40, 400]} name="Wickets" />
                              <ReferenceLine x={avgAvg} stroke="#2A2A3A" strokeDasharray="4 4" />
                              <ReferenceLine y={avgEcon} stroke="#2A2A3A" strokeDasharray="4 4" />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null
                                  const player = payload[0]?.payload
                                  return (
                                    <div className="rounded-lg px-3 py-2 text-xs shadow-xl border" style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
                                      <div className="flex items-center gap-2 mb-1">
                                        <img
                                          src={realPlayerImageUrl(player?.player)}
                                          alt={player?.player ? `${player.player} — player photo` : 'Player photo'}
                                          className="w-6 h-6 rounded-full border border-border-subtle object-cover"
                                          onError={(event) => { event.target.src = playerAvatarUrl(player?.player, 24) }}
                                        />
                                        <p className="text-text-primary font-semibold">{player?.player}</p>
                                      </div>
                                      <p style={{ color: '#FF2D78' }}>Wickets: <span className="font-mono font-bold">{formatNumber(player?.wickets)}</span></p>
                                      <p style={{ color: '#00E5FF' }}>Average: <span className="font-mono font-bold">{formatDecimal(player?.avg)}</span></p>
                                      <p style={{ color: '#FFB800' }}>Economy: <span className="font-mono font-bold">{formatDecimal(player?.economy)}</span></p>
                                      <p className="text-text-muted">Innings: <span className="font-mono">{player?.innings}</span> | Dot%: <span className="font-mono">{player?.dot_pct}%</span></p>
                                    </div>
                                  )
                                }}
                                cursor={{ strokeDasharray: '3 3', stroke: '#8888A0' }}
                              />
                              <Scatter
                                data={visibleData}
                                isAnimationActive={bowlRevealer.revealing}
                                animationDuration={300}
                                shape={(props) => {
                                  const { cx, cy, payload } = props
                                  const radius = 5 + (payload.wickets / maxWickets) * 18
                                  const isElite = payload.avg <= 22 && payload.economy <= 7.5
                                  const showLabel = payload.wickets >= wicketsThreshold
                                  const clipId = `dashboard-bowl-clip-${payload.player?.replace(/[^a-zA-Z0-9]/g, '')}`
                                  return (
                                    <g>
                                      <circle
                                        cx={cx}
                                        cy={cy}
                                        r={radius + 2}
                                        fill="none"
                                        stroke={isElite ? '#FF2D78' : payload.economy <= 7 ? '#B8FF00' : payload.avg <= 20 ? '#00E5FF' : '#8B5CF6'}
                                        strokeWidth={isElite ? 2.5 : 1.5}
                                        strokeOpacity={0.9}
                                      />
                                      <defs>
                                        <clipPath id={clipId}>
                                          <circle cx={cx} cy={cy} r={radius} />
                                        </clipPath>
                                      </defs>
                                      <image
                                        href={realPlayerImageUrl(payload.player)}
                                        x={cx - radius}
                                        y={cy - radius}
                                        width={radius * 2}
                                        height={radius * 2}
                                        clipPath={`url(#${clipId})`}
                                        preserveAspectRatio="xMidYMid slice"
                                        aria-label={payload.player ? `${payload.player} — player photo` : 'Player photo'}
                                        onError={(event) => { event.target.setAttribute('href', playerAvatarUrl(payload.player, Math.round(radius * 3))) }}
                                      >
                                        <title>{payload.player || 'Player'}</title>
                                      </image>
                                      {showLabel && (
                                        <text x={cx} y={cy - radius - 7} textAnchor="middle" fill="#E8E8F0" fontSize={10} fontWeight={600} fontFamily="monospace">
                                          {payload.shortName}
                                        </text>
                                      )}
                                    </g>
                                  )
                                }}
                              />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                        {bowlRevealer.revealing && (
                          <div className="text-center mt-2">
                            <span className="text-accent-amber font-mono text-sm font-bold animate-pulse">
                              {bowlRevealer.revealCount} / {bowlMatrixData.length} players
                            </span>
                            {bowlRevealer.revealCount > 0 && (
                              <span className="ml-3 text-text-primary text-xs font-semibold">
                                {bowlMatrixData[bowlRevealer.revealCount - 1]?.player}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>

                <div className="flex flex-wrap gap-4 text-[10px] text-text-muted">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF2D78' }} /> Elite (Avg ≤ 22 & Econ ≤ 7.5)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#B8FF00' }} /> Economy boss (≤ 7)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#00E5FF' }} /> Strike threat (Avg ≤ 20)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#8B5CF6' }} /> Others</span>
                </div>
              </div>
            </div>
          )}

          {insightView === 'dismissal' && (
            dismissalLoading ? (
              <Loading message="Loading dismissal mix..." />
            ) : !dismissalBreakup.length ? (
              <p className="text-text-muted text-sm py-8 text-center">No dismissal pattern data available</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] items-center">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={dismissalBreakup}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      dataKey="count"
                      nameKey="type"
                      stroke="#0A0A0F"
                      strokeWidth={2}
                      paddingAngle={2}
                    >
                      {dismissalBreakup.map((entry) => (
                        <Cell key={entry.type} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="rounded-lg px-3 py-2 text-xs shadow-xl border" style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
                          <p className="text-text-primary font-semibold">{d?.type}</p>
                          <p style={{ color: d?.fill }}>Count: <span className="font-mono font-bold">{formatNumber(d?.count)}</span></p>
                          <p className="text-text-muted">{d?.pct}% of dismissals</p>
                        </div>
                      )
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  <p className="text-xs text-text-secondary leading-relaxed">
                    A quick view of how wickets fall most often, useful for understanding league-wide batting risk patterns.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {dismissalBreakup.map((d) => (
                      <div key={d.type} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.fill }} />
                          <span className="font-semibold text-text-primary">{d.type}</span>
                        </div>
                        <p className="mt-1 text-text-muted">{formatNumber(d.count)} dismissals • {d.pct}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}
        </DashboardPanel>
      </section>

      <section id="dashboard-leaders" className="space-y-4">
        <SectionHeader
          title="Top Batters"
          description={`Sort and compare batting leaders by ${batSortLabel.toLowerCase()} to spot consistency, explosiveness, and big-innings impact.`}
          accent="lime"
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-mono">Sort by</span>
              <select value={batSort} onChange={e => setBatSort(e.target.value)}
                className="rounded-xl border border-accent-lime/20 bg-accent-lime/5 px-3 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-lime/50">
                {BAT_SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          }
        />
        {battersLoading ? (
          <Loading message="Loading batting leaderboard..." />
        ) : (
          <>
            {/* Horizontal Bar Chart */}
            {batterChartData.length > 0 && (
              <DashboardPanel accent="lime" className="mb-4">
                {featuredBatter && (
                  <div className="mb-4 flex flex-col gap-2 rounded-xl border border-accent-lime/15 bg-accent-lime/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-accent-lime font-bold">Batter spotlight</p>
                      <PlayerNameCell name={featuredBatter.player} to={`/batting/${encodeURIComponent(featuredBatter.player)}`} size={30} className="text-sm" />
                    </div>
                    <p className="text-xs text-text-secondary">
                      {formatNumber(featuredBatter.runs)} runs • Avg {formatDecimal(featuredBatter.avg)} • SR {formatDecimal(featuredBatter.sr)}
                    </p>
                  </div>
                )}
                <div className="mb-4 grid gap-2 sm:grid-cols-3">
                  <MiniGlowStat
                    accent="lime"
                    label="Runs leader"
                    value={featuredBatter ? formatNumber(featuredBatter.runs) : '—'}
                    meta={featuredBatter ? `${featuredBatter.matches} matches` : 'Current selection'}
                  />
                  <MiniGlowStat
                    accent="amber"
                    label="Strike rate"
                    value={featuredBatter ? formatDecimal(featuredBatter.sr) : '—'}
                    meta={featuredBatter ? `${featuredBatter.innings} innings` : 'Tempo lens'}
                  />
                  <MiniGlowStat
                    accent="cyan"
                    label="Consistency"
                    value={featuredBatter ? formatDecimal(featuredBatter.avg) : '—'}
                    meta={featuredBatter ? `${featuredBatter.fifties} fifties • ${featuredBatter.hundreds} hundreds` : 'Average lens'}
                  />
                </div>
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart
                    data={batterChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: '#8888A0', fontSize: 11 }}
                      axisLine={{ stroke: '#2A2A3A' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fill: '#C8C8D8', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="rounded-lg px-3 py-2 text-xs shadow-xl border"
                            style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
                            <div className="mb-1">
                              <PlayerNameCell name={d.fullName} to={`/batting/${encodeURIComponent(d.fullName)}`} size={24} />
                            </div>
                            <p style={{ color: '#B8FF00' }}>
                              {batSortLabel}: <span className="font-mono font-bold">{['avg', 'sr', 'economy'].includes(batSort) ? formatDecimal(d.value) : formatNumber(d.value)}</span>
                            </p>
                            <p className="text-text-secondary">
                              Avg: <span className="font-mono">{formatDecimal(d.avg)}</span> | SR: <span className="font-mono">{formatDecimal(d.sr)}</span>
                            </p>
                          </div>
                        )
                      }}
                      cursor={{ fill: 'rgba(184,255,0,0.05)' }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 6, 6, 0]}
                      barSize={24}
                      label={{
                        position: 'right',
                        fill: '#E8E8F0',
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        formatter: (v) => ['avg', 'sr', 'economy'].includes(batSort) ? formatDecimal(v) : formatNumber(v),
                      }}
                    >
                      {batterChartData.map((_, idx) => (
                        <Cell key={idx} fill={BAT_BAR_COLORS[idx % BAT_BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </DashboardPanel>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
              <p className="text-xs text-text-secondary">
                The chart handles quick comparison; expand the table only when you need row-level detail.
              </p>
              <button
                type="button"
                onClick={() => setShowBatTable((v) => !v)}
                className="inline-flex items-center rounded-full border border-accent-lime/25 bg-accent-lime/10 px-3 py-1.5 text-xs font-semibold text-accent-lime hover:bg-accent-lime/15 transition-colors"
              >
                {showBatTable ? 'Hide batting table' : 'Show batting table'}
              </button>
            </div>
            {showBatTable && (
              <DashboardPanel accent="lime" className="animate-in">
                <div className="mb-3 flex flex-wrap gap-2">
                  <AccentPill accent="lime">Sorted by {batSortLabel}</AccentPill>
                  <AccentPill accent="cyan">{battersWithRank.length} players shown</AccentPill>
                  {featuredBatter && <AccentPill accent="amber">Leader: {featuredBatter.player}</AccentPill>}
                </div>
                <DataTable columns={battingColumns} data={battersWithRank} />
              </DashboardPanel>
            )}
          </>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════
          TOP BOWLERS: Chart + Table
          ═══════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <SectionHeader
          title="Top Bowlers"
          description={`Track wicket-taking and control using ${bowlSortLabel.toLowerCase()} as the lens across the current filter.`}
          accent="magenta"
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-mono">Sort by</span>
              <select value={bowlSort} onChange={e => setBowlSort(e.target.value)}
                className="rounded-xl border border-accent-magenta/20 bg-accent-magenta/5 px-3 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-magenta/50">
                {BOWL_SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          }
        />
        {bowlersLoading ? (
          <Loading message="Loading bowling leaderboard..." />
        ) : (
          <>
            {/* Horizontal Bar Chart */}
            {bowlerChartData.length > 0 && (
              <DashboardPanel accent="magenta" className="mb-4">
                {featuredBowler && (
                  <div className="mb-4 flex flex-col gap-2 rounded-xl border border-accent-magenta/15 bg-accent-magenta/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-accent-magenta font-bold">Bowler spotlight</p>
                      <PlayerNameCell name={featuredBowler.player} to={`/bowling/${encodeURIComponent(featuredBowler.player)}`} size={30} className="text-sm" />
                    </div>
                    <p className="text-xs text-text-secondary">
                      {featuredBowler.wickets} wickets • Economy {formatDecimal(featuredBowler.economy)} • Avg {formatDecimal(featuredBowler.avg)}
                    </p>
                  </div>
                )}
                <div className="mb-4 grid gap-2 sm:grid-cols-3">
                  <MiniGlowStat
                    accent="magenta"
                    label="Wickets leader"
                    value={featuredBowler ? featuredBowler.wickets : '—'}
                    meta={featuredBowler ? `${featuredBowler.matches} matches` : 'Current selection'}
                  />
                  <MiniGlowStat
                    accent="amber"
                    label="Economy"
                    value={featuredBowler ? formatDecimal(featuredBowler.economy) : '—'}
                    meta="Control under pressure"
                  />
                  <MiniGlowStat
                    accent="cyan"
                    label="Average"
                    value={featuredBowler ? formatDecimal(featuredBowler.avg) : '—'}
                    meta={featuredBowler ? `SR ${formatDecimal(featuredBowler.sr)}` : 'Strike lens'}
                  />
                </div>
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart
                    data={bowlerChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: '#8888A0', fontSize: 11 }}
                      axisLine={{ stroke: '#2A2A3A' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fill: '#C8C8D8', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="rounded-lg px-3 py-2 text-xs shadow-xl border"
                            style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
                            <div className="mb-1">
                              <PlayerNameCell name={d.fullName} to={`/bowling/${encodeURIComponent(d.fullName)}`} size={24} />
                            </div>
                            <p style={{ color: '#FF2D78' }}>
                              {bowlSortLabel}: <span className="font-mono font-bold">{['economy', 'avg', 'sr'].includes(bowlSort) ? formatDecimal(d.value) : d.value}</span>
                            </p>
                            <p className="text-text-secondary">
                              Econ: <span className="font-mono">{formatDecimal(d.economy)}</span>
                            </p>
                          </div>
                        )
                      }}
                      cursor={{ fill: 'rgba(255,45,120,0.05)' }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 6, 6, 0]}
                      barSize={24}
                      label={{
                        position: 'right',
                        fill: '#E8E8F0',
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        formatter: (v) => ['economy', 'avg', 'sr'].includes(bowlSort) ? formatDecimal(v) : v,
                      }}
                    >
                      {bowlerChartData.map((_, idx) => (
                        <Cell key={idx} fill={BOWL_BAR_COLORS[idx % BOWL_BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </DashboardPanel>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
              <p className="text-xs text-text-secondary">
                Keep the visual ranking front and center, then expand the table for detailed inspection only when needed.
              </p>
              <button
                type="button"
                onClick={() => setShowBowlTable((v) => !v)}
                className="inline-flex items-center rounded-full border border-accent-magenta/25 bg-accent-magenta/10 px-3 py-1.5 text-xs font-semibold text-accent-magenta hover:bg-accent-magenta/15 transition-colors"
              >
                {showBowlTable ? 'Hide bowling table' : 'Show bowling table'}
              </button>
            </div>
            {showBowlTable && (
              <DashboardPanel accent="magenta" className="animate-in">
                <div className="mb-3 flex flex-wrap gap-2">
                  <AccentPill accent="magenta">Sorted by {bowlSortLabel}</AccentPill>
                  <AccentPill accent="cyan">{bowlersWithRank.length} players shown</AccentPill>
                  {featuredBowler && <AccentPill accent="amber">Leader: {featuredBowler.player}</AccentPill>}
                </div>
                <DataTable columns={bowlingColumns} data={bowlersWithRank} />
              </DashboardPanel>
            )}
          </>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════
          RECENT MATCHES with mini score bars
          ═══════════════════════════════════════════════════ */}
      <section id="dashboard-results" className="space-y-4">
        <SectionHeader
          title="Recent Matches"
          description="Result cards with quick score context, season tags, and standout performers for fast scanning."
          accent="cyan"
        />
        {matchesLoading ? (
          <Loading message="Loading matches..." />
        ) : recentMatches.length === 0 ? (
          <p className="text-text-muted text-sm py-8 text-center">No matches found</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger-children">
            {recentMatches.map((match) => {
              const t1Score = match.team1_score || 0
              const t2Score = match.team2_score || 0
              const maxScore = Math.max(t1Score, t2Score, 1)
              const team1Color = getTeamColor(match.team1)
              const team2Color = getTeamColor(match.team2)
              const winnerColor = getTeamColor(match.winner || match.team1)

              return (
                <Link
                  key={match.match_id}
                  to={`/matches/${match.match_id}`}
                  className="group relative block overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(17,20,31,0.96),rgba(10,12,18,0.96))] p-4 shadow-[0_16px_34px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${team1Color}, ${team2Color})` }} />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent_42%)] opacity-80" />

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-text-muted text-xs font-mono">
                        {formatDate(match.date)}
                      </span>
                      {match.season && (
                        <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: `${winnerColor}33`, color: winnerColor, backgroundColor: `${winnerColor}12` }}>
                          {match.season}
                        </span>
                      )}
                    </div>

                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                      <span className="rounded-full border px-2 py-0.5" style={{ borderColor: `${team1Color}33`, color: team1Color, backgroundColor: `${team1Color}12` }}>
                        {getTeamAbbr(match.team1)}
                      </span>
                      <span className="text-text-muted">vs</span>
                      <span className="rounded-full border px-2 py-0.5" style={{ borderColor: `${team2Color}33`, color: team2Color, backgroundColor: `${team2Color}12` }}>
                        {getTeamAbbr(match.team2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <TeamLogo team={match.team1} size={20} />
                      <p className="font-heading font-semibold text-text-primary text-sm">
                        {match.team1}
                        <span className="text-text-muted mx-2">vs</span>
                        {match.team2}
                      </p>
                      <TeamLogo team={match.team2} size={20} />
                    </div>

                    {(t1Score > 0 || t2Score > 0) && (
                      <div className="space-y-1.5 my-3">
                        <div className="flex items-center gap-2">
                          <span className="text-text-secondary text-xs w-8 text-right font-mono">{t1Score}</span>
                          <div className="flex-1 h-2 rounded-full bg-bg-elevated overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${(t1Score / maxScore) * 100}%`,
                                background: team1Color,
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-text-secondary text-xs w-8 text-right font-mono">{t2Score}</span>
                          <div className="flex-1 h-2 rounded-full bg-bg-elevated overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${(t2Score / maxScore) * 100}%`,
                                background: team2Color,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold" style={{ borderColor: `${winnerColor}33`, color: winnerColor, backgroundColor: `${winnerColor}12` }}>
                      {getMatchResult(match)}
                    </p>
                    {match.player_of_match && (
                      <p className="mt-2 text-text-muted text-xs">
                        Player of Match:{' '}
                        <span className="text-accent-amber">{match.player_of_match}</span>
                      </p>
                    )}
                    {match.venue && (
                      <p className="text-text-muted text-xs mt-1 truncate">
                        {match.venue}{match.city ? `, ${match.city}` : ''}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
