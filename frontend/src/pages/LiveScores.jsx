import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { toPng } from 'html-to-image'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts'
import { useFetch } from '../hooks/useFetch'
import {
  getLiveStatus, getLiveMatches, getLiveScorecard,
  getLiveMatchup, getLiveProjectedScore, getLiveVenueInsights,
  getLivePlayerForm, getLivePhaseAnalysis, getLiveTeamH2H,
  batchLookupPlayers,
} from '../lib/api'
import { getTeamColor, getTeamAbbr, getTeamLogo } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import Loading from '../components/ui/Loading'
import SEO from '../components/SEO'
import { useBallEvents, OverProgressTile, PreviousOversAccordion, BallEventNotifications } from '../components/live/BallEvents'

const POLL_INTERVAL = 3_000
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Fixes provider glitches like "6Bengaluru wickets" (matches backend sanitize). */
function sanitizeResultStatus(text) {
  if (!text || typeof text !== 'string') return text || ''
  const cities =
    'Bengaluru|Bangalore|Hyderabad|Mumbai|Chennai|Kolkata|Jaipur|Lucknow|Ahmedabad|Guwahati|Raipur|Delhi|Chandigarh|Dharamshala'
  let t = text.replace(
    new RegExp(`([0-9])(${cities})\\b`, 'gi'),
    '$1 $2',
  )
  t = t.replace(
    new RegExp(`([0-9])\\s+(?:${cities})\\s+wickets\\b`, 'gi'),
    '$1 wickets',
  )
  return t
}

function isCompletedMatchStatus(status) {
  if (!status || typeof status !== 'string') return false
  const text = status.toLowerCase()
  return (
    text.includes('completed') ||
    text.includes('finished') ||
    text.includes('result') ||
    text.includes('won by') ||
    text.includes('abandoned') ||
    text.includes('abandon') ||
    text.includes('no result') ||
    text.includes('cancelled')
  )
}

function oversToBalls(value) {
  const oversFloat = parseFloat(value || 0)
  if (!Number.isFinite(oversFloat) || oversFloat <= 0) return 0
  const completedOvers = Math.floor(oversFloat)
  const ballsInOver = Math.round((oversFloat - completedOvers) * 10)
  return completedOvers * 6 + ballsInOver
}

function inferChaseBallBudget(scores = [], status = '') {
  const firstInnings = scores.find(s => (s.inningNumber || 1) === 1) || scores[0]
  const statusText = typeof status === 'string' ? status : ''
  const revisedOvers = statusText.match(/(?:from|in)\s+(\d{1,2})\s*overs?/i) || statusText.match(/\b(\d{1,2})\s*overs?\b/i)
  if (revisedOvers) {
    const revised = Number(revisedOvers[1])
    if (Number.isFinite(revised) && revised > 0 && revised < 20) return revised * 6
  }

  const firstBalls = oversToBalls(firstInnings?.o)
  const firstWickets = Number(firstInnings?.w ?? 0)
  if (firstBalls > 0 && firstBalls < 120 && firstWickets < 10) {
    return firstBalls
  }

  return 120
}

function buildLineupFromScorecard(scorecard) {
  // Infer lineup from active play. Show partial lineups (4+) rather than nothing
  // Full lineup will come from API when available
  
  const innings = scorecard?.scorecard || []
  if (innings.length === 0) return []
  
  const teams = scorecard?.teams || []
  if (teams.length < 2) return []

  const teamKeys = teams.map(t => (t || '').toLowerCase().split(' ')[0])
  const teamPlayers = teams.map(() => new Map())

  for (const inn of innings) {
    const inningName = (inn?.inning || '').toLowerCase()
    let battingIdx = teamKeys.findIndex(key => inningName.includes(key))
    if (battingIdx === -1) battingIdx = 0
    const bowlingIdx = battingIdx === 0 ? 1 : 0

    for (const batsman of inn.batsmen || inn.batting || []) {
      const name = (batsman?.name || batsman?.fullName || '').trim()
      if (!name) continue
      if (!teamPlayers[battingIdx].has(name)) {
        teamPlayers[battingIdx].set(name, {
          name,
          image: batsman?.image || '',
          captain: false,
          wicketkeeper: false,
        })
      }
    }

    for (const bowler of inn.bowlers || inn.bowling || []) {
      const name = (bowler?.name || bowler?.fullName || '').trim()
      if (!name) continue
      if (!teamPlayers[bowlingIdx].has(name)) {
        teamPlayers[bowlingIdx].set(name, {
          name,
          image: bowler?.image || '',
          captain: false,
          wicketkeeper: false,
        })
      }
    }
  }

  // Return inferred lineup if we have at least 4+ players per team (partial lineup from active play)
  const result = teams.map((team, idx) => {
    const playerList = Array.from(teamPlayers[idx].values())
    return {
      team,
      teamImg: scorecard.teamInfo?.[idx]?.img || '',
      players: playerList.slice(0, 11),
    }
  })
  
  // Return result if both teams have at least 4 players captured
  return result.every(r => r.players.length >= 4) ? result : []
}

function collectInningsPlayers(scorecard) {
  const innings = scorecard?.scorecard || []
  const bats = []
  const bowls = []
  for (const inn of innings) {
    const iname = inn.inning || ''
    for (const b of inn.batsmen || inn.batting || []) {
      bats.push({
        name: b.name || b.fullName || '—',
        runs: Number(b.runs) || 0,
        balls: Number(b.balls) || 0,
        fours: Number(b.fours) || 0,
        sixes: Number(b.sixes) || 0,
        sr: Number(b.sr) || 0,
        inning: iname,
        image: b.image || '',
        dismissalDetail: b.dismissalDetail || b.dismissal || '',
      })
    }
    for (const w of inn.bowlers || inn.bowling || []) {
      bowls.push({
        name: w.name || w.fullName || '—',
        overs: Number(w.overs) || 0,
        maidens: Number(w.maidens) || 0,
        runs: Number(w.runs) || 0,
        wickets: Number(w.wickets) || 0,
        economy: Number(w.economy) || 0,
        inning: iname,
        image: w.image || '',
      })
    }
  }
  return { bats, bowls }
}

function buildMatchReportDerived(scorecard) {
  const { bats, bowls } = collectInningsPlayers(scorecard)
  const byRuns = [...bats].sort((a, b) => b.runs - a.runs)
  const byWkts = [...bowls].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
  const byEco = [...bowls].filter((x) => x.overs >= 1).sort((a, b) => a.economy - b.economy)
  const bySR = [...bats].filter(b => b.balls >= 10).sort((a, b) => b.sr - a.sr)
  const topBat = byRuns[0]
  const topBowl = byWkts[0]
  const bestEco = byEco[0]
  const bestSR = bySR[0]

  const innings = scorecard?.scorecard || []
  const teams = scorecard?.teams || []
  const inningsGrouped = innings.map((inn) => {
    const iname = inn.inning || ''
    const battingTeam = teams.find(t => iname.toLowerCase().includes(t.toLowerCase())) || iname
    const batters = (inn.batsmen || inn.batting || [])
      .map(b => ({
        name: b.name || b.fullName || '—',
        runs: Number(b.runs) || 0, balls: Number(b.balls) || 0,
        fours: Number(b.fours) || 0, sixes: Number(b.sixes) || 0,
        sr: Number(b.sr) || 0, image: b.image || '',
        dismissalDetail: b.dismissalDetail || b.dismissal || '',
      }))
      .sort((a, b) => b.runs - a.runs)
    const bowlers = (inn.bowlers || inn.bowling || [])
      .map(w => ({
        name: w.name || w.fullName || '—',
        overs: Number(w.overs) || 0, maidens: Number(w.maidens) || 0,
        runs: Number(w.runs) || 0, wickets: Number(w.wickets) || 0,
        economy: Number(w.economy) || 0, image: w.image || '',
      }))
      .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
    return { iname, battingTeam, batters, bowlers }
  })

  const perTeam = teams.map(team => {
    const batting = inningsGrouped.find(i => i.battingTeam === team)
    const bowling = inningsGrouped.find(i => i.battingTeam !== team)
    return { name: team, batters: batting?.batters || [], bowlers: bowling?.bowlers || [] }
  })

  const batChart = byRuns.slice(0, 8).map((b) => ({
    name: b.name.length > 14 ? `${b.name.slice(0, 12)}…` : b.name,
    runs: b.runs, img: b.image, fullName: b.name,
  }))
  const bowlChart = byWkts.slice(0, 8).map((b) => ({
    name: b.name.length > 14 ? `${b.name.slice(0, 12)}…` : b.name,
    wickets: b.wickets, img: b.image, fullName: b.name,
  }))
  const batStrip = byRuns.slice(0, 8)
  const bowlStrip = byWkts.slice(0, 8)
  return { topBat, topBowl, bestEco, bestSR, perTeam, batChart, bowlChart, bats, bowls, batStrip, bowlStrip }
}

