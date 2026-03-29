import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { getIPLSchedule, getMatches } from '../lib/api'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import Loading from '../components/ui/Loading'
import SEO from '../components/SEO'
import { MatchReportModal } from './LiveScores'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

function buildMatchLookup(dbMatches) {
  const lookup = {}
  if (!dbMatches?.length) return lookup
  for (const m of dbMatches) {
    const d = m.date?.slice(0, 10)
    const t1 = (m.team1 || '').toLowerCase()
    const t2 = (m.team2 || '').toLowerCase()
    if (d && t1 && t2) {
      lookup[`${d}|${t1}|${t2}`] = m.match_id
      lookup[`${d}|${t2}|${t1}`] = m.match_id
    }
  }
  return lookup
}

export default function IPLSchedule() {
  const { data: schedule, loading, error } = useFetch(() => getIPLSchedule(), [])
  const { data: dbData } = useFetch(() => getMatches({ season: '2026', limit: 100, offset: 0 }), [])
  const [teamFilter, setTeamFilter] = useState('all')
  const [reportCtx, setReportCtx] = useState(null)
  const scrollRef = useRef(null)
  const countdown = useCountdown(schedule?.nextMatch?.dateTimeGMT)

  const matchLookup = useMemo(() => buildMatchLookup(dbData?.matches), [dbData])

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

  function getDbMatchId(m) {
    const d = m.date
    const h = (m.home || '').toLowerCase()
    const a = (m.away || '').toLowerCase()
    return matchLookup[`${d}|${h}|${a}`] || null
  }

  return (
    <div className="space-y-6">
      <SEO
        title="IPL 2026 Schedule — Crickrida"
        description="Full IPL 2026 match schedule with dates, venues, results, and match reports."
        url="https://crickrida.rkjat.in/ipl-schedule"
        keywords="IPL 2026 schedule, IPL match dates, IPL fixtures, IPL 2026 matches, IPL venue"
      />
      {reportCtx && (
        <MatchReportModal
          apiMatchId={reportCtx.apiMatchId}
          title={reportCtx.title}
          onClose={() => setReportCtx(null)}
        />
      )}

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-accent-amber/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-accent-amber">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>
          IPL 2026 Matches
        </h1>
        <p className="text-xs text-text-muted mt-1">Full season schedule, results & match reports</p>
      </div>

      {/* Next match countdown */}
      {nextM && countdown && (
        <div className="rounded-2xl border border-accent-cyan/20 bg-gradient-to-br from-accent-cyan/5 via-bg-card to-accent-magenta/5 p-6 sm:p-8">
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
      <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Season Progress</span>
          <span className="text-xs font-mono text-text-secondary">{completedCount} / {schedule.totalMatches} matches</span>
        </div>
        <div className="w-full h-2 rounded-full bg-bg-primary overflow-hidden">
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
          className="px-3 py-1.5 rounded-lg text-xs border border-border-subtle bg-bg-card text-text-primary focus:outline-none focus:border-accent-cyan appearance-none pr-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2300E5FF' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
          }}
        >
          <option value="all">All Teams</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {teamFilter !== 'all' && <span className="text-xs text-text-secondary">{filteredMatches.length} matches</span>}
      </div>

      {/* Schedule table */}
      <div ref={scrollRef} className="rounded-xl border border-border-subtle bg-bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-elevated text-text-muted border-b border-border-subtle">
                <th className="text-center py-3 px-3 font-medium text-xs uppercase tracking-wider w-12">#</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider">Date</th>
                <th className="text-center py-3 px-3 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Day</th>
                <th className="text-center py-3 px-3 font-medium text-xs uppercase tracking-wider">Time</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider">Home</th>
                <th className="text-center py-3 px-2 font-medium text-xs uppercase tracking-wider w-8"></th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider">Away</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider hidden lg:table-cell min-w-[140px]">Result</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Venue</th>
                <th className="text-center py-3 px-2 font-medium text-xs uppercase tracking-wider w-20">Details</th>
                <th className="text-center py-3 px-2 font-medium text-xs uppercase tracking-wider w-24">Report</th>
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
                const winnerLine = m.matchWinner
                  ? `${getTeamAbbr(m.matchWinner)} won`
                  : isCompleted && m.resultNote
                    ? sanitizeResultStatus(m.resultNote).slice(0, 120)
                    : isCompleted
                      ? '—'
                      : ''

                const dbId = getDbMatchId(m)

                let rowClass = 'border-b border-border-subtle/50 transition-colors'
                if (isLive) rowClass += ' bg-accent-magenta/5 border-l-2 border-l-accent-magenta'
                else if (isNext) rowClass += ' bg-accent-cyan/5 border-l-2 border-l-accent-cyan'
                else if (isToday) rowClass += ' bg-accent-amber/5 border-l-2 border-l-accent-amber'
                else if (isCompleted && !m.matchWinner && !m.resultNote) rowClass += ' opacity-50'
                else if (isCompleted) rowClass += ' bg-bg-card-hover/25'
                else rowClass += ' hover:bg-bg-card-hover/50'

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
                    <td className="py-3 px-3 text-[11px] text-text-secondary hidden lg:table-cell align-top max-w-[200px]">
                      {isCompleted ? (
                        <div className="space-y-1">
                          <p className="font-bold text-accent-lime">{winnerLine}</p>
                          {m.resultNote && m.matchWinner && (
                            <p className="text-text-muted leading-snug line-clamp-2" title={m.resultNote}>
                              {sanitizeResultStatus(m.resultNote)}
                            </p>
                          )}
                          {m.playerOfMatch?.name && (
                            <p className="text-accent-amber/90 text-[10px]">MOTM: {m.playerOfMatch.name}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-xs text-text-secondary hidden md:table-cell">{m.venue}</td>
                    <td className="py-3 px-2 text-center align-middle">
                      {dbId ? (
                        <Link
                          to={`/matches/${dbId}`}
                          className="text-[10px] font-bold px-2 py-1.5 rounded-md border border-accent-purple/40 text-accent-purple hover:bg-accent-purple/10 whitespace-nowrap inline-block"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="text-[10px] text-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center align-middle">
                      {m.apiMatchId && (isCompleted || isLive) ? (
                        <button
                          type="button"
                          onClick={() =>
                            setReportCtx({
                              apiMatchId: m.apiMatchId,
                              title: `Match ${m.match} · ${getTeamAbbr(m.home)} vs ${getTeamAbbr(m.away)}`,
                            })
                          }
                          className="text-[10px] font-bold px-2 py-1.5 rounded-md border border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/10 whitespace-nowrap leading-tight text-center max-w-[9rem]"
                        >
                          {isCompleted ? 'Download' : 'Live'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-text-muted">—</span>
                      )}
                    </td>
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
