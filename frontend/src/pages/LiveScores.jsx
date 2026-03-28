import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { getLiveStatus, getLiveMatches, getLiveScorecard, getIPLSchedule } from '../lib/api'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import Loading from '../components/ui/Loading'
import SEO from '../components/SEO'

const POLL_INTERVAL = 30_000
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtScore(s) {
  if (!s) return '—'
  if (typeof s.score === 'string' && s.score) return s.score
  const parts = []
  if (s.r !== undefined) parts.push(s.r)
  if (s.w !== undefined) parts.push(`/${s.w}`)
  if (s.o !== undefined) parts.push(` (${s.o})`)
  return parts.join('') || '—'
}

function playerLink(name) {
  if (!name) return '/batting'
  return `/players/${encodeURIComponent(name)}`
}

function teamLink(name) {
  if (!name) return '/teams'
  return `/teams/${encodeURIComponent(name)}`
}

function venueLink(name) {
  if (!name) return '/venues'
  return `/venues/${encodeURIComponent(name)}`
}

/* ── Countdown hook ─────────────────────────────────────────── */
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

/* ── Live Score Summary Card ──────────────────────────────────
   Shows: team logos, score, overs, wickets, current batsmen/bowler
*/
function LiveScoreHero({ match, onClick, isSelected }) {
  const isLive = match.matchStarted && !match.matchEnded
  const teams = match.teams || []
  const scores = match.score || []
  const teamInfo = match.teamInfo || []

  const getScoreForTeam = (teamIdx) => {
    const teamName = (teams[teamIdx] || '').toLowerCase()
    return scores[teamIdx] || scores.find(s => {
      const inn = (s.inning || '').toLowerCase()
      return inn === teamName || inn.includes(teamName.split(' ')[0])
    })
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border transition-all duration-300 overflow-hidden ${
        isSelected
          ? 'border-accent-cyan/40 shadow-xl shadow-accent-cyan/10 ring-1 ring-accent-cyan/20'
          : 'border-border-subtle hover:border-border-default hover:shadow-lg'
      }`}
    >
      {/* Status bar */}
      <div className={`px-4 py-2 flex items-center justify-between ${
        isLive ? 'bg-accent-magenta/10' : match.matchEnded ? 'bg-surface-hover' : 'bg-accent-amber/5'
      }`}>
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
        <span className="text-[10px] text-text-muted">{match.series}</span>
      </div>

      <div className="p-4 bg-surface-card space-y-3">
        {/* Team rows with scores */}
        {teams.map((team, i) => {
          const score = getScoreForTeam(i)
          const teamImg = teamInfo[i]?.img
          const teamColor = getTeamColor(team)
          return (
            <div key={i} className="flex items-center justify-between gap-3">
              <Link
                to={teamLink(team)}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-3 min-w-0 flex-1 group/team"
              >
                {teamImg ? (
                  <img src={teamImg} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-border-subtle" />
                ) : (
                  <TeamLogo team={team} size={32} />
                )}
                <div className="min-w-0">
                  <span className="text-sm font-bold text-text-primary block truncate group-hover/team:text-accent-cyan transition-colors">{team}</span>
                  <span className="text-[10px] text-text-muted">{getTeamAbbr(team)}</span>
                </div>
              </Link>
              <div className="text-right flex-shrink-0">
                {score ? (
                  <div>
                    <span className="text-lg font-mono font-black" style={{ color: teamColor }}>
                      {score.r !== undefined ? `${score.r}/${score.w}` : fmtScore(score)}
                    </span>
                    {score.o !== undefined && (
                      <span className="text-xs text-text-muted ml-1.5">({score.o} ov)</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-text-muted">—</span>
                )}
              </div>
            </div>
          )
        })}

        {/* Match status */}
        {match.status && (
          <p className={`text-xs font-semibold text-center pt-2 border-t border-border-subtle/50 ${
            isLive ? 'text-accent-lime' : match.matchEnded ? 'text-accent-cyan' : 'text-text-secondary'
          }`}>
            {match.status}
          </p>
        )}

        {/* Current players (if available from scorecard) */}
        {match.currentBatsmen && match.currentBatsmen.length > 0 && (
          <div className="pt-2 border-t border-border-subtle/50 space-y-1">
            <p className="text-[9px] uppercase tracking-widest text-text-muted font-bold">At the crease</p>
            <div className="flex gap-3">
              {match.currentBatsmen.map((b, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-lime" />
                  <span className="text-text-primary font-medium">{b.name}</span>
                  <span className="text-text-muted font-mono">{b.runs}({b.balls})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </button>
  )
}


/* ── Detailed Scorecard View ──────────────────────────────────
   Two-section layout:
   1. Match summary hero (scores, toss, venue)
   2. Full batting/bowling tables per innings
*/
function DetailedScorecard({ matchId }) {
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
  if (error) return <div className="text-accent-magenta text-sm p-4 rounded-xl border border-accent-magenta/20 bg-accent-magenta/5">{error}</div>
  if (!scorecard) return null

  const isLive = scorecard.matchStarted && !scorecard.matchEnded
  const teams = scorecard.teams || []
  const teamInfo = scorecard.teamInfo || []

  return (
    <div className="space-y-5">
      {/* Match Summary Hero */}
      <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
        {/* Header band */}
        <div className={`px-5 py-3 flex items-center justify-between ${
          isLive ? 'bg-gradient-to-r from-accent-magenta/10 to-accent-cyan/5' : 'bg-surface-hover'
        }`}>
          <div className="flex items-center gap-3">
            {isLive && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-magenta/20 text-accent-magenta text-[10px] font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-accent-magenta animate-pulse" />
                Live
              </span>
            )}
            <span className="text-xs text-text-muted">{scorecard.series || 'IPL 2026'}</span>
          </div>
          <span className="text-[10px] text-text-muted">
            {scorecard.date && (() => {
              const d = new Date(scorecard.date + 'T00:00:00')
              return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
            })()}
          </span>
        </div>

        <div className="p-4 sm:p-5">
          {/* Teams & Scores */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 mb-4">
            {teams.map((team, i) => {
              const score = (scorecard.score || [])[i] || (scorecard.score || []).find(s => {
                const inn = (s.inning || '').toLowerCase()
                return inn === team.toLowerCase() || inn.includes(team.toLowerCase().split(' ')[0])
              })
              const img = teamInfo[i]?.img
              const color = getTeamColor(team)
              return (
                <div key={i} className={`flex-1 min-w-0 ${i === 1 ? 'text-right' : 'text-left'}`}>
                  <Link to={teamLink(team)} className={`flex items-center gap-2 sm:gap-3 ${i === 1 ? 'flex-row-reverse' : ''} mb-2 group`}>
                    {img ? (
                      <img src={img} alt="" className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover border border-border-subtle flex-shrink-0" />
                    ) : (
                      <TeamLogo team={team} size={40} />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-bold text-text-primary group-hover:text-accent-cyan transition-colors">{getTeamAbbr(team)}</p>
                      <p className="text-[10px] text-text-muted truncate hidden sm:block">{team}</p>
                    </div>
                  </Link>
                  {score ? (
                    <div className={i === 1 ? 'text-right' : 'text-left'}>
                      <span className="text-2xl sm:text-3xl font-mono font-black" style={{ color }}>
                        {score.r !== undefined ? score.r : ''}
                        <span className="text-base sm:text-lg text-text-muted">/{score.w !== undefined ? score.w : ''}</span>
                      </span>
                      {score.o !== undefined && (
                        <span className="text-xs sm:text-sm text-text-secondary ml-1 sm:ml-2">({score.o} ov)</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xl font-mono text-text-muted">—</span>
                  )}
                </div>
              )
            })}
            {teams.length === 2 && (
              <div className="flex-shrink-0 px-1 sm:px-3">
                <span className="text-xs sm:text-sm font-black text-text-muted">VS</span>
              </div>
            )}
          </div>

          {/* Match info row */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[11px] sm:text-xs text-text-secondary border-t border-border-subtle/50 pt-3">
            {scorecard.venue && (
              <Link to={venueLink(scorecard.venue)} className="flex items-center gap-1.5 hover:text-accent-cyan transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-accent-cyan">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                {scorecard.venue}
              </Link>
            )}
            {scorecard.tossWinner && (
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-accent-amber">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
                </svg>
                Toss: <span className="text-text-primary font-semibold">{scorecard.tossWinner}</span> — {scorecard.tossChoice}
              </span>
            )}
          </div>

          {/* Status */}
          <p className={`mt-3 text-xs sm:text-sm font-bold text-center ${
            isLive ? 'text-accent-lime' : scorecard.matchEnded ? 'text-accent-cyan' : 'text-text-secondary'
          }`}>
            {scorecard.status}
          </p>
        </div>
      </div>

      {/* Innings cards */}
      {(scorecard.scorecard || []).map((inn, idx) => (
        <InningsCard key={idx} innings={inn} index={idx} isLive={isLive} />
      ))}

      {/* Active players info (from the batting side of the current innings) */}
      {isLive && scorecard.scorecard && scorecard.scorecard.length > 0 && (
        <ActivePlayersSection scorecard={scorecard} />
      )}
    </div>
  )
}


/* ── Single Innings Card (Batting + Bowling side-by-side) ───── */
function InningsCard({ innings, index, isLive }) {
  const batsmen = innings.batsmen || innings.batting || []
  const bowlers = innings.bowlers || innings.bowling || []

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
      {/* Innings header */}
      <div className="px-4 py-2.5 bg-surface-hover border-b border-border-subtle flex items-center justify-between">
        <h3 className="text-xs font-bold text-text-primary tracking-wide uppercase flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-accent-cyan/20 text-accent-cyan text-[10px] font-black flex items-center justify-center">
            {index + 1}
          </span>
          {innings.inning || `Innings ${index + 1}`}
        </h3>
        {isLive && index === (innings.scoreboard === 'S2' ? 1 : 0) && (
          <span className="text-[9px] uppercase tracking-widest text-accent-magenta font-bold">Current</span>
        )}
      </div>

      {/* Side-by-side: Batting (left) + Bowling (right) — stacks on small screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border-subtle">
        {/* Batting */}
        {batsmen.length > 0 && (
          <div className="overflow-x-auto">
            <div className="px-3 py-1.5 bg-surface-dark/30 border-b border-border-subtle">
              <span className="text-[10px] uppercase tracking-wider text-accent-cyan font-bold">Batting</span>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-text-muted border-b border-border-subtle">
                  <th className="text-left py-1.5 px-3 font-medium">Batter</th>
                  <th className="text-center py-1.5 px-1 font-medium">R</th>
                  <th className="text-center py-1.5 px-1 font-medium">B</th>
                  <th className="text-center py-1.5 px-1 font-medium">4s</th>
                  <th className="text-center py-1.5 px-1 font-medium">6s</th>
                  <th className="text-center py-1.5 px-1 font-medium">SR</th>
                </tr>
              </thead>
              <tbody>
                {batsmen.map((b, bi) => {
                  const name = b.name || b.batsman?.name || b.batsman || ''
                  const displayName = b.fullName || name
                  const runs = b.runs ?? b.r ?? 0
                  const balls = b.balls ?? b.b ?? 0
                  const fours = b.fours ?? b['4s'] ?? 0
                  const sixes = b.sixes ?? b['6s'] ?? 0
                  const sr = b.sr ?? (balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0')
                  const dismissal = b.dismissal || ''
                  const isNotOut = dismissal.toLowerCase().includes('not out') || dismissal === ''

                  return (
                    <tr key={bi} className={`border-b border-border-subtle/30 hover:bg-surface-hover/50 ${
                      isNotOut && isLive ? 'bg-accent-lime/5' : ''
                    }`}>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isNotOut && isLive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-lime animate-pulse flex-shrink-0" />
                          )}
                          <Link
                            to={playerLink(name)}
                            className="text-text-primary font-semibold hover:text-accent-cyan transition-colors truncate"
                            title={dismissal || 'not out'}
                          >
                            {displayName}
                          </Link>
                        </div>
                      </td>
                      <td className={`text-center py-1.5 px-1 font-mono font-bold ${
                        runs >= 50 ? 'text-accent-lime' : runs >= 30 ? 'text-accent-cyan' : 'text-text-primary'
                      }`}>{runs}</td>
                      <td className="text-center py-1.5 px-1 font-mono text-text-muted">{balls}</td>
                      <td className="text-center py-1.5 px-1 font-mono text-accent-cyan">{fours}</td>
                      <td className="text-center py-1.5 px-1 font-mono text-accent-lime">{sixes}</td>
                      <td className="text-center py-1.5 px-1 font-mono text-text-muted">{sr}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bowling */}
        {bowlers.length > 0 && (
          <div className="overflow-x-auto">
            <div className="px-3 py-1.5 bg-surface-dark/30 border-b border-border-subtle">
              <span className="text-[10px] uppercase tracking-wider text-accent-magenta font-bold">Bowling</span>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-text-muted border-b border-border-subtle">
                  <th className="text-left py-1.5 px-3 font-medium">Bowler</th>
                  <th className="text-center py-1.5 px-1 font-medium">O</th>
                  <th className="text-center py-1.5 px-1 font-medium">M</th>
                  <th className="text-center py-1.5 px-1 font-medium">R</th>
                  <th className="text-center py-1.5 px-1 font-medium">W</th>
                  <th className="text-center py-1.5 px-1 font-medium">Eco</th>
                </tr>
              </thead>
              <tbody>
                {bowlers.map((bw, bwi) => {
                  const name = bw.name || bw.bowler?.name || bw.bowler || ''
                  const displayName = bw.fullName || name
                  const overs = bw.overs ?? bw.o ?? 0
                  const maidens = bw.maidens ?? bw.m ?? 0
                  const runs = bw.runs ?? bw.r ?? 0
                  const wickets = bw.wickets ?? bw.w ?? 0
                  const econ = bw.economy ?? bw.eco ?? (overs > 0 ? (runs / overs).toFixed(1) : '0.0')

                  return (
                    <tr key={bwi} className="border-b border-border-subtle/30 hover:bg-surface-hover/50">
                      <td className="py-1.5 px-3">
                        <Link
                          to={playerLink(name)}
                          className="text-text-primary font-semibold hover:text-accent-cyan transition-colors truncate block"
                        >
                          {displayName}
                        </Link>
                      </td>
                      <td className="text-center py-1.5 px-1 font-mono text-text-muted">{overs}</td>
                      <td className="text-center py-1.5 px-1 font-mono text-text-muted">{maidens}</td>
                      <td className="text-center py-1.5 px-1 font-mono text-text-primary">{runs}</td>
                      <td className={`text-center py-1.5 px-1 font-mono font-bold ${
                        wickets >= 3 ? 'text-accent-magenta' : wickets >= 1 ? 'text-accent-cyan' : 'text-text-primary'
                      }`}>{wickets}</td>
                      <td className={`text-center py-1.5 px-1 font-mono ${
                        econ <= 6 ? 'text-accent-lime' : econ >= 10 ? 'text-accent-magenta' : 'text-text-muted'
                      }`}>{econ}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


/* ── Active Players Section ──────────────────────────────────── */
function ActivePlayersSection({ scorecard }) {
  const lastInnings = scorecard.scorecard[scorecard.scorecard.length - 1]
  const batsmen = (lastInnings?.batsmen || lastInnings?.batting || [])
    .filter(b => {
      const d = (b.dismissal || '').toLowerCase()
      return d.includes('not out') || d === ''
    })

  const bowlers = (lastInnings?.bowlers || lastInnings?.bowling || []).slice(-1)

  const activePlayers = [
    ...batsmen.slice(0, 2).map(b => ({ ...b, role: 'Batting', name: b.name || b.batsman?.name || b.batsman || '', fullName: b.fullName || '' })),
    ...bowlers.map(bw => ({ ...bw, role: 'Bowling', name: bw.name || bw.bowler?.name || bw.bowler || '', fullName: bw.fullName || '' })),
  ]

  if (activePlayers.length === 0) return null

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
      <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-accent-lime animate-pulse" />
        Active Players
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {activePlayers.map((p, i) => (
          <Link
            key={i}
            to={playerLink(p.name)}
            className="flex items-center gap-3 p-3 rounded-xl bg-surface-dark hover:bg-surface-hover border border-border-subtle/50 transition-all group"
          >
            <PlayerAvatar name={p.fullName || p.name} size={40} showBorder />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text-primary truncate group-hover:text-accent-cyan transition-colors">
                {p.fullName || p.name}
              </p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider">{p.role}</p>
              <div className="flex gap-2 mt-0.5">
                {p.role === 'Batting' ? (
                  <>
                    <span className="text-xs font-mono text-accent-cyan">{p.runs ?? p.r ?? 0}({p.balls ?? p.b ?? 0})</span>
                    <span className="text-[10px] text-text-muted">
                      4s: {p.fours ?? p['4s'] ?? 0} · 6s: {p.sixes ?? p['6s'] ?? 0}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-mono text-accent-magenta">{p.wickets ?? p.w ?? 0}/{p.runs ?? p.r ?? 0}</span>
                    <span className="text-[10px] text-text-muted">
                      {p.overs ?? p.o ?? 0} ov · Econ {p.economy ?? p.eco ?? '—'}
                    </span>
                  </>
                )}
              </div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-text-muted group-hover:text-accent-cyan transition-colors flex-shrink-0">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}


/* ── IPL Schedule Tab ─────────────────────────────────────────── */
function IPLScheduleView() {
  const { data: schedule, loading, error } = useFetch(() => getIPLSchedule(), [])
  const [teamFilter, setTeamFilter] = useState('all')
  const scrollRef = useRef(null)
  const countdown = useCountdown(schedule?.nextMatch?.dateTimeGMT)

  const teams = useMemo(() => {
    if (!schedule?.matches) return []
    const s = new Set()
    schedule.matches.forEach(m => { s.add(m.home); s.add(m.away) })
    return [...s].sort()
  }, [schedule])

  const filteredMatches = useMemo(() => {
    if (!schedule?.matches) return []
    if (teamFilter === 'all') return schedule.matches
    return schedule.matches.filter(m => m.home === teamFilter || m.away === teamFilter)
  }, [schedule, teamFilter])

  useEffect(() => {
    if (!schedule?.nextMatch || !scrollRef.current) return
    const el = scrollRef.current.querySelector(`[data-match="${schedule.nextMatch.match}"]`)
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
  }, [schedule])

  if (loading) return <Loading />
  if (error) return <div className="text-accent-magenta text-sm p-4">{error}</div>
  if (!schedule) return null

  const nextM = schedule.nextMatch
  const completedCount = schedule.matches.filter(m => m.status === 'completed').length

  return (
    <div className="space-y-6">
      {nextM && countdown && (
        <div className="rounded-2xl border border-accent-cyan/20 bg-gradient-to-br from-accent-cyan/5 via-surface-card to-accent-magenta/5 p-6 sm:p-8">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent-cyan font-bold mb-4">Next Match</p>
            <div className="flex items-center justify-center gap-4 sm:gap-8 mb-6">
              <div className="flex flex-col items-center gap-2">
                <TeamLogo team={nextM.home} size={48} />
                <span className="text-sm sm:text-base font-bold text-text-primary">{getTeamAbbr(nextM.home)}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-black text-text-muted">VS</span>
                <span className="text-[10px] text-text-muted mt-1">Match #{nextM.match}</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <TeamLogo team={nextM.away} size={48} />
                <span className="text-sm sm:text-base font-bold text-text-primary">{getTeamAbbr(nextM.away)}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 sm:gap-5 mb-4">
              <CountdownBox label="Days" value={countdown.days} />
              <span className="text-xl font-bold text-text-muted mt-[-16px]">:</span>
              <CountdownBox label="Hours" value={countdown.hours} />
              <span className="text-xl font-bold text-text-muted mt-[-16px]">:</span>
              <CountdownBox label="Mins" value={countdown.minutes} />
              <span className="text-xl font-bold text-text-muted mt-[-16px]">:</span>
              <CountdownBox label="Secs" value={countdown.seconds} />
            </div>
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
          className="px-3 py-1.5 rounded-lg text-xs border border-border-subtle text-text-primary focus:outline-none focus:border-accent-cyan appearance-none pr-8"
          style={{
            backgroundColor: '#111118',
            color: '#e2e8f0',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2300E5FF' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
          }}
        >
          <option value="all" style={{ backgroundColor: '#111118', color: '#e2e8f0' }}>All Teams</option>
          {teams.map(t => <option key={t} value={t} style={{ backgroundColor: '#111118', color: '#e2e8f0' }}>{t}</option>)}
        </select>
        {teamFilter !== 'all' && <span className="text-xs text-text-secondary">{filteredMatches.length} matches</span>}
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
                        <span className="text-xs font-semibold text-text-primary lg:hidden">{getTeamAbbr(m.home)}</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-2 text-[10px] font-bold text-text-muted">vs</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <TeamLogo team={m.away} size={20} />
                        <span className="text-xs font-semibold text-text-primary hidden lg:inline">{m.away}</span>
                        <span className="text-xs font-semibold text-text-primary lg:hidden">{getTeamAbbr(m.away)}</span>
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
        To enable live cricket scores, configure your cricket API provider in the backend.
      </p>
      <div className="text-left bg-surface-card rounded-xl border border-border-subtle p-5 space-y-4">
        <div className="flex gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-accent-cyan/20 text-accent-cyan text-xs font-bold flex items-center justify-center">1</span>
          <p className="text-sm text-text-secondary">Get an API token from <span className="text-accent-cyan font-mono">sportmonks.com</span></p>
        </div>
        <div className="flex gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-accent-cyan/20 text-accent-cyan text-xs font-bold flex items-center justify-center">2</span>
          <p className="text-sm text-text-secondary">Add to <span className="font-mono text-text-primary">backend/.env</span>:</p>
        </div>
        <code className="block bg-surface-dark rounded-lg px-4 py-3 text-xs font-mono text-accent-lime whitespace-pre-line">
          {`CRICKET_API_PROVIDER=sportmonks\nSPORTMONKS_API_TOKEN=your_token_here`}
        </code>
        <div className="flex gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-accent-cyan/20 text-accent-cyan text-xs font-bold flex items-center justify-center">3</span>
          <p className="text-sm text-text-secondary">Restart the backend — scores will auto-poll during IPL match windows</p>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────────── */
export default function LiveScores() {
  const { data: status, loading: statusLoading } = useFetch(() => getLiveStatus(), [])
  const [tab, setTab] = useState('live')
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
    if (tab !== 'live') return
    fetchMatches()
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchMatches, POLL_INTERVAL)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh, fetchMatches, tab])

  useEffect(() => {
    if (!selectedMatch && matches.length > 0) {
      const live = matches.find(m => m.matchStarted && !m.matchEnded)
      setSelectedMatch(live?.id || matches[0]?.id)
    }
  }, [matches, selectedMatch])

  if (statusLoading) return <Loading />

  const apiAvailable = status?.available
  const liveCount = matches.filter(m => m.matchStarted && !m.matchEnded).length

  const sortedMatches = [...matches].sort((a, b) => {
    const aLive = a.matchStarted && !a.matchEnded ? 0 : 1
    const bLive = b.matchStarted && !b.matchEnded ? 0 : 1
    if (aLive !== bLive) return aLive - bLive
    const aUp = !a.matchStarted ? 0 : 1
    const bUp = !b.matchStarted ? 0 : 1
    return aUp - bUp
  })

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
            IPL 2026
          </h1>
          <p className="text-xs text-text-muted mt-1">Live scores, schedules & real-time match updates</p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-surface-card rounded-lg border border-border-subtle p-1">
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
              {liveCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent-magenta/30 text-accent-magenta text-[9px] font-bold">
                  {liveCount}
                </span>
              )}
            </span>
          </button>
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
        </div>
      </div>

      {/* Live Scores Tab */}
      {tab === 'live' && (
        <>
          {!apiAvailable && matches.length === 0 ? (
            <SetupGuide />
          ) : (
            <>
              {/* Controls */}
              <div className="flex items-center gap-3 mb-5">
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
                  Auto-refreshes every 30s
                </span>
              </div>

              {matchesLoading ? (
                <Loading />
              ) : matchesError ? (
                <div className="rounded-xl border border-accent-magenta/30 bg-accent-magenta/5 p-4">
                  <p className="text-sm text-accent-magenta">{matchesError}</p>
                  <button onClick={fetchMatches} className="mt-2 text-xs text-accent-cyan hover:underline">Try again</button>
                </div>
              ) : matches.length === 0 ? (
                <div className="rounded-xl border border-border-subtle bg-surface-card p-8 text-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-text-muted mx-auto mb-3">
                    <circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" strokeWidth="1" />
                  </svg>
                  <p className="text-sm text-text-secondary">No matches currently available</p>
                  <p className="text-xs text-text-muted mt-1">Check back during IPL match days</p>
                </div>
              ) : (
                <>
                  {/* Mobile: compact match switcher (horizontal scroll) */}
                  <div className="lg:hidden mb-4">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                      {sortedMatches.map(m => {
                        const mLive = m.matchStarted && !m.matchEnded
                        const sel = selectedMatch === m.id
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelectedMatch(m.id)}
                            className={`flex-shrink-0 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                              sel
                                ? 'border-accent-cyan bg-accent-cyan/10 text-accent-cyan'
                                : 'border-border-subtle bg-surface-card text-text-secondary'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {mLive && <span className="w-1.5 h-1.5 rounded-full bg-accent-magenta animate-pulse" />}
                              <span>{getTeamAbbr(m.teams?.[0] || '')} vs {getTeamAbbr(m.teams?.[1] || '')}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Scorecard first on mobile (order-1 on mobile, order-2 on lg) */}
                    <div className="lg:col-span-8 xl:col-span-9 order-1 lg:order-2">
                      {selectedMatch ? (
                        <DetailedScorecard matchId={selectedMatch} />
                      ) : (
                        <div className="rounded-2xl border border-border-subtle bg-surface-card p-12 text-center">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-text-muted mx-auto mb-4">
                            <rect x="2" y="3" width="20" height="18" rx="2" /><path d="M8 7h8M8 11h5M8 15h7" />
                          </svg>
                          <p className="text-sm text-text-secondary">Select a match to view the scorecard</p>
                        </div>
                      )}
                    </div>

                    {/* Match list sidebar — hidden on mobile, visible on lg+ */}
                    <div className="hidden lg:block lg:col-span-4 xl:col-span-3 order-2 lg:order-1 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider">Matches</h2>
                        <span className="text-[10px] text-text-muted font-mono">
                          {liveCount} live · {matches.length} total
                        </span>
                      </div>
                      <div className="space-y-3 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1 scrollbar-thin">
                        {sortedMatches.map(m => (
                          <LiveScoreHero
                            key={m.id}
                            match={m}
                            isSelected={selectedMatch === m.id}
                            onClick={() => setSelectedMatch(m.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Schedule Tab */}
      {tab === 'schedule' && <IPLScheduleView />}
    </div>
  )
}
