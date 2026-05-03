import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import SEO from '../components/SEO'
import { useFetch } from '../hooks/useFetch'
import { getMatches, getSeasons, getTeams } from '../lib/api'
import Loading from '../components/ui/Loading'
import MultiSeasonSelect from '../components/ui/MultiSeasonSelect'
import { formatDate, getMatchResult } from '../utils/format'
import { getTeamAbbr } from '../constants/teams'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import TeamLogo from '../components/ui/TeamLogo'

const PAGE_SIZE = 24

/* ── Match Card Component ───────────────────────────── */
function MatchCard({ match, index }) {
  const navigate = useNavigate()
  const result = getMatchResult(match)
  const isTeam1Winner = match.winner === match.team1
  const isTeam2Winner = match.winner === match.team2
  
  return (
    <div 
      onClick={() => navigate(`/matches/${match.match_id}`)}
      className="group relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-card p-6 cursor-pointer transition-all duration-300 hover:border-accent-cyan/40 hover:bg-bg-card-hover hover:-translate-y-1 shadow-lg"
      style={{ animationDelay: `${index * 20}ms` }}
    >
      <div className="relative z-10 flex flex-col h-full space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">{formatDate(match.date)}</span>
          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-bg-elevated border border-border-subtle text-text-secondary">
            {match.city || 'IPL'}
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <TeamLogo team={match.team1} size={36} className="transition-transform group-hover:scale-110" />
              <span className={`text-base font-black font-heading tracking-tight ${isTeam1Winner ? 'text-text-primary' : 'text-text-muted'}`}>
                {getTeamAbbr(match.team1)}
              </span>
            </div>
            {isTeam1Winner && <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan shadow-glow-cyan" />}
          </div>

          <div className="relative flex items-center justify-center py-1 opacity-20">
            <div className="absolute inset-x-0 h-px bg-text-muted/20" />
            <span className="relative z-10 px-3 bg-bg-card text-[9px] font-black text-text-muted italic">VS</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <TeamLogo team={match.team2} size={36} className="transition-transform group-hover:scale-110" />
              <span className={`text-base font-black font-heading tracking-tight ${isTeam2Winner ? 'text-text-primary' : 'text-text-muted'}`}>
                {getTeamAbbr(match.team2)}
              </span>
            </div>
            {isTeam2Winner && <div className="w-1.5 h-1.5 rounded-full bg-accent-magenta shadow-glow-magenta" />}
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-border-subtle flex items-center justify-between gap-4">
          <p className="text-[11px] font-bold text-text-secondary line-clamp-2 leading-tight flex-1">
            {result}
          </p>
          {match.player_of_match && (
             <PlayerAvatar name={match.player_of_match} size={24} />
          )}
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
      <div className="flex flex-col items-center justify-center py-40 gap-6">
        <div className="w-16 h-16 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger text-2xl font-black">!</div>
        <div className="text-center">
          <h2 className="text-2xl font-black font-heading text-text-primary uppercase tracking-tight">System Error</h2>
          <p className="text-text-muted mt-2">Unable to connect to the match archive stream.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-12 pb-24 max-w-7xl mx-auto">
      <SEO title="Match Archive - IPL Analytics Hub" description="Complete historical records of every IPL match. Filter by season and participating teams." />

      {/* ── HEADER & FILTERS ─────────────────────────────────── */}
      <section className="space-y-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
           <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/20 bg-accent-cyan/5 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-accent-cyan">
                Match Archive Database
              </span>
              <h1 className="text-4xl md:text-6xl font-black font-heading text-text-primary tracking-tighter leading-none uppercase">
                Match<br/><span className="text-text-muted">Center</span>
              </h1>
           </div>

           <div className="flex flex-wrap items-center gap-6 bg-bg-card border border-border-subtle rounded-2xl p-6 shadow-xl relative">
              <div className="flex flex-col gap-2">
                 <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Season</label>
                 <MultiSeasonSelect seasons={seasons || []} value={season} onChange={(val) => updateParam('season', val)} />
              </div>
              <div className="w-px h-10 bg-border-subtle mx-2 hidden sm:block" />
              <div className="flex flex-col gap-2">
                 <label className="text-[9px] font-black uppercase tracking-widest text-text-muted px-1">Team Filter</label>
                 <select
                    value={team}
                    onChange={(e) => updateParam('team', e.target.value)}
                    className="w-56"
                 >
                    <option value="">All Teams</option>
                    {(teams || []).map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
              </div>
           </div>
        </div>
      </section>

      {/* ── MATCH GRID ────────────────────────────────────────── */}
      <section className="relative">
        {loading ? (
          <Loading message="Syncing match records..." />
        ) : matches.length === 0 ? (
          <div className="py-40 text-center bg-bg-card rounded-3xl border border-border-subtle border-dashed">
             <p className="text-text-muted font-black uppercase tracking-widest">No match records found</p>
             <button 
               onClick={() => setSearchParams({})}
               className="mt-6 px-8 py-3 bg-text-primary text-bg-primary font-black uppercase tracking-widest text-[10px] rounded-lg hover:opacity-90 transition-all"
             >
               Clear Filters
             </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in">
            {matches.map((m, idx) => (
              <MatchCard key={m.match_id} match={m} index={idx} />
            ))}
          </div>
        )}
      </section>

      {/* ── PAGINATION ────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-12 border-t border-border-subtle">
           <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
             Viewing <span className="text-text-primary">{offset + 1}—{Math.min(offset + PAGE_SIZE, total)}</span> of {total} records
           </p>
           <div className="flex items-center gap-4">
              <button
                onClick={() => updateParam('page', String(page - 1))}
                disabled={page <= 1}
                className="px-6 py-2 rounded-lg border border-border-subtle text-[10px] font-black uppercase tracking-widest disabled:opacity-20 hover:bg-bg-card-hover transition-all"
              >
                Prev
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-elevated border border-border-subtle">
                 <span className="text-[10px] font-black text-text-muted">PAGE</span>
                 <span className="text-sm font-black text-text-primary font-mono">{page}</span>
                 <span className="text-[10px] font-black text-text-muted">/</span>
                 <span className="text-sm font-black text-text-secondary font-mono">{totalPages}</span>
              </div>
              <button
                onClick={() => updateParam('page', String(page + 1))}
                disabled={page >= totalPages}
                className="px-6 py-2 rounded-lg border border-border-subtle text-[10px] font-black uppercase tracking-widest disabled:opacity-20 hover:bg-bg-card-hover transition-all"
              >
                Next
              </button>
           </div>
        </div>
      )}
    </div>
  )
}
