import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getLiveStatus, getLiveMatches, getLiveScorecard, getLiveMatchInfo, getIPLSchedule } from '../lib/api'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import Loading from '../components/ui/Loading'
import SEO from '../components/SEO'

/* ── Refresh interval ──────────────────────────────────────── */
const POLL_INTERVAL = 900_000 // 15 minutes (free tier: 100 API hits/day)

/* ── Day names & month names ──────────────────────────────── */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/* ── Utility: format score line ────────────────────────────── */
function fmtScore(s) {
  if (!s) return '—'
  if (typeof s.score === 'string' && s.score) return s.score
  const parts = []
  if (s.r !== undefined) parts.push(s.r)
  if (s.w !== undefined) parts.push(`/${s.w}`)
  if (s.o !== undefined) parts.push(` (${s.o})`)
  return parts.join('') || '—'
}

/* ── Countdown hook ────────────────────────────────────────── */
function useCountdown(targetISO) {
  const [diff, setDiff] = useState(() => {
    if (!targetISO) return null
    return Math.max(0, new Date(targetISO).getTime() - Date.now())
  })

  useEffect(() => {
    if (!targetISO) return
    const tick = () => setDiff(Math.max(0, new Date(targetISO).getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetISO])

  if (diff === null || diff <= 0) return null
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return { days: d, hours: h, minutes: m, seconds: s }
}

/* ── Countdown Display ─────────────────────────────────────── */
function CountdownBox({ label, value }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl sm:text-3xl font-mono font-black text-accent-cyan tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[9px] uppercase tracking-widest text-text-muted mt-1">{label}</span>
    </div>
  )
}

/* ── Match Card (in the list view) ─────────────────────────── */
function MatchCard({ match, selected, onClick }) {
  const isLive = match.matchStarted && !match.matchEnded
  const teams = match.teams || []
  const scores = match.score || []

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 border transition-all duration-200 ${
        selected
          ? 'border-accent-cyan bg-accent-cyan/5 shadow-lg shadow-accent-cyan/10'
          : 'border-border-subtle bg-surface-card hover:border-border-default hover:bg-surface-hover'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {isLive ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent-magenta">
            <span className="w-2 h-2 rounded-full bg-accent-magenta animate-pulse" />
            Live
          </span>
        ) : match.matchEnded ? (
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Completed</span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-widest text-accent-amber">Upcoming</span>
        )}
        {match.matchType && (
          <span className="text-[10px] uppercase tracking-wider text-text-muted ml-auto">{match.matchType}</span>
        )}
      </div>

      <div className="space-y-2">
        {teams.map((team, i) => {
          const teamKey = (team || '').toLowerCase()
          const score = scores[i] || scores.find(s => {
            const inn = (s.inning || '').toLowerCase()
            return inn === teamKey || inn.includes(teamKey.split(' ')[0])
          })
          const teamImg = match.teamInfo?.[i]?.img
          return (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {teamImg ? (
                  <img src={teamImg} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <TeamLogo team={team} size={20} />
                )}
                <span className="text-sm font-semibold text-text-primary truncate">
                  {getTeamAbbr(team) || team}
                </span>
              </div>
              <span className="text-sm font-mono font-bold text-text-primary whitespace-nowrap">
                {score ? fmtScore(score) : '—'}
              </span>
            </div>
          )
        })}
      </div>

      {match.series && (
        <p className={`mt-2 text-[10px] font-medium tracking-wide ${match.isIPL ? 'text-accent-amber' : 'text-text-muted'}`}>
          {match.series}
        </p>
      )}
      {match.status && (
        <p className="mt-1 text-[11px] text-text-secondary leading-tight line-clamp-2">{match.status}</p>
      )}
    </button>
  )
}

