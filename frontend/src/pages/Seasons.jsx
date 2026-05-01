import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import SEO from '../components/SEO'
import { getSeasons, getSeasonSummary, getPointsTable, getCapRace } from '../lib/api'
import Loading from '../components/ui/Loading'
import LeaderboardShowcaseModal from '../components/ui/LeaderboardShowcaseModal'
import { formatNumber, formatDecimal } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#16161F] border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-black flex items-center gap-2" style={{ color: entry.color || '#E8E8ED' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-mono">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function Seasons() {
  const { year } = useParams()
  const navigate = useNavigate()
  const [showcaseConfig, setShowcaseConfig] = useState(null)

  const { data: seasons } = useFetch(() => getSeasons(), [])
  const selectedYear = year || (seasons && seasons.length > 0 ? String(seasons[seasons.length - 1]) : '')

  const { data: summary, loading: summaryLoading } = useFetch(
    () => (selectedYear ? getSeasonSummary(selectedYear) : Promise.resolve(null)),
    [selectedYear]
  )

  const { data: pointsTable, loading: ptLoading } = useFetch(
    () => (selectedYear ? getPointsTable(selectedYear) : Promise.resolve(null)),
    [selectedYear]
  )

  const { data: capRace, loading: capLoading } = useFetch(
    () => (selectedYear ? getCapRace(selectedYear) : Promise.resolve(null)),
    [selectedYear]
  )

  const ptData = useMemo(() => (pointsTable || []).map((row, i) => ({ ...row, pos: i + 1 })), [pointsTable])

  return (
    <div className="space-y-12 pb-24">
      <SEO title={`IPL ${selectedYear} - Season Intelligence`} />

      {/* ── CINEMATIC HEADER ──────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0B0E16] p-10 md:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,229,255,0.08),transparent_40%)]" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-12">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-accent-cyan mb-6">
              Season Archive Unit
            </span>
            <h1 className="text-5xl md:text-8xl font-black font-heading text-text-primary tracking-tighter leading-none mb-8">
              IPL {selectedYear}
            </h1>
            <div className="flex items-center gap-4">
               <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Temporal Shift</label>
               <select 
                 value={selectedYear} 
                 onChange={(e) => navigate(`/seasons/${e.target.value}`)}
                 className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-black text-xs uppercase tracking-widest outline-none focus:border-accent-cyan transition-all appearance-none"
               >
                  {seasons?.map(s => <option key={s} value={String(s)}>{s}</option>)}
               </select>
            </div>
          </div>

          {!summaryLoading && summary && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full lg:w-auto">
               <div className="bg-[#0B0E16] border border-white/5 rounded-3xl p-6">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">Champion</p>
                  <p className="text-2xl font-black font-heading text-accent-cyan">{summary.winner || '—'}</p>
               </div>
               <div className="bg-[#0B0E16] border border-white/5 rounded-3xl p-6">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted mb-2">Total Matches</p>
                  <p className="text-2xl font-black font-heading text-white">{summary.total_matches}</p>
               </div>
            </div>
          )}
        </div>
      </section>

      {/* ── SEASON ANALYTICS ─────────────────────────────────── */}
      {summaryLoading ? <Loading message="Synthesizing season historical data..." /> : (
        <div className="space-y-12 animate-in">
           
           {/* 1. STANDINGS HUB */}
           <div className="bg-[#0B0E16] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                 <h3 className="text-2xl font-black font-heading text-white italic">Operational Standings</h3>
                 <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">Final Points Table</span>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="border-b border-white/5 bg-white/[0.02]">
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center w-16">Pos</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted">Unit Name</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">Mat</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">Wins</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">Pts</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">NRR</th>
                       </tr>
                    </thead>
                    <tbody>
                       {ptData.map((row, idx) => (
                          <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.03] transition-all group">
                             <td className="px-8 py-5 text-center">
                                <span className={`text-2xl font-black font-heading ${idx < 4 ? 'text-accent-cyan' : 'text-white/20'}`}>{row.pos}</span>
                             </td>
                             <td className="px-8 py-5">
                                <div className="flex items-center gap-4">
                                   <TeamLogo team={row.team} size={32} />
                                   <div>
                                      <p className="text-sm font-black text-white">{row.team}</p>
                                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{getTeamAbbr(row.team)}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-8 py-5 text-center font-mono text-text-secondary">{row.played}</td>
                             <td className="px-8 py-5 text-center font-mono font-black text-accent-lime">{row.won}</td>
                             <td className="px-8 py-5 text-center font-mono text-2xl font-black text-white">{row.points}</td>
                             <td className="px-8 py-5 text-right font-mono font-bold" style={{ color: row.nrr > 0 ? '#B8FF00' : '#FF2D78' }}>
                                {row.nrr > 0 ? '+' : ''}{formatDecimal(row.nrr, 3)}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>

           {/* 2. ELITE PERFORMANCE GRID */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Orange Cap */}
              <div className="bg-[#0B0E16] rounded-[40px] border border-white/5 p-10 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-accent-amber/5 blur-[80px]" />
                 <div className="relative z-10">
                    <div className="flex justify-between items-center mb-8">
                       <h3 className="text-2xl font-black font-heading text-accent-amber uppercase tracking-tighter italic">Lethality Leader</h3>
                       <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Orange Cap</span>
                    </div>
                    {summary.orange_cap ? (
                      <div className="flex items-center gap-8">
                         <div className="w-20 h-20 rounded-full bg-accent-amber/10 border border-accent-amber/20 flex items-center justify-center">
                            <svg className="w-10 h-10 text-accent-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                               <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 17.8 5.7 21l2.3-7-6-4.6h7.6L12 2z" />
                            </svg>
                         </div>
                         <div>
                            <Link to={`/batting/${encodeURIComponent(summary.orange_cap.player)}`} className="text-3xl font-black font-heading text-white hover:text-accent-amber transition-colors">{summary.orange_cap.player}</Link>
                            <p className="text-lg font-black text-accent-amber mt-1 font-mono">{summary.orange_cap.runs} Runs Peak</p>
                         </div>
                      </div>
                    ) : <p className="text-text-muted font-black uppercase tracking-widest italic opacity-20">No Data Encrypted</p>}
                 </div>
              </div>

              {/* Purple Cap */}
              <div className="bg-[#0B0E16] rounded-[40px] border border-white/5 p-10 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-accent-magenta/5 blur-[80px]" />
                 <div className="relative z-10">
                    <div className="flex justify-between items-center mb-8">
                       <h3 className="text-2xl font-black font-heading text-accent-magenta uppercase tracking-tighter italic">Destruction Lead</h3>
                       <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Purple Cap</span>
                    </div>
                    {summary.purple_cap ? (
                      <div className="flex items-center gap-8">
                         <div className="w-20 h-20 rounded-full bg-accent-magenta/10 border border-accent-magenta/20 flex items-center justify-center">
                            <svg className="w-10 h-10 text-accent-magenta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                               <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 17.8 5.7 21l2.3-7-6-4.6h7.6L12 2z" />
                            </svg>
                         </div>
                         <div>
                            <Link to={`/bowling/${encodeURIComponent(summary.purple_cap.player)}`} className="text-3xl font-black font-heading text-white hover:text-accent-magenta transition-colors">{summary.purple_cap.player}</Link>
                            <p className="text-lg font-black text-accent-magenta mt-1 font-mono">{summary.purple_cap.wickets} Wickets Secured</p>
                         </div>
                      </div>
                    ) : <p className="text-text-muted font-black uppercase tracking-widest italic opacity-20">No Data Encrypted</p>}
                 </div>
              </div>
           </div>

           {/* 3. SEASON VENUE INTELLIGENCE */}
           <div className="bg-[#0B0E16] rounded-[40px] border border-white/5 p-10">
              <h3 className="text-2xl font-black font-heading text-white mb-10 uppercase tracking-tighter italic">Territory Intel</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                 <div className="space-y-2">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Active Cities</p>
                    <p className="text-4xl font-black font-heading text-white">{summary.cities}</p>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Active Strongholds</p>
                    <p className="text-4xl font-black font-heading text-white">{summary.venues}</p>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Launch Date</p>
                    <p className="text-2xl font-black font-heading text-accent-cyan uppercase tracking-tighter">{summary.start_date}</p>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Termination Date</p>
                    <p className="text-2xl font-black font-heading text-accent-magenta uppercase tracking-tighter">{summary.end_date}</p>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