function fmtScore(s) {
  if (!s) return '—'
  if (typeof s.score === 'string' && s.score) return s.score
  const parts = []
  if (s.r !== undefined) parts.push(s.r)
  if (s.w !== undefined) parts.push(`/${s.w}`)
  if (s.o !== undefined) parts.push(` (${s.o})`)
  return parts.join('') || '—'
}

/**
 * Sportmonks often returns relative image_path; normalize for <img src>.
 * Photos load straight from cdn.sportmonks.com in the browser — no call to our backend
 * and no Sportmonks JSON API usage (static CDN only).
 */
function livePlayerImageUrl(path) {
  if (!path || typeof path !== 'string') return undefined
  const p = path.trim()
  if (!p) return undefined
  const lower = p.toLowerCase()
  if (lower.startsWith('http://') || lower.startsWith('https://')) return p
  if (p.startsWith('//')) return `https:${p}`
  if (p.startsWith('/')) return `https://cdn.sportmonks.com${p}`
  return `https://cdn.sportmonks.com/${p.replace(/^\//, '')}`
}

function collectScorecardPlayerNames(scorecard) {
  const s = new Set()
  for (const inn of scorecard.scorecard || []) {
    for (const b of inn.batsmen || inn.batting || []) {
      const n = b.name || b.batsman?.name || b.batsman
      if (n) s.add(n)
    }
    for (const bw of inn.bowlers || inn.bowling || []) {
      const n = bw.name || bw.bowler?.name || bw.bowler
      if (n) s.add(n)
    }
  }
  return [...s]
}

/** Renders a profile link only when batch lookup found IPL data for this name. */
function LiveScorePlayerName({ name, displayName, lookup, title, block, className = '' }) {
  const label = displayName || name
  if (!name) return null
  const info = lookup[name]
  const linkCls = `text-text-primary font-semibold hover:text-accent-cyan transition-colors truncate ${className}${block ? ' block' : ''}`.trim()
  if (info?.slug) {
    return (
      <Link to={`/players/${encodeURIComponent(info.slug)}`} className={linkCls} title={title}>
        {label}
      </Link>
    )
  }
  return (
    <span className={`text-text-primary font-semibold truncate ${className}${block ? ' block' : ''}`.trim()} title={title}>
      {label}
    </span>
  )
}

function teamLink(name) {
  if (!name) return '/teams'
  return `/teams/${encodeURIComponent(name)}`
}

function venueLink(name) {
  if (!name) return '/venues'
  return `/venues/${encodeURIComponent(name)}`
}