/* ── Scorecard Section ─────────────────────────────────────── */
function ScorecardView({ matchId }) {
  const [scorecard, setScorecard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const data = await getLiveScorecard(matchId)
      setScorecard(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [matchId])

  useEffect(() => {
    setLoading(true)
    fetchData()
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  if (loading) return <Loading />
  if (error) return <div className="text-accent-magenta text-sm p-4">{error}</div>
  if (!scorecard) return null

  const isLive = scorecard.matchStarted && !scorecard.matchEnded

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border-subtle bg-surface-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">{scorecard.name}</h2>
            <p className="text-xs text-text-muted mt-1">{scorecard.venue}</p>
          </div>
          {isLive && (
            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent-magenta/20 text-accent-magenta text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-accent-magenta animate-pulse" />
              Live
            </span>
          )}
        </div>
        {scorecard.tossWinner && (
          <p className="text-xs text-text-secondary mb-4">
            Toss: <span className="text-text-primary font-semibold">{scorecard.tossWinner}</span> chose to <span className="text-accent-cyan">{scorecard.tossChoice}</span>
          </p>
        )}
        <div className="space-y-3">
          {(scorecard.score || []).map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-dark">
              <span className="text-sm font-semibold text-text-primary">{s.inning}</span>
              <span className="text-lg font-mono font-bold text-accent-cyan">{fmtScore(s)}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold text-accent-lime text-center">{scorecard.status}</p>
      </div>

      {(scorecard.scorecard || []).map((inn, idx) => (
        <div key={idx} className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
          <div className="px-5 py-3 bg-surface-hover border-b border-border-subtle">
            <h3 className="text-sm font-bold text-text-primary tracking-wide uppercase">
              {inn.inning || `Innings ${idx + 1}`}
            </h3>
            <div className="flex gap-4 text-xs text-text-secondary mt-1">
              {inn.totals && (
                <>
                  <span>Total: <span className="text-text-primary font-bold">{inn.totals.R || 0}/{inn.totals.W || 0}</span></span>
                  <span>Overs: <span className="text-text-primary">{inn.totals.O || 0}</span></span>
                </>
              )}
            </div>
          </div>
          {inn.batting && inn.batting.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-border-subtle">
                    <th className="text-left py-2 px-4 font-medium">Batter</th>
                    <th className="text-center py-2 px-2 font-medium">R</th>
                    <th className="text-center py-2 px-2 font-medium">B</th>
                    <th className="text-center py-2 px-2 font-medium">4s</th>
                    <th className="text-center py-2 px-2 font-medium">6s</th>
                    <th className="text-center py-2 px-2 font-medium">SR</th>
                  </tr>
                </thead>
                <tbody>
                  {inn.batting.map((b, bi) => (
                    <tr key={bi} className="border-b border-border-subtle/50 hover:bg-surface-hover/50">
                      <td className="py-2 px-4">
                        <span className="text-text-primary font-semibold">{b.batsman?.name || b.batsman}</span>
                        <span className="text-text-muted ml-1 text-[10px]">{b.dismissal || ''}</span>
                      </td>
                      <td className={`text-center py-2 px-2 font-mono font-bold ${
                        (b.r || 0) >= 50 ? 'text-accent-lime' : (b.r || 0) >= 30 ? 'text-accent-cyan' : 'text-text-primary'
                      }`}>{b.r ?? 0}</td>
                      <td className="text-center py-2 px-2 font-mono text-text-secondary">{b.b ?? 0}</td>
                      <td className="text-center py-2 px-2 font-mono text-accent-cyan">{b['4s'] ?? 0}</td>
                      <td className="text-center py-2 px-2 font-mono text-accent-lime">{b['6s'] ?? 0}</td>
                      <td className="text-center py-2 px-2 font-mono text-text-secondary">{b.sr ?? '0.00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {inn.bowling && inn.bowling.length > 0 && (
            <div className="overflow-x-auto border-t border-border-subtle">
              <div className="px-4 py-2 bg-surface-hover/50">
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Bowling</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-border-subtle">
                    <th className="text-left py-2 px-4 font-medium">Bowler</th>
                    <th className="text-center py-2 px-2 font-medium">O</th>
                    <th className="text-center py-2 px-2 font-medium">M</th>
                    <th className="text-center py-2 px-2 font-medium">R</th>
                    <th className="text-center py-2 px-2 font-medium">W</th>
                    <th className="text-center py-2 px-2 font-medium">Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {inn.bowling.map((bw, bwi) => (
                    <tr key={bwi} className="border-b border-border-subtle/50 hover:bg-surface-hover/50">
                      <td className="py-2 px-4 text-text-primary font-semibold">{bw.bowler?.name || bw.bowler}</td>
                      <td className="text-center py-2 px-2 font-mono text-text-secondary">{bw.o ?? 0}</td>
                      <td className="text-center py-2 px-2 font-mono text-text-secondary">{bw.m ?? 0}</td>
                      <td className="text-center py-2 px-2 font-mono text-text-primary">{bw.r ?? 0}</td>
                      <td className={`text-center py-2 px-2 font-mono font-bold ${
                        (bw.w || 0) >= 3 ? 'text-accent-magenta' : (bw.w || 0) >= 1 ? 'text-accent-cyan' : 'text-text-primary'
                      }`}>{bw.w ?? 0}</td>
                      <td className="text-center py-2 px-2 font-mono text-text-secondary">{bw.eco ?? '0.00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── IPL Schedule Tab ──────────────────────────────────────── */
function IPLScheduleView() {
  const { data: schedule, loading, error } = useFetch(() => getIPLSchedule(), [])
  const [teamFilter, setTeamFilter] = useState('all')
  const scrollRef = useRef(null)

  const countdown = useCountdown(schedule?.nextMatch?.dateTimeGMT)

  // Get unique teams for filter
  const teams = useMemo(() => {
    if (!schedule?.matches) return []
    const s = new Set()
    schedule.matches.forEach(m => { s.add(m.home); s.add(m.away) })
    return [...s].sort()
  }, [schedule])

  // Filter matches
  const filteredMatches = useMemo(() => {
    if (!schedule?.matches) return []
    if (teamFilter === 'all') return schedule.matches
    return schedule.matches.filter(m => m.home === teamFilter || m.away === teamFilter)
  }, [schedule, teamFilter])

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups = {}
    filteredMatches.forEach(m => {
      if (!groups[m.date]) groups[m.date] = []
      groups[m.date].push(m)
    })
    return groups
  }, [filteredMatches])

  // Scroll to next match on load
  useEffect(() => {
    if (!schedule?.nextMatch || !scrollRef.current) return
    const el = scrollRef.current.querySelector(`[data-match="${schedule.nextMatch.match}"]`)
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
    }
  }, [schedule])

  if (loading) return <Loading />
  if (error) return <div className="text-accent-magenta text-sm p-4">{error}</div>
  if (!schedule) return null

  const nextM = schedule.nextMatch
  const completedCount = schedule.matches.filter(m => m.status === 'completed').length

  return (
    <div className="space-y-6">
      {/* Next Match Countdown Hero */}
      {nextM && countdown && (
        <div className="rounded-2xl border border-accent-cyan/20 bg-gradient-to-br from-accent-cyan/5 via-surface-card to-accent-magenta/5 p-6 sm:p-8">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent-cyan font-bold mb-4">Next Match</p>

            {/* Teams */}
            <div className="flex items-center justify-center gap-4 sm:gap-8 mb-6">
              <div className="flex flex-col items-center gap-2">
                <TeamLogo team={nextM.home} size={48} />
                <span className="text-sm sm:text-base font-bold text-text-primary">{getTeamAbbr(nextM.home) || nextM.home}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-black text-text-muted">VS</span>
                <span className="text-[10px] text-text-muted mt-1">Match #{nextM.match}</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <TeamLogo team={nextM.away} size={48} />
                <span className="text-sm sm:text-base font-bold text-text-primary">{getTeamAbbr(nextM.away) || nextM.away}</span>
              </div>
            </div>

            {/* Countdown */}
            <div className="flex items-center justify-center gap-3 sm:gap-5 mb-4">
              <CountdownBox label="Days" value={countdown.days} />
              <span className="text-xl font-bold text-text-muted mt-[-16px]">:</span>
              <CountdownBox label="Hours" value={countdown.hours} />
              <span className="text-xl font-bold text-text-muted mt-[-16px]">:</span>
              <CountdownBox label="Mins" value={countdown.minutes} />
              <span className="text-xl font-bold text-text-muted mt-[-16px]">:</span>
              <CountdownBox label="Secs" value={countdown.seconds} />
            </div>

            {/* Match details */}
            <div className="flex items-center justify-center gap-4 text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {(() => {
                  const d = new Date(nextM.date + 'T00:00:00')
                  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
                })()}
              </span>
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                {nextM.time} IST
              </span>
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                {nextM.venue}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="rounded-xl border border-border-subtle bg-surface-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Season Progress</span>
          <span className="text-xs font-mono text-text-secondary">{completedCount} / {schedule.totalMatches} matches</span>
        </div>
        <div className="w-full h-2 rounded-full bg-surface-dark overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-lime transition-all duration-500"
            style={{ width: `${(completedCount / schedule.totalMatches) * 100}%` }}
          />
        </div>
      </div>

      {/* Team filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Filter</span>
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs bg-surface-card border border-border-subtle text-text-primary focus:outline-none focus:border-accent-cyan"
        >
          <option value="all">All Teams</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {teamFilter !== 'all' && (
          <span className="text-xs text-text-secondary">
            {filteredMatches.length} matches
          </span>
        )}
      </div>

      {/* Schedule table */}
      <div ref={scrollRef} className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-hover text-text-muted border-b border-border-subtle">
                <th className="text-center py-3 px-3 font-medium text-xs uppercase tracking-wider w-12">#</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider">Date</th>
                <th className="text-center py-3 px-3 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Day</th>
                <th className="text-center py-3 px-3 font-medium text-xs uppercase tracking-wider">Time</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider">Home</th>
                <th className="text-center py-3 px-2 font-medium text-xs uppercase tracking-wider w-8"></th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider">Away</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Venue</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches.map((m) => {
                const d = new Date(m.date + 'T00:00:00')
                const dayStr = DAYS[d.getDay()]
                const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]}`
                const isNext = nextM && m.match === nextM.match
                const isToday = m.date === new Date().toISOString().slice(0, 10)
                const isCompleted = m.status === 'completed'
                const isLive = m.status === 'live'

                let rowClass = 'border-b border-border-subtle/50 transition-colors'
                if (isLive) rowClass += ' bg-accent-magenta/5 border-l-2 border-l-accent-magenta'
                else if (isNext) rowClass += ' bg-accent-cyan/5 border-l-2 border-l-accent-cyan'
                else if (isToday) rowClass += ' bg-accent-amber/5 border-l-2 border-l-accent-amber'
                else if (isCompleted) rowClass += ' opacity-50'
                else rowClass += ' hover:bg-surface-hover/50'

                return (
                  <tr key={m.match} data-match={m.match} className={rowClass}>
                    <td className="text-center py-3 px-3 font-mono text-xs text-text-muted">{m.match}</td>
                    <td className="py-3 px-3 text-xs font-medium text-text-primary whitespace-nowrap">{dateStr}</td>
                    <td className="text-center py-3 px-3 text-xs text-text-secondary hidden sm:table-cell">{dayStr}</td>
                    <td className="text-center py-3 px-3 text-xs font-mono text-text-secondary whitespace-nowrap">
                      {m.time}
                      {isLive && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-[9px] font-bold text-accent-magenta">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-magenta animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <TeamLogo team={m.home} size={20} />
                        <span className="text-xs font-semibold text-text-primary hidden lg:inline">{m.home}</span>
                        <span className="text-xs font-semibold text-text-primary lg:hidden">{getTeamAbbr(m.home) || m.home}</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-2 text-[10px] font-bold text-text-muted">vs</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <TeamLogo team={m.away} size={20} />
                        <span className="text-xs font-semibold text-text-primary hidden lg:inline">{m.away}</span>
                        <span className="text-xs font-semibold text-text-primary lg:hidden">{getTeamAbbr(m.away) || m.away}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs text-text-secondary hidden md:table-cell">{m.venue}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── No API Key State ──────────────────────────────────────── */
function SetupGuide() {
  return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-accent-cyan/10 flex items-center justify-center mx-auto mb-6">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 text-accent-cyan">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-text-primary mb-3">Live Scores Setup</h2>
      <p className="text-sm text-text-secondary mb-6 leading-relaxed">
        To enable live cricket scores, you need a free API key from CricAPI.
      </p>
      <div className="text-left bg-surface-card rounded-xl border border-border-subtle p-5 space-y-4">
        <div className="flex gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-accent-cyan/20 text-accent-cyan text-xs font-bold flex items-center justify-center">1</span>
          <p className="text-sm text-text-secondary">
            Sign up at <span className="text-accent-cyan font-mono">cricapi.com</span> to get a free API key (100 requests/day)
          </p>
        </div>
        <div className="flex gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-accent-cyan/20 text-accent-cyan text-xs font-bold flex items-center justify-center">2</span>
          <p className="text-sm text-text-secondary">
            Add to your <span className="font-mono text-text-primary">backend/.env</span> file:
          </p>
        </div>
        <code className="block bg-surface-dark rounded-lg px-4 py-3 text-xs font-mono text-accent-lime">
          CRICAPI_KEY=your_api_key_here
        </code>
        <div className="flex gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-accent-cyan/20 text-accent-cyan text-xs font-bold flex items-center justify-center">3</span>
          <p className="text-sm text-text-secondary">
            Restart the backend server and refresh this page
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────────── */
export default function LiveScores() {
  const { data: status, loading: statusLoading } = useFetch(() => getLiveStatus(), [])
  const [tab, setTab] = useState('schedule') // 'schedule' | 'live'
  const [matches, setMatches] = useState([])
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [matchesError, setMatchesError] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef(null)

  const fetchMatches = useCallback(async () => {
    try {
      const data = await getLiveMatches()
      setMatches(data.matches || [])
      setMatchesError(null)
    } catch (err) {
      setMatchesError(err.message)
    } finally {
      setMatchesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!status?.available || tab !== 'live') return
    fetchMatches()
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchMatches, POLL_INTERVAL)
    }
    return () => clearInterval(intervalRef.current)
  }, [status?.available, autoRefresh, fetchMatches, tab])

  useEffect(() => {
    if (!selectedMatch && matches.length > 0) {
      const live = matches.find(m => m.matchStarted && !m.matchEnded)
      setSelectedMatch(live?.id || matches[0]?.id)
    }
  }, [matches, selectedMatch])

  if (statusLoading) return <Loading />

  const apiAvailable = status?.available

  return (
    <div className="min-h-screen">
      <SEO title="Live Scores | Crickrida" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-accent-magenta/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-accent-magenta">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
              </svg>
            </span>
            Live & Schedule
          </h1>
          <p className="text-xs text-text-muted mt-1">IPL 2026 schedule & real-time match updates</p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-surface-card rounded-lg border border-border-subtle p-1">
          <button
            onClick={() => setTab('schedule')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              tab === 'schedule'
                ? 'bg-accent-cyan/20 text-accent-cyan'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              Schedule
            </span>
          </button>
          <button
            onClick={() => setTab('live')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              tab === 'live'
                ? 'bg-accent-magenta/20 text-accent-magenta'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${tab === 'live' ? 'bg-accent-magenta animate-pulse' : 'bg-text-muted'}`} />
              Live Scores
            </span>
          </button>
        </div>
      </div>

      {/* Schedule Tab */}
      {tab === 'schedule' && <IPLScheduleView />}

      {/* Live Scores Tab */}
      {tab === 'live' && (
        <>
          {!apiAvailable ? (
            <SetupGuide />
          ) : (
            <>
              {/* Controls */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    autoRefresh
                      ? 'border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan'
                      : 'border-border-subtle bg-surface-card text-text-muted'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-accent-cyan animate-pulse' : 'bg-text-muted'}`} />
                  Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={() => { setMatchesLoading(true); fetchMatches() }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle bg-surface-card text-text-secondary hover:bg-surface-hover transition-all"
                >
                  Refresh
                </button>
                <span className="text-[10px] text-text-muted font-mono ml-auto">
                  Refreshes every 15 min
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 xl:col-span-3 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider">Matches</h2>
                    <span className="text-[10px] text-text-muted font-mono">
                      {matches.filter(m => m.matchStarted && !m.matchEnded).length} live
                    </span>
                  </div>

                  {matchesLoading ? (
                    <Loading />
                  ) : matchesError ? (
                    <div className="rounded-xl border border-accent-magenta/30 bg-accent-magenta/5 p-4">
                      <p className="text-sm text-accent-magenta">{matchesError}</p>
                      <button onClick={fetchMatches} className="mt-2 text-xs text-accent-cyan hover:underline">
                        Try again
                      </button>
                    </div>
                  ) : matches.length === 0 ? (
                    <div className="rounded-xl border border-border-subtle bg-surface-card p-8 text-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-text-muted mx-auto mb-3">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 12h8M12 8v8" strokeWidth="1" />
                      </svg>
                      <p className="text-sm text-text-secondary">No matches currently available</p>
                      <p className="text-xs text-text-muted mt-1">Check back during IPL match days</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1 scrollbar-thin">
                      {[...matches].sort((a, b) => {
                        const aLive = a.matchStarted && !a.matchEnded ? 0 : 1
                        const bLive = b.matchStarted && !b.matchEnded ? 0 : 1
                        if (aLive !== bLive) return aLive - bLive
                        const aUp = !a.matchStarted ? 0 : 1
                        const bUp = !b.matchStarted ? 0 : 1
                        return aUp - bUp
                      }).map(m => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          selected={selectedMatch === m.id}
                          onClick={() => setSelectedMatch(m.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-8 xl:col-span-9">
                  {selectedMatch ? (
                    <ScorecardView matchId={selectedMatch} />
                  ) : (
                    <div className="rounded-xl border border-border-subtle bg-surface-card p-12 text-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-text-muted mx-auto mb-4">
                        <rect x="2" y="3" width="20" height="18" rx="2" />
                        <path d="M8 7h8M8 11h5M8 15h7" />
                      </svg>
                      <p className="text-sm text-text-secondary">Select a match to view the scorecard</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
