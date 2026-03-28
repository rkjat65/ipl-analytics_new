import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useFetch } from '../hooks/useFetch'
import {
  getLiveStatus, getLiveMatches, getLiveScorecard, getIPLSchedule,
  getLiveMatchup, getLiveProjectedScore, getLiveVenueInsights,
  getLivePlayerForm, getLivePhaseAnalysis, getLiveTeamH2H,
} from '../lib/api'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import Loading from '../components/ui/Loading'
import SEO from '../components/SEO'

const POLL_INTERVAL = 3_000
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
    const teamFirst = teamName.split(' ')[0]
    return scores.find(s => {
      const t = (s.team || s.inning || '').toLowerCase()
      return t === teamName || t.startsWith(teamName) || t.includes(teamFirst)
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
                  <img src={teamImg} alt={`${team} team logo`} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-border-subtle" />
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
function DetailedScorecard({ matchId, onScorecardUpdate, mobileAnalyticsSlot }) {
  const [scorecard, setScorecard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const data = await getLiveScorecard(matchId)
      setScorecard(data)
      if (onScorecardUpdate) onScorecardUpdate(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [matchId, onScorecardUpdate])

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
  const rawTeams = scorecard.teams || []
  const rawTeamInfo = scorecard.teamInfo || []

  const firstInnings = (scorecard.scorecard || [])[0]
  const battingTeamName = firstInnings?.inning || ''
  const battingIdx = rawTeams.findIndex(t =>
    t.toLowerCase() === battingTeamName.toLowerCase() ||
    battingTeamName.toLowerCase().includes(t.toLowerCase().split(' ')[0])
  )
  const teams = battingIdx > 0
    ? [rawTeams[battingIdx], ...rawTeams.filter((_, i) => i !== battingIdx)]
    : rawTeams
  const teamInfo = battingIdx > 0
    ? [rawTeamInfo[battingIdx], ...rawTeamInfo.filter((_, i) => i !== battingIdx)]
    : rawTeamInfo

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
              const scoreArr = scorecard.score || []
              const teamLower = team.toLowerCase()
              const teamFirst = teamLower.split(' ')[0]
              const score = scoreArr.find(s => {
                const t = (s.team || s.inning || '').toLowerCase()
                return t === teamLower || t.startsWith(teamLower) || t.includes(teamFirst)
              })
              const img = teamInfo[i]?.img
              const color = getTeamColor(team)
              return (
                <React.Fragment key={i}>
                  {i === 1 && teams.length === 2 && (
                    <div className="flex-shrink-0 px-1 sm:px-3 self-center">
                      <span className="text-xs sm:text-sm font-black text-text-muted">VS</span>
                    </div>
                  )}
                  <div className={`flex-1 min-w-0 ${i === 1 ? 'text-right' : 'text-left'}`}>
                    <Link to={teamLink(team)} className={`flex items-center gap-2 sm:gap-3 ${i === 1 ? 'flex-row-reverse' : ''} mb-2 group`}>
                      {img ? (
                        <img src={img} alt={`${team} team logo`} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover border border-border-subtle flex-shrink-0" />
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
                    ) : scoreArr.length > 0 ? (
                      <span className="text-xs font-medium text-text-muted italic">Yet to bat</span>
                    ) : (
                      <span className="text-xl font-mono text-text-muted">—</span>
                    )}
                  </div>
                </React.Fragment>
              )
            })}
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

      {/* Mobile-only: analytics right below live score */}
      {mobileAnalyticsSlot && (
        <div className="xl:hidden">{mobileAnalyticsSlot}</div>
      )}

      {/* Innings cards */}
      {(scorecard.scorecard || []).map((inn, idx, arr) => (
        <InningsCard key={idx} innings={inn} index={idx} isLive={isLive} isCurrentInnings={idx === arr.length - 1} />
      ))}

      {/* Active players info (from the batting side of the current innings) */}
      {isLive && scorecard.scorecard && scorecard.scorecard.length > 0 && (
        <ActivePlayersSection scorecard={scorecard} />
      )}
    </div>
  )
}


