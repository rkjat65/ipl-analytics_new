import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getTeams, getTeamStats } from '../lib/api'
import SEO from '../components/SEO'
import Loading from '../components/ui/Loading'
import { formatDecimal, formatNumber } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'

function TeamCard({ team, stats, loading }) {
  const color = getTeamColor(team)

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-1 rounded-t-lg mb-4" style={{ backgroundColor: color }} />
        <div className="h-5 bg-bg-card-hover rounded w-3/4 mb-3" />
        <div className="h-8 bg-bg-card-hover rounded w-1/2 mb-4" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-10 bg-bg-card-hover rounded" />
          <div className="h-10 bg-bg-card-hover rounded" />
          <div className="h-10 bg-bg-card-hover rounded" />
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <Link to={`/teams/${encodeURIComponent(team)}`} className="block group h-full">
      <div className="relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(17,20,31,0.96),rgba(10,12,18,0.96))] p-4 shadow-[0_16px_34px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent_42%)] opacity-80" />

        <div className="relative z-10">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <TeamLogo team={team} size={38} />
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Franchise</p>
                <h3 className="text-lg font-heading font-bold group-hover:underline truncate" style={{ color }}>
                  {team}
                </h3>
              </div>
            </div>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: `${color}33`, color, backgroundColor: `${color}12` }}>
              {getTeamAbbr(team)}
            </span>
          </div>

          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Win rate</p>
              <p className="text-3xl font-heading font-bold stat-glow-cyan text-accent-cyan font-mono">{formatDecimal(stats.win_pct, 1)}%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Titles</p>
              <p className="text-base font-heading font-bold text-accent-amber">{stats.titles ?? 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Mat</p>
              <p className="text-sm font-mono font-semibold text-text-primary">{stats.matches}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Won</p>
              <p className="text-sm font-mono font-semibold text-accent-lime">{stats.wins}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Lost</p>
              <p className="text-sm font-mono font-semibold text-danger">{stats.losses}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-text-muted">Avg score</p>
              <p className="mt-1 font-mono font-semibold text-text-primary">{formatDecimal(stats.avg_score, 1)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-text-muted">Best total</p>
              <p className="mt-1 font-mono font-semibold" style={{ color }}>{formatNumber(stats.highest_total ?? 0)}</p>
            </div>
          </div>

          <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-accent-cyan">
            View full team profile →
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function Teams() {
  const { data: teams, loading, error } = useFetch(() => getTeams(), [])
  const { data: teamStatsList, loading: statsLoading } = useFetch(
    () => (Array.isArray(teams) && teams.length
      ? Promise.all(teams.map(async (team) => ({ team, ...(await getTeamStats(team)) })))
      : Promise.resolve([])),
    [Array.isArray(teams) ? teams.join('|') : '']
  )

  const summary = useMemo(() => {
    const list = Array.isArray(teamStatsList) ? teamStatsList : []
    if (!list.length) return null
    const topWinRate = [...list].sort((a, b) => (b.win_pct || 0) - (a.win_pct || 0))[0]
    const topTitles = [...list].sort((a, b) => (b.titles || 0) - (a.titles || 0))[0]
    const bestAttack = [...list].sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0))[0]
    return { topWinRate, topTitles, bestAttack }
  }, [teamStatsList])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-heading text-lg">Failed to load teams</p>
        <p className="text-text-secondary text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SEO
        title="IPL Teams"
        description="Explore all IPL team analytics including win rates, performance stats, player rosters, and historical data for every franchise."
      />
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.16),transparent_0%,transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,184,0,0.12),transparent_0%,transparent_34%),linear-gradient(135deg,#0B0E16_0%,#101726_42%,#130F1D_100%)] p-5 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] animate-in">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-accent-cyan">
              <span className="h-2 w-2 rounded-full bg-accent-cyan animate-pulse" />
              Franchise hub
            </span>
            <div>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-text-primary">Team Analytics</h1>
              <p className="mt-2 text-sm text-text-secondary max-w-2xl leading-relaxed">
                Richer franchise cards with win rate, titles, scoring profile, and deeper team-level exploration from one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
              <span className="rounded-full border border-accent-cyan/20 bg-accent-cyan/10 px-3 py-1 text-accent-cyan">{loading ? 'Loading…' : `${(teams || []).length} franchises`}</span>
              <span className="rounded-full border border-accent-lime/20 bg-accent-lime/10 px-3 py-1 text-accent-lime">Profile, season trend, H2H ready</span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">Best win rate</p>
              <p className="mt-1 text-lg font-heading font-bold text-accent-cyan stat-glow-cyan">{summary?.topWinRate ? `${formatDecimal(summary.topWinRate.win_pct, 1)}%` : '—'}</p>
              <p className="mt-1 text-[11px] text-text-muted">{summary?.topWinRate?.team || 'Loading team pulse'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">Most titles</p>
              <p className="mt-1 text-lg font-heading font-bold text-accent-amber stat-glow-amber">{summary?.topTitles?.titles ?? '—'}</p>
              <p className="mt-1 text-[11px] text-text-muted">{summary?.topTitles?.team || 'Championship view'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">Best avg score</p>
              <p className="mt-1 text-lg font-heading font-bold text-accent-lime stat-glow-lime">{summary?.bestAttack ? formatDecimal(summary.bestAttack.avg_score, 1) : '—'}</p>
              <p className="mt-1 text-[11px] text-text-muted">{summary?.bestAttack?.team || 'Scoring benchmark'}</p>
            </div>
          </div>
        </div>
      </section>

      {loading || statsLoading ? (
        <Loading message="Loading teams..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(teams || []).map((team) => {
            const stats = (teamStatsList || []).find((entry) => entry.team === team)
            return <TeamCard key={team} team={team} stats={stats} loading={statsLoading} />
          })}
        </div>
      )}
    </div>
  )
}
