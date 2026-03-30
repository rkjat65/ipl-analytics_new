import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { getIPLSchedule, getMatches, getIPLPointsTable } from '../lib/api'
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

function SeasonProgress({ completed, total }) {
  const [width, setWidth] = useState(0)
  const pct = total > 0 ? (completed / total) * 100 : 0

  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Season Progress</span>
        <span className="text-xs font-mono text-text-secondary">{completed} / {total} matches</span>
      </div>
      <div className="w-full h-2 rounded-full bg-bg-primary overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-lime"
          style={{ width: `${width}%`, transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </div>
    </div>
  )
}

const QUALIFY_LINE = 4

function PointsTable({ data }) {
  const [open, setOpen] = useState(true)

  if (!data?.length) return null

  const maxPts = Math.max(...data.map(t => t.points), 1)

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
      {/* Header — clickable to collapse */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 border-b border-border-subtle/50 bg-white/[0.02] flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-accent-cyan/15 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-accent-cyan">
              <path d="M8 21h8m-4-4v4M6 4h12l-1.5 8h-9L6 4z" />
              <path d="M5 4C3.5 4 2 5.5 2 7.5S3.5 11 5 12h1.5" />
              <path d="M19 4c1.5 0 3 1.5 3 3.5S20.5 11 19 12h-1.5" />
            </svg>
          </span>
          <h2 className="text-sm font-bold text-text-primary tracking-tight">Points Table</h2>
          <span className="text-[10px] text-text-muted font-mono ml-1">IPL 2026</span>
        </div>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`w-4 h-4 text-text-muted transition-transform duration-300 ${open ? 'rotate-0' : '-rotate-90'}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Collapsible body */}
      <div
        className="transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden"
        style={{ maxHeight: open ? '800px' : '0px', opacity: open ? 1 : 0 }}
      >
        {/* Table */}
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-subtle/30 bg-white/[0.01] text-[10px] font-bold text-text-muted uppercase tracking-wider">
              <th className="py-2 pl-4 pr-1 text-left w-8">#</th>
              <th className="py-2 pl-1 text-left">Team</th>
              <th className="py-2 text-center w-10">P</th>
              <th className="py-2 text-center w-10">W</th>
              <th className="py-2 text-center w-10">L</th>
              <th className="py-2 text-center w-10">NR</th>
              <th className="py-2 text-center w-12">PTS</th>
              <th className="py-2 pr-4 text-right w-16">NRR</th>
            </tr>
          </thead>
          <tbody>
            {data.map((team, idx) => {
              const color = getTeamColor(team.team)
              const abbr = getTeamAbbr(team.team)
              const isQualify = idx < QUALIFY_LINE
              const nrrStr = team.nrr > 0 ? `+${team.nrr.toFixed(3)}` : team.nrr.toFixed(3)
              const ptsFrac = maxPts > 0 ? team.points / maxPts : 0

              return (
                <tr
                  key={team.team}
                  className={`
                    border-b transition-colors hover:bg-white/[0.03]
                    ${idx === QUALIFY_LINE - 1 ? 'border-b-2 border-accent-cyan/30' : 'border-border-subtle/20'}
                  `}
                  style={{ borderLeft: `3px solid ${isQualify ? color : 'transparent'}` }}
                >
                  <td className={`py-2.5 pl-4 pr-1 font-bold ${isQualify ? 'text-text-primary' : 'text-text-muted'}`}>
                    {team.position}
                  </td>
                  <td className="py-2.5 pl-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamLogo team={team.team} size={26} />
                      <span className={`font-bold truncate ${isQualify ? 'text-text-primary' : 'text-text-secondary'}`}>{abbr}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-center font-mono text-text-secondary">{team.played}</td>
                  <td className="py-2.5 text-center font-mono font-bold text-accent-lime">{team.won || <span className="text-text-muted">0</span>}</td>
                  <td className="py-2.5 text-center font-mono text-text-secondary">{team.lost || <span className="text-text-muted">0</span>}</td>
                  <td className="py-2.5 text-center font-mono text-text-muted">{team.no_result}</td>
                  <td className="py-2.5 text-center relative">
                    <span className="relative z-10 font-black text-text-primary">{team.points}</span>
                    {ptsFrac > 0 && (
                      <span
                        className="absolute inset-y-1 left-0 right-0 rounded-md opacity-15"
                        style={{ backgroundColor: color, transform: `scaleX(${ptsFrac})`, transformOrigin: 'left' }}
                      />
                    )}
                  </td>
                  <td className={`py-2.5 pr-4 text-right font-mono font-semibold ${
                    team.nrr > 0 ? 'text-accent-lime' : team.nrr < 0 ? 'text-accent-magenta' : 'text-text-muted'
                  }`}>
                    {nrrStr}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="px-4 py-2 flex items-center gap-2 bg-white/[0.01]">
          <div className="w-3 h-0.5 rounded-full bg-accent-cyan/40" />
          <span className="text-[9px] text-text-muted">Top {QUALIFY_LINE} qualify for playoffs</span>
        </div>
      </div>
    </div>
  )
}


export default function IPLSchedule() {
  const { data: schedule, loading, error } = useFetch(() => getIPLSchedule(), [])
  const { data: dbData } = useFetch(() => getMatches({ season: '2026', limit: 100, offset: 0 }), [])
  const { data: pointsTable } = useFetch(() => getIPLPointsTable('2026'), [])
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
        title="IPL26 Schedule — Crickrida"
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
          IPL 2026
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

      {/* Season progress bar (animated) */}
      <SeasonProgress completed={completedCount} total={schedule.totalMatches} />

      {/* Points Table */}
      <PointsTable data={pointsTable} />

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

      {/* Match tiles */}
      <div ref={scrollRef} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredMatches.map((m) => {
          const d = new Date(m.date + 'T00:00:00')
          const dayStr = DAYS[d.getDay()]
          const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]}`
          const isNext = nextM && m.match === nextM.match
          const todayStr = new Date().toISOString().slice(0, 10)
          const isToday = m.date === todayStr
          const isCompleted = m.status === 'completed'
          const isLive = m.status === 'live'
          const dbId = getDbMatchId(m)

          const homeColor = getTeamColor(m.home) || '#00E5FF'
          const awayColor = getTeamColor(m.away) || '#E040FB'

          let borderClass = 'border-border-subtle'
          let glowStyle = {}
          if (isLive) {
            borderClass = 'border-accent-magenta/60'
            glowStyle = { boxShadow: '0 0 20px rgba(224,64,251,0.15)' }
          } else if (isNext) {
            borderClass = 'border-accent-cyan/50'
            glowStyle = { boxShadow: '0 0 20px rgba(0,229,255,0.1)' }
          } else if (isToday) {
            borderClass = 'border-accent-amber/50'
          }

          return (
            <div
              key={m.match}
              data-match={m.match}
              className={`rounded-2xl border ${borderClass} bg-surface-card overflow-hidden transition-all hover:border-white/20 group`}
              style={glowStyle}
            >
              {/* Top bar with match number, date, status */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle/50 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-text-muted bg-white/[0.05] px-1.5 py-0.5 rounded">#{m.match}</span>
                  <span className="text-[11px] text-text-secondary font-medium">{dayStr}, {dateStr}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-text-muted">{m.time}</span>
                  {isLive && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-accent-magenta bg-accent-magenta/15 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-magenta animate-pulse" />
                      LIVE
                    </span>
                  )}
                  {isNext && !isLive && (
                    <span className="text-[9px] font-bold text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded-full">NEXT</span>
                  )}
                  {isCompleted && (
                    <span className="text-[9px] font-bold text-accent-lime/70 bg-accent-lime/10 px-2 py-0.5 rounded-full">DONE</span>
                  )}
                </div>
              </div>

              {/* Teams */}
              <div className="px-4 py-4">
                <div className="flex items-center justify-between">
                  {/* Home team */}
                  <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    <div className="relative">
                      <TeamLogo team={m.home} size={44} />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full" style={{ backgroundColor: homeColor, opacity: 0.6 }} />
                    </div>
                    <span className="text-xs font-bold text-text-primary text-center leading-tight">{getTeamAbbr(m.home)}</span>
                  </div>

                  {/* VS */}
                  <div className="flex flex-col items-center gap-1 px-3">
                    <span className="text-sm font-black text-text-muted/40">VS</span>
                  </div>

                  {/* Away team */}
                  <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    <div className="relative">
                      <TeamLogo team={m.away} size={44} />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full" style={{ backgroundColor: awayColor, opacity: 0.6 }} />
                    </div>
                    <span className="text-xs font-bold text-text-primary text-center leading-tight">{getTeamAbbr(m.away)}</span>
                  </div>
                </div>

                {/* Result (completed matches) */}
                {isCompleted && (m.matchWinner || m.resultNote) && (
                  <div className="mt-3 pt-3 border-t border-border-subtle/40">
                    {m.matchWinner && (
                      <p className="text-[11px] font-bold text-accent-lime text-center">
                        {getTeamAbbr(m.matchWinner)} won
                      </p>
                    )}
                    {m.resultNote && (
                      <p className="text-[10px] text-text-muted text-center mt-0.5 line-clamp-1" title={sanitizeResultStatus(m.resultNote)}>
                        {sanitizeResultStatus(m.resultNote)}
                      </p>
                    )}
                    {m.playerOfMatch?.name && (
                      <p className="text-[10px] text-accent-amber/80 text-center mt-0.5">
                        MOTM: {m.playerOfMatch.name}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer: venue + action buttons */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border-subtle/40 bg-white/[0.01]">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-text-muted flex-shrink-0">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="text-[10px] text-text-muted truncate">{m.venue}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {dbId && (
                    <Link
                      to={`/matches/${dbId}`}
                      className="text-[9px] font-bold px-2 py-1 rounded-md border border-accent-purple/30 text-accent-purple hover:bg-accent-purple/10 transition-colors"
                    >
                      Details
                    </Link>
                  )}
                  {m.apiMatchId && (isCompleted || isLive) && (
                    <button
                      type="button"
                      onClick={() =>
                        setReportCtx({
                          apiMatchId: m.apiMatchId,
                          title: `Match ${m.match} · ${getTeamAbbr(m.home)} vs ${getTeamAbbr(m.away)}`,
                        })
                      }
                      className="text-[9px] font-bold px-2 py-1 rounded-md border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10 transition-colors"
                    >
                      Report
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
