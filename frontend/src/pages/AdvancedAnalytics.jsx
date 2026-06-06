import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import Loading from '../components/ui/Loading'
import SEO from '../components/SEO'
import { getTeamColor, getTeamAbbr } from '../constants/teams'

/* ── Constants ────────────────────────────────────────────── */
const TEAMS = [
  'Chennai Super Kings',
  'Mumbai Indians',
  'Royal Challengers Bangalore',
  'Kolkata Knight Riders',
  'Delhi Capitals',
  'Punjab Kings',
  'Rajasthan Royals',
  'Sunrisers Hyderabad',
  'Gujarat Titans',
  'Lucknow Super Giants',
]

const TABS = [
  { key: 'form',    label: 'Team Form Index',  icon: '📊' },
  { key: 'predict', label: 'Win Predictor',     icon: '🎯' },
  { key: 'fantasy', label: 'Fantasy Picks',     icon: '⭐' },
  { key: 'impact',  label: 'Player Impact',     icon: '💥' },
]

const ACCENT = {
  cyan:    '#00E5FF',
  magenta: '#FF2D78',
  lime:    '#B8FF00',
  amber:   '#FFB800',
}

/* ── API Helper ───────────────────────────────────────────── */
const fetchAPI = (url) =>
  fetch(`/api/advanced${url}`).then((r) => {
    if (!r.ok) throw new Error(`API error: ${r.status}`)
    return r.json()
  })

/* ── Reusable Components ──────────────────────────────────── */

function NeonTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-xl border"
      style={{ background: '#16161F', borderColor: '#2A2A3A' }}>
      <p className="text-text-primary font-semibold mb-0.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <span className="font-mono font-bold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

function TabButton({ active, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-heading font-semibold
        transition-all duration-300 whitespace-nowrap
        ${active
          ? 'bg-gradient-to-r from-accent-cyan/20 to-accent-magenta/10 text-accent-cyan border border-accent-cyan/40 shadow-lg shadow-accent-cyan/10'
          : 'bg-bg-card text-text-secondary border border-border-subtle hover:border-accent-cyan/30 hover:text-text-primary'
        }
      `}
    >
      <span className="text-base">{icon}</span>
      {label}
    </button>
  )
}

function TeamSelect({ value, onChange, label, excludeTeam }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-text-muted uppercase tracking-wider font-heading">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-bg-card border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary
                   font-body focus:outline-none focus:border-accent-cyan/60 focus:ring-1 focus:ring-accent-cyan/30
                   transition-all appearance-none cursor-pointer"
      >
        <option value="">Select team...</option>
        {TEAMS.filter((t) => t !== excludeTeam).map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  )
}

function GaugeChart({ value, max = 100, label, color = ACCENT.cyan, size = 200 }) {
  const pct = Math.min((value / max) * 100, 100)
  const data = [{ name: label, value: pct, fill: color }]

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size / 2 + 50 }}>
        <ResponsiveContainer width="100%" height={size / 2 + 20}>
          <RadialBarChart
            cx="50%" cy="90%"
            innerRadius="55%"
            outerRadius="85%"
            startAngle={180}
            endAngle={0}
            data={data}
            barSize={14}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={6}
              background={{ fill: '#1A1A24' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Score positioned below the arc with safe spacing */}
        <div className="absolute left-0 right-0 text-center" style={{ bottom: '0px' }}>
          <span className="text-3xl font-heading font-bold font-mono" style={{ color }}>
            {typeof value === 'number' ? value.toFixed(1) : value}
          </span>
          <span className="text-text-muted text-xs ml-1">/ {max}</span>
        </div>
      </div>
      <p className="text-text-secondary text-xs mt-2 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function AnimatedBar({ value, max = 100, color = ACCENT.cyan, height = 'h-3' }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className={`w-full ${height} rounded-full bg-[#1A1A24] overflow-hidden`}>
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}
      />
    </div>
  )
}

function EmptyState({ message = 'Select options above to get started', icon = '📋' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <span className="text-5xl opacity-40">{icon}</span>
      <p className="text-text-muted text-sm font-body">{message}</p>
    </div>
  )
}

function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <span className="text-4xl">⚠️</span>
      <p className="text-red-400 text-sm font-body">{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="mt-2 px-4 py-2 text-xs font-heading font-semibold rounded-lg
                     bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30
                     hover:bg-accent-cyan/20 transition-all">
          Retry
        </button>
      )}
    </div>
  )
}