/* ── Live Score Summary Card ──────────────────────────────────
   Shows: team logos, score, overs, wickets, current batsmen/bowler
*/
function LiveScoreHero({ match, onClick, isSelected }) {
  // More robust live detection: check matchWinner and status as additional indicators
  const hasWinner = !!(match.matchWinner && match.matchWinner.trim())
  const isCompletedStatus = isCompletedMatchStatus(match.status)
  const matchComplete = match.matchEnded || hasWinner || isCompletedStatus
  const isLive = match.matchStarted && !match.matchEnded && !hasWinner && !isCompletedStatus
  const displayStatus = matchComplete && match.matchWinner
    ? `Winner: ${match.matchWinner}`
    : sanitizeResultStatus(match.status)
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
        isLive ? 'bg-accent-magenta/10' : matchComplete ? 'bg-surface-hover' : 'bg-accent-amber/5'
      }`}>
        {isLive ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent-magenta">
            <span className="w-2 h-2 rounded-full bg-accent-magenta animate-pulse" />
            Live
          </span>
        ) : matchComplete ? (
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
        {(displayStatus || match.status) && (
          <p className={`text-xs font-semibold text-center pt-2 border-t border-border-subtle/50 ${
            isLive ? 'text-accent-lime' : matchComplete ? 'text-accent-cyan' : 'text-text-secondary'
          }`}>
            {displayStatus}
          </p>
        )}

        {match.playerOfMatch?.name && (
          <p className="text-[10px] sm:text-xs text-center text-accent-amber font-semibold">
            Player of the match: <span className="text-text-primary">{match.playerOfMatch.name}</span>
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
   1. Match summary hero: scores → status → chase target → notifications →
      current over → active players → venue/toss
   2. Full batting/bowling tables per innings
*/
function DetailedScorecard({ matchId, onScorecardUpdate }) {
  const [scorecard, setScorecard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [playerLookup, setPlayerLookup] = useState({})
  const intervalRef = useRef(null)

  const playerNamesKey = useMemo(() => {
    if (!scorecard?.scorecard?.length) return ''
    return collectScorecardPlayerNames(scorecard).sort().join('\0')
  }, [scorecard])

  useEffect(() => {
    if (!playerNamesKey) {
      setPlayerLookup({})
      return
    }
    const names = playerNamesKey.split('\0').filter(Boolean)
    let cancelled = false
    batchLookupPlayers(names)
      .then(data => {
        if (!cancelled) setPlayerLookup(data && typeof data === 'object' ? data : {})
      })
      .catch(() => {
        if (!cancelled) setPlayerLookup({})
      })
    return () => { cancelled = true }
  }, [playerNamesKey])

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

  // More robust live detection: check matchWinner and status as additional indicators
  const hasWinner = !!(scorecard?.matchWinner && scorecard.matchWinner.trim())
  const isCompletedStatus = isCompletedMatchStatus(scorecard?.status)
  const isLive = !!(scorecard?.matchStarted && !scorecard?.matchEnded && !hasWinner && !isCompletedStatus)
  const matchComplete = !!(scorecard?.matchEnded || hasWinner || isCompletedStatus)
  const { notifications, overBalls, overComp, allOvers, currentInnings, serverSynced } = useBallEvents(scorecard, isLive, matchId)

  const inningsComplete = useMemo(() => {
    if (!isLive || !scorecard?.score?.length) return false
    const scores = scorecard.score
    const currentInnScore = scores.find(s => (s.inningNumber || scores.indexOf(s) + 1) === currentInnings)
    if (!currentInnScore) return false
    const overs = parseFloat(currentInnScore.o || 0)
    const wickets = parseInt(currentInnScore.w || 0, 10)
    return overs >= 20 || wickets >= 10
  }, [scorecard, isLive, currentInnings])

  const inferredLineup = useMemo(() => buildLineupFromScorecard(scorecard), [scorecard])

  if (loading) return <Loading />
  if (error) return <div className="text-accent-magenta text-sm p-4 rounded-xl border border-accent-magenta/20 bg-accent-magenta/5">{error}</div>
  if (!scorecard) return null

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
  const effectiveLineup = scorecard.lineup?.length > 0 ? scorecard.lineup : inferredLineup

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
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-magenta/20 text-accent-magenta text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-accent-magenta animate-pulse" />
                Live
              </span>
            )}
            <span className="text-sm text-text-muted">{scorecard.series || 'IPL 2026'}</span>
          </div>
          <span className="text-xs text-text-muted">
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
                        <p className="text-base sm:text-lg font-bold text-text-primary group-hover:text-accent-cyan transition-colors">{getTeamAbbr(team)}</p>
                        <p className="text-xs text-text-muted truncate hidden sm:block">{team}</p>
                      </div>
                    </Link>
                    {score ? (
                      <div className={i === 1 ? 'text-right' : 'text-left'}>
                        <span className="text-3xl sm:text-4xl font-mono font-black" style={{ color }}>
                          {score.r !== undefined ? score.r : ''}
                          <span className="text-lg sm:text-xl text-text-muted">/{score.w !== undefined ? score.w : ''}</span>
                        </span>
                        {score.o !== undefined && (
                          <span className="text-sm text-text-secondary ml-1.5 sm:ml-2">({score.o} ov)</span>
                        )}
                      </div>
                    ) : scoreArr.length > 0 ? (
                      <span className="text-sm font-medium text-text-muted italic">Yet to bat</span>
                    ) : (
                      <span className="text-xl font-mono text-text-muted">—</span>
                    )}
                  </div>
                </React.Fragment>
              )
            })}
          </div>

          {/* Status */}
          <p className={`mt-3 text-sm sm:text-base font-bold text-center ${
            isLive ? 'text-accent-lime' : scorecard.matchEnded ? 'text-accent-cyan' : 'text-text-secondary'
          }`}>
            {sanitizeResultStatus(scorecard.status)}
          </p>

          {/* Runs needed in balls — shown only during 2nd innings chase */}
          {(() => {
            if (!isLive) return null
            const scores = scorecard.score || []
            if (scores.length < 2) return null
            const firstInnings = scores.find(s => (s.inningNumber || 1) === 1)
            const secondInnings = scores.find(s => (s.inningNumber || s.inning || 2) === 2) || scores[1]
            if (!firstInnings || !secondInnings) return null
            const targetRuns = (firstInnings.r ?? 0) + 1
            const currentRuns = secondInnings.r ?? 0
            const runsNeeded = targetRuns - currentRuns
            if (runsNeeded <= 0) return null
            const totalBallsBowled = oversToBalls(secondInnings.o)
            const ballsRemaining = inferChaseBallBudget(scores, scorecard.status) - totalBallsBowled
            if (ballsRemaining <= 0) return null
            const rrr = (runsNeeded / (ballsRemaining / 6)).toFixed(2)
            return (
              <div className="mt-3 space-y-2">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-sm">
                  <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 px-3 py-1.5 rounded-full bg-accent-amber/10 border border-accent-amber/30 font-bold text-sm text-center max-w-full">
                    <span className="text-accent-amber shrink-0">Need</span>
                    <span className="text-accent-lime inline-flex items-center gap-0.5">
                      <span aria-hidden="true">⚡</span>
                      <span className="tabular-nums">{runsNeeded}</span>
                      <span>run{runsNeeded !== 1 ? 's' : ''}</span>
                    </span>
                    <span className="text-text-secondary font-semibold shrink-0">in</span>
                    <span className="text-accent-cyan inline-flex items-center gap-0.5">
                      <span aria-hidden="true">🏏</span>
                      <span className="tabular-nums">{ballsRemaining}</span>
                      <span>ball{ballsRemaining !== 1 ? 's' : ''}</span>
                    </span>
                  </span>
                  <span className="text-text-muted">
                    RRR: <span className="text-accent-amber font-mono font-bold">{rrr}</span>
                  </span>
                </div>
              </div>
            )
          })()}
          {scorecard.playerOfMatch?.name && (
            <p className="mt-1.5 text-xs sm:text-sm text-center text-accent-amber font-semibold">
              Player of the match:{' '}
              <span className="text-text-primary">{scorecard.playerOfMatch.name}</span>
            </p>
          )}

          {/* Ball event notifications — inline inside scorecard */}
          {isLive && notifications.length > 0 && (
            <div className="mt-3">
              <BallEventNotifications notifications={notifications} />
            </div>
          )}

          {/* Current over — ball-by-ball (after target/chase, before active players) */}
          {overComp != null && serverSynced && (
            <div className="mt-3 space-y-2">
              {isLive && !inningsComplete && (
                <OverProgressTile balls={overBalls} overComp={overComp} />
              )}
              {allOvers.length > 0 && (
                <PreviousOversAccordion
                  allOvers={allOvers}
                  currentOverNumber={overComp}
                  currentInnings={currentInnings}
                  inningsComplete={inningsComplete}
                  matchComplete={matchComplete}
                />
              )}
            </div>
          )}

          {/* Active players inline */}
          {isLive && scorecard.scorecard && scorecard.scorecard.length > 0 && (
            <ActivePlayersInline scorecard={scorecard} playerLookup={playerLookup} />
          )}

          {/* Venue & toss — last: context after live action */}
          {(scorecard.venue || scorecard.tossWinner) && (
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-text-secondary border-t border-border-subtle/50 pt-3 mt-4">
              {scorecard.venue && (
                <Link to={venueLink(scorecard.venue)} className="flex items-center gap-1.5 hover:text-accent-cyan transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-accent-cyan">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  {scorecard.venue}
                </Link>
              )}
              {scorecard.tossWinner && (
                <span className="flex items-center gap-1.5 text-center sm:text-left">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-accent-amber flex-shrink-0">
                    <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
                  </svg>
                  Toss: <span className="text-text-primary font-semibold">{scorecard.tossWinner}</span> — {scorecard.tossChoice}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Innings cards — current (last) innings first */}
      {(() => {
        const sc = scorecard.scorecard || []
        const n = sc.length
        return [...sc.entries()]
          .sort(([iA], [iB]) => {
            if (n <= 1) return 0
            const aCur = iA === n - 1
            const bCur = iB === n - 1
            if (aCur !== bCur) return aCur ? -1 : 1
            return iA - iB
          })
          .map(([idx, inn]) => (
            <InningsCard
              key={idx}
              innings={inn}
              index={idx}
              isLive={isLive}
              isCurrentInnings={idx === n - 1}
              playerLookup={playerLookup}
            />
          ))
      })()}

    </div>
  )
}

/* ── Single Innings Card (Batting + Bowling side-by-side) ───── */
function InningsCard({ innings, index, isLive, isCurrentInnings, playerLookup = {} }) {
  const batsmen = innings.batsmen || innings.batting || []
  const bowlers = innings.bowlers || innings.bowling || []

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
      {/* Innings header */}
      <div className="px-4 py-2.5 bg-surface-hover border-b border-border-subtle flex items-center justify-between">
        <h3 className="text-sm font-bold text-text-primary tracking-wide uppercase flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-accent-cyan/20 text-accent-cyan text-[10px] font-black flex items-center justify-center">
            {index + 1}
          </span>
          {innings.inning || `Innings ${index + 1}`}
        </h3>
        {isLive && isCurrentInnings && (
          <span className="text-[10px] uppercase tracking-widest text-accent-magenta font-bold">Current</span>
        )}
      </div>

      {/* Side-by-side: Batting (left) + Bowling (right) — stacks on small screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border-subtle">
        {/* Batting */}
        {batsmen.length > 0 && (
          <div className="overflow-x-auto">
            <div className="px-3 py-1.5 bg-surface-dark/30 border-b border-border-subtle">
              <span className="text-xs uppercase tracking-wider text-accent-cyan font-bold">Batting</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border-subtle">
                  <th className="text-left py-1.5 px-3 font-medium">Batter</th>
                  <th className="text-left py-1.5 px-2 font-medium hidden md:table-cell min-w-[120px]">How out</th>
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
                  const howOut = (b.dismissalDetail || b.dismissal || '').trim()
                  const isNotOut = !howOut || howOut.toLowerCase() === 'not out'

                  return (
                    <tr key={bi} className={`border-b border-border-subtle/30 hover:bg-surface-hover/50 ${
                      isNotOut && isLive ? 'bg-accent-lime/5' : ''
                    }`}>
                      <td className="py-1.5 px-3">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <PlayerAvatar name={displayName} imageUrl={livePlayerImageUrl(b.image)} size={26} showBorder />
                            {isNotOut && isLive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-accent-lime animate-pulse flex-shrink-0" />
                            )}
                            <LiveScorePlayerName
                              name={name}
                              displayName={displayName}
                              lookup={playerLookup}
                              title={howOut || 'not out'}
                              className="text-sm"
                            />
                          </div>
                          <p className="md:hidden text-[10px] text-text-muted leading-snug pl-8">
                            {howOut || 'not out'}
                          </p>
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-[10px] text-text-muted leading-snug hidden md:table-cell align-top max-w-[200px]">
                        {howOut || '—'}
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
              <span className="text-xs uppercase tracking-wider text-accent-magenta font-bold">Bowling</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border-subtle">
                  <th className="text-left py-1.5 px-3 font-medium">Bowler</th>
                  <th className="text-center py-1.5 px-1 font-medium">O</th>
                  <th className="text-center py-1.5 px-1 font-medium">M</th>
                  <th className="text-center py-1.5 px-1 font-medium">R</th>
                  <th className="text-center py-1.5 px-1 font-medium">W</th>
                  <th className="text-center py-1.5 px-1 font-medium">Eco</th>
                  <th className="text-center py-1.5 px-1 font-medium">Dots</th>
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
                  const _oversToBalls = (o) => {
                    const whole = Math.floor(o)
                    const balls = Math.round((o - whole) * 10)
                    return whole * 6 + balls
                  }
                  const totalBalls = _oversToBalls(Number(overs))
                  const econ = bw.economy ?? bw.eco ?? (totalBalls > 0 ? ((runs / totalBalls) * 6).toFixed(1) : '0.0')
                  const dots = bw.dots ?? bw.dot_balls ?? '—'

                  return (
                    <tr key={bwi} className="border-b border-border-subtle/30 hover:bg-surface-hover/50">
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerAvatar name={displayName} imageUrl={livePlayerImageUrl(bw.image)} size={26} showBorder />
                          <LiveScorePlayerName
                            name={name}
                            displayName={displayName}
                            lookup={playerLookup}
                            block
                          />
                        </div>
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
                      <td className="text-center py-1.5 px-1 font-mono text-text-muted">{dots}</td>
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


/* ── Active Players Inline (inside hero card) ────────────────── */
function ActivePlayersInline({ scorecard, playerLookup = {} }) {
  const lastInnings = scorecard.scorecard[scorecard.scorecard.length - 1]
  const allBatsmen = lastInnings?.batsmen || lastInnings?.batting || []
  const notOutBatsmen = allBatsmen.filter(b => {
    const d = (b.dismissalDetail || b.dismissal || '').toLowerCase()
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
      role: 'Batting',
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
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="w-2 h-2 rounded-full bg-accent-lime animate-pulse" />
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">At the Crease</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {activePlayers.map((p, i) => {
          const isBat = p.role === 'Batting'
          const roleTag = isBat
            ? (p.isStriker ? 'On Strike' : 'Off Strike')
            : 'Bowler'
          const tagColor = isBat
            ? (p.isStriker ? 'bg-accent-lime/15 text-accent-lime border-accent-lime/30' : 'bg-accent-amber/15 text-accent-amber border-accent-amber/30')
            : 'bg-accent-magenta/15 text-accent-magenta border-accent-magenta/30'
          const profile = p.name ? playerLookup[p.name] : null
          const rowClass = 'flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-dark/60 hover:bg-surface-hover border border-border-subtle/40 transition-all group'
          const inner = (
            <>
              <PlayerAvatar name={p.fullName || p.name} imageUrl={livePlayerImageUrl(p.image)} size={56} showBorder />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold text-text-primary truncate group-hover:text-accent-cyan transition-colors">
                    {p.fullName || p.name}
                  </p>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${tagColor}`}>
                    {roleTag}
                  </span>
                </div>
                {isBat ? (
                  <p className="text-xs font-mono">
                    <span className="text-accent-cyan font-bold">{p.runs ?? p.r ?? 0}</span>
                    <span className="text-text-muted">({p.balls ?? p.b ?? 0})</span>
                    <span className="text-text-muted ml-1.5 text-[11px]">
                      {p.fours ?? p['4s'] ?? 0}×4 · {p.sixes ?? p['6s'] ?? 0}×6
                    </span>
                  </p>
                ) : (
                  <p className="text-xs font-mono">
                    <span className="text-accent-magenta font-bold">{p.wickets ?? p.w ?? 0}/{p.runs ?? p.r ?? 0}</span>
                    <span className="text-text-muted ml-1.5 text-[11px]">
                      {p.overs ?? p.o ?? 0}ov · Eco {p.economy ?? p.eco ?? '—'}
                    </span>
                  </p>
                )}
              </div>
            </>
          )
          if (profile?.slug) {
            return (
              <Link key={i} to={`/players/${encodeURIComponent(profile.slug)}`} className={rowClass}>
                {inner}
              </Link>
            )
          }
          return (
            <div key={i} className={rowClass}>
              {inner}
            </div>
          )
        })}
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
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-accent-cyan/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-cyan animate-spin" />
      </div>
      <p className="text-[10px] uppercase tracking-widest text-text-muted animate-pulse">Loading analytics…</p>
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