/* ── Single Innings Card (Batting + Bowling side-by-side) ───── */
function InningsCard({ innings, index, isLive, isCurrentInnings }) {
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
        {isLive && isCurrentInnings && (
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
  const allBatsmen = lastInnings?.batsmen || lastInnings?.batting || []
  const notOutBatsmen = allBatsmen.filter(b => {
    const d = (b.dismissal || '').toLowerCase()
    return d.includes('not out') || d === ''
  })

  const striker = notOutBatsmen.find(b => b.active) || notOutBatsmen[notOutBatsmen.length - 1]
  const nonStriker = notOutBatsmen.find(b => b !== striker)
  const battingPair = [striker, nonStriker].filter(Boolean)

  const allBowlers = lastInnings?.bowlers || lastInnings?.bowling || []
  const activeBowler = allBowlers.find(b => b.active) || allBowlers[allBowlers.length - 1]

  const activePlayers = [
    ...battingPair.map(b => ({
      ...b,
      role: b.active ? 'Batting' : 'Batting',
      isStriker: !!b.active,
      name: b.name || b.batsman?.name || b.batsman || '',
      fullName: b.fullName || '',
    })),
    ...(activeBowler ? [{
      ...activeBowler,
      role: 'Bowling',
      name: activeBowler.name || activeBowler.bowler?.name || activeBowler.bowler || '',
      fullName: activeBowler.fullName || '',
    }] : []),
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
              <p className="text-[10px] text-text-muted uppercase tracking-wider">
                {p.role}{p.isStriker ? ' *' : ''}
              </p>
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


/* ── Analytics Tooltip ────────────────────────────────────────── */
function AnalyticsTooltip({ active, payload, label, extra }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 shadow-lg">
      <p className="text-text-secondary text-xs font-mono mb-1">{extra || label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: <span className="font-mono font-semibold">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

/* ── Skeleton Loader ─────────────────────────────────────────── */
function AnalyticsSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      <div className="h-4 bg-surface-hover rounded w-1/3" />
      <div className="h-24 bg-surface-hover rounded" />
      <div className="h-4 bg-surface-hover rounded w-1/2" />
    </div>
  )
}

/* ── Card 1: Batsman vs Bowler Matchup (Content Studio style) ── */
const MATCHUP_STAT_COLORS = [
  { bg: 'bg-[#0D1A1A]', border: 'border-[#22D3EE25]', text: 'text-[#22D3EE]' },
  { bg: 'bg-[#1A1508]', border: 'border-[#FFB80025]', text: 'text-[#FFB800]' },
  { bg: 'bg-[#0D1A12]', border: 'border-[#B8FF0025]', text: 'text-[#B8FF00]' },
  { bg: 'bg-[#120D1F]', border: 'border-[#8B5CF625]', text: 'text-[#8B5CF6]' },
  { bg: 'bg-[#0D1B2A]', border: 'border-[#00E5FF25]', text: 'text-[#00E5FF]' },
  { bg: 'bg-[#1A0D1F]', border: 'border-[#FF2D7825]', text: 'text-[#FF2D78]' },
]

function MatchupRivalryCard({ batters, bowler }) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bowler || batters.length === 0) { setLoading(false); return }
    setLoading(true)
    Promise.all(
      batters.map(b => getLiveMatchup(b, bowler).catch(() => ({ batter: b, bowler, found: false })))
    ).then(results => {
      const map = {}
      results.forEach(r => { map[r.batter] = r })
      setData(map)
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batters.join(','), bowler])

  if (loading) return <AnalyticsSkeleton />

  const entries = batters.map(b => data[b] || { batter: b, bowler, found: false })

  return (
    <div className="space-y-5">
      {entries.map(m => {
        if (!m.found) {
          return (
            <div key={m.batter} className="rounded-xl overflow-hidden bg-[#0A0A0F] border border-border-subtle">
              <div className="h-1 bg-gradient-to-r from-[#FFB800]/30 to-[#00E5FF]/30" />
              <div className="flex items-center justify-center gap-3 sm:gap-5 px-4 pt-5 pb-3">
                <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                  <PlayerAvatar name={m.batter} size={48} showBorder />
                  <span className="text-[9px] uppercase tracking-[0.15em] text-[#FFB800]/60 font-bold">Batsman</span>
                  <p className="text-sm font-bold text-text-primary text-center truncate w-full">{m.batter}</p>
                </div>
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-[#FFB80015] to-[#00E5FF15] border border-[#FFB80030] flex-shrink-0">
                  <span className="text-[10px] font-black text-text-muted">VS</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                  <PlayerAvatar name={m.bowler} size={48} showBorder />
                  <span className="text-[9px] uppercase tracking-[0.15em] text-[#00E5FF]/60 font-bold">Bowler</span>
                  <p className="text-sm font-bold text-text-primary text-center truncate w-full">{m.bowler}</p>
                </div>
              </div>
              <div className="text-center pb-5 text-text-muted text-xs">No IPL history between these players</div>
            </div>
          )
        }

        const statsGrid = [
          { label: 'BALLS', value: m.balls || 0 },
          { label: 'SR', value: m.sr || 0 },
          { label: '4s', value: m.fours || 0 },
          { label: '6s', value: m.sixes || 0 },
          { label: 'DOTS', value: m.dots || 0 },
          { label: 'OUTS', value: m.dismissals || 0 },
        ]
        return (
          <div key={m.batter} className="rounded-xl overflow-hidden bg-[#0A0A0F] border border-border-subtle">
            <div className="h-1 bg-gradient-to-r from-[#FFB800] to-[#00E5FF]" />

            <div className="flex items-center justify-center gap-3 sm:gap-5 px-4 pt-5 pb-3">
              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <PlayerAvatar name={m.batter} size={56} showBorder />
                <span className="text-[9px] uppercase tracking-[0.15em] text-[#FFB800] font-bold">Batsman</span>
                <p className="text-sm font-bold text-text-primary text-center truncate w-full">{m.batter}</p>
              </div>

              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#FFB80025] to-[#00E5FF25] border border-[#FFB80050] flex-shrink-0">
                <span className="text-xs font-black text-[#FFB800]">VS</span>
              </div>

              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <PlayerAvatar name={m.bowler} size={56} showBorder />
                <span className="text-[9px] uppercase tracking-[0.15em] text-[#00E5FF] font-bold">Bowler</span>
                <p className="text-sm font-bold text-text-primary text-center truncate w-full">{m.bowler}</p>
              </div>
            </div>

            <div className="text-center py-3 mx-4 rounded-full bg-gradient-to-r from-[#FFB80008] to-[#00E5FF08] border border-[#FFB80015]">
              <p className="text-[10px] uppercase tracking-[0.1em] text-[#FFB800] font-semibold mb-0.5">Runs Scored</p>
              <p className="text-4xl font-black text-text-primary font-mono leading-none">{m.runs || 0}</p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-4">
              {statsGrid.map((s, i) => {
                const c = MATCHUP_STAT_COLORS[i % MATCHUP_STAT_COLORS.length]
                return (
                  <div key={i} className={`${c.bg} border ${c.border} rounded-xl py-3 px-2 text-center`}>
                    <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1.5">{s.label}</p>
                    <p className={`text-xl sm:text-2xl font-black font-mono ${c.text}`}>{s.value}</p>
                  </div>
                )
              })}
            </div>

            {m.dismissal_kinds && m.dismissal_kinds.length > 0 && (
              <div className="px-4 pb-3 flex gap-2 flex-wrap">
                {m.dismissal_kinds.map((dk, i) => (
                  <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-accent-magenta/10 text-accent-magenta border border-accent-magenta/20">
                    {dk.dismissal_kind} x{dk.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Card 2: Projected Score ─────────────────────────────────── */
function ProjectedScoreCard({ venue, currentScore, currentOvers, currentWickets, inningsNumber, target }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venue || currentOvers <= 0) { setLoading(false); return }
    setLoading(true)
    getLiveProjectedScore({
      venue, current_score: currentScore, current_overs: currentOvers,
      current_wickets: currentWickets, innings_number: inningsNumber,
      target: target || undefined,
    }).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [venue, currentScore, currentOvers, currentWickets, inningsNumber, target])

  if (loading) return <AnalyticsSkeleton />
  if (!data) return <div className="text-center py-6 text-text-muted text-xs">No venue data available</div>

  const projectionBars = [
    { name: 'Conservative', score: data.projected_conservative, fill: '#4cc9f0' },
    { name: 'Current RR', score: data.projected_current_rr, fill: '#06d6a0' },
    { name: 'Accelerated', score: data.projected_accelerated, fill: '#f72585' },
  ].filter(b => b.score)

  if (data.venue_avg_1st || data.venue_avg_2nd) {
    projectionBars.unshift({
      name: `Venue Avg ${inningsNumber === 1 ? '1st' : '2nd'}`,
      score: inningsNumber === 1 ? data.venue_avg_1st : data.venue_avg_2nd,
      fill: '#8d99ae',
    })
  }
  if (data.par_score_at_over) {
    projectionBars.push({ name: 'Par Score', score: data.par_score_at_over, fill: '#ffd166' })
  }

  const overAvg = data.over_by_over_avg || []
  const currentOverInt = Math.floor(currentOvers)
  let cumAvg = 0
  const cumulativeAvg = overAvg.map(o => {
    cumAvg += o.avg_runs
    return { over: o.over_num, venue_avg: Math.round(cumAvg) }
  })
  if (currentOverInt > 0) {
    const currentPoint = cumulativeAvg.find(c => c.over === currentOverInt)
    if (currentPoint) currentPoint.current = currentScore
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Conservative', value: data.projected_conservative, color: 'text-accent-cyan' },
          { label: 'Projected', value: data.projected_current_rr, color: 'text-accent-lime' },
          { label: 'Accelerated', value: data.projected_accelerated, color: 'text-accent-magenta' },
        ].map((p, i) => (
          <div key={i} className="text-center p-3 rounded-xl bg-surface-dark/50 border border-border-subtle/50">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{p.label}</p>
            <p className={`text-2xl font-mono font-black ${p.color}`}>{p.value || '—'}</p>
          </div>
        ))}
      </div>

      {data.required_rate && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-accent-amber/5 border border-accent-amber/20">
          <span className="text-xs text-text-secondary">Required Rate</span>
          <span className="text-lg font-mono font-bold text-accent-amber">{data.required_rate}</span>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span>CRR: <span className="font-mono text-text-primary">{data.current_rr}</span></span>
        <span>Par: <span className="font-mono text-text-primary">{data.par_score_at_over || '—'}</span></span>
        <span>Venue Avg: <span className="font-mono text-text-primary">{data.venue_avg_score || '—'}</span></span>
        {data.last_3_avg && <span>Last 3: <span className="font-mono text-text-primary">{data.last_3_avg}</span></span>}
      </div>

      {cumulativeAvg.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Score Curve vs Venue Avg</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={cumulativeAvg} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis dataKey="over" tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} />
              <Tooltip content={<AnalyticsTooltip extra="Over" />} />
              <Line type="monotone" dataKey="venue_avg" stroke="#8d99ae" strokeWidth={2} dot={false} name="Venue Avg" strokeDasharray="4 4" />
              {currentOverInt > 0 && (
                <ReferenceLine x={currentOverInt} stroke="#f72585" strokeDasharray="3 3" label={{ value: 'Now', fontSize: 9, fill: '#f72585' }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={projectionBars} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} />
          <Tooltip content={<AnalyticsTooltip />} />
          <Bar dataKey="score" radius={[6, 6, 0, 0]} barSize={36}>
            {projectionBars.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Card 3: Venue DNA ───────────────────────────────────────── */
function VenueDNACard({ venue }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venue) { setLoading(false); return }
    setLoading(true)
    getLiveVenueInsights(venue).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [venue])

  if (loading) return <AnalyticsSkeleton />
  if (!data?.stats) return <div className="text-center py-6 text-text-muted text-xs">No venue data available</div>

  const s = data.stats
  const kpis = [
    { label: 'Avg 1st Inn', value: s.avg_1st, color: 'text-accent-cyan' },
    { label: 'Avg 2nd Inn', value: s.avg_2nd, color: 'text-accent-lime' },
    { label: 'Bat 1st Win%', value: s.bat_first_win_pct ? `${s.bat_first_win_pct}%` : '—', color: 'text-accent-amber' },
    { label: 'Highest', value: s.highest, color: 'text-accent-magenta' },
  ]

  const phaseData = (data.phase_stats || []).map(p => ({
    phase: p.phase === 'powerplay' ? 'PP' : p.phase === 'middle' ? 'Mid' : 'Death',
    avg_rr: p.avg_rr,
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {kpis.map((k, i) => (
          <div key={i} className="text-center p-2 rounded-lg bg-surface-dark/50 border border-border-subtle/30">
            <p className="text-[9px] text-text-muted uppercase tracking-wider">{k.label}</p>
            <p className={`text-base font-mono font-bold ${k.color}`}>{k.value ?? '—'}</p>
          </div>
        ))}
      </div>

      {phaseData.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Phase-wise Run Rate</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={phaseData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="phase" tick={{ fontSize: 10, fill: '#8d99ae' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} domain={[0, 'auto']} />
              <Tooltip content={<AnalyticsTooltip />} />
              <Bar dataKey="avg_rr" name="Run Rate" radius={[6, 6, 0, 0]} barSize={32}>
                <Cell fill="#4cc9f0" />
                <Cell fill="#06d6a0" />
                <Cell fill="#f72585" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.recent_matches && data.recent_matches.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Recent at this venue</p>
          <div className="space-y-1.5">
            {data.recent_matches.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg bg-surface-dark/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-text-primary font-medium truncate">{getTeamAbbr(r.team1)} vs {getTeamAbbr(r.team2)}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-mono text-text-muted">{r.inn1_score}/{r.inn1_wickets} - {r.inn2_score}/{r.inn2_wickets}</span>
                  <span className="text-accent-cyan font-semibold">{getTeamAbbr(r.winner || '')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Card 4: Player Form Tracker ─────────────────────────────── */
function PlayerFormCard({ players }) {
  const [formData, setFormData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!players || players.length === 0) { setLoading(false); return }
    setLoading(true)
    Promise.all(
      players.map(p =>
        getLivePlayerForm(p.name, p.role).catch(() => ({ player: p.name, role: p.role, last_5: [] }))
      )
    ).then(results => {
      const map = {}
      results.forEach(r => { map[r.player] = r })
      setFormData(map)
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.map(p => `${p.name}-${p.role}`).join(',')])

  if (loading) return <AnalyticsSkeleton />

  const entries = players.map(p => formData[p.name]).filter(Boolean)
  if (entries.length === 0) {
    return <div className="text-center py-6 text-text-muted text-xs">No form data available</div>
  }

  return (
    <div className="space-y-4">
      {entries.map(f => {
        const isBat = f.role === 'bat'
        const last5 = f.last_5 || []
        if (last5.length === 0) return null

        const chartData = last5.map((inn, i) => ({
          inn: `${i + 1}`,
          value: isBat ? inn.runs : inn.economy,
          opponent: inn.opponent ? getTeamAbbr(inn.opponent) : '',
        })).reverse()

        const refValue = isBat ? f.career_avg : f.career_economy
        const primaryColor = isBat ? '#06d6a0' : '#f72585'

        return (
          <div key={f.player} className="rounded-xl border border-border-subtle bg-surface-dark/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PlayerAvatar name={f.player} size={28} showBorder />
                <div>
                  <p className="text-xs font-bold text-text-primary">{f.player}</p>
                  <p className="text-[9px] text-text-muted uppercase">{isBat ? 'Batting' : 'Bowling'}</p>
                </div>
              </div>
              <div className="text-right text-[10px] text-text-muted">
                {isBat ? (
                  <>
                    <span>Last 5 Avg: <span className="font-mono text-accent-cyan">{f.avg_last_5 ?? '—'}</span></span>
                    <span className="ml-2">Career: <span className="font-mono text-text-secondary">{f.career_avg ?? '—'}</span></span>
                  </>
                ) : (
                  <>
                    <span>Last 5 Econ: <span className="font-mono text-accent-magenta">{f.avg_econ_last_5 ?? '—'}</span></span>
                    <span className="ml-2">Career: <span className="font-mono text-text-secondary">{f.career_economy ?? '—'}</span></span>
                  </>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={90}>
              {isBat ? (
                <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="opponent" tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  {refValue && <ReferenceLine y={refValue} stroke="#8d99ae" strokeDasharray="3 3" label={{ value: 'Avg', fontSize: 8, fill: '#8d99ae' }} />}
                  <Bar dataKey="value" name="Runs" fill={primaryColor} radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="opponent" tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  {refValue && <ReferenceLine y={refValue} stroke="#8d99ae" strokeDasharray="3 3" label={{ value: 'Avg', fontSize: 8, fill: '#8d99ae' }} />}
                  <Line type="monotone" dataKey="value" name="Economy" stroke={primaryColor} strokeWidth={2} dot={{ r: 3, fill: primaryColor }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
}

/* ── Card 5: Phase Analysis ──────────────────────────────────── */
function PhaseAnalysisCard({ team, currentOver }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!team) { setLoading(false); return }
    setLoading(true)
    getLivePhaseAnalysis(team, currentOver).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [team, currentOver])

  if (loading) return <AnalyticsSkeleton />
  if (!data?.phases?.length) return <div className="text-center py-6 text-text-muted text-xs">No phase data available</div>

  const phaseColors = { powerplay: '#4cc9f0', middle: '#06d6a0', death: '#f72585' }
  const phaseLabels = { powerplay: 'Powerplay (1-6)', middle: 'Middle (7-15)', death: 'Death (16-20)' }

  const chartData = data.phases.map(p => ({
    phase: p.phase === 'powerplay' ? 'PP' : p.phase === 'middle' ? 'Mid' : 'Death',
    team_rr: p.team_rr,
    league_rr: p.league_rr,
    rawPhase: p.phase,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-text-muted">Current Phase:</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
          background: `${phaseColors[data.current_phase]}20`,
          color: phaseColors[data.current_phase],
          border: `1px solid ${phaseColors[data.current_phase]}40`,
        }}>
          {phaseLabels[data.current_phase] || data.current_phase}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
          <XAxis dataKey="phase" tick={{ fontSize: 10, fill: '#8d99ae' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} />
          <Tooltip content={<AnalyticsTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="team_rr" name={getTeamAbbr(data.team)} fill="#06d6a0" radius={[4, 4, 0, 0]} barSize={20} />
          <Bar dataKey="league_rr" name="League Avg" fill="#8d99ae" radius={[4, 4, 0, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>

      <div className="space-y-1.5">
        {data.phases.map((p, i) => {
          const diff = p.team_rr && p.league_rr ? (p.team_rr - p.league_rr).toFixed(2) : null
          const isCurrent = p.phase === data.current_phase
          return (
            <div key={i} className={`flex items-center justify-between text-[11px] px-3 py-2 rounded-lg ${
              isCurrent ? 'bg-accent-cyan/5 border border-accent-cyan/20' : 'bg-surface-dark/30'
            }`}>
              <span className="font-medium" style={{ color: phaseColors[p.phase] }}>
                {phaseLabels[p.phase]}
                {isCurrent && <span className="ml-1 text-[9px] text-accent-cyan">(NOW)</span>}
              </span>
              <span className="font-mono text-text-secondary">
                {p.team_rr} RPO
                {diff && (
                  <span className={`ml-1 ${parseFloat(diff) > 0 ? 'text-accent-lime' : 'text-accent-magenta'}`}>
                    ({parseFloat(diff) > 0 ? '+' : ''}{diff})
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Card 6: Team H2H Context ────────────────────────────────── */
function TeamH2HCard({ team1, team2 }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!team1 || !team2) { setLoading(false); return }
    setLoading(true)
    getLiveTeamH2H(team1, team2).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [team1, team2])

  if (loading) return <AnalyticsSkeleton />
  if (!data || data.total_matches === 0) return <div className="text-center py-6 text-text-muted text-xs">No H2H data available</div>

  const pieData = [
    { name: getTeamAbbr(data.team1), value: data.team1_wins, fill: getTeamColor(data.team1) || '#4cc9f0' },
    { name: getTeamAbbr(data.team2), value: data.team2_wins, fill: getTeamColor(data.team2) || '#f72585' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <TeamLogo team={data.team1} size={36} />
          <p className="text-xs font-bold text-text-primary mt-1">{getTeamAbbr(data.team1)}</p>
          <p className="text-2xl font-mono font-black text-accent-cyan">{data.team1_wins}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Matches</p>
          <p className="text-lg font-mono font-bold text-text-secondary">{data.total_matches}</p>
        </div>
        <div className="text-center">
          <TeamLogo team={data.team2} size={36} />
          <p className="text-xs font-bold text-text-primary mt-1">{getTeamAbbr(data.team2)}</p>
          <p className="text-2xl font-mono font-black text-accent-magenta">{data.team2_wins}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={110}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={30}
            outerRadius={48}
            paddingAngle={3}
            dataKey="value"
          >
            {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
          <Tooltip content={<AnalyticsTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {data.last_5 && data.last_5.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Recent Meetings</p>
          <div className="space-y-1.5">
            {data.last_5.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg bg-surface-dark/30">
                <span className="text-text-muted font-mono">{m.date}</span>
                <span className="text-text-primary font-semibold">{getTeamAbbr(m.winner)}</span>
                <span className="text-text-muted">by {m.margin}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Scorecard + Analytics Side-by-Side Wrapper ──────────────── */
function ScorecardWithAnalytics({ matchId }) {
  const [liveScorecard, setLiveScorecard] = useState(null)

  const handleScorecardUpdate = useCallback((data) => {
    setLiveScorecard(data)
  }, [])

  const isLive = liveScorecard?.matchStarted && !liveScorecard?.matchEnded
  const hasScorecard = isLive

  const mobileSlot = hasScorecard
    ? <LiveAnalyticsPanel scorecard={liveScorecard} />
    : null

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Scorecard — main column */}
      <div className={hasScorecard ? 'xl:col-span-7' : 'xl:col-span-12'}>
        <DetailedScorecard
          matchId={matchId}
          onScorecardUpdate={handleScorecardUpdate}
          mobileAnalyticsSlot={mobileSlot}
        />
      </div>

      {/* Live Analytics — desktop side panel only */}
      {hasScorecard && (
        <div className="hidden xl:block xl:col-span-5">
          <LiveAnalyticsPanel scorecard={liveScorecard} />
        </div>
      )}
    </div>
  )
}


/* ── Live Analytics Panel (Main Container) ───────────────────── */
function LiveAnalyticsPanel({ scorecard }) {
  const [expanded, setExpanded] = useState(true)

  const lastInnings = scorecard.scorecard?.[scorecard.scorecard.length - 1]
  const teams = scorecard.teams || []

  const activeBatters = useMemo(() => {
    if (!lastInnings) return []
    const batsmen = lastInnings.batsmen || lastInnings.batting || []
    return batsmen
      .filter(b => {
        const d = (b.dismissal || '').toLowerCase()
        return d.includes('not out') || d === ''
      })
      .slice(0, 2)
      .map(b => b.name || b.batsman?.name || b.batsman || '')
      .filter(Boolean)
  }, [lastInnings])

  const currentBowler = useMemo(() => {
    if (!lastInnings) return ''
    const bowlers = lastInnings.bowlers || lastInnings.bowling || []
    const last = bowlers[bowlers.length - 1]
    return last ? (last.name || last.bowler?.name || last.bowler || '') : ''
  }, [lastInnings])

  const currentScore = useMemo(() => {
    const scores = scorecard.score || []
    const lastScore = scores[scores.length - 1]
    return lastScore?.r ?? 0
  }, [scorecard])

  const currentOvers = useMemo(() => {
    const scores = scorecard.score || []
    const lastScore = scores[scores.length - 1]
    return lastScore?.o ? parseFloat(lastScore.o) : 0
  }, [scorecard])

  const currentWickets = useMemo(() => {
    const scores = scorecard.score || []
    const lastScore = scores[scores.length - 1]
    return lastScore?.w ?? 0
  }, [scorecard])

  const inningsNumber = scorecard.scorecard?.length || 1

  const target = useMemo(() => {
    if (inningsNumber < 2) return null
    const scores = scorecard.score || []
    const firstInnings = scores.find(s => (s.inningNumber || 1) === 1)
    if (firstInnings) return (firstInnings.r ?? 0) + 1
    return null
  }, [scorecard, inningsNumber])

  const venue = scorecard.venue || ''

  const battingTeam = useMemo(() => {
    if (!lastInnings) return teams[0] || ''
    const inning = lastInnings.inning || ''
    for (const t of teams) {
      if (inning.toLowerCase().includes(t.toLowerCase().split(' ')[0])) return t
    }
    return teams[inningsNumber - 1] || teams[0] || ''
  }, [lastInnings, teams, inningsNumber])

  const formPlayers = useMemo(() => {
    const list = activeBatters.map(name => ({ name, role: 'bat' }))
    if (currentBowler) list.push({ name: currentBowler, role: 'bowl' })
    return list
  }, [activeBatters, currentBowler])

  const analyticsCards = [
    {
      id: 'matchup',
      title: 'Live Matchup Rivalry',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v-2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
      show: activeBatters.length > 0 && !!currentBowler,
      render: () => <MatchupRivalryCard batters={activeBatters} bowler={currentBowler} />,
    },
    {
      id: 'projected',
      title: 'Projected Score',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
      show: !!venue && currentOvers > 0,
      render: () => (
        <ProjectedScoreCard
          venue={venue}
          currentScore={currentScore}
          currentOvers={currentOvers}
          currentWickets={currentWickets}
          inningsNumber={inningsNumber}
          target={target}
        />
      ),
    },
    {
      id: 'venue',
      title: 'Venue DNA',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
      ),
      show: !!venue,
      render: () => <VenueDNACard venue={venue} />,
    },
    {
      id: 'form',
      title: 'Player Form',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M3 3v18h18" /><path d="M18 17l-5-5-4 4-3-3" />
        </svg>
      ),
      show: formPlayers.length > 0,
      render: () => <PlayerFormCard players={formPlayers} />,
    },
    {
      id: 'phase',
      title: 'Phase Analysis',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
        </svg>
      ),
      show: !!battingTeam,
      render: () => <PhaseAnalysisCard team={battingTeam} currentOver={Math.floor(currentOvers)} />,
    },
    {
      id: 'h2h',
      title: 'Head to Head',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M6 9l6 6 6-6" />
        </svg>
      ),
      show: teams.length === 2,
      render: () => <TeamH2HCard team1={teams[0]} team2={teams[1]} />,
    },
  ]

  const visibleCards = analyticsCards.filter(c => c.show)
  if (visibleCards.length === 0) return null

  return (
    <div className="rounded-2xl border border-accent-cyan/20 bg-gradient-to-br from-accent-cyan/[0.02] via-surface-card to-accent-magenta/[0.02] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-hover/50 transition-colors"
      >
        <h3 className="text-sm font-bold text-text-primary tracking-wide flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-accent-cyan">
              <path d="M3 3v18h18" /><path d="M18 17l-5-5-4 4-3-3" />
            </svg>
          </span>
          Analytics
        </h3>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-4 space-y-3 max-h-[calc(100vh-10rem)] overflow-y-auto scrollbar-thin">
          {visibleCards.map(card => (
            <div key={card.id} className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
              <div className="px-3 py-2 border-b border-border-subtle bg-surface-hover/50 flex items-center gap-2">
                <span className="text-accent-cyan">{card.icon}</span>
                <h4 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">{card.title}</h4>
              </div>
              <div className="p-3">
                {card.render()}
              </div>
            </div>
          ))}
        </div>
      )}
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

  const liveMatchNames = sortedMatches
    .filter(m => m.matchStarted && !m.matchEnded)
    .map(m => (m.teams || []).join(' vs '))

  const seoDescription = liveCount > 0
    ? `Watch ${liveCount} live IPL 2026 match${liveCount > 1 ? 'es' : ''}: ${liveMatchNames.join(', ')}. Ball-by-ball scores, batting & bowling scorecards, and real-time updates on Crickrida.`
    : 'IPL 2026 live cricket scores, ball-by-ball updates, full scorecards, match schedule & countdown. Follow every IPL match in real-time on Crickrida.'

  const seoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'IPL 2026 Live Scores & Schedule — Crickrida',
    description: seoDescription,
    url: 'https://crickrida.rkjat.in/live',
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Crickrida',
      url: 'https://crickrida.rkjat.in',
    },
    about: {
      '@type': 'SportsEvent',
      name: 'Indian Premier League 2026',
      sport: 'Cricket',
      location: { '@type': 'Country', name: 'India' },
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://crickrida.rkjat.in' },
        { '@type': 'ListItem', position: 2, name: 'Live Scores', item: 'https://crickrida.rkjat.in/live' },
      ],
    },
  }

  return (
    <div className="min-h-screen">
      <SEO
        title="IPL 2026 Live Scores & Schedule — Crickrida"
        description={seoDescription}
        url="https://crickrida.rkjat.in/live"
        keywords="IPL 2026 live score, IPL live cricket score, IPL scorecard, IPL schedule 2026, cricket live score today, IPL match today, ball by ball score, IPL points table, T20 live score, Indian Premier League 2026"
        jsonLd={seoJsonLd}
      />

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
              {/* Spacer */}
              <div className="mb-3" />

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
                  {/* Match selector chips (always visible) */}
                  <div className="mb-5">
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
                                : 'border-border-subtle bg-surface-card text-text-secondary hover:bg-surface-hover'
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

                  {/* Row 1: Scorecard + Live Analytics side by side */}
                  {selectedMatch ? (
                    <ScorecardWithAnalytics matchId={selectedMatch} />
                  ) : (
                    <div className="rounded-2xl border border-border-subtle bg-surface-card p-12 text-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-text-muted mx-auto mb-4">
                        <rect x="2" y="3" width="20" height="18" rx="2" /><path d="M8 7h8M8 11h5M8 15h7" />
                      </svg>
                      <p className="text-sm text-text-secondary">Select a match to view the scorecard</p>
                    </div>
                  )}

                  {/* Row 2: Matches list below */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-text-muted">
                          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        All Matches
                      </h2>
                      <span className="text-[10px] text-text-muted font-mono">
                        {liveCount} live · {matches.length} total
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
