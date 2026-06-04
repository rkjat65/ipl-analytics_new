import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getTeams, getTeamStats } from '../lib/api'
import SEO from '../components/SEO'
import Loading from '../components/ui/Loading'
import { formatDecimal } from '../utils/format'
import { getTeamAbbr, getTeamColor } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import {
  AnalyticsChartShell,
  GlassTooltipSurface,
  cartesianGridProps,
  CHART_ANIMATION,
  axisTickPrimary,
} from '../components/charts'

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

  const winIndexChart = useMemo(() => {
    const list = Array.isArray(teamStatsList) ? teamStatsList : []
    return [...list]
      .filter((t) => t && t.team && typeof t.win_pct === 'number')
      .sort((a, b) => (b.win_pct || 0) - (a.win_pct || 0))
      .map((t) => ({
        abbr: getTeamAbbr(t.team),
        fullTeam: t.team,
        win_pct: Number(t.win_pct),
        matches: t.matches,
        fill: getTeamColor(t.team),
      }))
  }, [teamStatsList])

  if (error) return (
    <div className="py-20 text-center">
       <p className="text-danger font-black font-heading text-2xl uppercase tracking-tighter">System Error</p>
       <p className="text-text-secondary mt-2">{error}</p>
    </div>
  )

  return (
    <div className="space-y-16 pb-24">
      <SEO
        title="IPL Teams & Franchise Stats | Crickrida"
        description="Complete IPL franchise analytics — win/loss records, season-by-season performance, points tables, and historical data for all 10 IPL teams including CSK, MI, RCB, KKR, SRH, RR, DC, PBKS, LSG, and GT."
        keywords="IPL teams, CSK stats, Mumbai Indians, Royal Challengers Bengaluru, KKR, Sunrisers Hyderabad, IPL franchise records, IPL team history"
        url="https://crickrida.rkjat.in/teams"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "IPL Teams & Franchise Analytics",
          "description": "Complete IPL team analytics with win/loss records, season performances, and historical data for all 10 IPL franchises.",
          "url": "https://crickrida.rkjat.in/teams",
          "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://crickrida.rkjat.in/dashboard" },
              { "@type": "ListItem", "position": 2, "name": "Teams", "item": "https://crickrida.rkjat.in/teams" }
            ]
          }
        }}
      />

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

      {/* ── LEAGUE WIN INDEX (ALL FRANCHISES) ───────────────── */}
      {!loading && !statsLoading && winIndexChart.length > 0 && (
        <AnalyticsChartShell
          title="Franchise win index"
          subtitle="Career win rate • ordered best → rest"
          insight="Quick scan of long-run efficiency — compare bar length before drilling into a team's HQ page."
          accent="cyan"
          badge="League snapshot"
          chartClassName="h-[min(520px,70vh)] min-h-[320px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={winIndexChart} layout="vertical" margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
              <CartesianGrid {...cartesianGridProps} />
              <XAxis
                type="number"
                domain={[0, 'auto']}
                tick={axisTickPrimary}
                axisLine={{ stroke: '#2A2A3A' }}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="abbr"
                width={52}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#C8C8D8', fontSize: 11, fontWeight: 800 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,229,255,0.06)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <GlassTooltipSurface title={d?.fullTeam} eyebrow="Win index">
                      <p className="text-sm font-semibold" style={{ color: d?.fill }}>
                        Win rate: <span className="font-mono">{formatDecimal(d?.win_pct, 2)}%</span>
                      </p>
                      <p className="mt-1 text-[11px] text-text-muted">Matches logged: {d?.matches ?? '—'}</p>
                    </GlassTooltipSurface>
                  )
                }}
              />
              <Bar dataKey="win_pct" radius={[0, 10, 10, 0]} barSize={18} {...CHART_ANIMATION}>
                {winIndexChart.map((entry, i) => (
                  <Cell key={entry.fullTeam} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartShell>
      )}

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