function MatchupRivalryCard({ batters, bowler, playerImages = {}, matchId }) {
  const [data, setData] = useState({})
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (!bowler || batters.length === 0) { setInitialLoad(false); return }
    Promise.all(
      batters.map(b => getLiveMatchup(b, bowler, matchId).catch(() => ({ batter: b, bowler, found: false })))
    ).then(results => {
      const map = {}
      results.forEach(r => { map[r.batter] = r })
      setData(map)
    }).finally(() => setInitialLoad(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batters.join(','), bowler, matchId])

  if (initialLoad && Object.keys(data).length === 0) return <AnalyticsSkeleton />

  const entries = batters.map(b => data[b] || { batter: b, bowler, found: false })

  return (
    <div className="space-y-5">
      {entries.map(m => {
        if (!m.found) {
          const hasLive = m.this_match_batter || m.this_match_bowler
          return (
            <div key={m.batter} className="rounded-xl overflow-hidden bg-[#0A0A0F] border border-border-subtle">
              <div className="h-1 bg-gradient-to-r from-[#FFB800]/30 to-[#00E5FF]/30" />
              <div className="flex items-center justify-center gap-3 sm:gap-6 px-4 pt-5 pb-3">
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                  <PlayerAvatar name={m.batter} imageUrl={playerImages[m.batter]} size={76} showBorder />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[#FFB800]/60 font-bold">Batsman</span>
                  <p className="text-sm font-bold text-text-primary text-center truncate w-full">{m.batter}</p>
                </div>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#FFB80015] to-[#00E5FF15] border border-[#FFB80030] flex-shrink-0">
                  <span className="text-sm font-black text-text-muted">VS</span>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                  <PlayerAvatar name={m.bowler} imageUrl={playerImages[m.bowler]} size={76} showBorder />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[#00E5FF]/60 font-bold">Bowler</span>
                  <p className="text-sm font-bold text-text-primary text-center truncate w-full">{m.bowler}</p>
                </div>
              </div>
              {hasLive && (
                <div className="text-center py-3 mx-4 mb-3 rounded-xl bg-accent-lime/10 border border-accent-lime/20 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-accent-lime font-bold">This match</p>
                  {m.this_match_batter && (
                    <p className="text-xl font-black font-mono text-text-primary">
                      {m.this_match_batter.runs} ({m.this_match_batter.balls})
                    </p>
                  )}
                  {m.this_match_bowler && (
                    <p className="text-sm font-mono text-accent-cyan">
                      {m.this_match_bowler.wickets}/{m.this_match_bowler.runs_conceded} ({m.this_match_bowler.overs} ov)
                    </p>
                  )}
                </div>
              )}
              <div className="text-center pb-4 text-text-muted text-sm">
                {hasLive ? 'No prior IPL ball-by-ball H2H in our database for this pair.' : 'No IPL history between these players'}
              </div>
            </div>
          )
        }

        const sr = m.sr || 0
        const statsGrid = [
          { label: 'BALLS', labelMobile: 'Balls faced', hint: 'Legal balls this batter faced from this bowler (all past IPL)' },
          { label: 'SR', labelMobile: 'Strike rate', hint: 'Runs per 100 balls in this matchup (IPL)' },
          { label: '4s', labelMobile: 'Fours', hint: 'Boundary fours in this matchup' },
          { label: '6s', labelMobile: 'Sixes', hint: 'Sixes hit in this matchup' },
          { label: 'DOTS', labelMobile: 'Dot balls', hint: 'Scoreless deliveries from this bowler to this batter' },
          { label: 'OUTS', labelMobile: 'Dismissals', hint: 'Times this bowler dismissed this batter' },
        ].map((row, i) => ({
          ...row,
          value: [m.balls || 0, Math.round(sr), m.fours || 0, m.sixes || 0, m.dots || 0, m.dismissals || 0][i] ?? 0,
        }))
        return (
          <div key={m.batter} className="rounded-xl overflow-hidden bg-[#0A0A0F] border border-border-subtle">
            <div className="h-1 bg-gradient-to-r from-[#FFB800] to-[#00E5FF]" />

            <div className="flex items-center justify-center gap-3 sm:gap-6 px-4 pt-5 pb-3">
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <PlayerAvatar name={m.batter} imageUrl={playerImages[m.batter]} size={76} showBorder />
                <span className="text-[10px] uppercase tracking-[0.15em] text-[#FFB800] font-bold">Batsman</span>
                <p className="text-sm font-bold text-text-primary text-center truncate w-full">{m.batter}</p>
              </div>

              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#FFB80025] to-[#00E5FF25] border border-[#FFB80050] flex-shrink-0">
                <span className="text-sm font-black text-[#FFB800]">VS</span>
              </div>

              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <PlayerAvatar name={m.bowler} imageUrl={playerImages[m.bowler]} size={76} showBorder />
                <span className="text-[10px] uppercase tracking-[0.15em] text-[#00E5FF] font-bold">Bowler</span>
                <p className="text-sm font-bold text-text-primary text-center truncate w-full">{m.bowler}</p>
              </div>
            </div>

            {(m.this_match_batter || m.this_match_bowler) && (
              <div className="text-center py-3 mx-4 rounded-xl bg-gradient-to-r from-accent-lime/10 to-accent-cyan/10 border border-accent-lime/25 space-y-1">
                <p className="text-[10px] uppercase tracking-[0.12em] text-accent-lime font-bold">This match (scorecard)</p>
                {m.this_match_batter && (
                  <p className="text-lg font-black font-mono text-text-primary">
                    {m.this_match_batter.runs}<span className="text-text-muted text-base font-bold"> ({m.this_match_batter.balls})</span>
                    <span className="block text-[10px] font-normal text-text-muted normal-case">
                      SR {m.this_match_batter.strike_rate ?? '—'}
                      {m.this_match_batter.dismissal ? ` · ${m.this_match_batter.dismissal}` : ''}
                    </span>
                  </p>
                )}
                {m.this_match_bowler && (
                  <p className="text-sm font-mono text-accent-cyan">
                    Spell {m.this_match_bowler.wickets}/{m.this_match_bowler.runs_conceded} ({m.this_match_bowler.overs} ov)
                    {m.this_match_bowler.economy != null ? ` · eco ${m.this_match_bowler.economy}` : ''}
                  </p>
                )}
              </div>
            )}

            <div className="text-center py-3 mx-4 rounded-full bg-gradient-to-r from-[#FFB80008] to-[#00E5FF08] border border-[#FFB80015]">
              <p className="text-[10px] uppercase tracking-[0.1em] text-[#FFB800] font-semibold mb-0.5">IPL career (all balls vs this bowler)</p>
              <p className="text-4xl font-black text-text-primary font-mono leading-none">{m.runs || 0}</p>
            </div>

            <p className="sm:hidden text-[10px] text-text-muted text-center leading-snug px-3 pt-2">
              Large total is historical IPL ball-by-ball data. “This match” is from the live scorecard.
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-1.5 p-3 pt-2 sm:pt-3">
              {statsGrid.map((s, i) => {
                const c = MATCHUP_STAT_COLORS[i % MATCHUP_STAT_COLORS.length]
                return (
                  <div
                    key={i}
                    className={`${c.bg} border ${c.border} rounded-lg py-2.5 px-1.5 sm:px-1 text-center`}
                    title={s.hint}
                  >
                    <p className="sm:hidden text-[9px] text-text-muted leading-tight mb-1 font-medium">
                      {s.labelMobile}
                    </p>
                    <p className="hidden sm:block text-[9px] text-text-muted uppercase tracking-wider mb-1">{s.label}</p>
                    <p className={`text-xl font-black font-mono leading-tight ${c.text}`}>{s.value}</p>
                  </div>
                )
              })}
            </div>

            {m.dismissal_kinds && m.dismissal_kinds.length > 0 && (
              <div className="px-4 pb-3 flex gap-2 flex-wrap">
                {m.dismissal_kinds.map((dk, i) => (
                  <span key={i} className="text-[10px] px-2.5 py-0.5 rounded-full bg-accent-magenta/10 text-accent-magenta border border-accent-magenta/20">
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
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (!venue || currentOvers <= 0) { setInitialLoad(false); return }
    getLiveProjectedScore({
      venue, current_score: currentScore, current_overs: currentOvers,
      current_wickets: currentWickets, innings_number: inningsNumber,
      target: target || undefined,
    }).then(setData).catch(() => {}).finally(() => setInitialLoad(false))
  }, [venue, currentScore, currentOvers, currentWickets, inningsNumber, target])

  if (initialLoad && !data) return <AnalyticsSkeleton />
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
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{p.label}</p>
            <p className={`text-3xl font-mono font-black ${p.color}`}>{p.value || '—'}</p>
          </div>
        ))}
      </div>

      {data.required_rate && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-accent-amber/5 border border-accent-amber/20">
          <span className="text-sm text-text-secondary">Required Rate</span>
          <span className="text-xl font-mono font-bold text-accent-amber">{data.required_rate}</span>
        </div>
      )}

      <div className="flex items-center gap-4 text-sm text-text-muted">
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
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (!venue) { setInitialLoad(false); return }
    getLiveVenueInsights(venue).then(setData).catch(() => {}).finally(() => setInitialLoad(false))
  }, [venue])

  if (initialLoad && !data) return <AnalyticsSkeleton />
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
function PlayerFormCard({ players, matchId }) {
  const [formData, setFormData] = useState({})
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (!players || players.length === 0) { setInitialLoad(false); return }
    Promise.all(
      players.map(p =>
        getLivePlayerForm(p.name, p.role, matchId).catch(() => ({ player: p.name, role: p.role, last_5: [] }))
      )
    ).then(results => {
      const map = {}
      results.forEach(r => { map[r.player] = r })
      setFormData(map)
    }).finally(() => setInitialLoad(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.map(p => `${p.name}-${p.role}`).join(','), matchId])

  if (initialLoad && Object.keys(formData).length === 0) return <AnalyticsSkeleton />

  const entries = players
    .map(p => {
      const fd = formData[p.name]
      if (!fd) return null
      return { ...fd, imageUrl: p.imageUrl }
    })
    .filter(Boolean)
  if (entries.length === 0) {
    return <div className="text-center py-6 text-text-muted text-xs">No form data available</div>
  }

  return (
    <div className="space-y-4">
      {entries.map(f => {
        const isBat = f.role === 'bat'
        const last5 = f.last_5 || []
        if (last5.length === 0 && !f.this_match) return null

        const chartData = last5.map((inn, i) => ({
          inn: `${i + 1}`,
          value: isBat ? inn.runs : inn.economy,
          opponent: inn.opponent ? getTeamAbbr(inn.opponent) : '',
        })).reverse()

        let refValue = isBat ? f.career_avg : f.career_economy
        if (isBat && refValue != null && refValue > 150) refValue = null

        const primaryColor = isBat ? '#06d6a0' : '#f72585'

        return (
          <div key={f.player} className="rounded-xl border border-border-subtle bg-surface-dark/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PlayerAvatar name={f.player} imageUrl={livePlayerImageUrl(f.imageUrl)} size={28} showBorder />
                <div>
                  <p className="text-xs font-bold text-text-primary">{f.player}</p>
                  <p className="text-[9px] text-text-muted uppercase">{isBat ? 'Batting' : 'Bowling'}</p>
                </div>
              </div>
              <div className="text-right text-[10px] text-text-muted max-w-[55%]">
                {isBat ? (
                  <>
                    <span>Last 5 avg: <span className="font-mono text-accent-cyan">{f.avg_last_5 ?? '—'}</span></span>
                    <span className="ml-2">IPL DB avg: <span className="font-mono text-text-secondary">{f.career_avg ?? '—'}</span></span>
                    <span className="block text-[8px] text-text-muted mt-0.5">DB = historical ball-by-ball, not this innings</span>
                  </>
                ) : (
                  <>
                    <span>Last 5 econ: <span className="font-mono text-accent-magenta">{f.avg_econ_last_5 ?? '—'}</span></span>
                    <span className="ml-2">IPL DB: <span className="font-mono text-text-secondary">{f.career_economy ?? '—'}</span></span>
                  </>
                )}
              </div>
            </div>

            {f.this_match && (
              <div className="mb-3 p-3 rounded-lg border border-accent-lime/35 bg-accent-lime/5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-accent-lime mb-1">This match (live scorecard)</p>
                {isBat ? (
                  <p className="text-2xl font-black font-mono text-text-primary">
                    {f.this_match.runs}
                    <span className="text-base text-text-muted font-bold"> ({f.this_match.balls})</span>
                    <span className="ml-2 text-sm text-accent-cyan">SR {f.this_match.strike_rate ?? '—'}</span>
                  </p>
                ) : (
                  <p className="text-2xl font-black font-mono text-text-primary">
                    {f.this_match.wickets}/{f.this_match.runs_conceded}
                    <span className="text-base text-text-muted font-bold"> ({f.this_match.overs} ov)</span>
                    {f.this_match.economy != null && (
                      <span className="ml-2 text-sm text-accent-magenta">eco {f.this_match.economy}</span>
                    )}
                  </p>
                )}
                {isBat && f.this_match.dismissal && (
                  <p className="text-[10px] text-text-muted mt-1">{f.this_match.dismissal}</p>
                )}
              </div>
            )}

            {last5.length > 0 ? (
              <ResponsiveContainer width="100%" height={90}>
                {isBat ? (
                  <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="opponent" tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<AnalyticsTooltip />} />
                    {refValue != null && (
                      <ReferenceLine y={refValue} stroke="#8d99ae" strokeDasharray="3 3" label={{ value: 'DB avg', fontSize: 8, fill: '#8d99ae' }} />
                    )}
                    <Bar dataKey="value" name="Runs" fill={primaryColor} radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                ) : (
                  <LineChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="opponent" tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#8d99ae' }} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                    <Tooltip content={<AnalyticsTooltip />} />
                    {refValue != null && (
                      <ReferenceLine y={refValue} stroke="#8d99ae" strokeDasharray="3 3" label={{ value: 'DB avg', fontSize: 8, fill: '#8d99ae' }} />
                    )}
                    <Line type="monotone" dataKey="value" name="Economy" stroke={primaryColor} strokeWidth={2} dot={{ r: 3, fill: primaryColor }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-[11px] text-text-muted py-2">No prior IPL innings in our database for this player.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Card 5: Phase Analysis ──────────────────────────────────── */
function PhaseAnalysisCard({ team, currentOver }) {
  const [data, setData] = useState(null)
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (!team) { setInitialLoad(false); return }
    getLivePhaseAnalysis(team, currentOver).then(setData).catch(() => {}).finally(() => setInitialLoad(false))
  }, [team, currentOver])

  if (initialLoad && !data) return <AnalyticsSkeleton />
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
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (!team1 || !team2) { setInitialLoad(false); return }
    getLiveTeamH2H(team1, team2).then(setData).catch(() => {}).finally(() => setInitialLoad(false))
  }, [team1, team2])

  if (initialLoad && !data) return <AnalyticsSkeleton />
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

/* ── Scorecard Wrapper ───────────────────────────────────────── */
function ScorecardWithAnalytics({ matchId }) {
  return (
    <div>
      <DetailedScorecard matchId={matchId} />
    </div>
  )
}


/* ── Live Analytics Panel (Main Container) ───────────────────── */
function LiveAnalyticsPanel({ scorecard, isLive, matchId }) {
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

  const playerImages = useMemo(() => {
    const map = {}
    if (!lastInnings) return map
    for (const b of lastInnings.batsmen || lastInnings.batting || []) {
      const n = b.name || b.batsman?.name || b.batsman
      const u = livePlayerImageUrl(b.image)
      if (n && u) map[n] = u
    }
    for (const bw of lastInnings.bowlers || lastInnings.bowling || []) {
      const n = bw.name || bw.bowler?.name || bw.bowler
      const u = livePlayerImageUrl(bw.image)
      if (n && u) map[n] = u
    }
    return map
  }, [lastInnings])

  const formPlayers = useMemo(() => {
    const list = activeBatters.map(name => ({
      name,
      role: 'bat',
      imageUrl: playerImages[name],
    }))
    if (currentBowler) {
      list.push({
        name: currentBowler,
        role: 'bowl',
        imageUrl: playerImages[currentBowler],
      })
    }
    return list
  }, [activeBatters, currentBowler, playerImages])

  const analyticsCards = [
    {
      id: 'matchup',
      title: 'Matchup Rivalry',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v-2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
      show: activeBatters.length > 0 && !!currentBowler,
      render: () => (
        <MatchupRivalryCard
          batters={activeBatters}
          bowler={currentBowler}
          playerImages={playerImages}
          matchId={matchId}
        />
      ),
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
      render: () => <PlayerFormCard players={formPlayers} matchId={matchId} />,
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
  const visibleIds = visibleCards.map(c => c.id).join(',')
  const [activeTab, setActiveTab] = useState(visibleCards[0]?.id || '')

  useEffect(() => {
    if (visibleCards.length > 0 && !visibleCards.find(c => c.id === activeTab)) {
      setActiveTab(visibleCards[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds])

  if (visibleCards.length === 0) return null
  const activeCard = visibleCards.find(c => c.id === activeTab) || visibleCards[0]

  return (
    <div className="rounded-2xl border border-accent-cyan/20 bg-gradient-to-br from-accent-cyan/[0.02] via-surface-card to-accent-magenta/[0.02] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-hover/50 transition-colors"
      >
        <h3 className="text-base font-bold text-text-primary tracking-wide flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-accent-cyan">
              <path d="M3 3v18h18" /><path d="M18 17l-5-5-4 4-3-3" />
            </svg>
          </span>
          Analytics
          {isLive ? (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-magenta/20 text-accent-magenta">
              Live
            </span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-hover text-text-muted">
              Match card
            </span>
          )}
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
        <div className="pb-3">
          {/* Tab navigation */}
          <div className="px-3 pb-3 overflow-x-auto scrollbar-thin">
            <div className="flex gap-1.5 min-w-max">
              {visibleCards.map(card => (
                <button
                  key={card.id}
                  onClick={() => setActiveTab(card.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                    activeTab === card.id
                      ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                      : 'bg-surface-hover/50 text-text-muted border border-transparent hover:bg-surface-hover hover:text-text-secondary'
                  }`}
                >
                  <span className={activeTab === card.id ? 'text-accent-cyan' : 'text-text-muted'}>{card.icon}</span>
                  {card.title}
                </button>
              ))}
            </div>
          </div>

          {/* Active card content */}
          <div className="px-3">
            <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
              <div className="p-3 max-h-[calc(100vh-16rem)] overflow-y-auto scrollbar-thin">
                {activeCard.render()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


/* ── Match report modal (cached live scorecard + Recharts + downloads) ─ */
export function MatchReportModal({ apiMatchId, title, onClose }) {
  const chartRef = useRef(null)
  const { data: sc, loading, error } = useFetch(
    () => getLiveScorecard(apiMatchId),
    [apiMatchId],
  )

  const derived = useMemo(() => (sc ? buildMatchReportDerived(sc) : null), [sc])

  const downloadPng = async () => {
    if (!chartRef.current) return
    try {
      const dataUrl = await toPng(chartRef.current, { pixelRatio: 2, backgroundColor: '#0A0A0F' })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `ipl-match-report-${apiMatchId}.png`
      a.click()
    } catch (e) {
      console.error(e)
    }
  }

  const downloadTxt = () => {
    if (!sc || !derived) return
    const lines = [
      title || sc.name,
      sc.venue ? `Venue: ${sc.venue}` : '',
      `Date: ${sc.date || ''}`,
      sanitizeResultStatus(sc.status || ''),
      sc.matchWinner ? `Winner: ${sc.matchWinner}` : '',
      sc.playerOfMatch?.name ? `Player of the match: ${sc.playerOfMatch.name}` : '',
      '',
      '--- Top batsman (runs) ---',
      derived.topBat
        ? `${derived.topBat.name}: ${derived.topBat.runs} (${derived.topBat.balls} balls, SR ${derived.topBat.sr || '—'})`
        : '—',
      '',
      '--- Top bowler (wickets) ---',
      derived.topBowl
        ? `${derived.topBowl.name}: ${derived.topBowl.wickets}/${derived.topBowl.runs} (${derived.topBowl.overs} ov, eco ${derived.topBowl.economy})`
        : '—',
      '',
      '--- All batsmen ---',
      ...derived.bats.map((b) => {
        const how = b.dismissalDetail ? ` · ${b.dismissalDetail}` : ''
        return `${b.name} (${b.inning}): ${b.runs} (${b.balls}), ${b.fours}x4 ${b.sixes}x6${how}`
      }),
      '',
      '--- All bowlers ---',
      ...derived.bowls.map(
        (b) => `${b.name} (${b.inning}): ${b.overs}-${b.maidens}-${b.runs}-${b.wickets}, eco ${b.economy}`,
      ),
    ]
    const blob = new Blob([lines.filter(Boolean).join('\n')], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ipl-match-report-${apiMatchId}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-border-subtle bg-surface-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-border-subtle bg-surface-card/95 backdrop-blur">
          <h3 className="text-lg font-bold text-text-primary pr-4">{title || 'Match report'}</h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-text-muted hover:text-text-primary hover:bg-surface-hover"
          >
            Close
          </button>
        </div>
        <div className="p-5 space-y-6">
          {loading && <Loading />}
          {error && <p className="text-accent-magenta text-sm">{error}</p>}
          {!loading && !error && sc && (
            <>
              <div ref={chartRef} className="rounded-xl overflow-hidden" style={{ background: '#0A0A0F' }}>
                {/* Branding strip */}
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="" className="w-5 h-5 rounded-lg object-cover" onError={e => { e.target.style.display='none' }} />
                    <span className="font-bold text-xs text-white/70 tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Crickrida</span>
                  </div>
                  <span className="text-[9px] font-mono text-white/25 uppercase tracking-[0.2em]">Match Report</span>
                </div>

                {/* Team scores banner */}
                <div className="px-5 py-4">
                  <div className="flex items-center justify-center gap-6 sm:gap-10">
                    {sc.teams?.slice(0, 2).map((t, idx) => {
                      const s = sc.score?.find(x => (x.inning || '').toLowerCase().includes(t.toLowerCase()))
                      const logo = getTeamLogo(t)
                      const color = getTeamColor(t)
                      return (
                        <React.Fragment key={t}>
                          {idx === 1 && <span className="text-white/15 text-xs font-bold uppercase tracking-widest">vs</span>}
                          <div className="flex items-center gap-3">
                            {logo
                              ? <img src={logo} alt="" className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg object-contain" />
                              : <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center font-bold text-white text-sm" style={{ background: color }}>{getTeamAbbr(t)}</div>
                            }
                            <div>
                              <div className="text-xs sm:text-sm font-bold text-white/80">{getTeamAbbr(t)}</div>
                              <div className="text-xl sm:text-2xl font-mono font-black" style={{ color }}>{fmtScore(s)}</div>
                            </div>
                          </div>
                        </React.Fragment>
                      )
                    })}
                  </div>
                  <div className="text-center mt-3 space-y-1">
                    <p className="text-[10px] sm:text-[11px] font-mono text-white/35">{sc.venue}{sc.date ? ` · ${sc.date}` : ''}</p>
                    {sc.tossWinner && <p className="text-[9px] text-white/25 font-mono">Toss: {sc.tossWinner} — {sc.tossChoice}</p>}
                    <p className="text-xs font-semibold text-[#B8FF00]">{sanitizeResultStatus(sc.status)}</p>
                  </div>
                </div>

                {/* Man of the Match */}
                {sc.playerOfMatch?.name && (
                  <div className="mx-5 mb-3 flex items-center gap-4 px-4 py-3 rounded-xl" style={{ border: '1px solid #FFB80030', background: '#FFB80008' }}>
                    {livePlayerImageUrl(sc.playerOfMatch.image) ? (
                      <img src={livePlayerImageUrl(sc.playerOfMatch.image)} alt="" className="w-14 h-14 rounded-full object-cover" style={{ border: '2px solid #FFB80050' }} />
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg" style={{ background: '#FFB80020', color: '#FFB800' }}>★</div>
                    )}
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-[0.15em] font-bold" style={{ color: '#FFB800' }}>Man of the Match</span>
                      <p className="text-base font-bold text-white mt-0.5">{sc.playerOfMatch.name}</p>
                    </div>
                  </div>
                )}

                {/* Key highlights */}
                {derived && (() => {
                  const cards = [
                    derived.topBat && { label: 'Most Runs', name: derived.topBat.name, image: derived.topBat.image, value: `${derived.topBat.runs} (${derived.topBat.balls}b)`, sub: `SR ${derived.topBat.sr || '—'}`, color: '#00E5FF' },
                    derived.bestSR && derived.bestSR.name !== derived.topBat?.name && { label: 'Highest SR', name: derived.bestSR.name, image: derived.bestSR.image, value: `SR ${derived.bestSR.sr}`, sub: `${derived.bestSR.runs} (${derived.bestSR.balls}b)`, color: '#B8FF00' },
                    derived.topBowl && { label: 'Best Figures', name: derived.topBowl.name, image: derived.topBowl.image, value: `${derived.topBowl.wickets}/${derived.topBowl.runs}`, sub: `${derived.topBowl.overs} ov`, color: '#FF2D78' },
                    derived.bestEco && derived.bestEco.name !== derived.topBowl?.name && { label: 'Best Economy', name: derived.bestEco.name, image: derived.bestEco.image, value: `eco ${derived.bestEco.economy}`, sub: `${derived.bestEco.wickets}/${derived.bestEco.runs}`, color: '#8B5CF6' },
                  ].filter(Boolean)
                  return (
                    <div className="flex justify-center gap-2 px-5 mb-3 flex-wrap">
                      {cards.map(h => (
                        <div key={h.label} className="rounded-lg p-3 text-center flex-1 min-w-[120px] max-w-[180px]" style={{ background: `${h.color}08`, border: `1px solid ${h.color}25` }}>
                          <span className="text-[8px] font-mono uppercase tracking-wider block mb-2" style={{ color: h.color }}>{h.label}</span>
                          <div className="flex justify-center mb-2">
                            {livePlayerImageUrl(h.image)
                              ? <img src={livePlayerImageUrl(h.image)} alt="" className="w-12 h-12 rounded-full object-cover" style={{ border: `2px solid ${h.color}40` }} />
                              : <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `${h.color}15`, color: h.color }}>{h.name?.[0] || '?'}</div>
                            }
                          </div>
                          <p className="text-[10px] font-bold text-white truncate">{h.name}</p>
                          <p className="text-base font-mono font-black mt-0.5" style={{ color: h.color }}>{h.value}</p>
                          <p className="text-[9px] font-mono text-white/35">{h.sub}</p>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Batting by team */}
                {derived?.perTeam?.length > 0 && (
                  <div className="px-5 mb-3">
                    <p className="text-[9px] font-mono text-white/25 uppercase tracking-[0.15em] mb-2">Batting</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {derived.perTeam.map(team => {
                        const color = getTeamColor(team.name)
                        return (
                          <div key={`bat-${team.name}`} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${color}30` }}>
                            <div className="px-3 py-1.5 flex items-center gap-2" style={{ background: `${color}15` }}>
                              <div className="w-3.5 h-3.5 rounded" style={{ background: color }} />
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{getTeamAbbr(team.name)}</span>
                            </div>
                            <div className="p-1.5 space-y-0.5">
                              {team.batters.slice(0, 5).map(b => (
                                <div key={b.name} className="flex items-center gap-2 py-1.5 px-2 rounded-md" style={{ background: 'rgba(255,255,255,0.015)' }}>
                                  {livePlayerImageUrl(b.image)
                                    ? <img src={livePlayerImageUrl(b.image)} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
                                    : <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }} />
                                  }
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold text-white/75 truncate">{b.name}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-mono font-bold" style={{ color }}>{b.runs}<span className="text-white/25">({b.balls})</span></p>
                                    <p className="text-[8px] font-mono text-white/25">{b.fours}×4 {b.sixes}×6 SR {b.sr || '—'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Bowling by team */}
                {derived?.perTeam?.length > 0 && (
                  <div className="px-5 mb-3">
                    <p className="text-[9px] font-mono text-white/25 uppercase tracking-[0.15em] mb-2">Bowling</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {derived.perTeam.map(team => {
                        const color = getTeamColor(team.name)
                        return (
                          <div key={`bowl-${team.name}`} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${color}30` }}>
                            <div className="px-3 py-1.5 flex items-center gap-2" style={{ background: `${color}15` }}>
                              <div className="w-3.5 h-3.5 rounded" style={{ background: color }} />
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{getTeamAbbr(team.name)}</span>
                            </div>
                            <div className="p-1.5 space-y-0.5">
                              {team.bowlers.slice(0, 4).map(b => (
                                <div key={b.name} className="flex items-center gap-2 py-1.5 px-2 rounded-md" style={{ background: 'rgba(255,255,255,0.015)' }}>
                                  {livePlayerImageUrl(b.image)
                                    ? <img src={livePlayerImageUrl(b.image)} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
                                    : <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }} />
                                  }
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold text-white/75 truncate">{b.name}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-mono font-bold" style={{ color }}>{b.wickets}/{b.runs}<span className="text-white/25"> ({b.overs}ov)</span></p>
                                    <p className="text-[8px] font-mono text-white/25">eco {b.economy}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Watermark */}
                <div className="px-5 pb-4 pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <img src="/logo.png" alt="" className="w-3.5 h-3.5 rounded object-cover opacity-30" onError={e => { e.target.style.display='none' }} />
                    <span className="text-[9px] font-mono text-white/20 tracking-wide">@Crickrida · Cricket via Stats</span>
                  </div>
                  <span className="text-[8px] font-mono text-white/10">{sc.date || ''}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={downloadPng}
                  disabled={!derived?.perTeam?.length}
                  className="rounded-lg px-4 py-2 text-xs font-bold bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30 hover:bg-accent-cyan/25 disabled:opacity-40"
                >
                  Download Image (PNG)
                </button>
                <button
                  type="button"
                  onClick={downloadTxt}
                  className="rounded-lg px-4 py-2 text-xs font-bold bg-accent-lime/15 text-accent-lime border border-accent-lime/30 hover:bg-accent-lime/25"
                >
                  Download full report (TXT)
                </button>
              </div>
            </>
          )}
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
  const [matches, setMatches] = useState([])
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [matchesError, setMatchesError] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef(null)

  const isLiveMatch = useCallback((match) => {
    const hasWinner = !!(match.matchWinner && match.matchWinner.trim())
    const isCompletedStatus = isCompletedMatchStatus(match.status)
    
    if (!match.matchStarted || match.matchEnded || hasWinner || isCompletedStatus) {
      return false
    }
    
    // Must have started within last 24 hours to be considered "live"
    const startTime = match.dateTimeGMT || match.date || match.starting_at
    if (startTime) {
      const startDate = new Date(startTime)
      const hoursElapsed = (Date.now() - startDate.getTime()) / (1000 * 60 * 60)
      if (hoursElapsed > 24) return false
    }
    
    return true
  }, [])

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
    fetchMatches()
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchMatches, POLL_INTERVAL)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh, fetchMatches])

  useEffect(() => {
    if (matches.length === 0) return

    const live = matches.find(isLiveMatch)
    const currentMatch = matches.find(m => m.id === selectedMatch)

    if (!selectedMatch) {
      setSelectedMatch(live?.id || matches[0]?.id)
      return
    }

    if (live && currentMatch && !isLiveMatch(currentMatch)) {
      setSelectedMatch(live.id)
    }
  }, [matches, selectedMatch, isLiveMatch])

  if (statusLoading) return <Loading />

  const apiAvailable = status?.available
  const sortedMatches = [...matches].sort((a, b) => {
    const aLive = isLiveMatch(a) ? 0 : 1
    const bLive = isLiveMatch(b) ? 0 : 1
    if (aLive !== bLive) return aLive - bLive
    const aUp = !a.matchStarted ? 0 : 1
    const bUp = !b.matchStarted ? 0 : 1
    return aUp - bUp
  })

  const liveMatches = sortedMatches.filter(isLiveMatch)
  const displayedMatchTabs = liveMatches.length > 0 ? liveMatches : sortedMatches
  const liveCount = liveMatches.length

  const liveMatchNames = liveMatches.map(m => (m.teams || []).join(' vs '))

  const seoDescription = liveCount > 0
    ? `Watch ${liveCount} live IPL 2026 match${liveCount > 1 ? 'es' : ''}: ${liveMatchNames.join(', ')}. Ball-by-ball scores, batting & bowling scorecards, and real-time updates on Crickrida.`
    : 'IPL 2026 live cricket scores, ball-by-ball updates, full scorecards, match schedule & countdown. Follow every IPL match in real-time on Crickrida.'

  const seoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'IPL 2026 Live Scores — Crickrida',
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
        title="IPL 2026 Live Scores — Crickrida"
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
            IPL 2026 Live
          </h1>
          <p className="text-xs text-text-muted mt-1">Live scores & real-time match updates</p>
        </div>

        {liveCount > 0 && (
          <span className="px-3 py-1.5 rounded-full bg-accent-magenta/20 text-accent-magenta text-xs font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-magenta animate-pulse" />
            {liveCount} Live
          </span>
        )}
      </div>

      {/* Live Scores Content */}
      {!apiAvailable && matches.length === 0 ? (
        <SetupGuide />
      ) : (
        <>
          <div className="mb-3" />

          {matchesLoading ? (
            <Loading />
          ) : matchesError ? (
            <div className="rounded-xl border border-accent-magenta/30 bg-accent-magenta/5 p-4">
              <p className="text-sm text-accent-magenta">{matchesError}</p>
              <button onClick={fetchMatches} className="mt-2 text-xs text-accent-cyan hover:underline">Try again</button>
            </div>
          ) : matches.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-bg-card p-8 text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-text-muted mx-auto mb-3">
                <circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" strokeWidth="1" />
              </svg>
              <p className="text-sm text-text-secondary">No matches currently available</p>
              <p className="text-xs text-text-muted mt-1">Check back during IPL match days</p>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {displayedMatchTabs.map(m => {
                    const mLive = isLiveMatch(m)
                    const sel = selectedMatch === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMatch(m.id)}
                        className={`flex-shrink-0 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                          sel
                            ? 'border-accent-cyan bg-accent-cyan/10 text-accent-cyan'
                            : 'border-border-subtle bg-bg-card text-text-secondary hover:bg-bg-card-hover'
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

              {selectedMatch ? (
                <ScorecardWithAnalytics matchId={selectedMatch} />
              ) : (
                <div className="rounded-2xl border border-border-subtle bg-bg-card p-12 text-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-text-muted mx-auto mb-4">
                    <rect x="2" y="3" width="20" height="18" rx="2" /><path d="M8 7h8M8 11h5M8 15h7" />
                  </svg>
                  <p className="text-sm text-text-secondary">Select a match to view the scorecard</p>
                </div>
              )}

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
    </div>
  )
}