function GlowCard({ children, className = '', glowColor = ACCENT.cyan }) {
  return (
    <div
      className={`bg-bg-card border border-border-subtle rounded-2xl p-6 relative overflow-hidden ${className}`}
      style={{ boxShadow: `0 0 40px ${glowColor}08` }}
    >
      {children}
    </div>
  )
}

function SectionTitle({ children, accent = 'bg-accent-cyan' }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-1 h-6 ${accent} rounded-full`} />
      <h2 className="text-lg font-heading font-bold text-text-primary">{children}</h2>
    </div>
  )
}

/* ── Custom hook for async data ───────────────────────────── */
function useAsyncData(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const execute = useCallback(() => {
    if (!fetcher) return
    setLoading(true)
    setError(null)
    fetcher()
      .then((d) => { setData(d); setError(null) })
      .catch((e) => { setError(e.message || 'Failed to fetch data'); setData(null) })
      .finally(() => setLoading(false))
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { execute() }, [execute])

  return { data, loading, error, refetch: execute }
}

/* ═══════════════════════════════════════════════════════════
   TAB 1: TEAM FORM INDEX
   ═══════════════════════════════════════════════════════════ */
function TeamFormIndex() {
  const [team, setTeam] = useState('')
  const [lastN, setLastN] = useState(10)

  const { data, loading, error, refetch } = useAsyncData(
    team ? () => fetchAPI(`/form-index?team=${encodeURIComponent(team)}&last_n=${lastN}`) : null,
    [team, lastN]
  )

  const formIndex = data?.form_index ?? null
  const matches = data?.trend ?? data?.recent_matches ?? []
  // Parse current_streak string like "W3" into {type, count}
  const streakRaw = data?.current_streak ?? ''
  const streak = useMemo(() => {
    if (typeof streakRaw === 'object') return streakRaw
    const match = String(streakRaw).match(/^([WL])(\d+)$/)
    return match ? { type: match[1], count: parseInt(match[2]) } : { type: '', count: 0 }
  }, [streakRaw])

  const trendData = useMemo(() =>
    matches.map((m, i) => ({
      match: `M${i + 1}`,
      score: m.score ?? 0,
      result: m.result,
      opponent: m.opponent,
    })).reverse(),
    [matches]
  )

  const getFormLabel = (v) => {
    if (v >= 80) return { text: 'Dominant', color: ACCENT.lime }
    if (v >= 60) return { text: 'Strong', color: ACCENT.cyan }
    if (v >= 40) return { text: 'Average', color: ACCENT.amber }
    if (v >= 20) return { text: 'Struggling', color: '#FF6B6B' }
    return { text: 'Poor', color: ACCENT.magenta }
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <GlowCard>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <TeamSelect value={team} onChange={setTeam} label="Select Team" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted uppercase tracking-wider font-heading">Last N Matches</label>
            <select
              value={lastN}
              onChange={(e) => setLastN(Number(e.target.value))}
              className="bg-bg-card border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary
                         font-body focus:outline-none focus:border-accent-cyan/60 transition-all appearance-none cursor-pointer"
            >
              {[5, 10, 15, 20].map((n) => (
                <option key={n} value={n}>Last {n}</option>
              ))}
            </select>
          </div>
        </div>
      </GlowCard>

      {loading && <Loading message="Calculating form index..." />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!team && !loading && <EmptyState message="Select a team to analyze form" icon="🏏" />}

      {data && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Index Gauge */}
          <GlowCard glowColor={getTeamColor(team)}>
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[#00E5FF08] pointer-events-none rounded-2xl" />
            <SectionTitle accent="bg-accent-cyan">Form Index</SectionTitle>
            <div className="flex flex-col items-center pt-4">
              <GaugeChart value={formIndex} label="Form Rating" color={getTeamColor(team)} size={220} />
              {formIndex !== null && (
                <div className="mt-4 px-4 py-1.5 rounded-full text-xs font-heading font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${getFormLabel(formIndex).color}18`,
                    color: getFormLabel(formIndex).color,
                    border: `1px solid ${getFormLabel(formIndex).color}40`,
                  }}>
                  {getFormLabel(formIndex).text}
                </div>
              )}
            </div>
          </GlowCard>

          {/* Win Streak Info */}
          <GlowCard glowColor={ACCENT.lime}>
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[#B8FF0008] pointer-events-none rounded-2xl" />
            <SectionTitle accent="bg-accent-lime">Streak &amp; Record</SectionTitle>
            <div className="space-y-5 mt-6">
              <div>
                <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Current Streak</p>
                <p className="text-3xl font-heading font-bold font-mono" style={{
                  color: streak.type === 'W' ? ACCENT.lime : streak.type === 'L' ? ACCENT.magenta : ACCENT.amber
                }}>
                  {streak.count ?? 0}{streak.type ?? ''}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-[#B8FF0010] border border-[#B8FF0020]">
                  <p className="text-xl font-mono font-bold text-accent-lime">{data?.wins ?? 0}</p>
                  <p className="text-[10px] text-text-muted uppercase">Wins</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-[#FF2D7810] border border-[#FF2D7820]">
                  <p className="text-xl font-mono font-bold text-accent-magenta">{data?.losses ?? 0}</p>
                  <p className="text-[10px] text-text-muted uppercase">Losses</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-[#FFB80010] border border-[#FFB80020]">
                  <p className="text-xl font-mono font-bold text-accent-amber">{data?.no_results ?? 0}</p>
                  <p className="text-[10px] text-text-muted uppercase">N/R</p>
                </div>
              </div>

              {/* Result dots */}
              <div>
                <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Recent Results</p>
                <div className="flex gap-1.5 flex-wrap">
                  {matches.map((m, i) => (
                    <div
                      key={i}
                      title={`vs ${m.opponent}: ${m.result}`}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold
                                 cursor-default transition-transform hover:scale-125"
                      style={{
                        backgroundColor: m.result === 'W' ? '#B8FF0025' : m.result === 'L' ? '#FF2D7825' : '#FFB80025',
                        color: m.result === 'W' ? ACCENT.lime : m.result === 'L' ? ACCENT.magenta : ACCENT.amber,
                        border: `1px solid ${m.result === 'W' ? ACCENT.lime : m.result === 'L' ? ACCENT.magenta : ACCENT.amber}50`,
                      }}
                    >
                      {m.result}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlowCard>

          {/* Trend Line Chart */}
          <GlowCard glowColor={ACCENT.amber}>
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[#FFB80008] pointer-events-none rounded-2xl" />
            <SectionTitle accent="bg-accent-amber">Match Trend</SectionTitle>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <XAxis dataKey="match" tick={{ fill: '#6B6B80', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B6B80', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<NeonTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Team Score"
                    stroke={getTeamColor(team)}
                    strokeWidth={2.5}
                    dot={(props) => {
                      const { cx, cy, payload } = props
                      const c = payload.result === 'W' ? ACCENT.lime : payload.result === 'L' ? ACCENT.magenta : ACCENT.amber
                      return <circle key={props.index} cx={cx} cy={cy} r={5} fill={c} stroke="#0A0A0F" strokeWidth={2} />
                    }}
                    activeDot={{ r: 7, stroke: ACCENT.cyan, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No match data available" icon="📉" />
            )}
          </GlowCard>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB 2: WIN PREDICTOR
   ═══════════════════════════════════════════════════════════ */
function WinPredictor() {
  const [team1, setTeam1] = useState('')
  const [team2, setTeam2] = useState('')
  const [venue, setVenue] = useState('')

  const canPredict = team1 && team2 && team1 !== team2

  const { data, loading, error, refetch } = useAsyncData(
    canPredict
      ? () => fetchAPI(`/win-predictor?team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(team2)}${venue ? `&venue=${encodeURIComponent(venue)}` : ''}`)
      : null,
    [team1, team2, venue]
  )

  const t1Pct = data?.team1_win_pct ?? 50
  const t2Pct = data?.team2_win_pct ?? 50
  const factorsRaw = data?.factors ?? {}

  const FACTOR_LABELS = { h2h: 'Head to Head', form: 'Recent Form', venue: 'Venue Stats', overall: 'Overall Record' }

  const factorChartData = useMemo(() =>
    Object.entries(factorsRaw).map(([key, f]) => ({
      name: FACTOR_LABELS[key] || key,
      [getTeamAbbr(team1)]: f.team1_pct ?? 0,
      [getTeamAbbr(team2)]: f.team2_pct ?? 0,
    })),
    [factorsRaw, team1, team2]
  )

  return (
    <div className="space-y-6">
      {/* Controls */}
      <GlowCard>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[180px]">
            <TeamSelect value={team1} onChange={setTeam1} label="Team 1" excludeTeam={team2} />
          </div>
          <div className="flex items-end pb-2">
            <span className="text-text-muted font-heading text-lg font-bold">VS</span>
          </div>
          <div className="flex-1 min-w-[180px]">
            <TeamSelect value={team2} onChange={setTeam2} label="Team 2" excludeTeam={team1} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-text-muted uppercase tracking-wider font-heading">Venue (optional)</label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. Wankhede Stadium"
                className="bg-bg-card border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary
                           font-body focus:outline-none focus:border-accent-cyan/60 focus:ring-1 focus:ring-accent-cyan/30
                           transition-all placeholder:text-text-muted/40"
              />
            </div>
          </div>
        </div>
      </GlowCard>

      {loading && <Loading message="Crunching predictions..." />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!canPredict && !loading && <EmptyState message="Select two different teams to predict the outcome" icon="🎯" />}

      {data && !loading && canPredict && (
        <div className="space-y-6">
          {/* Split Bar */}
          <GlowCard>
            <div className="absolute inset-0 bg-gradient-to-r from-[#00E5FF06] via-transparent to-[#FF2D7806] pointer-events-none rounded-2xl" />
            <SectionTitle>Predicted Win Probability</SectionTitle>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-right flex-1">
                <p className="text-sm font-heading font-semibold text-text-primary">{getTeamAbbr(team1)}</p>
                <p className="text-3xl font-mono font-bold" style={{ color: getTeamColor(team1) }}>
                  {t1Pct.toFixed(1)}%
                </p>
              </div>
              <div className="flex-[3] h-10 rounded-full overflow-hidden bg-[#1A1A24] flex">
                <div
                  className="h-full transition-all duration-1000 ease-out rounded-l-full"
                  style={{
                    width: `${t1Pct}%`,
                    background: `linear-gradient(90deg, ${getTeamColor(team1)}, ${getTeamColor(team1)}CC)`,
                  }}
                />
                <div
                  className="h-full transition-all duration-1000 ease-out rounded-r-full"
                  style={{
                    width: `${t2Pct}%`,
                    background: `linear-gradient(90deg, ${getTeamColor(team2)}CC, ${getTeamColor(team2)})`,
                  }}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-heading font-semibold text-text-primary">{getTeamAbbr(team2)}</p>
                <p className="text-3xl font-mono font-bold" style={{ color: getTeamColor(team2) }}>
                  {t2Pct.toFixed(1)}%
                </p>
              </div>
            </div>

            {data.verdict && (
              <div className="text-center mt-4 px-4 py-2 rounded-xl bg-[#00E5FF08] border border-[#00E5FF20]">
                <p className="text-text-secondary text-sm">{data.verdict}</p>
              </div>
            )}
          </GlowCard>

          {/* Factor Breakdown */}
          {factorChartData.length > 0 && (
            <GlowCard glowColor={ACCENT.amber}>
              <SectionTitle accent="bg-accent-amber">Factor Breakdown</SectionTitle>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={factorChartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <XAxis type="number" tick={{ fill: '#6B6B80', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#A0A0B0', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip content={<NeonTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#A0A0B0' }} />
                  <Bar dataKey={getTeamAbbr(team1)} fill={getTeamColor(team1)} radius={[0, 4, 4, 0]} barSize={14} />
                  <Bar dataKey={getTeamAbbr(team2)} fill={getTeamColor(team2)} radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </GlowCard>
          )}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB 3: FANTASY PICKS
   ═══════════════════════════════════════════════════════════ */
const ROLE_COLORS = {
  Batsman: ACCENT.cyan,
  Batter: ACCENT.cyan,
  Bowler: ACCENT.magenta,
  'All-Rounder': ACCENT.lime,
  'Allrounder': ACCENT.lime,
  'Wicket-Keeper': ACCENT.amber,
  'WK-Batter': ACCENT.amber,
}

function getRoleColor(role) {
  return ROLE_COLORS[role] || ACCENT.cyan
}

function FantasyPicks() {
  const [team1, setTeam1] = useState('')
  const [team2, setTeam2] = useState('')

  const canFetch = team1 && team2 && team1 !== team2

  const { data, loading, error, refetch } = useAsyncData(
    canFetch
      ? () => fetchAPI(`/fantasy-picks?team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(team2)}`)
      : null,
    [team1, team2]
  )

  const picks = data?.picks ?? []
  const maxScore = useMemo(() => Math.max(...picks.map((p) => p.fantasy_score ?? 0), 1), [picks])

  return (
    <div className="space-y-6">
      {/* Controls */}
      <GlowCard>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <TeamSelect value={team1} onChange={setTeam1} label="Team 1" excludeTeam={team2} />
          </div>
          <div className="flex items-end pb-2">
            <span className="text-text-muted font-heading text-lg font-bold">VS</span>
          </div>
          <div className="flex-1 min-w-[200px]">
            <TeamSelect value={team2} onChange={setTeam2} label="Team 2" excludeTeam={team1} />
          </div>
        </div>
      </GlowCard>

      {loading && <Loading message="Scouting top fantasy picks..." />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!canFetch && !loading && <EmptyState message="Select two teams to get fantasy recommendations" icon="⭐" />}

      {picks.length > 0 && !loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle accent="bg-accent-lime">Top 11 Fantasy Picks</SectionTitle>
            <div className="text-xs text-text-muted font-mono">
              {picks.length} player{picks.length !== 1 ? 's' : ''}
            </div>
          </div>

          {picks.map((player, i) => {
            const roleColor = getRoleColor(player.role)
            const teamColor = getTeamColor(player.team)
            const score = player.fantasy_score ?? 0

            return (
              <GlowCard key={i} glowColor={teamColor} className="!p-4">
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-mono font-bold flex-shrink-0"
                    style={{
                      background: i < 3
                        ? `linear-gradient(135deg, ${ACCENT.amber}30, ${ACCENT.amber}10)`
                        : '#1A1A24',
                      color: i < 3 ? ACCENT.amber : '#6B6B80',
                      border: i < 3 ? `1px solid ${ACCENT.amber}40` : '1px solid #2A2A3A',
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-text-primary font-heading font-semibold text-sm truncate">{player.name}</p>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase flex-shrink-0"
                        style={{ backgroundColor: `${roleColor}18`, color: roleColor, border: `1px solid ${roleColor}30` }}
                      >
                        {player.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span style={{ color: teamColor }}>{getTeamAbbr(player.team)}</span>
                      {player.matches && <span>{player.matches} matches</span>}
                      {player.avg !== undefined && <span>Avg: {Number(player.avg).toFixed(1)}</span>}
                      {player.sr !== undefined && <span>SR: {Number(player.sr).toFixed(1)}</span>}
                      {player.wickets !== undefined && <span>Wkts: {player.wickets}</span>}
                    </div>
                  </div>

                  {/* Score bar + value */}
                  <div className="flex items-center gap-3 flex-shrink-0 w-44">
                    <div className="flex-1">
                      <AnimatedBar value={score} max={maxScore} color={roleColor} height="h-2" />
                    </div>
                    <span className="text-lg font-mono font-bold min-w-[48px] text-right" style={{ color: roleColor }}>
                      {score.toFixed(0)}
                    </span>
                  </div>
                </div>
              </GlowCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TAB 4: PLAYER IMPACT
   ═══════════════════════════════════════════════════════════ */
function PlayerImpact() {
  const [playerName, setPlayerName] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchInput.trim()) setPlayerName(searchInput.trim())
  }

  const { data, loading, error, refetch } = useAsyncData(
    playerName ? () => fetchAPI(`/batting-impact?player=${encodeURIComponent(playerName)}`) : null,
    [playerName]
  )

  const impact = data?.impact_score ?? null
  const metrics = data?.metrics ?? {}
  const summary = data?.summary ?? {}

  const radarData = useMemo(() => {
    if (!metrics || Object.keys(metrics).length === 0) return []
    return Object.entries(metrics).map(([key, val]) => ({
      metric: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: typeof val === 'number' ? val : 0,
      fullMark: 100,
    }))
  }, [metrics])

  const getImpactLabel = (v) => {
    if (v >= 85) return { text: 'Elite', color: ACCENT.lime }
    if (v >= 70) return { text: 'High Impact', color: ACCENT.cyan }
    if (v >= 50) return { text: 'Moderate', color: ACCENT.amber }
    if (v >= 30) return { text: 'Low', color: '#FF6B6B' }
    return { text: 'Minimal', color: ACCENT.magenta }
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <GlowCard>
        <form onSubmit={handleSearch} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-text-muted uppercase tracking-wider font-heading block mb-1.5">Search Player</label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="e.g. Virat Kohli, MS Dhoni..."
              className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary
                         font-body focus:outline-none focus:border-accent-cyan/60 focus:ring-1 focus:ring-accent-cyan/30
                         transition-all placeholder:text-text-muted/40"
            />
          </div>
          <button
            type="submit"
            disabled={!searchInput.trim()}
            className="px-6 py-2.5 rounded-lg font-heading font-semibold text-sm
                       bg-gradient-to-r from-accent-cyan to-accent-cyan/80 text-bg-primary
                       hover:shadow-lg hover:shadow-accent-cyan/20 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Analyze
          </button>
        </form>
      </GlowCard>

      {loading && <Loading message={`Analyzing ${playerName}...`} />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!playerName && !loading && <EmptyState message="Search for a player to see their impact analysis" icon="💥" />}

      {data && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Impact Score Gauge */}
          <GlowCard glowColor={ACCENT.cyan}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#00E5FF06] to-transparent pointer-events-none rounded-2xl" />
            <SectionTitle>Impact Score</SectionTitle>
            <div className="flex flex-col items-center pt-2">
              <GaugeChart
                value={impact}
                label="Player Impact"
                color={impact !== null ? getImpactLabel(impact).color : ACCENT.cyan}
                size={240}
              />
              {impact !== null && (
                <div className="mt-4 px-4 py-1.5 rounded-full text-xs font-heading font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${getImpactLabel(impact).color}18`,
                    color: getImpactLabel(impact).color,
                    border: `1px solid ${getImpactLabel(impact).color}40`,
                  }}>
                  {getImpactLabel(impact).text}
                </div>
              )}

              {/* Summary stats */}
              {Object.keys(summary).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 w-full">
                  {Object.entries(summary).map(([key, val]) => (
                    <div key={key} className="text-center p-3 rounded-xl bg-[#1A1A24] border border-[#2A2A3A]">
                      <p className="text-lg font-mono font-bold text-text-primary">
                        {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : val}
                      </p>
                      <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">
                        {key.replace(/_/g, ' ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlowCard>

          {/* Metrics Breakdown */}
          <GlowCard glowColor={ACCENT.magenta}>
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[#FF2D7806] pointer-events-none rounded-2xl" />
            <SectionTitle accent="bg-accent-magenta">Performance Metrics</SectionTitle>
            {radarData.length > 0 ? (
              <div className="space-y-4 mt-2">
                {radarData.map((item, i) => {
                  const colors = [ACCENT.cyan, ACCENT.magenta, ACCENT.lime, ACCENT.amber, '#8B5CF6', '#EC4899']
                  const barColor = colors[i % colors.length]
                  return (
                    <div key={item.metric}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-text-secondary font-heading">{item.metric}</span>
                        <span className="text-sm font-mono font-bold" style={{ color: barColor }}>
                          {item.value.toFixed(1)}
                        </span>
                      </div>
                      <AnimatedBar value={item.value} max={item.fullMark} color={barColor} />
                    </div>
                  )
                })}

                {/* Pie chart visual */}
                <div className="mt-6 pt-4 border-t border-border-subtle">
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-3">Score Distribution</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={radarData}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                        dataKey="value"
                        nameKey="metric"
                        strokeWidth={0}
                        paddingAngle={3}
                      >
                        {radarData.map((_, i) => {
                          const colors = [ACCENT.cyan, ACCENT.magenta, ACCENT.lime, ACCENT.amber, '#8B5CF6', '#EC4899']
                          return <Cell key={i} fill={colors[i % colors.length]} />
                        })}
                      </Pie>
                      <Tooltip content={<NeonTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <EmptyState message="No detailed metrics available" icon="📊" />
            )}
          </GlowCard>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function AdvancedAnalytics() {
  const [activeTab, setActiveTab] = useState('form')

  const renderTab = () => {
    switch (activeTab) {
      case 'form':    return <TeamFormIndex />
      case 'predict': return <WinPredictor />
      case 'fantasy': return <FantasyPicks />
      case 'impact':  return <PlayerImpact />
      default:        return null
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <SEO
        title="Advanced Analytics - Form Index, Win Predictor"
        description="Advanced IPL analytics with team form index, match win predictor, fantasy picks, and player impact analysis powered by statistical models."
      />
      {/* Page Header */}
      <div className="mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#00E5FF10] via-[#FF2D7808] to-[#B8FF0010] border border-border-subtle p-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#00E5FF08,_transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#FF2D7808,_transparent_60%)]" />
          <div className="relative">
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-text-primary mb-2">
              Advanced Analytics
            </h1>
            <p className="text-text-secondary font-body text-sm max-w-xl">
              Deep-dive into team form, match predictions, fantasy recommendations, and player impact analysis
              powered by advanced statistical models.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border-subtle">
        {TABS.map((tab) => (
          <TabButton
            key={tab.key}
            active={activeTab === tab.key}
            label={tab.label}
            icon={tab.icon}
            onClick={() => setActiveTab(tab.key)}
          />
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {renderTab()}
      </div>
    </div>
  )
}
