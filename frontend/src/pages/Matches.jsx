import { useState, useMemo } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import SEO from '../components/SEO'
import { useFetch } from '../hooks/useFetch'
import { getMatches, getSeasons, getTeams } from '../lib/api'
import Loading from '../components/ui/Loading'
import Badge from '../components/ui/Badge'
import MultiSeasonSelect from '../components/ui/MultiSeasonSelect'
import { formatDate, formatDecimal, getMatchResult, formatNumber } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import TeamLogo from '../components/ui/TeamLogo'

const PAGE_SIZE = 20

function MatchCard({ match }) {
  const navigate = useNavigate()
  const result = getMatchResult(match)
  const isTeam1Winner = match.winner === match.team1
  const isTeam2Winner = match.winner === match.team2

  return (
    <div 
      onClick={() => navigate(`/matches/${match.match_id}`)}
      className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#11141F]/80 p-5 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-accent-cyan/30 hover:shadow-cyan-900/10 cursor-pointer"
    >
      {/* Accent Line */}
      <div 
        className="absolute inset-x-0 top-0 h-1 opacity-40" 
        style={{ background: `linear-gradient(90deg, ${getTeamColor(match.team1)}, ${getTeamColor(match.team2)})` }}
      />

      <div className="flex flex-col h-full space-y-4">
        <div className="flex items-center justify-between text-[10px] font-mono text-text-muted uppercase tracking-widest">
          <span>{formatDate(match.date)}</span>
          <span>{match.city || match.venue?.split(',')[1] || 'IPL'}</span>
        </div>

        <div className="space-y-4 py-2">
          {/* Team 1 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TeamLogo team={match.team1} size={40} className="rounded-xl bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors" />
              <span className={`font-heading font-bold ${isTeam1Winner ? 'text-text-primary' : 'text-text-secondary'}`}>
                {match.team1}
              </span>
            </div>
            {isTeam1Winner && <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse shadow-[0_0_8px_#00E5FF]" />}
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-x-0 h-px bg-white/5" />
            <span className="relative z-10 px-3 bg-[#11141F] text-[10px] font-black text-white/20 italic">VS</span>
          </div>

          {/* Team 2 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TeamLogo team={match.team2} size={40} className="rounded-xl bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors" />
              <span className={`font-heading font-bold ${isTeam2Winner ? 'text-text-primary' : 'text-text-secondary'}`}>
                {match.team2}
              </span>
            </div>
            {isTeam2Winner && <div className="w-1.5 h-1.5 rounded-full bg-accent-magenta animate-pulse shadow-[0_0_8px_#FF2D78]" />}
          </div>
        </div>

        <div className="pt-3 border-t border-white/5 flex items-center justify-between mt-auto">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-[11px] font-medium text-text-primary truncate">{result}</p>
          </div>
          {match.player_of_match && (
            <div className="flex items-center gap-1.5 shrink-0" title={`Player of Match: ${match.player_of_match}`}>
              <PlayerAvatar name={match.player_of_match} size={22} ringColor="#FFB800" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MatchSpotlight({ match }) {
  if (!match) return null
  const team1Color = getTeamColor(match.team1)
  const team2Color = getTeamColor(match.team2)

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0A0A0F] p-1 shadow-2xl group">
      <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/10 via-transparent to-accent-magenta/10 opacity-60" />
      <div className="relative rounded-[31px] bg-[#0A0A0F]/60 backdrop-blur-3xl p-6 sm:p-10 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-16">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent-amber/25 bg-accent-amber/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-accent-amber">
              <span className="h-2 w-2 rounded-full bg-accent-amber animate-pulse" />
              Featured Match
            </div>
            
            <h2 className="text-3xl sm:text-5xl font-heading font-black text-text-primary leading-tight">
              {match.team1} <span className="text-white/20 italic mx-2">vs</span> {match.team2}
            </h2>

            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Result</p>
                <p className="text-xl font-bold text-accent-cyan">{getMatchResult(match)}</p>
              </div>
              <div className="w-px h-10 bg-white/10 hidden sm:block" />
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Player of Match</p>
                <div className="flex items-center gap-2">
                  <PlayerAvatar name={match.player_of_match} size={24} />
                  <p className="text-lg font-bold text-text-primary">{match.player_of_match}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center gap-4">
              <Link to={`/matches/${match.match_id}`} className="px-6 py-2.5 rounded-full bg-accent-cyan text-bg-primary text-sm font-black uppercase tracking-widest hover:bg-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/20">
                View Full Scorecard
              </Link>
              <div className="text-xs font-mono text-text-muted">
                {formatDate(match.date)} • {match.venue}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 lg:shrink-0">
             <div className="relative">
                <div className="absolute inset-0 blur-2xl rounded-full opacity-20" style={{ backgroundColor: team1Color }} />
                <TeamLogo team={match.team1} size={128} className="relative rounded-[2rem] bg-white/5 border border-white/10 p-4 transition-transform group-hover:scale-110 duration-500" />
             </div>
             <div className="text-2xl font-black text-white/10 italic">VS</div>
             <div className="relative">
                <div className="absolute inset-0 blur-2xl rounded-full opacity-20" style={{ backgroundColor: team2Color }} />
                <TeamLogo team={match.team2} size={128} className="relative rounded-[2rem] bg-white/5 border border-white/10 p-4 transition-transform group-hover:scale-110 duration-500" />
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Matches() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'table'
  const season = searchParams.get('season') || ''
  const team = searchParams.get('team') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const offset = (page - 1) * PAGE_SIZE

  const { data: seasons } = useFetch(() => getSeasons(), [])
  const { data: teams } = useFetch(() => getTeams(), [])

  const { data: matchesData, loading, error } = useFetch(
    () => getMatches({ season, team, limit: PAGE_SIZE, offset }),
    [season, team, page]
  )

  const matches = matchesData?.matches || []
  const total = matchesData?.total || 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  const sortedMatches = useMemo(() => {
    const getValue = (match, key) => {
      switch (key) {
        case 'teams':
          return `${match.team1 || ''} ${match.team2 || ''}`.toLowerCase()
        case 'venue':
          return `${match.venue || ''} ${match.city || ''}`.toLowerCase()
        case 'result':
          return (getMatchResult(match) || '').toLowerCase()
        case 'player_of_match':
          return (match.player_of_match || '').toLowerCase()
        case 'date':
        default:
          return Date.parse(match.date || '') || 0
      }
    }

    return [...matches].sort((a, b) => {
      const av = getValue(a, sortKey)
      const bv = getValue(b, sortKey)
      if (av === bv) return 0
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  }, [matches, sortDir, sortKey])

  function updateParam(key, value) {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    if (key !== 'page') {
      params.delete('page')
    }
    setSearchParams(params)
  }

  const teamOptions = (teams || []).map((t) => ({ value: t, label: t }))
  const latestMatch = sortedMatches[0]

  function toggleSort(key) {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'))
        return prevKey
      }
      setSortDir(key === 'date' ? 'desc' : 'asc')
      return key
    })
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-heading text-lg">Failed to load matches</p>
        <p className="text-text-secondary text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-10 pb-20">
      <SEO
        title="IPL Match Center"
        description="Browse all IPL matches with detailed scorecards, results, and match summaries. Filter by season and team."
      />

      {/* Header & Spotlight */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-accent-cyan">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
              Archive & Reports
            </span>
            <h1 className="mt-3 text-3xl sm:text-4xl font-heading font-black text-text-primary">Match Center</h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex bg-bg-card border border-border-subtle rounded-lg p-1">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                </button>
                <button 
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white/10 text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                </button>
             </div>
          </div>
        </div>

        {!loading && page === 1 && !team && (
          <div className="animate-in">
            <MatchSpotlight match={latestMatch} />
          </div>
        )}
      </section>

      {/* Filters & Stats */}
      <section className="space-y-6">
        <div className="card !overflow-visible flex flex-wrap items-center justify-between gap-4 py-4 px-6 bg-[#0E121E]/50">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-text-muted text-xs font-bold uppercase tracking-widest">Season</label>
              <MultiSeasonSelect
                seasons={seasons || []}
                value={season}
                onChange={(val) => updateParam('season', val)}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-text-muted text-xs font-bold uppercase tracking-widest">Team</label>
              <select
                value={team}
                onChange={(e) => updateParam('team', e.target.value)}
                className="bg-bg-card border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary font-bold focus:outline-none focus:border-accent-cyan transition-colors appearance-none cursor-pointer pr-8 min-w-[140px]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238888A0' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                }}
              >
                <option value="">All Teams</option>
                {teamOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {!loading && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-text-muted uppercase tracking-widest font-black">Matches Found</p>
                <p className="text-xl font-heading font-black text-text-primary">{formatNumber(total)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Match List */}
        {loading ? (
          <Loading message="Fetching matches..." />
        ) : matches.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="text-5xl opacity-20">🏏</div>
            <p className="text-text-muted text-sm">No matches found for the selected filters.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedMatches.map((match, i) => (
              <div key={match.match_id} className="animate-in" style={{ animationDelay: `${i * 40}ms` }}>
                <MatchCard match={match} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card !p-0 overflow-hidden rounded-2xl border border-white/5 animate-in">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  {[
                    ['date', 'Date', ''],
                    ['teams', 'Teams', ''],
                    ['venue', 'Venue', 'hidden md:table-cell'],
                    ['result', 'Result', ''],
                    ['player_of_match', 'Player of Match', 'hidden sm:table-cell'],
                  ].map(([key, label, extraClass]) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className={`px-6 py-4 font-black text-text-muted text-[10px] uppercase tracking-widest text-left whitespace-nowrap cursor-pointer select-none hover:text-text-primary transition-colors ${extraClass}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {label}
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className={`w-2.5 h-2.5 transition-transform ${sortKey === key && sortDir === 'desc' ? 'rotate-180 opacity-100' : sortKey === key ? 'opacity-100' : 'opacity-30'}`}
                        >
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedMatches.map((match, i) => (
                  <tr
                    key={match.match_id}
                    onClick={() => navigate(`/matches/${match.match_id}`)}
                    className={`border-b border-white/5 transition-all hover:bg-white/[0.03] cursor-pointer group`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-text-secondary font-mono text-[11px] group-hover:text-text-primary">
                        {formatDate(match.date)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <TeamLogo team={match.team1} size={24} />
                        <span className="font-heading font-black text-text-primary text-sm tracking-tight">{getTeamAbbr(match.team1)}</span>
                        <span className="text-white/10 mx-1 italic">VS</span>
                        <span className="font-heading font-black text-text-primary text-sm tracking-tight">{getTeamAbbr(match.team2)}</span>
                        <TeamLogo team={match.team2} size={24} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-muted text-[11px] hidden md:table-cell max-w-[200px] truncate">
                      {match.venue}
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-xs font-bold text-accent-cyan group-hover:text-white transition-colors">{getMatchResult(match)}</span>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      {match.player_of_match && (
                        <div className="flex items-center gap-2">
                           <PlayerAvatar name={match.player_of_match} size={20} />
                           <span className="text-text-secondary text-[11px] group-hover:text-text-primary">{match.player_of_match}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6">
            <p className="text-text-muted text-xs font-mono">
              Displaying <span className="text-text-primary font-bold">{offset + 1}–{Math.min(offset + PAGE_SIZE, total)}</span> of {total.toLocaleString()} fixtures
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateParam('page', String(page - 1))}
                disabled={page <= 1}
                className="px-5 py-2 text-xs font-black uppercase tracking-widest rounded-full border border-white/10 bg-white/5 text-text-primary hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum = page - 2 + i
                  if (page <= 2) pageNum = i + 1
                  if (page >= totalPages - 1) pageNum = totalPages - 4 + i
                  if (pageNum < 1 || pageNum > totalPages) return null
                  return (
                    <button
                      key={pageNum}
                      onClick={() => updateParam('page', String(pageNum))}
                      className={`w-8 h-8 rounded-full text-xs font-mono transition-all ${page === pageNum ? 'bg-accent-cyan text-bg-primary font-black scale-110 shadow-lg shadow-cyan-500/20' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => updateParam('page', String(page + 1))}
                disabled={page >= totalPages}
                className="px-5 py-2 text-xs font-black uppercase tracking-widest rounded-full border border-white/10 bg-white/5 text-text-primary hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                Next Page
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
