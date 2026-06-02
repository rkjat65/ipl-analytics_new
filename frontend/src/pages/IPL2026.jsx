import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import SEO from '../components/SEO'
import {
  getSeasonSummary,
  getPointsTable,
  getBattingMatrix,
  getBowlingMatrix,
  getPhaseDominance
} from '../lib/api'
import Loading from '../components/ui/Loading'
import { formatNumber, formatDecimal } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import TeamLogo from '../components/ui/TeamLogo'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Cell, BarChart, Bar, Legend
} from 'recharts'

export default function IPL2026() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('championship')

  // Fetch season data
  const { data: summary, loading: summaryLoading } = useFetch(() => getSeasonSummary('2026'), [])
  const { data: pointsTable, loading: ptLoading } = useFetch(() => getPointsTable('2026'), [])
  
  // Advanced Analytics data (gated but fully unlocked for 2026)
  const { data: battingMatrix, loading: battingLoading } = useFetch(() => getBattingMatrix('2026', 5), [])
  const { data: bowlingMatrix, loading: bowlingLoading } = useFetch(() => getBowlingMatrix('2026', 5), [])
  const { data: phaseDominance, loading: phaseLoading } = useFetch(() => getPhaseDominance('2026'), [])

  // Process standings
  const ptData = useMemo(() => (pointsTable || []).map((row, i) => ({ ...row, pos: i + 1 })), [pointsTable])

  // Custom styling tokens
  const ACCENT_GOLD = '#F2C94C'
  const ACCENT_CYAN = '#00E5FF'
  const ACCENT_MAGENTA = '#FF2D78'
  const ACCENT_LIME = '#B8FF00'

  if (summaryLoading || ptLoading) {
    return <Loading message="Synthesizing IPL 2026 historical records..." />
  }

  return (
    <div className="space-y-10 pb-24">
      <SEO title="IPL 2026 Hub - Crickrida" />

      {/* ── HERO BANNER ────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#07090F] p-8 md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(242,201,76,0.1),transparent_50%)]" />
        <div className="absolute -right-32 -top-32 w-96 h-96 bg-accent-amber/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F2C94C]/35 bg-[#F2C94C]/10 px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#F2C94C]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F2C94C] animate-pulse" />
                Dedicated Premium Vault
              </span>
            </div>
            <h1 className="text-4xl md:text-7xl font-black font-heading text-text-primary tracking-tighter leading-none mb-3">
              IPL 2026
            </h1>
            <p className="text-text-secondary text-sm font-medium max-w-xl">
              Tournament intelligence and analytical insights for the legendary 2026 season, culminating in RCB's historic maiden title.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Archive</span>
            <select
              value="2026"
              onChange={(e) => navigate(e.target.value === '2026' ? '/seasons/2026' : `/seasons/${e.target.value}`)}
              className="bg-[#0B0E16] border border-white/10 rounded-xl px-4 py-2 text-white font-black text-xs uppercase tracking-widest outline-none focus:border-accent-cyan transition-all appearance-none cursor-pointer"
            >
              <option value="2026">IPL 2026 (Special Edition)</option>
              <option value="2025">IPL 2025</option>
              <option value="2024">IPL 2024</option>
              <option value="2023">IPL 2023</option>
              <option value="2022">IPL 2022</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── TAB NAVIGATION ─────────────────────────────────────── */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 border-b border-white/5 scrollbar-thin">
        <button
          onClick={() => setActiveTab('championship')}
          className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
            activeTab === 'championship'
              ? 'bg-[#F2C94C]/15 text-[#F2C94C] border border-[#F2C94C]/45 shadow-[0_12px_24px_rgba(242,201,76,0.06)]'
              : 'text-text-secondary hover:text-white border border-transparent hover:bg-white/[0.03]'
          }`}
        >
          🏆 Championship Room
        </button>
        <button
          onClick={() => setActiveTab('standings')}
          className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
            activeTab === 'standings'
              ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/45 shadow-[0_12px_24px_rgba(0,229,255,0.06)]'
              : 'text-text-secondary hover:text-white border border-transparent hover:bg-white/[0.03]'
          }`}
        >
          📊 Standings & Honors
        </button>
        <button
          onClick={() => setActiveTab('advanced')}
          className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
            activeTab === 'advanced'
              ? 'bg-accent-lime/15 text-accent-lime border border-accent-lime/45 shadow-[0_12px_24px_rgba(184,255,0,0.06)]'
              : 'text-text-secondary hover:text-white border border-transparent hover:bg-white/[0.03]'
          }`}
        >
          ⚡ Advanced Lab (Unlocked)
        </button>
      </div>

      {/* ── TAB CONTENTS ──────────────────────────────────────── */}

      {/* TAB 1: CHAMPIONSHIP ROOM */}
      {activeTab === 'championship' && (
        <div className="space-y-10 animate-in">
          
          {/* Main Tribute Card */}
          <div className="relative overflow-hidden rounded-[32px] border border-[#F2C94C]/25 bg-gradient-to-b from-[#181510] to-[#0A0907] p-8 md:p-12 shadow-[0_20px_50px_rgba(242,201,76,0.03)]">
            <div className="absolute right-0 top-0 w-80 h-80 bg-[#F2C94C]/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Left Column: Big Announcement */}
              <div className="lg:col-span-7 space-y-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F2C94C]/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#F2C94C] border border-[#F2C94C]/20">
                  Champions of India
                </span>
                <h2 className="text-4xl md:text-6xl font-black font-heading text-text-primary tracking-tight leading-none italic">
                  THE MAIDEN GLORY
                </h2>
                <p className="text-text-secondary text-sm leading-relaxed max-w-xl">
                  On May 31, 2026, Royal Challengers Bengaluru secured their long-awaited first IPL title in a clinical run chase against Gujarat Titans at the Narendra Modi Stadium, Ahmedabad.
                </p>

                {/* Final Scorecard */}
                <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Grand Final Scorecard</span>
                    <span className="text-[10px] font-mono text-[#F2C94C]">Ahmedabad • May 31</span>
                  </div>
                  
                  {/* Innings 1: GT */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <TeamLogo team="Gujarat Titans" size={24} />
                      <span className="text-sm font-black text-white">Gujarat Titans</span>
                    </div>
                    <span className="font-mono text-base font-bold text-text-secondary">155/8 <span className="text-xs text-text-muted">(20.0)</span></span>
                  </div>

                  {/* Innings 2: RCB */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <TeamLogo team="Royal Challengers Bengaluru" size={24} />
                      <span className="text-sm font-black text-[#F2C94C]">Royal Challengers Bengaluru</span>
                    </div>
                    <span className="font-mono text-lg font-black text-white">161/5 <span className="text-xs text-text-muted">(18.0)</span></span>
                  </div>

                  <div className="pt-2 text-xs font-black text-accent-lime uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-lime" />
                    RCB won by 5 wickets (12 balls remaining)
                  </div>
                </div>
              </div>

              {/* Right Column: Hero Visual - Virat Kohli */}
              <div className="lg:col-span-5 flex flex-col items-center lg:items-end justify-center">
                <div className="bg-black/60 border border-[#F2C94C]/20 rounded-3xl p-8 text-center max-w-sm w-full relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#F2C94C]/10 rounded-full blur-[30px]" />
                  <p className="text-[9px] font-black text-[#F2C94C] uppercase tracking-[0.2em] mb-4">Final Match MVP</p>
                  
                  <div className="w-20 h-20 rounded-full bg-[#F2C94C]/10 border border-[#F2C94C]/30 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#F2C94C]/5">
                    <span className="text-2xl font-black font-heading text-[#F2C94C]">VK</span>
                  </div>

                  <Link
                    to={`/players/${encodeURIComponent('V Kohli')}`}
                    className="text-2xl font-black font-heading text-white hover:text-[#F2C94C] transition-colors block mb-1"
                  >
                    Virat Kohli
                  </Link>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Royal Challengers Bengaluru</p>

                  <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-4">
                    <div>
                      <p className="text-xl font-mono font-black text-white">75</p>
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Runs</p>
                    </div>
                    <div>
                      <p className="text-xl font-mono font-black text-white">42</p>
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Balls</p>
                    </div>
                    <div>
                      <p className="text-xl font-mono font-black text-white">178.6</p>
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">SR</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-4 text-xs text-text-secondary font-mono">
                    <span>9 × Fours</span>
                    <span className="text-white/20">•</span>
                    <span>3 × Sixes</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Leaders & Record-Breakers Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Orange Cap */}
            <div className="bg-[#0B0E16] border border-[#FF822A]/15 rounded-3xl p-8 relative overflow-hidden shadow-xl">
              <div className="absolute right-0 top-0 w-24 h-24 bg-[#FF822A]/5 rounded-full blur-[40px]" />
              <div className="flex justify-between items-center mb-6">
                <span className="px-2.5 py-1 rounded bg-[#FF822A]/10 text-[9px] font-black uppercase tracking-wider text-[#FF822A] border border-[#FF822A]/20">Orange Cap</span>
                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest font-mono">Most Runs</span>
              </div>
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-[#FF822A]/10 border border-[#FF822A]/25 flex items-center justify-center text-lg font-black font-heading text-[#FF822A]">
                  VS
                </div>
                <div>
                  <Link to={`/players/${encodeURIComponent('V Suryavanshi')}`} className="text-lg font-black font-heading text-white hover:text-[#FF822A] transition-all">
                    V Suryavanshi
                  </Link>
                  <p className="text-[10px] font-bold text-text-muted uppercase mt-0.5">Rajasthan Royals</p>
                  <p className="text-2xl font-mono font-black text-white mt-2">{summary?.orange_cap?.runs || 776} <span className="text-xs font-normal text-text-muted">Runs</span></p>
                </div>
              </div>
            </div>

            {/* Purple Cap */}
            <div className="bg-[#0B0E16] border border-[#7B5EA7]/15 rounded-3xl p-8 relative overflow-hidden shadow-xl">
              <div className="absolute right-0 top-0 w-24 h-24 bg-[#7B5EA7]/5 rounded-full blur-[40px]" />
              <div className="flex justify-between items-center mb-6">
                <span className="px-2.5 py-1 rounded bg-[#7B5EA7]/10 text-[9px] font-black uppercase tracking-wider text-[#7B5EA7] border border-[#7B5EA7]/20">Purple Cap</span>
                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest font-mono">Most Wickets</span>
              </div>
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-[#7B5EA7]/10 border border-[#7B5EA7]/25 flex items-center justify-center text-lg font-black font-heading text-[#7B5EA7]">
                  KR
                </div>
                <div>
                  <Link to={`/players/${encodeURIComponent('K Rabada')}`} className="text-lg font-black font-heading text-white hover:text-[#7B5EA7] transition-all">
                    K Rabada
                  </Link>
                  <p className="text-[10px] font-bold text-text-muted uppercase mt-0.5">Gujarat Titans</p>
                  <p className="text-2xl font-mono font-black text-white mt-2">{summary?.purple_cap?.wickets || 29} <span className="text-xs font-normal text-text-muted">Wickets</span></p>
                </div>
              </div>
            </div>

            {/* Sixes King */}
            <div className="bg-[#0B0E16] border border-[#B8FF00]/15 rounded-3xl p-8 relative overflow-hidden shadow-xl">
              <div className="absolute right-0 top-0 w-24 h-24 bg-[#B8FF00]/5 rounded-full blur-[40px]" />
              <div className="flex justify-between items-center mb-6">
                <span className="px-2.5 py-1 rounded bg-[#B8FF00]/10 text-[9px] font-black uppercase tracking-wider text-[#B8FF00] border border-[#B8FF00]/20">Six King</span>
                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest font-mono">Maximums</span>
              </div>
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-[#B8FF00]/10 border border-[#B8FF00]/25 flex items-center justify-center text-lg font-black font-heading text-[#B8FF00]">
                  6s
                </div>
                <div>
                  <Link to={`/players/${encodeURIComponent('V Suryavanshi')}`} className="text-lg font-black font-heading text-white hover:text-[#B8FF00] transition-all">
                    V Suryavanshi
                  </Link>
                  <p className="text-[10px] font-bold text-text-muted uppercase mt-0.5">Rajasthan Royals</p>
                  <p className="text-2xl font-mono font-black text-white mt-2">72 <span className="text-xs font-normal text-text-muted">Sixes</span></p>
                </div>
              </div>
            </div>

          </div>

          {/* Quick tournament stats */}
          <div className="bg-[#07090F] rounded-3xl border border-white/5 p-8">
            <h3 className="text-base font-black font-heading text-white mb-6 uppercase tracking-widest">Tournament Intel</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Total Matches</p>
                <p className="text-3xl font-mono font-black text-white mt-1">74</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Total Runs Scored</p>
                <p className="text-3xl font-mono font-black text-white mt-1">27,450</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Total Wickets Fallen</p>
                <p className="text-3xl font-mono font-black text-white mt-1">880</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Total Sixes</p>
                <p className="text-3xl font-mono font-black text-white mt-1">1,425</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STANDINGS & HONORS */}
      {activeTab === 'standings' && (
        <div className="space-y-10 animate-in">
          
          {/* Points Table */}
          <div className="bg-[#07090F] rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <h3 className="text-lg font-black font-heading text-white uppercase tracking-wider">Operational Standings</h3>
              <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">IPL 2026 Points Table</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01]">
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted text-center w-12">Pos</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted">Unit Name</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted text-center">Played</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted text-center">Won</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted text-center">Lost</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted text-center">Points</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-text-muted text-right">NRR</th>
                  </tr>
                </thead>
                <tbody>
                  {ptData.map((row, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-all">
                      <td className="px-6 py-4 text-center">
                        <span className={`text-base font-black font-heading ${idx < 4 ? 'text-[#F2C94C]' : 'text-white/20'}`}>{row.pos}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <TeamLogo team={row.team} size={28} />
                          <div>
                            <span className="text-xs font-black text-white">{row.team}</span>
                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest ml-2">{getTeamAbbr(row.team)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-text-secondary text-xs">{row.played}</td>
                      <td className="px-6 py-4 text-center font-mono font-black text-accent-lime text-xs">{row.won}</td>
                      <td className="px-6 py-4 text-center font-mono text-xs text-text-muted">{row.lost}</td>
                      <td className="px-6 py-4 text-center font-mono text-sm font-black text-white">{row.points}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-xs" style={{ color: row.nrr > 0 ? '#B8FF00' : '#FF2D78' }}>
                        {row.nrr > 0 ? '+' : ''}{formatDecimal(row.nrr, 3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Season highlights & record details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Record batting scores */}
            <div className="bg-[#07090F] rounded-3xl border border-white/5 p-6">
              <h3 className="text-sm font-black font-heading text-white mb-6 uppercase tracking-widest">Highest Totals</h3>
              <div className="space-y-4">
                
                <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <span className="text-xs font-black text-white">Punjab Kings</span>
                    <p className="text-[10px] text-text-muted mt-0.5">vs Delhi Capitals • Apr 25</p>
                  </div>
                  <span className="font-mono text-lg font-black text-white">265/6</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <span className="text-xs font-black text-white">Delhi Capitals</span>
                    <p className="text-[10px] text-text-muted mt-0.5">vs Punjab Kings • Apr 25</p>
                  </div>
                  <span className="font-mono text-lg font-black text-white">264/8</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <span className="text-xs font-black text-white">Sunrisers Hyderabad</span>
                    <p className="text-[10px] text-text-muted mt-0.5">vs RCB • May 22</p>
                  </div>
                  <span className="font-mono text-lg font-black text-white">255/4</span>
                </div>

              </div>
            </div>

            {/* Individual highlights */}
            <div className="bg-[#07090F] rounded-3xl border border-white/5 p-6">
              <h3 className="text-sm font-black font-heading text-white mb-6 uppercase tracking-widest">Batting &amp; Bowling Peaks</h3>
              <div className="space-y-4">
                
                <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <span className="text-xs font-black text-white">KL Rahul</span>
                    <p className="text-[10px] text-text-muted mt-0.5">152* (66 balls) vs DC • Apr 25</p>
                  </div>
                  <span className="text-xs font-black text-[#F2C94C] uppercase tracking-wider font-mono">Record Score</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <span className="text-xs font-black text-white">Abhishek Sharma</span>
                    <p className="text-[10px] text-text-muted mt-0.5">135 (68 balls) • 10 × 4s, 10 × 6s</p>
                  </div>
                  <span className="text-xs font-black text-accent-cyan uppercase tracking-wider font-mono">Boundaries</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <span className="text-xs font-black text-white">Mohsin Khan</span>
                    <p className="text-[10px] text-text-muted mt-0.5">5/24 (4.0 overs) vs PBKS • Apr 26</p>
                  </div>
                  <span className="text-xs font-black text-accent-magenta uppercase tracking-wider font-mono">Best Bowling</span>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: ADVANCED LAB (UNLOCKED) */}
      {activeTab === 'advanced' && (
        <div className="space-y-10 animate-in">
          
          {/* Batting Scatter Analysis */}
          <div className="bg-[#07090F] border border-white/5 rounded-3xl p-6 lg:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-base font-black font-heading text-white uppercase tracking-wider">Batter Performance Matrix</h3>
                <p className="text-xs text-text-muted mt-1">Bubble sizes correspond to total runs scored. Focus on Top 2026 Batters.</p>
              </div>
              <span className="px-3 py-1 rounded bg-[#B8FF00]/10 text-[9px] font-black uppercase tracking-wider text-[#B8FF00] border border-[#B8FF00]/20 font-mono">Advanced Scatter</span>
            </div>
            
            {battingLoading ? (
              <Loading message="Synthesizing batter matrices..." />
            ) : battingMatrix && battingMatrix.length > 0 ? (
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis
                      type="number"
                      dataKey="avg"
                      name="Batting Average"
                      unit=""
                      tick={{ fill: '#888', fontSize: 10 }}
                      tickLine={false}
                      domain={[15, 65]}
                      label={{ value: 'Average', position: 'insideBottom', offset: -10, fill: '#888', fontSize: 10, fontWeight: 'bold' }}
                    />
                    <YAxis
                      type="number"
                      dataKey="sr"
                      name="Strike Rate"
                      unit=""
                      tick={{ fill: '#888', fontSize: 10 }}
                      tickLine={false}
                      domain={[110, 210]}
                      label={{ value: 'Strike Rate', angle: -90, position: 'insideLeft', offset: 10, fill: '#888', fontSize: 10, fontWeight: 'bold' }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const data = payload[0].payload
                        return (
                          <div className="bg-[#12141F] border border-white/10 rounded-xl p-4 shadow-2xl max-w-xs">
                            <p className="text-sm font-black text-white">{data.player}</p>
                            <p className="text-[10px] text-[#00E5FF] font-black uppercase mt-0.5">{data.team}</p>
                            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/5 text-xs">
                              <div>
                                <p className="text-text-muted">Runs</p>
                                <p className="font-mono font-bold text-white">{data.runs}</p>
                              </div>
                              <div>
                                <p className="text-text-muted">Innings</p>
                                <p className="font-mono font-bold text-white">{data.innings}</p>
                              </div>
                              <div>
                                <p className="text-text-muted">Average</p>
                                <p className="font-mono font-bold text-accent-lime">{data.avg}</p>
                              </div>
                              <div>
                                <p className="text-text-muted">Strike Rate</p>
                                <p className="font-mono font-bold text-[#F2C94C]">{data.sr}</p>
                              </div>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Scatter name="Batters" data={battingMatrix}>
                      {battingMatrix.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={getTeamColor(entry.team) || '#8884d8'}
                          opacity={0.8}
                          r={Math.max(4, Math.min(18, (entry.runs / 776) * 16))}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-text-muted text-xs font-mono">No batting matrix data loaded.</p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Bowling Scatter Analysis */}
            <div className="bg-[#07090F] border border-white/5 rounded-3xl p-6">
              <h3 className="text-base font-black font-heading text-white mb-2 uppercase tracking-wider">Bowling Efficiency Index</h3>
              <p className="text-xs text-text-muted mb-6">X-Axis = Economy Rate (lower is better), Y-Axis = Wickets.</p>
              
              {bowlingLoading ? (
                <Loading message="Synthesizing bowling matrices..." />
              ) : bowlingMatrix && bowlingMatrix.length > 0 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis
                        type="number"
                        dataKey="economy"
                        name="Economy"
                        tick={{ fill: '#888', fontSize: 10 }}
                        tickLine={false}
                        domain={[6.5, 12]}
                        label={{ value: 'Economy Rate', position: 'insideBottom', offset: -10, fill: '#888', fontSize: 10 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="wickets"
                        name="Wickets"
                        tick={{ fill: '#888', fontSize: 10 }}
                        tickLine={false}
                        domain={[5, 32]}
                        label={{ value: 'Wickets', angle: -90, position: 'insideLeft', offset: 10, fill: '#888', fontSize: 10 }}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const data = payload[0].payload
                          return (
                            <div className="bg-[#12141F] border border-white/10 rounded-xl p-3 shadow-xl">
                              <p className="text-xs font-black text-white">{data.player}</p>
                              <p className="text-[9px] text-[#FF2D78] font-black uppercase mt-0.5">{data.team}</p>
                              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5 text-[10px]">
                                <div>
                                  <p className="text-text-muted">Wickets</p>
                                  <p className="font-mono font-bold text-white">{data.wickets}</p>
                                </div>
                                <div>
                                  <p className="text-text-muted">Economy</p>
                                  <p className="font-mono font-bold text-accent-magenta">{data.economy}</p>
                                </div>
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Scatter name="Bowlers" data={bowlingMatrix}>
                        {bowlingMatrix.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={getTeamColor(entry.team) || '#FF2D78'}
                            opacity={0.8}
                            r={7}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-text-muted text-xs font-mono">No bowling matrix data loaded.</p>
              )}
            </div>

            {/* Team Phase run rate */}
            <div className="bg-[#07090F] border border-white/5 rounded-3xl p-6">
              <h3 className="text-base font-black font-heading text-white mb-2 uppercase tracking-wider">Phase Run Rate Index</h3>
              <p className="text-xs text-text-muted mb-6">Run rate across Powerplay, Middle, and Death overs by team.</p>

              {phaseLoading ? (
                <Loading message="Synthesizing phase index..." />
              ) : phaseDominance && phaseDominance.length > 0 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={phaseDominance.slice(0, 5)} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="team" tick={{ fill: '#888', fontSize: 10 }} tickLine={false} tickFormatter={(val) => getTeamAbbr(val)} />
                      <YAxis tick={{ fill: '#888', fontSize: 10 }} tickLine={false} domain={[6, 13]} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const data = payload[0].payload
                          return (
                            <div className="bg-[#12141F] border border-white/10 rounded-xl p-3 shadow-xl text-xs">
                              <p className="font-black text-white">{data.team}</p>
                              <div className="space-y-1 mt-2 pt-2 border-t border-white/5">
                                <p className="text-accent-cyan">Powerplay: <span className="font-mono font-bold">{data.powerplay}</span></p>
                                <p className="text-accent-amber">Middle: <span className="font-mono font-bold">{data.middle}</span></p>
                                <p className="text-accent-magenta">Death: <span className="font-mono font-bold">{data.death}</span></p>
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="powerplay" name="Powerplay" fill={ACCENT_CYAN} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="middle" name="Middle" fill={ACCENT_GOLD} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="death" name="Death" fill={ACCENT_MAGENTA} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-text-muted text-xs font-mono">No phase dominance data loaded.</p>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  )
}
