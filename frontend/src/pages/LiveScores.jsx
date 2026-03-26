import { useState, useEffect, useCallback, useRef } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getLiveStatus, getLiveMatches, getLiveScorecard, getLiveMatchInfo } from '../lib/api'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import Loading from '../components/ui/Loading'
import SEO from '../components/SEO'

/* ── Refresh interval ──────────────────────────────────────── */
const POLL_INTERVAL = 900_000 // 15 minutes (free tier: 100 API hits/day)

/* ── Utility: format score line ────────────────────────────── */
function fmtScore(s) {
  if (!s) return '—'
  // cricScore format: { inning, score: "185/4 (20 ov)" }
  if (typeof s.score === 'string' && s.score) return s.score
  // match_scorecard format: { r, w, o }
  const parts = []
  if (s.r !== undefined) parts.push(s.r)
  if (s.w !== undefined) parts.push(`/${s.w}`)
  if (s.o !== undefined) parts.push(` (${s.o})`)
  return parts.join('') || '—'
}

/* ── Ball dot for last-6-balls strip ──────────────────────── */
function BallDot({ val }) {
  const v = String(val).toLowerCase()
  let bg = 'bg-surface-card'
  let text = 'text-text-secondary'
  if (v === 'w' || v === 'W') { bg = 'bg-accent-magenta/30'; text = 'text-accent-magenta' }
  else if (v === '6') { bg = 'bg-accent-lime/30'; text = 'text-accent-lime' }
  else if (v === '4') { bg = 'bg-accent-cyan/30'; text = 'text-accent-cyan' }
  else if (v === '0') { bg = 'bg-surface-hover'; text = 'text-text-muted' }
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${bg} ${text}`}>
      {val}
    </span>
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
      {/* Status badge */}
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

      {/* Teams + Scores */}
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

      {/* Series + Status */}
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
      {/* Match Header */}
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

        {/* Toss */}
        {scorecard.tossWinner && (
          <p className="text-xs text-text-secondary mb-4">
            Toss: <span className="text-text-primary font-semibold">{scorecard.tossWinner}</span> chose to <span className="text-accent-cyan">{scorecard.tossChoice}</span>
          </p>
        )}

        {/* Score Summary */}
        <div className="space-y-3">
          {(scorecard.score || []).map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-dark">
              <span className="text-sm font-semibold text-text-primary">{s.inning}</span>
              <span className="text-lg font-mono font-bold text-accent-cyan">{fmtScore(s)}</span>
            </div>
          ))}
        </div>

        {/* Match result / status */}
        <p className="mt-4 text-sm font-semibold text-accent-lime text-center">{scorecard.status}</p>
      </div>

      {/* Detailed Scorecard Innings */}
      {(scorecard.scorecard || []).map((inn, idx) => (
        <div key={idx} className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
          {/* Innings header */}
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

          {/* Batting table */}
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

          {/* Bowling table */}
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
    if (!status?.available) return
    fetchMatches()
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchMatches, POLL_INTERVAL)
    }
    return () => clearInterval(intervalRef.current)
  }, [status?.available, autoRefresh, fetchMatches])

  // Auto-select first live match
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
            Live Scores
          </h1>
          <p className="text-xs text-text-muted mt-1">Real-time cricket match updates</p>
        </div>

        {apiAvailable && (
          <div className="flex items-center gap-3">
            {/* Auto-refresh toggle */}
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

            {/* Manual refresh */}
            <button
              onClick={() => { setMatchesLoading(true); fetchMatches() }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border-subtle bg-surface-card text-text-secondary hover:bg-surface-hover transition-all"
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      {!apiAvailable ? (
        <SetupGuide />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Match List */}
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
              <div className="space-y-2 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1 scrollbar-thin">
                {/* Sort: live first, then upcoming, then completed */}
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

          {/* Right: Scorecard Detail */}
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
      )}
    </div>
  )
}
