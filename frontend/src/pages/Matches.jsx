import { useState, useMemo } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import SEO from '../components/SEO'
import { useFetch } from '../hooks/useFetch'
import { getMatches, getSeasons, getTeams } from '../lib/api'
import Loading from '../components/ui/Loading'
import MultiSeasonSelect from '../components/ui/MultiSeasonSelect'
import { formatDate, formatDecimal, getMatchResult, formatNumber } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import TeamLogo from '../components/ui/TeamLogo'

const PAGE_SIZE = 24

/* ── Match Card Component ───────────────────────────── */
function MatchHeroCard({ match, index }) {
  const navigate = useNavigate()
  const result = getMatchResult(match)
  const isTeam1Winner = match.winner === match.team1
  const isTeam2Winner = match.winner === match.team2
  
  return (
    <div 
      onClick={() => navigate(`/matches/${match.match_id}`)}
      className="group relative overflow-hidden rounded-[24px] border border-white/5 bg-[#0B0E16] p-6 cursor-pointer transition-all duration-500 hover:scale-[1.02] hover:border-white/20 hover:shadow-2xl"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">{formatDate(match.date)}</span>
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-text-muted">
            {match.city || 'IPL'}
          </span>
        </div>

        <div className="space-y-6 flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <TeamLogo team={match.team1} size={44} className="drop-shadow-lg" />
              <span className={`text-lg font-black font-heading tracking-tight ${isTeam1Winner ? 'text-white' : 'text-text-muted'}`}>
                {getTeamAbbr(match.team1)}
              </span>
            </div>
            {isTeam1Winner && <div className="h-1 w-8 rounded-full bg-accent-cyan shadow-[0_0_10px_#00E5FF]" />}
          </div>

          <div className="relative flex items-center justify-center py-1">
            <div className="absolute inset-x-0 h-px bg-white/5" />
            <span className="relative z-10 px-3 bg-[#0B0E16] text-[10px] font-black text-white/20 italic">VS</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <TeamLogo team={match.team2} size={44} className="drop-shadow-lg" />
              <span className={`text-lg font-black font-heading tracking-tight ${isTeam2Winner ? 'text-white' : 'text-text-muted'}`}>
                {getTeamAbbr(match.team2)}
              </span>
            </div>
            {isTeam2Winner && <div className="h-1 w-8 rounded-full bg-accent-magenta shadow-[0_0_10px_#FF2D78]" />}
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
          <p className="text-[11px] font-black uppercase tracking-tighter text-accent-cyan line-clamp-1">{result}</p>
          {match.player_of_match && (
            <PlayerAvatar name={match.player_of_match} size={24} ringColor="#FFB800" />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Match Spotlight (Featured) ───────────────────────── */
function MatchSpotlight({ match }) {
  if (!match) return null
  return (
    <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0B0E16] min-h-[400px] flex items-center group">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.1),transparent_70%)]" />
      <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      
      <div className="relative w-full p-8 md:p-16 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-12">
        {/* Team 1 Side */}
        <div className="flex flex-col items-center lg:items-end text-center lg:text-right gap-6 order-2 lg:order-1">
          <div className="relative">
             <div className="absolute inset-0 blur-3xl opacity-30 rounded-full" style={{ backgroundColor: getTeamColor(match.team1) }} />
             <TeamLogo team={match.team1} size={140} className="relative drop-shadow-2xl group-hover:scale-110 transition-transform duration-700" />
          </div>
          <div>
            <h3 className="text-3xl md:text-5xl font-black font-heading text-white tracking-tighter mb-2">{match.team1}</h3>
            <span className="px-4 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-text-muted">Challenger</span>
          </div>
        </div>

        {/* Center Info */}
        <div className="flex flex-col items-center gap-6 z-10 order-1 lg:order-2">
          <span className="px-3 py-1 rounded-full bg-accent-amber/10 border border-accent-amber/20 text-[10px] font-black uppercase tracking-[0.3em] text-accent-amber">Featured Match</span>
          <div className="text-5xl md:text-7xl font-black italic text-white/5 select-none">VS</div>
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.4em] text-text-muted mb-2">{formatDate(match.date)}</p>
            <p className="text-sm font-bold text-accent-cyan uppercase tracking-tighter">{match.venue}</p>
          </div>
          <Link to={`/matches/${match.match_id}`} className="mt-4 px-10 py-4 bg-white text-black font-black uppercase tracking-[0.2em] text-xs rounded-full hover:scale-105 transition-transform shadow-2xl">
            View Scorecard
          </Link>
        </div>

        {/* Team 2 Side */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-6 order-3">
          <div className="relative">
             <div className="absolute inset-0 blur-3xl opacity-30 rounded-full" style={{ backgroundColor: getTeamColor(match.team2) }} />
             <TeamLogo team={match.team2} size={140} className="relative drop-shadow-2xl group-hover:scale-110 transition-transform duration-700" />
          </div>
          <div>
            <h3 className="text-3xl md:text-5xl font-black font-heading text-white tracking-tighter mb-2">{match.team2}</h3>
            <span className="px-4 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-text-muted">Challenger</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Matches() {
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

  function updateParam(key, value) {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    if (key !== 'page') params.delete('page')
    setSearchParams(params)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-heading text-lg">Failed to load match center</p>
        <p className="text-text-secondary text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-12 pb-20">
      <SEO title="IPL Match Center - History & Results" description="Explore 17+ years of IPL match history. Filter by season and team." />

      {/* ── HEADER & FEATURED ─────────────────────────────────── */}
      <section className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
           <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-accent-cyan mb-4">
                The Archive
              </span>
              <h1 className="text-5xl md:text-7xl font-black font-heading text-text-primary tracking-tighter leading-none">
                Match Center
              </h1>
           </div>

           <div className="flex flex-wrap items-center gap-4 bg-white/5 border border-white/10 rounded-[24px] p-4">
              <div className="flex flex-col gap-1.5">
                 <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Season Filter</label>
                 <MultiSeasonSelect seasons={seasons || []} value={season} onChange={(val) => updateParam('season', val)} />
              </div>
              <div className="w-px h-10 bg-white/10 mx-2 hidden sm:block" />
              <div className="flex flex-col gap-1.5">
                 <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Team Filter</label>
                 <select
                    value={team}
                    onChange={(e) => updateParam('team', e.target.value)}
                    className="bg-transparent border border-white/10 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-tighter text-white focus:outline-none focus:border-accent-cyan transition-colors"
                 >
                    <option value="">All Teams</option>
                    {(teams || []).map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
              </div>
           </div>
        </div>

        {!loading && page === 1 && !team && matches.length > 0 && (
          <MatchSpotlight match={matches[0]} />
        )}
      </section>

      {/* ── MATCH GRID ────────────────────────────────────────── */}
      <section>
        {loading ? (
          <Loading message="Querying match records..." />
        ) : matches.length === 0 ? (
          <div className="py-20 text-center card bg-white/[0.02]">
             <p className="text-text-muted font-black uppercase tracking-widest">No Matches Found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {matches.map((m, idx) => (
              <MatchHeroCard key={m.match_id} match={m} index={idx} />
            ))}
          </div>
        )}
      </section>

      {/* ── PAGINATION ────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-10 border-t border-white/5">
           <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
             Records <span className="text-white">{offset + 1}—{Math.min(offset + PAGE_SIZE, total)}</span> of {total}
           </p>
           <div className="flex items-center gap-2">
              <button
                onClick={() => updateParam('page', String(page - 1))}
                disabled={page <= 1}
                className="px-6 py-2 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest disabled:opacity-20 hover:bg-white hover:text-black transition-all"
              >
                Back
              </button>
              <span className="text-[10px] font-black px-4">{page} / {totalPages}</span>
              <button
                onClick={() => updateParam('page', String(page + 1))}
                disabled={page >= totalPages}
                className="px-6 py-2 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest disabled:opacity-20 hover:bg-white hover:text-black transition-all"
              >
                Next
              </button>
           </div>
        </div>
      )}
    </div>
  )
}
