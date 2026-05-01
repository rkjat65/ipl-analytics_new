import { useState, useMemo } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import {
  getPlayerBatting,
  getPlayerBowling,
  getPlayerBattingMatchups,
  getPlayerBowlingMatchups,
} from '../lib/api'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import PlayerNameCell from '../components/ui/PlayerNameCell'
import DataTable from '../components/ui/DataTable'
import Loading from '../components/ui/Loading'
import SEO from '../components/SEO'
import { formatNumber, formatDecimal, formatDate } from '../utils/format'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts'

/* ── Custom Components ────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#16161F] border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-black flex items-center gap-2" style={{ color: entry.color || '#E8E8ED' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-mono">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </p>
      ))}
    </div>
  )
}

function ProfileStat({ label, value, color = 'cyan', meta = '' }) {
  const accentColor = {
    cyan: '#00E5FF',
    lime: '#B8FF00',
    amber: '#FFB800',
    magenta: '#FF2D78',
  }[color] || '#00E5FF'

  return (
    <div className="bg-[#0B0E16] border border-white/5 rounded-[24px] p-6 group transition-all hover:border-white/10">
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted mb-2">{label}</p>
      <p className="text-3xl font-black font-heading tracking-tighter" style={{ color: accentColor }}>{value}</p>
      {meta && <p className="mt-2 text-[10px] font-black text-white/30 uppercase tracking-widest">{meta}</p>}
    </div>
  )
}

const PIE_COLORS = ['#00E5FF', '#FF2D78', '#B8FF00', '#FFB800', '#8B5CF6', '#22C55E', '#EF4444']

export default function PlayerProfile() {
  const { playerName } = useParams()
  const location = useLocation()
  const fromBowling = location.pathname.startsWith('/bowling/')
  const decodedName = decodeURIComponent(playerName)

  const [activeTab, setActiveTab] = useState(fromBowling ? 'bowling' : 'batting')

  const { data: batting, loading: batLoad } = useFetch(() => getPlayerBatting(decodedName).catch(() => null), [decodedName])
  const { data: bowling, loading: bowlLoad } = useFetch(() => getPlayerBowling(decodedName).catch(() => null), [decodedName])
  const { data: batMatchups, loading: batMatchupsLoad } = useFetch(() => getPlayerBattingMatchups(decodedName).catch(() => null), [decodedName])
  const { data: bowlMatchups, loading: bowlMatchupsLoad } = useFetch(() => getPlayerBowlingMatchups(decodedName).catch(() => null), [decodedName])

  const isLoading = batLoad || bowlLoad
  const hasBatting = batting?.career && batting.career.matches > 0
  const hasBowling = bowling?.career && bowling.career.matches > 0

  if (isLoading) return <Loading message={`Synchronizing ${decodedName}'s career DNA...`} />

  if (!hasBatting && !hasBowling) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-text-muted"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        </div>
        <div className="text-center">
           <h2 className="text-3xl font-black font-heading text-white tracking-tighter">Profile Missing</h2>
           <p className="text-text-secondary mt-2">The requested athlete record could not be located in our elite database.</p>
        </div>
        <Link to="/batting" className="px-6 py-2 rounded-xl bg-accent-cyan text-black font-black uppercase tracking-widest text-[10px]">Back to Records</Link>
      </div>
    )
  }

  const tabs = []
  if (hasBatting) tabs.push('batting')
  if (hasBowling) tabs.push('bowling')

  return (
    <div className="space-y-12 pb-24">
      <SEO title={`${decodedName} - Athlete Hub`} />

      {/* ── CINEMATIC PLAYER HEADER ───────────────────────────── */}
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0B0E16] p-10 md:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,229,255,0.08),transparent_40%)]" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10 md:gap-16">
          <div className="relative shrink-0">
             <div className="absolute inset-0 bg-accent-cyan blur-[100px] opacity-20" />
             <PlayerAvatar name={decodedName} size={180} shape="circle" className="relative z-10 ring-4 ring-white/10" />
          </div>
          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-accent-cyan mb-6">
              Verified Athlete Hub
            </span>
            <h1 className="text-5xl md:text-7xl font-black font-heading text-text-primary tracking-tighter leading-none mb-4">
              {decodedName}
            </h1>
            <p className="text-xl text-text-secondary font-medium italic opacity-60">Career Profile • Elite Performance Metrics</p>
          </div>
        </div>

        {/* Tab Switcher Overlay */}
        {tabs.length > 1 && (
          <div className="mt-12 flex gap-2 bg-white/5 p-2 rounded-2xl w-fit mx-auto md:mx-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  activeTab === tab
                    ? 'bg-accent-cyan text-black shadow-lg scale-105'
                    : 'text-text-secondary hover:text-white hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── BATTING MODULE ───────────────────────────────────── */}
      {activeTab === 'batting' && hasBatting && (
        <div className="space-y-12 animate-in">
           {/* Career Grid */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ProfileStat label="Appearances" value={batting.career.matches} color="cyan" meta="Total Matches" />
              <ProfileStat label="Run Volume" value={formatNumber(batting.career.runs)} color="lime" meta="Career Aggregation" />
              <ProfileStat label="Metric Avg" value={formatDecimal(batting.career.avg)} color="amber" meta="Consistency Index" />
              <ProfileStat label="Impact SR" value={formatDecimal(batting.career.sr)} color="magenta" meta="Strike Tempo" />
           </div>

           {/* Trend Charts */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#0B0E16] rounded-[32px] border border-white/5 p-8">
                 <h3 className="text-2xl font-black font-heading text-white mb-2 uppercase tracking-tighter">Season Evolution</h3>
                 <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-8">Run production trend across eras</p>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={batting.seasons}>
                          <defs>
                             <linearGradient id="limeGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#B8FF00" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#B8FF00" stopOpacity={0} />
                             </linearGradient>
                          </defs>
                          <XAxis dataKey="season" axisLine={false} tickLine={false} tick={{ fill: '#ffffff30', fontSize: 10, fontWeight: 900 }} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey="runs" stroke="#B8FF00" strokeWidth={3} fill="url(#limeGradient)" dot={{ r: 4, fill: '#B8FF00', stroke: '#0B0E16', strokeWidth: 2 }} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="bg-[#0B0E16] rounded-[32px] border border-white/5 p-8">
                 <h3 className="text-2xl font-black font-heading text-white mb-2 uppercase tracking-tighter">Phase Dominance</h3>
                 <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-8">Strike Rate distribution per match phase</p>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={batting.phase_stats}>
                          <XAxis dataKey="phase" axisLine={false} tickLine={false} tick={{ fill: '#ffffff30', fontSize: 10, fontWeight: 900 }} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="sr" radius={[8, 8, 0, 0]} fill="#00E5FF" barSize={40} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           {/* Data Tables */}
           <div className="grid grid-cols-1 gap-8">
              <div className="bg-[#0B0E16] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
                 <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-2xl font-black font-heading text-white">Career Breakdown</h3>
                    <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">Season History</span>
                 </div>
                 <DataTable columns={[
                   { key: 'season', label: 'Season' },
                   { key: 'innings', label: 'Inn', align: 'right' },
                   { key: 'runs', label: 'Runs', align: 'right', render: (v) => <span className="font-mono font-black text-accent-lime text-base">{v}</span> },
                   { key: 'avg', label: 'Avg', align: 'right', render: (v) => <span className="font-mono font-bold">{formatDecimal(v)}</span> },
                   { key: 'sr', label: 'SR', align: 'right', render: (v) => <span className="font-mono font-bold">{formatDecimal(v)}</span> },
                   { key: 'highest', label: 'HS', align: 'right' },
                   { key: 'sixes', label: '6s', align: 'right', render: (v) => <span className="font-mono font-black text-accent-amber">{v}</span> },
                 ]} data={batting.seasons} />
              </div>

              <div className="bg-[#0B0E16] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
                 <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-2xl font-black font-heading text-white">Elite Matchups</h3>
                    <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">Head to Head</span>
                 </div>
                 <DataTable columns={[
                   { key: 'bowler', label: 'Bowler', render: (v) => <PlayerNameCell name={v} to={`/bowling/${encodeURIComponent(v)}`} size={32} /> },
                   { key: 'balls', label: 'Balls', align: 'right' },
                   { key: 'runs', label: 'Runs', align: 'right', render: (v) => <span className="font-mono font-black text-accent-lime">{v}</span> },
                   { key: 'dismissals', label: 'Outs', align: 'right', render: (v) => <span className="font-mono font-black text-accent-magenta">{v}</span> },
                   { key: 'sr', label: 'SR', align: 'right', render: (v) => <span className="font-mono font-bold">{formatDecimal(v)}</span> },
                 ]} data={batMatchups?.slice(0, 10) || []} />
              </div>
           </div>
        </div>
      )}

      {/* ── BOWLING MODULE ───────────────────────────────────── */}
      {activeTab === 'bowling' && hasBowling && (
        <div className="space-y-12 animate-in">
           {/* Career Grid */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ProfileStat label="Territories" value={bowling.career.matches} color="cyan" meta="Matches Played" />
              <ProfileStat label="Impact Wkts" value={bowling.career.wickets} color="magenta" meta="Career Scalps" />
              <ProfileStat label="Control Econ" value={formatDecimal(bowling.career.economy)} color="amber" meta="Discipline Index" />
              <ProfileStat label="Lethality Avg" value={formatDecimal(bowling.career.avg)} color="lime" meta="Strike Metric" />
           </div>

           {/* Trend Charts */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#0B0E16] rounded-[32px] border border-white/5 p-8">
                 <h3 className="text-2xl font-black font-heading text-white mb-2 uppercase tracking-tighter">Wicket Evolution</h3>
                 <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-8">Career strike trend across eras</p>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={bowling.seasons}>
                          <defs>
                             <linearGradient id="magentaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#FF2D78" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#FF2D78" stopOpacity={0} />
                             </linearGradient>
                          </defs>
                          <XAxis dataKey="season" axisLine={false} tickLine={false} tick={{ fill: '#ffffff30', fontSize: 10, fontWeight: 900 }} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey="wickets" stroke="#FF2D78" strokeWidth={3} fill="url(#magentaGradient)" dot={{ r: 4, fill: '#FF2D78', stroke: '#0B0E16', strokeWidth: 2 }} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="bg-[#0B0E16] rounded-[32px] border border-white/5 p-8">
                 <h3 className="text-2xl font-black font-heading text-white mb-2 uppercase tracking-tighter">Dismissal DNA</h3>
                 <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-8">Method of capture distribution</p>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                            data={bowling.dismissal_types}
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="count"
                            nameKey="dismissal_kind"
                          >
                             {bowling.dismissal_types.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                       </PieChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           {/* Data Tables */}
           <div className="grid grid-cols-1 gap-8">
              <div className="bg-[#0B0E16] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
                 <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-2xl font-black font-heading text-white">Bowling Breakdown</h3>
                    <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">Era Analytics</span>
                 </div>
                 <DataTable columns={[
                   { key: 'season', label: 'Season' },
                   { key: 'innings', label: 'Inn', align: 'right' },
                   { key: 'wickets', label: 'Wkts', align: 'right', render: (v) => <span className="font-mono font-black text-accent-magenta text-base">{v}</span> },
                   { key: 'avg', label: 'Avg', align: 'right', render: (v) => <span className="font-mono font-bold">{formatDecimal(v)}</span> },
                   { key: 'economy', label: 'Econ', align: 'right', render: (v) => <span className="font-mono font-bold text-accent-amber">{formatDecimal(v)}</span> },
                   { key: 'sr', label: 'SR', align: 'right', render: (v) => <span className="font-mono font-bold">{formatDecimal(v)}</span> },
                 ]} data={bowling.seasons} />
              </div>

              <div className="bg-[#0B0E16] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
                 <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-2xl font-black font-heading text-white">Lethality Matchups</h3>
                    <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted">Targeted Batters</span>
                 </div>
                 <DataTable columns={[
                   { key: 'batter', label: 'Batter', render: (v) => <PlayerNameCell name={v} to={`/batting/${encodeURIComponent(v)}`} size={32} /> },
                   { key: 'balls', label: 'Balls', align: 'right' },
                   { key: 'wickets', label: 'Wkts', align: 'right', render: (v) => <span className="font-mono font-black text-accent-magenta">{v}</span> },
                   { key: 'runs', label: 'Runs', align: 'right', render: (v) => <span className="font-mono font-black text-accent-lime">{v}</span> },
                   { key: 'economy', label: 'Econ', align: 'right', render: (v) => <span className="font-mono font-bold">{formatDecimal(v)}</span> },
                 ]} data={bowlMatchups?.slice(0, 10) || []} />
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
