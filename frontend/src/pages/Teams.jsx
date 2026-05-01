import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getTeams, getTeamStats } from '../lib/api'
import SEO from '../components/SEO'
import Loading from '../components/ui/Loading'
import { formatDecimal } from '../utils/format'
import { getTeamColor } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'

/* ── Cinematic Team Card ────────────────────────────── */
function TeamHeroCard({ team, stats, index }) {
  const color = getTeamColor(team)
  if (!stats) return null

  return (
    <Link 
      to={`/teams/${encodeURIComponent(team)}`} 
      className="group relative h-[450px] overflow-hidden rounded-[40px] border border-white/5 bg-[#0B0E16] cursor-pointer shadow-2xl transition-all duration-700 hover:scale-[1.02] hover:border-white/20"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute -right-20 -top-20 opacity-[0.05] group-hover:opacity-[0.12] transition-all duration-1000 scale-[2] group-hover:scale-[2.5]"
        >
          <TeamLogo team={team} size={300} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E16] via-[#0B0E16]/60 to-transparent" />
        <div 
          className="absolute bottom-0 left-0 h-2 w-full opacity-30 group-hover:opacity-100 transition-all duration-500"
          style={{ backgroundColor: color, boxShadow: `0 0 30px ${color}` }}
        />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 p-10 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="relative group-hover:scale-110 transition-transform duration-700">
             <div className="absolute inset-0 blur-3xl opacity-30 group-hover:opacity-50 transition-opacity rounded-full" style={{ backgroundColor: color }} />
             <TeamLogo team={team} size={80} className="relative drop-shadow-2xl" />
          </div>
          <div className="text-right">
             <p className="text-[9px] font-black uppercase tracking-[0.4em] text-text-muted mb-1">Legacy</p>
             <p className="text-4xl font-black font-heading text-accent-amber tracking-tighter">
                {stats.titles || 0}<span className="text-sm ml-1 opacity-40">🏆</span>
             </p>
          </div>
        </div>

        <div>
          <h2 className="text-4xl font-black font-heading text-white tracking-tighter leading-[0.9] mb-8 group-hover:text-accent-cyan transition-colors">
            {team.split(' ').map((word, i, arr) => (
               <span key={i} className={i === arr.length - 1 ? 'block mt-1' : ''}>{word} </span>
            ))}
          </h2>
          
          <div className="grid grid-cols-2 gap-y-6 gap-x-4 border-t border-white/5 pt-8">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-text-muted mb-2">Win Index</p>
              <p className="text-2xl font-black font-heading text-accent-cyan tracking-tighter">{formatDecimal(stats.win_pct, 1)}%</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-text-muted mb-2">Deployments</p>
              <p className="text-2xl font-black font-heading text-white tracking-tighter">{stats.matches}</p>
            </div>
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

  if (error) return (
    <div className="py-20 text-center">
       <p className="text-danger font-black font-heading text-2xl uppercase tracking-tighter">System Error</p>
       <p className="text-text-secondary mt-2">{error}</p>
    </div>
  )

  return (
    <div className="space-y-16 pb-24">
      <SEO title="Franchise Intelligence Hub" />

      {/* ── BROADCAST HEADER ─────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0B0E16] p-12 md:p-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,229,255,0.08),transparent_40%)]" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-16">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-accent-cyan mb-8">
              Franchise Analytics Mainframe
            </span>
            <h1 className="text-6xl md:text-9xl font-black font-heading text-text-primary tracking-tighter leading-[0.75] mb-8">
              ELITE <br /> RIVALRIES
            </h1>
            <p className="text-xl text-text-secondary leading-relaxed max-w-xl font-medium opacity-80">
              Deep-dive into the historical dominance, tactical peaks, and championship legacies of the world's premier T20 franchises.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto">
             <div className="bg-[#0B0E16] border border-white/5 rounded-3xl p-8 min-w-[220px]">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted mb-3">Win King</p>
                <p className="text-4xl font-black font-heading text-accent-cyan tracking-tighter">{summary?.topWinRate ? `${formatDecimal(summary.topWinRate.win_pct, 1)}%` : '—'}</p>
                <p className="text-[10px] font-black text-white/20 mt-2 uppercase tracking-widest">{summary?.topWinRate?.team || '...'}</p>
             </div>
             <div className="bg-[#0B0E16] border border-white/5 rounded-3xl p-8 min-w-[220px]">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted mb-3">Title Holder</p>
                <p className="text-4xl font-black font-heading text-accent-amber tracking-tighter">{summary?.topTitles?.titles ?? '—'} Titles</p>
                <p className="text-[10px] font-black text-white/20 mt-2 uppercase tracking-widest">{summary?.topTitles?.team || '...'}</p>
             </div>
          </div>
        </div>
      </section>

      {/* ── FRANCHISE GRID ───────────────────────────────────── */}
      {loading || statsLoading ? (
        <Loading message="Syncing franchise databases..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
          {(teams || []).map((team, idx) => {
            const stats = (teamStatsList || []).find((entry) => entry.team === team)
            return <TeamHeroCard key={team} team={team} stats={stats} index={idx} />
          })}
        </div>
      )}
    </div>
  )
}
