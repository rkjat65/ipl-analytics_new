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
import {
  AnalyticsChartShell,
  GlassTooltipSurface,
  CHART_ANIMATION,
  cartesianGridProps,
  axisTickPrimary,
  useChartGradientIds,
} from '../components/charts'

/* ── Custom Components ────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <GlassTooltipSurface eyebrow="Series" title={label}>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-black flex items-center gap-2" style={{ color: entry.color || '#E8E8ED' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-mono">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </p>
      ))}
    </GlassTooltipSurface>
  )
}

function ProfileStat({ label, value, color = 'cyan', meta = '', tooltip = '' }) {
  const accentColor = {
    cyan: '#00E5FF',
    lime: '#B8FF00',
    amber: '#FFB800',
    magenta: '#FF2D78',
  }[color] || '#00E5FF'

  return (
    <div className="bg-[#0B0E16] border border-white/5 rounded-[24px] p-6 group transition-all hover:border-white/10 relative">
      <div className="flex items-center justify-between gap-1 mb-2">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted truncate">{label}</p>
        {tooltip && (
          <div className="relative group/tooltip flex shrink-0">
            <span className="cursor-pointer text-text-muted hover:text-white transition-colors text-xs select-none">
              ⓘ
            </span>
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block w-48 p-2.5 bg-[#0B0E16]/95 border border-white/10 rounded-xl shadow-2xl text-[10px] font-semibold text-text-secondary tracking-normal text-center z-50 leading-relaxed normal-case">
              {tooltip}
              <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-[#0B0E16]" />
            </div>
          </div>
        )}
      </div>
      <p className="text-3xl font-black font-heading tracking-tighter" style={{ color: accentColor }}>{value}</p>
      {meta && <p className="mt-2 text-[10px] font-black text-white/30 uppercase tracking-widest">{meta}</p>}
    </div>
  )
}

function getBattingCommentary(name, b1, b2) {
  if (!b1.runs && !b2.runs) return ""
  const diffSr = b2.sr - b1.sr
  const diffAvg = b2.avg - b1.avg
  if (diffSr > 8 && diffAvg > 4) {
    return `${name} is an elite chase specialist, boosting strike rate by ${formatDecimal(diffSr)} and average by ${formatDecimal(diffAvg)} when chasing under scoreboard pressure.`
  } else if (diffSr < -8 && diffAvg < -4) {
    return `${name} excels when setting targets, performing significantly better under less scoreboard pressure in the first innings.`
  } else {
    return `${name} exhibits balanced metrics across both innings, demonstrating versatility in both setting and chasing targets.`
  }
}

function getBowlingCommentary(name, b1, b2) {
  if (!b1.wickets && !b2.wickets) return ""
  const diffEcon = b2.economy - b1.economy
  if (diffEcon < -0.4) {
    return `${name} is highly defensive when defending targets in the second innings, choking run flow with an economy drop of ${formatDecimal(Math.abs(diffEcon))}.`
  } else if (diffEcon > 0.4) {
    return `${name} is more effective in first innings restriction, showing better economy control when wickets are fresh.`
  } else {
    return `${name} maintains a consistent economy and strike tempo regardless of bowling sequence.`
  }
}

function SplitsCompareRow({ label, val1, val2, color1 = '#00E5FF', color2 = '#FF2D78', isDecimal = false, isLowerBetter = false }) {
  const n1 = parseFloat(val1) || 0
  const n2 = parseFloat(val2) || 0
  const maxVal = Math.max(n1, n2, 1)
  const isBetter1 = isLowerBetter ? n1 < n2 : n1 > n2;
  const isBetter2 = isLowerBetter ? n2 < n1 : n2 > n1;
  const isEqual = n1 === n2;

  return (
    <div className="py-4 border-b border-white/5 last:border-b-0 group">
      <p className="text-center text-[9px] font-black text-text-muted uppercase tracking-[0.2em] mb-2 transition-colors group-hover:text-text-secondary">{label}</p>
      <div className="flex items-center gap-4">
        <div className="flex-1 flex flex-col items-end gap-1">
          <span className="font-mono text-base font-black" style={{ color: isBetter1 || isEqual ? color1 : '#ffffff40' }}>
            {isDecimal ? formatDecimal(n1) : n1}
          </span>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden flex justify-end">
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(n1 / maxVal) * 100}%`, backgroundColor: color1 }} />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-start gap-1">
          <span className="font-mono text-base font-black" style={{ color: isBetter2 || isEqual ? color2 : '#ffffff40' }}>
            {isDecimal ? formatDecimal(n2) : n2}
          </span>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(n2 / maxVal) * 100}%`, backgroundColor: color2 }} />
          </div>
        </div>
      </div>
    </div>
  )
}

const PIE_COLORS = ['#00E5FF', '#FF2D78', '#B8FF00', '#FFB800', '#8B5CF6', '#22C55E', '#EF4444']

export default function PlayerProfile() {
  const { playerName } = useParams()
  const location = useLocation()
  const fromBowling = location.pathname.startsWith('/bowling/')
  const decodedName = decodeURIComponent(playerName)
  const cg = useChartGradientIds('profile')

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
      <SEO
        title={`${decodedName} IPL Stats — Career Batting & Bowling Records | Crickrida`}
        description={`Full IPL career statistics for ${decodedName} — runs scored, batting average, strike rate, wickets taken, economy rate, and season-by-season performance across all IPL editions.`}
        keywords={`${decodedName} IPL stats, ${decodedName} cricket, ${decodedName} batting average, ${decodedName} IPL career, IPL player stats`}
        url={`https://crickrida.rkjat.in/players/${encodeURIComponent(decodedName)}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Person",
          "name": decodedName,
          "description": `IPL cricket player profile for ${decodedName} with complete career statistics across all IPL seasons.`,
          "url": `https://crickrida.rkjat.in/players/${encodeURIComponent(decodedName)}`,
          "sport": "Cricket"
        }}
      />

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
           <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <ProfileStat label="Appearances" value={batting.career.matches} color="cyan" meta="Total Matches" tooltip="Total matches played in your IPL career." />
              <ProfileStat label="Run Volume" value={formatNumber(batting.career.runs)} color="lime" meta="Career Aggregation" tooltip="Total runs scored in your IPL career." />
              <ProfileStat label="Metric Avg" value={formatDecimal(batting.career.avg)} color="amber" meta="Consistency Index" tooltip="Batting Average: Runs scored per dismissal (runs / dismissals). Measures consistency." />
              <ProfileStat label="Impact SR" value={formatDecimal(batting.career.sr)} color="magenta" meta="Strike Tempo" tooltip="Strike Rate: Runs scored per 100 balls faced. Measures raw scoring speed." />
              <ProfileStat 
                label="True SR (TSR)" 
                value={(batting.career.tsr >= 0 ? '+' : '') + formatDecimal(batting.career.tsr)} 
                color={batting.career.tsr >= 0 ? 'cyan' : 'magenta'} 
                meta="Vs Match Average" 
                tooltip="True Strike Rate: How much faster or slower you score compared to average batters in the same matches and phases."
              />
           </div>

           {/* Inning Splits Card */}
           {batting.innings_splits && batting.innings_splits.length > 0 && (
             (() => {
               const bat1 = batting.innings_splits.find(s => s.innings_number === 1) || { matches: 0, runs: 0, avg: 0, sr: 0, fours: 0, sixes: 0 };
               const bat2 = batting.innings_splits.find(s => s.innings_number === 2) || { matches: 0, runs: 0, avg: 0, sr: 0, fours: 0, sixes: 0 };
               const commentary = getBattingCommentary(decodedName, bat1, bat2);
               return (
                 <div className="bg-[#0B0E16] border border-white/5 rounded-[32px] p-8 md:p-10 shadow-xl space-y-6">
                   <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                     <div>
                       <h3 className="text-xl font-black font-heading text-white uppercase tracking-tight">Advanced Inning Splits</h3>
                       <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1">First Innings (Setting Target) vs Second Innings (Chasing)</p>
                     </div>
                     <span className="w-fit px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-[9px] font-black uppercase tracking-widest">
                       Analyst Splits View
                     </span>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                     <div className="space-y-2">
                       <div className="flex justify-between text-[9px] font-black uppercase text-text-muted px-2">
                         <span>1st Inn (Setting)</span>
                         <span>2nd Inn (Chasing)</span>
                       </div>
                       <SplitsCompareRow label="Matches Played" val1={bat1.matches} val2={bat2.matches} />
                       <SplitsCompareRow label="Runs Volume" val1={bat1.runs} val2={bat2.runs} />
                       <SplitsCompareRow label="Batting Average" val1={bat1.avg} val2={bat2.avg} isDecimal />
                       <SplitsCompareRow label="Strike Rate" val1={bat1.sr} val2={bat2.sr} isDecimal />
                       <SplitsCompareRow label="Boundaries" val1={bat1.fours + bat1.sixes} val2={bat2.fours + bat2.sixes} />
                     </div>
                     <div className="bg-white/5 border border-white/5 rounded-2xl p-6 h-full flex flex-col justify-center space-y-3">
                       <span className="text-[9px] font-black uppercase tracking-widest text-accent-cyan">Analyst Commentary</span>
                       <p className="text-sm font-medium text-text-secondary leading-relaxed italic">
                         {commentary || "No significant split variance detected."}
                       </p>
                     </div>
                   </div>
                 </div>
               );
             })()
           )}

           {/* Trend Charts */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <AnalyticsChartShell
                title="Season evolution"
                subtitle="Run production trend across eras"
                insight="Season-to-season slope shows form arcs — compare peaks to identify prime IPL windows."
                accent="lime"
                badge="Batting trajectory"
                chartClassName="h-64"
              >
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={batting.seasons} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                          <defs>
                             <linearGradient id={cg.area} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#B8FF00" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="#B8FF00" stopOpacity={0} />
                             </linearGradient>
                          </defs>
                          <CartesianGrid {...cartesianGridProps} />
                          <XAxis dataKey="season" axisLine={false} tickLine={false} tick={axisTickPrimary} />
                          <YAxis axisLine={false} tickLine={false} tick={axisTickPrimary} width={36} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey="runs" stroke="#B8FF00" strokeWidth={3} fill={`url(#${cg.area})`} dot={{ r: 5, fill: '#B8FF00', stroke: '#0B0E16', strokeWidth: 2 }} activeDot={{ r: 7, strokeWidth: 0 }} {...CHART_ANIMATION} />
                       </AreaChart>
                    </ResponsiveContainer>
              </AnalyticsChartShell>

              <AnalyticsChartShell
                title="Phase dominance"
                subtitle="Strike rate by match phase"
                insight="Middle-overs lift separates anchors from pure powerplay hitters — death overs show finish tempo."
                accent="cyan"
                badge="Phase tempo"
                chartClassName="h-64"
              >
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={batting.phase_stats} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                          <CartesianGrid {...cartesianGridProps} />
                          <XAxis dataKey="phase" axisLine={false} tickLine={false} tick={{ fill: '#8888A0', fontSize: 10, fontWeight: 700 }} />
                          <YAxis axisLine={false} tickLine={false} tick={axisTickPrimary} width={32} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,229,255,0.06)' }} />
                          <Bar dataKey="sr" radius={[10, 10, 0, 0]} fill="#00E5FF" barSize={44} {...CHART_ANIMATION} />
                       </BarChart>
                    </ResponsiveContainer>
              </AnalyticsChartShell>
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
           <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <ProfileStat label="Appearances" value={bowling.career.matches} color="cyan" meta="Matches Played" tooltip="Total matches played in your IPL career." />
              <ProfileStat label="Impact Wkts" value={bowling.career.wickets} color="magenta" meta="Career Scalps" tooltip="Total wickets taken in your IPL career." />
              <ProfileStat label="Control Econ" value={formatDecimal(bowling.career.economy)} color="amber" meta="Discipline Index" tooltip="Economy Rate: Average runs conceded per over (runs / balls * 6). Measures run restriction." />
              <ProfileStat label="Lethality Avg" value={formatDecimal(bowling.career.avg)} color="lime" meta="Strike Metric" tooltip="Bowling Average: Runs conceded per wicket taken. Measures wicket-taking cost." />
              <ProfileStat 
                label="True Econ (TER)" 
                value={(bowling.career.ter >= 0 ? '+' : '') + formatDecimal(bowling.career.ter)} 
                color={bowling.career.ter < 0 ? 'cyan' : 'magenta'} 
                meta="Vs Match Average" 
                tooltip="True Economy Rate: How many runs fewer (negative) or more (positive) you concede per over compared to average bowlers in the same situations."
              />
           </div>

           {/* Inning Splits Card */}
           {bowling.innings_splits && bowling.innings_splits.length > 0 && (
             (() => {
               const bowl1 = bowling.innings_splits.find(s => s.innings_number === 1) || { matches: 0, wickets: 0, avg: 0, economy: 0, sr: 0 };
               const bowl2 = bowling.innings_splits.find(s => s.innings_number === 2) || { matches: 0, wickets: 0, avg: 0, economy: 0, sr: 0 };
               const commentary = getBowlingCommentary(decodedName, bowl1, bowl2);
               return (
                 <div className="bg-[#0B0E16] border border-white/5 rounded-[32px] p-8 md:p-10 shadow-xl space-y-6">
                   <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                     <div>
                       <h3 className="text-xl font-black font-heading text-white uppercase tracking-tight">Advanced Inning Splits</h3>
                       <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1">First Innings (Bowling 1st / Restricting) vs Second Innings (Bowling 2nd / Defending)</p>
                     </div>
                     <span className="w-fit px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-[9px] font-black uppercase tracking-widest">
                       Analyst Splits View
                     </span>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                     <div className="space-y-2">
                       <div className="flex justify-between text-[9px] font-black uppercase text-text-muted px-2">
                         <span>1st Inn (Restricting)</span>
                         <span>2nd Inn (Defending)</span>
                       </div>
                       <SplitsCompareRow label="Matches Played" val1={bowl1.matches} val2={bowl2.matches} />
                       <SplitsCompareRow label="Wickets Taken" val1={bowl1.wickets} val2={bowl2.wickets} />
                       <SplitsCompareRow label="Bowling Average" val1={bowl1.avg} val2={bowl2.avg} isDecimal isLowerBetter />
                       <SplitsCompareRow label="Economy Rate" val1={bowl1.economy} val2={bowl2.economy} isDecimal isLowerBetter />
                       <SplitsCompareRow label="Bowling Strike Rate" val1={bowl1.sr} val2={bowl2.sr} isDecimal isLowerBetter />
                     </div>
                     <div className="bg-white/5 border border-white/5 rounded-2xl p-6 h-full flex flex-col justify-center space-y-3">
                       <span className="text-[9px] font-black uppercase tracking-widest text-accent-cyan">Analyst Commentary</span>
                       <p className="text-sm font-medium text-text-secondary leading-relaxed italic">
                         {commentary || "No significant split variance detected."}
                       </p>
                     </div>
                   </div>
                 </div>
               );
             })()
           )}

           {/* Trend Charts */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <AnalyticsChartShell
                title="Wicket evolution"
                subtitle="Seasonal wicket-taking rhythm"
                insight="Sustained wicket bands signal bowling IQ across phases — compare troughs with workload spikes."
                accent="magenta"
                badge="Bowling trajectory"
                chartClassName="h-64"
              >
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={bowling.seasons} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                          <defs>
                             <linearGradient id={cg.areaAlt} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#FF2D78" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="#FF2D78" stopOpacity={0} />
                             </linearGradient>
                          </defs>
                          <CartesianGrid {...cartesianGridProps} />
                          <XAxis dataKey="season" axisLine={false} tickLine={false} tick={axisTickPrimary} />
                          <YAxis axisLine={false} tickLine={false} tick={axisTickPrimary} width={32} allowDecimals={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey="wickets" stroke="#FF2D78" strokeWidth={3} fill={`url(#${cg.areaAlt})`} dot={{ r: 5, fill: '#FF2D78', stroke: '#0B0E16', strokeWidth: 2 }} activeDot={{ r: 7, strokeWidth: 0 }} {...CHART_ANIMATION} />
                       </AreaChart>
                    </ResponsiveContainer>
              </AnalyticsChartShell>

              <AnalyticsChartShell
                title="Dismissal DNA"
                subtitle="How wickets are manufactured"
                insight="Caught-heavy profiles reward intelligent fields; LBW/Bowled mixes imply deception and seam skill."
                accent="amber"
                badge="Mix breakdown"
                chartClassName="h-64"
              >
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                            data={bowling.dismissal_types}
                            innerRadius={56}
                            outerRadius={92}
                            paddingAngle={4}
                            dataKey="count"
                            nameKey="dismissal_kind"
                            stroke="#0A0A0F"
                            strokeWidth={2}
                            {...CHART_ANIMATION}
                          >
                             {bowling.dismissal_types.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                          <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: 16 }} formatter={(value) => <span className="text-[11px] font-semibold text-text-secondary">{value}</span>} />
                       </PieChart>
                    </ResponsiveContainer>
              </AnalyticsChartShell>
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
