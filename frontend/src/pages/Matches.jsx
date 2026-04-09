import { useState, useMemo } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import SEO from '../components/SEO'
import { useFetch } from '../hooks/useFetch'
import { getMatches, getSeasons, getTeams } from '../lib/api'
import Loading from '../components/ui/Loading'
import Badge from '../components/ui/Badge'
import MultiSeasonSelect from '../components/ui/MultiSeasonSelect'
import { formatDate, getMatchResult } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'

const PAGE_SIZE = 20

function HeroStat({ label, value, accent = 'cyan' }) {
  const accentClass = {
    cyan: 'text-accent-cyan stat-glow-cyan',
    lime: 'text-accent-lime stat-glow-lime',
    amber: 'text-accent-amber stat-glow-amber',
    magenta: 'text-accent-magenta stat-glow-magenta',
  }[accent] || 'text-accent-cyan stat-glow-cyan'

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{label}</p>
      <p className={`mt-1 text-lg font-heading font-bold ${accentClass}`}>{value}</p>
    </div>
  )
}

export default function Matches() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
    // Reset to page 1 when filters change
    if (key !== 'page') {
      params.delete('page')
    }
    setSearchParams(params)
  }

  const seasonOptions = (seasons || []).map((s) => ({ value: s, label: s }))
  const teamOptions = (teams || []).map((t) => ({ value: t, label: t }))
  const activeSeasonCount = season ? season.split(',').map((s) => s.trim()).filter(Boolean).length : (seasons || []).length
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
    <div className="space-y-6">
      <SEO
        title="IPL Matches"
        description="Browse all IPL matches with detailed scorecards, results, and match summaries. Filter by season and team."
      />
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.16),transparent_0%,transparent_36%),radial-gradient(circle_at_bottom_right,rgba(184,255,0,0.12),transparent_0%,transparent_36%),linear-gradient(135deg,#0B0E16_0%,#101726_42%,#130F1D_100%)] p-5 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] animate-in">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-accent-cyan">
              <span className="h-2 w-2 rounded-full bg-accent-cyan animate-pulse" />
              Match archive
            </span>
            <div>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-text-primary">Matches</h1>
              <p className="mt-2 text-sm text-text-secondary max-w-2xl leading-relaxed">
                Browse every result with a cleaner premium layout, fast filters, and clearer rivalry context at a glance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
              <span className="rounded-full border border-accent-cyan/20 bg-accent-cyan/10 px-3 py-1 text-accent-cyan">{loading ? 'Loading…' : `${total.toLocaleString()} matches tracked`}</span>
              <span className="rounded-full border border-accent-lime/20 bg-accent-lime/10 px-3 py-1 text-accent-lime">{activeSeasonCount} season lens</span>
              {team && <span className="rounded-full border border-accent-amber/20 bg-accent-amber/10 px-3 py-1 text-accent-amber">Team: {getTeamAbbr(team)}</span>}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <HeroStat label="On this page" value={loading ? '—' : sortedMatches.length} accent="cyan" />
            <HeroStat label="Page" value={`${page}/${Math.max(totalPages, 1)}`} accent="lime" />
            <HeroStat label="Latest result" value={latestMatch?.winner ? getTeamAbbr(latestMatch.winner) : '—'} accent="amber" />
          </div>
        </div>
      </section>

      <div className="card flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm font-body">Season</label>
          <MultiSeasonSelect
            seasons={seasons || []}
            value={season}
            onChange={(val) => updateParam('season', val)}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm font-body">Team</label>
          <select
            value={team}
            onChange={(e) => updateParam('team', e.target.value)}
            className="bg-bg-card border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary font-body focus:outline-none focus:border-accent-cyan transition-colors appearance-none cursor-pointer pr-8"
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

      {/* Match List */}
      {loading ? (
        <Loading message="Loading matches..." />
      ) : matches.length === 0 ? (
        <p className="text-text-muted text-sm py-12 text-center">No matches found for the selected filters.</p>
      ) : (
        <>
          <div className="card overflow-x-auto rounded-2xl border border-border-subtle">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-elevated border-b border-border-subtle">
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
                      className={`px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider text-left whitespace-nowrap cursor-pointer select-none hover:text-text-primary transition-colors ${extraClass}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`w-3 h-3 transition-transform ${sortKey === key && sortDir === 'desc' ? 'rotate-180 opacity-100' : sortKey === key ? 'opacity-100' : 'opacity-35'}`}
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
                    className={`border-b border-border-subtle transition-colors hover:bg-bg-card-hover cursor-pointer animate-row ${
                      i % 2 === 1 ? 'bg-bg-card/50' : ''
                    }`}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/matches/${match.match_id}`} className="text-text-secondary font-mono text-xs hover:text-text-primary">
                        {formatDate(match.date)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/matches/${match.match_id}`} className="hover:underline">
                        <span className="font-heading font-semibold text-text-primary">
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                            style={{ backgroundColor: getTeamColor(match.team1) }}
                          />
                          {getTeamAbbr(match.team1)}
                        </span>
                        <span className="text-text-muted mx-2">vs</span>
                        <span className="font-heading font-semibold text-text-primary">
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                            style={{ backgroundColor: getTeamColor(match.team2) }}
                          />
                          {getTeamAbbr(match.team2)}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs hidden md:table-cell max-w-[200px] truncate">
                      {match.venue}{match.city ? `, ${match.city}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/matches/${match.match_id}`}>
                        {match.winner ? (
                          <Badge
                            text={getMatchResult(match)}
                            color={match.winner === match.team1 ? 'cyan' : 'magenta'}
                          />
                        ) : (
                          <Badge text={getMatchResult(match)} color="muted" />
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-accent-amber text-xs hidden sm:table-cell">
                      {match.player_of_match || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-text-muted text-sm">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateParam('page', String(page - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 text-sm font-body rounded-md border border-border-subtle bg-bg-card text-text-primary hover:bg-bg-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <span className="text-text-secondary text-sm font-mono px-2">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => updateParam('page', String(page + 1))}
                  disabled={page >= totalPages}
                  className="px-4 py-2 text-sm font-body rounded-md border border-border-subtle bg-bg-card text-text-primary hover:bg-bg-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
