import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import {
  getSeasons,
  getCaptainStatsDuckdb,
  getIPL2026CaptainStats,
  getIPL2026Captains,
} from '../lib/api'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import Loading from '../components/ui/Loading'
import SEO from '../components/SEO'

function pctLabel(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return `${v}%`
}

function CaptainLeaderboardTable({ captains, emptyHint }) {
  const rows = captains || []
  return (
    <div className="rounded-xl border border-border-subtle/60 overflow-x-auto">
      <table className="w-full text-xs min-w-[520px]">
        <thead>
          <tr className="border-b border-border-subtle/40 bg-white/[0.02] text-[10px] font-bold text-text-muted uppercase tracking-wider">
            <th className="py-2 pl-3 pr-2 text-left">#</th>
            <th className="py-2 pr-2 text-left">Captain</th>
            <th className="py-2 text-center w-10">M</th>
            <th className="py-2 text-center w-10 text-accent-lime">W</th>
            <th className="py-2 text-center w-10">L</th>
            <th className="py-2 text-center w-10">NR</th>
            <th className="py-2 pr-3 text-right w-14">Win%</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-6 text-center text-text-muted font-mono text-[11px]">
                {emptyHint}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={`${row.captain}-${idx}`} className="border-b border-border-subtle/20 hover:bg-white/[0.02]">
                <td className="py-2.5 pl-3 pr-2 font-mono text-text-muted">{idx + 1}</td>
                <td className="py-2.5 pr-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {row.image ? (
                      <img src={row.image} alt="" className="w-7 h-7 rounded-full object-cover border border-border-subtle shrink-0" />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-white/[0.06] shrink-0" />
                    )}
                    <Link
                      to={`/players/${encodeURIComponent(row.captain)}`}
                      className="font-bold text-text-primary hover:text-accent-cyan truncate"
                    >
                      {row.captain}
                    </Link>
                  </div>
                </td>
                <td className="py-2.5 text-center font-mono text-text-secondary">{row.played}</td>
                <td className="py-2.5 text-center font-mono font-bold text-accent-lime">{row.won}</td>
                <td className="py-2.5 text-center font-mono text-text-secondary">{row.lost}</td>
                <td className="py-2.5 text-center font-mono text-text-muted">{row.nr}</td>
                <td className="py-2.5 pr-3 text-right font-mono text-text-primary">{pctLabel(row.winPct)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function CaptainByTeamGrid({ byTeam }) {
  const blocks = byTeam || []
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {blocks.map((block) => {
        const color = getTeamColor(block.team)
        return (
          <div
            key={block.team}
            className="rounded-lg border border-border-subtle/60 bg-bg-card/50 overflow-hidden"
            style={{ borderLeftWidth: 3, borderLeftColor: color }}
          >
            <div className="px-3 py-2 flex items-center gap-2 border-b border-border-subtle/30 bg-white/[0.02]">
              <TeamLogo team={block.team} size={28} />
              <span className="text-xs font-black text-text-primary">{getTeamAbbr(block.team)}</span>
              <span className="text-[10px] text-text-muted truncate">{block.team}</span>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[9px] font-bold text-text-muted uppercase tracking-wider">
                  <th className="py-1.5 pl-3 text-left">Captain</th>
                  <th className="py-1.5 text-center w-8">M</th>
                  <th className="py-1.5 text-center w-8 text-accent-lime">W</th>
                  <th className="py-1.5 text-center w-8">L</th>
                  <th className="py-1.5 text-center w-8">NR</th>
                  <th className="py-1.5 pr-3 text-right w-12">%</th>
                </tr>
              </thead>
              <tbody>
                {block.captains?.length ? (
                  block.captains.map((r) => (
                    <tr key={`${block.team}-${r.captain}`} className="border-t border-border-subtle/15">
                      <td className="py-1.5 pl-3 pr-1">
                        <Link
                          to={`/players/${encodeURIComponent(r.captain)}`}
                          className="font-semibold text-text-primary hover:text-accent-cyan truncate block max-w-[140px]"
                          title={r.captain}
                        >
                          {r.captain}
                        </Link>
                      </td>
                      <td className="py-1.5 text-center font-mono text-text-secondary">{r.played}</td>
                      <td className="py-1.5 text-center font-mono font-bold text-accent-lime">{r.won}</td>
                      <td className="py-1.5 text-center font-mono">{r.lost}</td>
                      <td className="py-1.5 text-center font-mono text-text-muted">{r.nr}</td>
                      <td className="py-1.5 pr-3 text-right font-mono">{pctLabel(r.winPct)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-3 text-center text-text-muted">
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

function SquadCaptainsGrid({ teams }) {
  const list = teams || []
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {list.map((row) => {
        const color = getTeamColor(row.team)
        return (
          <div
            key={row.team}
            className="rounded-xl border border-border-subtle/80 bg-bg-card/80 p-3 flex gap-3 min-h-[88px]"
            style={{ borderLeftWidth: 3, borderLeftColor: color }}
          >
            <TeamLogo team={row.team} size={40} className="shrink-0" />
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted truncate">{getTeamAbbr(row.team)}</p>
              {row.captain ? (
                <>
                  {row.image ? (
                    <img
                      src={row.image}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover border border-border-subtle mt-1 mb-1"
                    />
                  ) : null}
                  <Link
                    to={`/players/${encodeURIComponent(row.captain)}`}
                    className="text-sm font-bold text-text-primary hover:text-accent-cyan truncate leading-tight"
                    title={row.captain}
                  >
                    {row.captain}
                  </Link>
                </>
              ) : (
                <span className="text-sm font-mono text-text-muted">—</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Captains() {
  const [tab, setTab] = useState('seasons')
  const { data: seasonsList } = useFetch(() => getSeasons(), [])
  const [duckSeason, setDuckSeason] = useState('2024')

  useEffect(() => {
    if (!seasonsList?.length) return
    setDuckSeason((prev) => {
      if (seasonsList.includes(prev)) return prev
      if (seasonsList.includes('2024')) return '2024'
      const non26 = seasonsList.find((s) => String(s) !== '2026')
      return non26 || seasonsList[0]
    })
  }, [seasonsList])

  const duckSeasons = useMemo(() => {
    if (!seasonsList?.length) return []
    return [...seasonsList].filter((s) => String(s) !== '2026').sort((a, b) => String(b).localeCompare(String(a)))
  }, [seasonsList])

  const duckSeasonOptions = useMemo(() => {
    const base = duckSeasons.length ? duckSeasons : ['2024', '2023', '2022', '2021', '2020']
    if (duckSeason && !base.includes(duckSeason)) return [duckSeason, ...base]
    return base
  }, [duckSeasons, duckSeason])

  const {
    data: duckStats,
    loading: duckLoading,
    error: duckError,
  } = useFetch(() => getCaptainStatsDuckdb(duckSeason), [duckSeason])

  const { data: live26Stats, loading: live26Loading, error: live26Err } = useFetch(
    () => getIPL2026CaptainStats(2026),
    [],
  )
  const { data: live26Squads, loading: squadsLoading, error: squadsErr } = useFetch(() => getIPL2026Captains(), [])

  return (
    <div className="space-y-6">
      <SEO
        title="Captains — Crickrida"
        description="IPL captain statistics, win-loss records by franchise, and current playing-XI captains."
        url="https://crickrida.rkjat.in/captains"
        keywords="IPL captains, captain statistics, IPL win loss captain, playing XI captain"
      />

      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-accent-amber/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-accent-amber">
              <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 17.8 5.7 21l2.3-7-6-4.6h7.6L12 2z" />
            </svg>
          </span>
          Captains
        </h1>
        <p className="text-xs text-text-muted mt-1">Playing-XI captain stats, franchise breakdowns, and live IPL 2026 snapshots</p>
        <p className="text-[10px] text-text-muted/90 leading-relaxed max-w-4xl mt-3 border-l-2 border-accent-cyan/30 pl-3">
          <span className="text-text-secondary font-semibold">Data coverage:</span> Historical IPL numbers use Sportmonks lineups matched to the analytics database; on this feed, captain-level data is reliable from{' '}
          <strong className="text-text-primary">IPL 2013</strong> onward once matches are backfilled (very old seasons in the DB may show empty until you run the backfill and deploy to Oracle).{' '}
          <strong className="text-text-primary">IPL 2026</strong> live tabs use the scorecard cache and fill in as completed games include full XIs. After you backfill remaining rows on the server, refresh this page to see updates.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-1 rounded-xl bg-white/[0.03] border border-border-subtle/60 w-fit">
        <button
          type="button"
          onClick={() => setTab('seasons')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            tab === 'seasons'
              ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
              : 'text-text-muted hover:text-text-primary border border-transparent'
          }`}
        >
          IPL seasons (database)
        </button>
        <button
          type="button"
          onClick={() => setTab('ipl26')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            tab === 'ipl26'
              ? 'bg-accent-amber/15 text-accent-amber border border-accent-amber/30'
              : 'text-text-muted hover:text-text-primary border border-transparent'
          }`}
        >
          IPL 2026 (live cache)
        </button>
      </div>

      {tab === 'seasons' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="captain-season" className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Season
            </label>
            <select
              id="captain-season"
              value={duckSeason}
              onChange={(e) => setDuckSeason(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs border border-border-subtle bg-bg-card text-text-primary focus:outline-none focus:border-accent-cyan min-w-[140px]"
            >
              {duckSeasonOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {duckStats?.enrichedRows != null && (
              <span className="text-[10px] text-text-muted font-mono">
                {duckStats.enrichedRows} matches with captain rows cached · source {duckStats.source}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle/50 bg-white/[0.02]">
              <h2 className="text-sm font-bold text-text-primary">Captain record · season {duckSeason}</h2>
              <p className="text-[10px] text-text-muted mt-0.5">
                Wins and losses attributed to the flagged captain in each team&apos;s XI (Sportmonks), joined to match results in DuckDB.
              </p>
            </div>
            <div className="p-4 space-y-5">
              {duckLoading && <Loading />}
              {duckError && <p className="text-sm text-accent-magenta">{duckError}</p>}
              {!duckLoading && !duckError && (
                <>
                  {duckStats?.matchesUsed === 0 && (
                    <p className="text-xs text-text-muted">
                      No captain cache for this season yet. After backfilling on the server, reload this page.
                    </p>
                  )}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent-cyan mb-2">Leaderboard</h3>
                    <CaptainLeaderboardTable
                      captains={duckStats?.captains}
                      emptyHint="No captain rows for this season in the cache yet."
                    />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent-magenta mb-2">Team-wise</h3>
                    <CaptainByTeamGrid byTeam={duckStats?.byTeam} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'ipl26' && (
        <div className="space-y-6">
          <p className="text-[10px] text-text-muted">
            Same data as the{' '}
            <Link to="/ipl-schedule" className="text-accent-cyan font-bold hover:underline">
              IPL 2026
            </Link>{' '}
            schedule page — shown here for convenience.
          </p>

          <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle/50 bg-white/[0.02]">
              <h2 className="text-sm font-bold text-text-primary">Captain statistics (live scorecards)</h2>
              <p className="text-[10px] text-text-muted mt-0.5">Completed matches with lineups + winners in the local live cache.</p>
            </div>
            <div className="p-4 space-y-5">
              {live26Loading && <Loading />}
              {live26Err && <p className="text-sm text-accent-magenta">{live26Err}</p>}
              {!live26Loading && !live26Err && (
                <>
                  {live26Stats?.matchesUsed === 0 && (
                    <p className="text-xs text-text-muted">
                      No finished IPL 2026 games with lineups in the cache yet. Keep the live poller running during matches.
                    </p>
                  )}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent-cyan mb-2">Leaderboard</h3>
                    <CaptainLeaderboardTable
                      captains={live26Stats?.captains}
                      emptyHint="No completed IPL 2026 matches with captains in the live cache yet."
                    />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent-magenta mb-2">Team-wise</h3>
                    <CaptainByTeamGrid byTeam={live26Stats?.byTeam} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle/50 bg-white/[0.02]">
              <h2 className="text-sm font-bold text-text-primary">Latest XI captains (from cache)</h2>
              <p className="text-[10px] text-text-muted mt-0.5">Most recent playing-XI captain flagged per franchise when lineups exist.</p>
            </div>
            <div className="p-4">
              {squadsLoading && <Loading />}
              {squadsErr && <p className="text-sm text-accent-magenta">{squadsErr}</p>}
              {!squadsLoading && !squadsErr && <SquadCaptainsGrid teams={live26Squads?.teams} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
