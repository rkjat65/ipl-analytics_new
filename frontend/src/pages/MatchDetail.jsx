import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { getMatch, getWinProbability } from '../lib/api'
import Loading from '../components/ui/Loading'
import Badge from '../components/ui/Badge'
import { formatDate, formatDecimal } from '../utils/format'
import { getTeamColor, getTeamAbbr } from '../constants/teams'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import TeamLogo from '../components/ui/TeamLogo'

const TABS = ['Scorecard', 'Match Report', 'Worm', 'Run Rate Battle', 'Partnerships']

function ChartTooltip({ active, payload, label, extra }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 shadow-lg">
      <p className="text-text-secondary text-xs font-mono mb-1">{extra || `Over ${label}`}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: <span className="font-mono font-semibold">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

function ManhattanTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 shadow-lg">
      <p className="text-text-secondary text-xs font-mono mb-1">Over {label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: <span className="font-mono font-semibold">{entry.value} runs</span>
          {entry.payload[`wickets_${entry.dataKey.split('_')[1]}`] > 0 && (
            <span className="text-danger ml-1">
              ({entry.payload[`wickets_${entry.dataKey.split('_')[1]}`]}W)
            </span>
          )}
        </p>
      ))}
    </div>
  )
}

export default function MatchDetail() {
  const { matchId } = useParams()
  const [activeTab, setActiveTab] = useState('Scorecard')

  const { data: matchData, loading, error } = useFetch(
    () => getMatch(matchId),
    [matchId]
  )

  const { data: winProbData } = useFetch(
    () => getWinProbability(matchId).catch(() => null),
    [matchId]
  )

  const match = matchData?.info
  const scorecards = matchData?.scorecards || []
  const oversData = matchData?.overs_data || []

  // Flatten scorecards into innings-level arrays for convenience
  const innings = scorecards.map((sc) => ({
    innings_number: sc.innings_number,
    batting_team: sc.batting_team,
    bowling_team: sc.bowling_team,
    total_runs: sc.total_runs,
    total_wickets: sc.total_wickets,
    total_balls: sc.total_balls,
  }))
  const batting = scorecards.flatMap((sc) => sc.batting || [])
  const bowling = scorecards.flatMap((sc) => (sc.bowling || []).map((b) => ({ ...b, runs: b.runs_conceded })))
  const partnerships = scorecards.flatMap((sc) => sc.partnerships || [])
  const fallOfWickets = scorecards.flatMap((sc) => sc.fall_of_wickets || [])
  const overs = oversData

  // Derive team colors
  const team1Color = match ? getTeamColor(match.team1) : '#00E5FF'
  const team2Color = match ? getTeamColor(match.team2) : '#FF00E5'

  // Build manhattan data
  const manhattanData = useMemo(() => {
    if (!overs.length) return []
    const overMap = {}
    for (let i = 1; i <= 20; i++) {
      overMap[i] = { over: i, runs_1: 0, runs_2: 0, wickets_1: 0, wickets_2: 0 }
    }
    overs.forEach((o) => {
      const key = o.innings_number === 1 ? '1' : '2'
      const overNum = o.over_number + 1 // API uses 0-indexed overs
      if (overMap[overNum]) {
        overMap[overNum][`runs_${key}`] = o.runs
        overMap[overNum][`wickets_${key}`] = o.wickets
      }
    })
    return Object.values(overMap)
  }, [overs])

  // Build worm data
  const wormData = useMemo(() => {
    if (!overs.length) return []
    const overMap = {}
    for (let i = 0; i <= 20; i++) {
      overMap[i] = { over: i }
    }
    overMap[0].cumulative_1 = 0
    overMap[0].cumulative_2 = 0
    overs.forEach((o) => {
      const key = o.innings_number === 1 ? '1' : '2'
      const overNum = o.over_number + 1 // API uses 0-indexed overs
      if (overMap[overNum]) {
        overMap[overNum][`cumulative_${key}`] = o.cumulative_runs
        if (o.wickets > 0) {
          overMap[overNum][`wicket_${key}`] = o.cumulative_runs
        }
      }
    })
    return Object.values(overMap)
  }, [overs])

  const runRateData = useMemo(() => {
    if (!overs.length) return []
    const inn1 = overs.filter((o) => o.innings_number === 1)
    const inn2 = overs.filter((o) => o.innings_number === 2)
    const target = winProbData?.target || null
    const map1 = new Map(inn1.map((o) => [o.over_number + 1, o.cumulative_runs]))
    const map2 = new Map(inn2.map((o) => [o.over_number + 1, o.cumulative_runs]))
    const rows = []
    for (let over = 1; over <= 20; over += 1) {
      const c1 = map1.get(over)
      const c2 = map2.get(over)
      rows.push({
        over,
        rr1: c1 != null ? c1 / over : null,
        rr2: c2 != null ? c2 / over : null,
        required_rr: target && c2 != null && over < 20 ? Math.max((target - c2) / (20 - over), 0) : null,
      })
    }
    return rows
  }, [overs, winProbData])

  // Win probability data (must come before momentumData which depends on it)
  const winProbChartData = useMemo(() => {
    const probabilities = winProbData?.probabilities
    if (!probabilities || !Array.isArray(probabilities) || !probabilities.length) return []
    return probabilities.map((d) => ({
      ...d,
      over: d.over_number,
      ball: d.ball_number,
      target: winProbData.target,
      total_runs: d.runs_scored,
      total_wickets: 10 - (d.wickets_in_hand || 0),
      ball_label: `${d.over_number}.${d.ball_number}`,
      win_prob: Math.round(d.win_probability * 100 * 10) / 10,
    }))
  }, [winProbData])

  const momentumData = useMemo(() => {
    if (!winProbChartData.length) return []
    let prev = winProbChartData[0].win_prob
    return winProbChartData.map((point, idx) => {
      const swing = idx === 0 ? 0 : point.win_prob - prev
      prev = point.win_prob
      return { ...point, swing }
    })
  }, [winProbChartData])

  // Build partnership data
  const partnershipData = useMemo(() => {
    if (!partnerships.length) return []
    return partnerships.map((p, i) => ({
      ...p,
      batter1: p.pair ? p.pair.split(' & ')[0] : '',
      batter2: p.pair ? p.pair.split(' & ')[1] : '',
      label: `${getTeamAbbr(innings.find(inn => inn.innings_number === p.innings_number)?.batting_team || '')} - ${p.pair || ''}`,
      id: i,
    }))
  }, [partnerships, innings])

  if (loading) return <Loading message="Loading match details..." />

  if (error || !match) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-heading text-lg">Failed to load match</p>
        <p className="text-text-secondary text-sm">{error || 'Match not found'}</p>
        <Link to="/matches" className="text-accent-cyan hover:underline text-sm">
          Back to Matches
        </Link>
      </div>
    )
  }

  const winnerColor = match.winner ? getTeamColor(match.winner) : null
  const resultText =
    !match.winner
      ? match.result || 'No Result'
      : match.win_by_runs > 0
      ? `${match.winner} won by ${match.win_by_runs} runs`
      : match.win_by_wickets > 0
      ? `${match.winner} won by ${match.win_by_wickets} wickets`
      : match.result || 'Result unknown'

  // Get innings info helper
  function getInningsScore(inningsNum) {
    const inn = innings.find((i) => i.innings_number === inningsNum)
    if (!inn) return null
    return inn
  }

  function renderScorecard() {
    return (
      <div className="space-y-8">
        {[1, 2].map((inningsNum) => {
          const inn = getInningsScore(inningsNum)
          if (!inn) return null

          const inningsBatting = batting
            .filter((b) => b.innings_number === inningsNum)
            .sort((a, b) => (a.position || 99) - (b.position || 99))
          const inningsBowling = bowling.filter((b) => b.innings_number === inningsNum)
          const inningsFow = fallOfWickets
            .filter((f) => f.innings_number === inningsNum)
            .sort((a, b) => a.wicket_number - b.wicket_number)

          const topScorer = inningsBatting.reduce((max, b) => (b.runs > (max?.runs || -1) ? b : max), null)
          const bestBowler = inningsBowling.reduce((max, b) => (b.wickets > (max?.wickets || -1) ? b : max), null)

          const teamColor = getTeamColor(inn.batting_team)
          const totalOvers = inn.total_balls ? `${Math.floor(inn.total_balls / 6)}${inn.total_balls % 6 ? '.' + (inn.total_balls % 6) : ''}` : '20'

          // Calculate extras from batting data
          const totalBattingRuns = inningsBatting.reduce((sum, b) => sum + (b.runs || 0), 0)
          const extras = (inn.total_runs || 0) - totalBattingRuns

          return (
            <div key={inningsNum} className="space-y-4 animate-in"
              style={{ animationDelay: `${(inningsNum - 1) * 150}ms` }}>
              {/* Innings Header */}
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 rounded-full" style={{ backgroundColor: teamColor }} />
                <div>
                  <h3 className="text-lg font-heading font-bold text-text-primary flex items-center gap-2">
                    <TeamLogo team={inn.batting_team} size={24} />
                    {inn.batting_team} Innings
                  </h3>
                  <p className="text-text-secondary text-sm font-mono">
                    {inn.total_runs}/{inn.total_wickets} ({totalOvers} ov)
                  </p>
                </div>
              </div>

              {/* Batting Table */}
              <div className="overflow-x-auto rounded-lg border border-border-subtle">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-elevated border-b border-border-subtle">
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-left">Batter</th>
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-left">Dismissal</th>
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-right">R</th>
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-right">B</th>
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-right">4s</th>
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-right">6s</th>
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-right">SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inningsBatting.map((b, i) => {
                      const isTopScorer = topScorer && b.batter === topScorer.batter
                      return (
                        <tr
                          key={b.player + i}
                          className={`border-b border-border-subtle transition-colors hover:bg-bg-card-hover group ${
                            i % 2 === 1 ? 'bg-bg-card/50' : ''
                          } ${isTopScorer ? 'bg-accent-cyan/5' : ''}`}
                        >
                          <td className="px-4 py-2.5 text-text-primary font-medium whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <PlayerAvatar name={b.batter} size={24} />
                              <Link
                                to={`/batting/${encodeURIComponent(b.batter)}`}
                                className={`hover:underline ${isTopScorer ? 'text-accent-cyan' : ''}`}
                              >
                                {b.batter}
                              </Link>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-text-secondary text-xs max-w-[200px] truncate">
                            {b.dismissal ? (
                              <span>
                                {b.dismissal === 'bowled' && <span>b {b.dismissed_by}</span>}
                                {b.dismissal === 'lbw' && <span>lbw b {b.dismissed_by}</span>}
                                {b.dismissal === 'caught' && (
                                  <span>
                                    {b.fielder && b.fielder !== b.dismissed_by ? `c ${b.fielder} b ${b.dismissed_by}` : `c & b ${b.dismissed_by}`}
                                  </span>
                                )}
                                {b.dismissal === 'stumped' && <span>st {b.fielder} b {b.dismissed_by}</span>}
                                {b.dismissal === 'run out' && <span>run out ({b.fielder})</span>}
                                {!['bowled', 'lbw', 'caught', 'stumped', 'run out'].includes(b.dismissal) && (
                                  <span>{b.dismissal} {b.dismissed_by ? `b ${b.dismissed_by}` : ''}</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-accent-lime font-medium italic">not out</span>
                            )}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-mono font-semibold ${
                            isTopScorer ? 'text-accent-cyan' : 'text-text-primary'
                          }`}>
                            {b.runs}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{b.balls}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{b.fours}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{b.sixes}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-text-secondary">
                            {formatDecimal(b.strike_rate, 1)}
                          </td>
                        </tr>
                      )
                    })}
                    {/* Extras */}
                    {extras > 0 && (
                      <tr className="border-b border-border-subtle bg-bg-elevated/50">
                        <td className="px-4 py-2 text-text-muted text-xs" colSpan={2}>Extras</td>
                        <td className="px-4 py-2 text-right font-mono text-text-secondary text-xs">{extras}</td>
                        <td colSpan={4} />
                      </tr>
                    )}
                    {/* Total */}
                    <tr className="bg-bg-elevated font-semibold">
                      <td className="px-4 py-2.5 text-text-primary" colSpan={2}>Total</td>
                      <td className="px-4 py-2.5 text-right font-mono text-text-primary">{inn.total_runs}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-text-secondary">
                        {inningsBatting.reduce((s, b) => s + (b.balls || 0), 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-text-secondary">
                        {inningsBatting.reduce((s, b) => s + (b.fours || 0), 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-text-secondary">
                        {inningsBatting.reduce((s, b) => s + (b.sixes || 0), 0)}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bowling Table */}
              <div className="overflow-x-auto rounded-lg border border-border-subtle">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-elevated border-b border-border-subtle">
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-left">Bowler</th>
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-right">O</th>
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-right">M</th>
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-right">R</th>
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-right">W</th>
                      <th className="px-4 py-2.5 font-medium text-text-muted text-xs uppercase tracking-wider text-right">Econ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inningsBowling.map((b, i) => {
                      const isBest = bestBowler && b.bowler === bestBowler.bowler
                      return (
                        <tr
                          key={b.bowler + i}
                          className={`border-b border-border-subtle transition-colors hover:bg-bg-card-hover ${
                            i % 2 === 1 ? 'bg-bg-card/50' : ''
                          } ${isBest ? 'bg-accent-magenta/5' : ''}`}
                        >
                          <td className="px-4 py-2.5 text-text-primary font-medium whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <PlayerAvatar name={b.bowler} size={24} />
                              <Link
                                to={`/bowling/${encodeURIComponent(b.bowler)}`}
                                className={`hover:underline ${isBest ? 'text-accent-magenta' : ''}`}
                              >
                                {b.bowler}
                              </Link>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{b.overs}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{b.maidens}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{b.runs}</td>
                          <td className={`px-4 py-2.5 text-right font-mono font-semibold ${
                            isBest ? 'text-accent-magenta' : 'text-text-primary'
                          }`}>
                            {b.wickets}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-text-secondary">
                            {formatDecimal(b.economy, 1)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Fall of Wickets */}
              {inningsFow.length > 0 && (
                <div className="card">
                  <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-2">Fall of Wickets</p>
                  <p className="text-text-secondary text-sm font-mono leading-relaxed">
                    {inningsFow.map((f, i) => (
                      <span key={i}>
                        {i > 0 && <span className="text-text-muted">, </span>}
                        <span className="text-text-primary">{f.wicket_number}-{f.score}</span>
                        <span className="text-text-muted"> ({f.player_dismissed}, {f.over_ball} ov)</span>
                      </span>
                    ))}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }


  function renderWorm() {
    if (!wormData.length) {
      return <p className="text-text-muted text-sm py-12 text-center">No over-by-over data available.</p>
    }

    const inn1 = getInningsScore(1)
    const inn2 = getInningsScore(2)
    const team1Name = inn1 ? getTeamAbbr(inn1.batting_team) : 'Inn 1'
    const team2Name = inn2 ? getTeamAbbr(inn2.batting_team) : 'Inn 2'
    const color1 = inn1 ? getTeamColor(inn1.batting_team) : team1Color
    const color2 = inn2 ? getTeamColor(inn2.batting_team) : team2Color

    return (
      <div className="card">
        <h3 className="text-lg font-heading font-bold text-text-primary mb-4">Worm Chart</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={wormData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" vertical={false} />
              <XAxis
                dataKey="over"
                tick={{ fill: '#8888A0', fontSize: 12 }}
                axisLine={{ stroke: '#1E1E2A' }}
                tickLine={false}
                label={{ value: 'Over', position: 'insideBottomRight', offset: -5, fill: '#8888A0', fontSize: 12 }}
              />
              <YAxis
                tick={{ fill: '#8888A0', fontSize: 12 }}
                axisLine={{ stroke: '#1E1E2A' }}
                tickLine={false}
                label={{ value: 'Runs', angle: -90, position: 'insideLeft', fill: '#8888A0', fontSize: 12 }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ color: '#8888A0', fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="cumulative_1"
                name={team1Name}
                stroke={color1}
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
              {/* Wicket markers for innings 1 */}
              <Line
                type="monotone"
                dataKey="wicket_1"
                name={`${team1Name} Wickets`}
                stroke={color1}
                strokeWidth={0}
                dot={{ fill: color1, stroke: '#fff', strokeWidth: 2, r: 5 }}
                connectNulls={false}
                legendType="none"
              />
              {inn2 && (
                <>
                  <Line
                    type="monotone"
                    dataKey="cumulative_2"
                    name={team2Name}
                    stroke={color2}
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="wicket_2"
                    name={`${team2Name} Wickets`}
                    stroke={color2}
                    strokeWidth={0}
                    dot={{ fill: color2, stroke: '#fff', strokeWidth: 2, r: 5 }}
                    connectNulls={false}
                    legendType="none"
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  function renderPartnerships() {
    if (!partnershipData.length) {
      return <p className="text-text-muted text-sm py-12 text-center">No partnership data available.</p>
    }

    const inn1 = getInningsScore(1)
    const inn2 = getInningsScore(2)
    const color1 = inn1 ? getTeamColor(inn1.batting_team) : team1Color
    const color2 = inn2 ? getTeamColor(inn2.batting_team) : team2Color

    // Group by innings
    const inn1Partnerships = partnershipData.filter((p) => p.innings_number === 1)
    const inn2Partnerships = partnershipData.filter((p) => p.innings_number === 2)

    function renderPartnershipSection(pData, inningsNum, teamColor, teamName) {
      if (!pData.length) return null
      const maxRuns = Math.max(...partnershipData.map((p) => p.runs || 0), 1)

      return (
        <div className="space-y-3">
          <h4 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2">
            <span className="w-1 h-5 rounded-full" style={{ backgroundColor: teamColor }} />
            {teamName} Innings
          </h4>
          <div className="space-y-2">
            {pData.map((p, i) => {
              const widthPct = maxRuns > 0 ? Math.max((p.runs / maxRuns) * 100, 2) : 2
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-32 sm:w-44 text-right">
                    <span className="text-text-secondary text-xs font-mono truncate block">
                      {p.batter1} & {p.batter2}
                    </span>
                  </div>
                  <div className="flex-1 h-6 bg-bg-elevated rounded relative overflow-hidden">
                    <div
                      className="h-full rounded flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${widthPct}%`, backgroundColor: teamColor + 'CC' }}
                    >
                      <span className="text-xs font-mono font-semibold text-white drop-shadow">
                        {p.runs}
                      </span>
                    </div>
                  </div>
                  <div className="w-20 text-xs text-text-muted font-mono">
                    {p.balls ? `${p.balls}b` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <div className="card space-y-6">
        <h3 className="text-lg font-heading font-bold text-text-primary">Partnerships</h3>
        {renderPartnershipSection(inn1Partnerships, 1, color1, inn1 ? inn1.batting_team : 'Innings 1')}
        {renderPartnershipSection(inn2Partnerships, 2, color2, inn2 ? inn2.batting_team : 'Innings 2')}
      </div>
    )
  }

  function renderRunRateBattle() {
    if (!runRateData.length) {
      return <p className="text-text-muted text-sm py-12 text-center">Run-rate trend unavailable for this match.</p>
    }
    const inn1 = getInningsScore(1)
    const inn2 = getInningsScore(2)
    const team1Name = inn1 ? getTeamAbbr(inn1.batting_team) : 'Innings 1'
    const team2Name = inn2 ? getTeamAbbr(inn2.batting_team) : 'Innings 2'
    const color1 = inn1 ? getTeamColor(inn1.batting_team) : team1Color
    const color2 = inn2 ? getTeamColor(inn2.batting_team) : team2Color

    return (
      <div className="card animate-in">
        <h3 className="text-lg font-heading font-bold text-text-primary mb-1">Run Rate Battle</h3>
        <p className="text-text-secondary text-xs mb-4">Instant view of tempo control vs chase pressure over the full innings arc.</p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={runRateData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" vertical={false} />
              <XAxis dataKey="over" tick={{ fill: '#8888A0', fontSize: 12 }} axisLine={{ stroke: '#1E1E2A' }} tickLine={false} />
              <YAxis tick={{ fill: '#8888A0', fontSize: 12 }} axisLine={{ stroke: '#1E1E2A' }} tickLine={false} domain={[0, 'auto']} />
              <Tooltip content={<ChartTooltip extra="Run rate by over" />} />
              <Legend wrapperStyle={{ color: '#8888A0', fontSize: 12 }} />
              <Line type="monotone" dataKey="rr1" name={`${team1Name} RR`} stroke={color1} strokeWidth={2.5} dot={false} connectNulls />
              {inn2 && <Line type="monotone" dataKey="rr2" name={`${team2Name} RR`} stroke={color2} strokeWidth={2.5} dot={false} connectNulls />}
              {inn2 && <Line type="monotone" dataKey="required_rr" name="Required RR" stroke="#FFB800" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }


  function renderMatchReport() {
    const inn1 = getInningsScore(1)
    const inn2 = getInningsScore(2)
    const team1Abbr = inn1 ? getTeamAbbr(inn1.batting_team) : 'T1'
    const team2Abbr = inn2 ? getTeamAbbr(inn2.batting_team) : 'T2'

    // Derived Data for Report
    const inningsGrouped = [1, 2].map(num => {
      const b = batting.filter(x => x.innings_number === num).sort((a, b) => b.runs - a.runs)
      const w = bowling.filter(x => x.innings_number === num).sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
      const team = num === 1 ? inn1?.batting_team : inn2?.batting_team
      return { num, team, batters: b, bowlers: w }
    }).filter(x => x.team)

    const allBatters = batting.sort((a, b) => b.runs - a.runs)
    const allBowlers = bowling.sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)

    const topBat = allBatters[0]
    const topBowl = allBowlers[0]
    const bestSR = batting.filter(b => b.balls >= 10).sort((a, b) => b.strike_rate - a.strike_rate)[0]
    const bestEco = bowling.filter(b => b.overs >= 2).sort((a, b) => a.economy - b.economy)[0]

    return (
      <div className="space-y-6 animate-in">
        <style>{`
          @keyframes slideInUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes fadeInScale {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          .report-card-glow {
            box-shadow: 0 0 30px rgba(0, 229, 255, 0.08);
          }
        `}</style>

        {/* Cinematic Header Banner */}
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0A0A0F] p-1 shadow-2xl report-card-glow">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/15 via-transparent to-accent-magenta/15" />
          <div className="relative rounded-[31px] bg-[#0A0A0F]/60 backdrop-blur-3xl p-6 sm:p-10 overflow-hidden">
            {/* Branding */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-accent-cyan">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5" />
                  </svg>
                </span>
                <span className="text-xs font-black uppercase tracking-widest text-white/50">Crickrida Stats</span>
              </div>
              <div className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">Season {match.season} Report</div>
            </div>

            <div className="grid sm:grid-cols-[1fr_auto_1fr] items-center gap-6 sm:gap-12">
              {/* Team 1 */}
              <div className="flex flex-col items-center sm:items-end text-center sm:text-right space-y-3">
                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center p-4 shadow-inner relative group">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <TeamLogo team={match.team1} size={80} className="transition-transform group-hover:scale-110 duration-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white/90">{match.team1}</h3>
                  <div className="text-2xl sm:text-4xl font-mono font-black" style={{ color: team1Color }}>
                    {inn1?.total_runs}<span className="text-xl sm:text-2xl text-white/20">/{inn1?.total_wickets}</span>
                  </div>
                </div>
              </div>

              {/* VS Divider */}
              <div className="flex flex-col items-center">
                <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <div className="my-2 text-white/20 font-black text-2xl italic">VS</div>
                <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
              </div>

              {/* Team 2 */}
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-3">
                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center p-4 shadow-inner relative group">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <TeamLogo team={match.team2} size={80} className="transition-transform group-hover:scale-110 duration-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white/90">{match.team2}</h3>
                  <div className="text-2xl sm:text-4xl font-mono font-black" style={{ color: team2Color }}>
                    {inn2?.total_runs}<span className="text-xl sm:text-2xl text-white/20">/{inn2?.total_wickets}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Result footer */}
            <div className="mt-10 pt-8 border-t border-white/5 text-center">
              <div className="inline-block px-4 py-1 rounded-full bg-accent-lime/10 border border-accent-lime/20 text-accent-lime text-[10px] font-bold uppercase tracking-[0.2em] mb-3">
                Official Result
              </div>
              <h2 className="text-2xl sm:text-4xl font-heading font-black text-white leading-tight drop-shadow-lg">
                {resultText}
              </h2>
              <p className="text-white/40 text-xs sm:text-sm font-mono mt-3">
                {formatDate(match.date)} • {match.venue}
              </p>
            </div>
          </div>
        </div>

        {/* Performer Spotlight Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Player of the Match */}
          <div className="card !bg-[#0E121E] !border-accent-amber/30 !p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-accent-amber">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-accent-amber mb-4">Player of Match</div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-accent-amber/10 border border-accent-amber/20 flex items-center justify-center text-3xl">🌟</div>
              <div className="min-w-0">
                <div className="text-lg font-bold text-white truncate">{match.player_of_match || 'N/A'}</div>
                <div className="text-[10px] text-accent-amber/60 font-mono">STANDOUT PERFORMANCE</div>
              </div>
            </div>
          </div>

          {/* Top Batting */}
          <div className="card !bg-[#0E121E] !border-accent-cyan/30 !p-5 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-12 h-12 text-accent-cyan">
                <path d="M18.823 4.823a2.5 2.5 0 1 1 3.536 3.536L12.5 18.213l-4 1 1-4 9.323-9.39Z" />
              </svg>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-accent-cyan mb-4">Most Runs</div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center text-3xl">🏏</div>
              <div className="min-w-0">
                <div className="text-lg font-bold text-white truncate">{topBat?.batter || '—'}</div>
                <div className="text-xl font-mono font-black text-accent-cyan">{topBat?.runs || 0}<span className="text-xs text-white/30 ml-1">({topBat?.balls}b)</span></div>
              </div>
            </div>
          </div>

          {/* Top Bowling */}
          <div className="card !bg-[#0E121E] !border-accent-magenta/30 !p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-12 h-12 text-accent-magenta">
                <circle cx="12" cy="12" r="10" /><path d="m12 12-4 10 4-10-4-10 4 10 4-10-4 10 4 10-4-10z" />
              </svg>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-accent-magenta mb-4">Best Bowling</div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-accent-magenta/10 border border-accent-magenta/20 flex items-center justify-center text-3xl">🔥</div>
              <div className="min-w-0">
                <div className="text-lg font-bold text-white truncate">{topBowl?.bowler || '—'}</div>
                <div className="text-xl font-mono font-black text-accent-magenta">{topBowl?.wickets || 0}<span className="text-xs text-white/30 ml-1">/{topBowl?.runs || 0}</span></div>
              </div>
            </div>
          </div>

          {/* Efficiency */}
          <div className="card !bg-[#0E121E] !border-accent-lime/30 !p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-12 h-12 text-accent-lime">
                <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93" />
              </svg>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-accent-lime mb-4">Precision</div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-accent-lime/10 border border-accent-lime/20 flex items-center justify-center text-3xl">⚡</div>
              <div className="min-w-0">
                <div className="text-lg font-bold text-white truncate">{bestSR?.batter || '—'}</div>
                <div className="text-xl font-mono font-black text-accent-lime">{bestSR?.strike_rate || 0}<span className="text-[10px] text-white/30 ml-1 uppercase">SR</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Performers Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {inningsGrouped.map((innGroup, idx) => {
            const teamColor = getTeamColor(innGroup.team)
            return (
              <div key={innGroup.num} className="card !p-0 overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between border-b border-white/5" style={{ background: `${teamColor}08` }}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: teamColor }} />
                    <span className="text-xs font-black uppercase tracking-widest" style={{ color: teamColor }}>{getTeamAbbr(innGroup.team)} Performance</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/20">Innings {innGroup.num}</span>
                </div>
                
                <div className="p-4 space-y-4">
                  {/* Top 3 Batters */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Key Batsmen</p>
                    {innGroup.batters.slice(0, 3).map((b, bi) => (
                      <div key={bi} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-white/20">0{bi+1}</span>
                          <span className="text-sm font-bold text-white/90">{b.batter}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono font-black" style={{ color: teamColor }}>{b.runs}<span className="text-[10px] text-white/25 ml-1">({b.balls})</span></div>
                          <div className="text-[9px] font-mono text-white/30 uppercase">SR {formatDecimal(b.strike_rate, 1)} • {b.fours}×4 {b.sixes}×6</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Top 3 Bowlers */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Sharp Bowlers</p>
                    {innGroup.bowlers.slice(0, 2).map((b, bi) => (
                      <div key={bi} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-white/20">0{bi+1}</span>
                          <span className="text-sm font-bold text-white/90">{b.bowler}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono font-black text-accent-magenta">{b.wickets}/{b.runs}<span className="text-[10px] text-white/25 ml-1">({b.overs}ov)</span></div>
                          <div className="text-[9px] font-mono text-white/30 uppercase">ECON {formatDecimal(b.economy, 1)} • {b.maidens} MDN</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Orientation Hint */}
        <div className="flex items-center justify-center py-4 opacity-50">
          <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.4em] text-white/60">
            <span>Responsive Report</span>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <span>Premium UI</span>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <span>Crickrida</span>
          </div>
        </div>
      </div>
    )
  }



  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/matches" className="text-text-muted hover:text-accent-cyan text-sm inline-flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Matches
      </Link>

      {/* Match Header */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-primary flex items-center gap-3">
              <TeamLogo team={match.team1} size={32} />
              <span style={{ color: team1Color }}>{getTeamAbbr(match.team1)}</span>
              <span className="text-text-muted italic mx-1">vs</span>
              <span style={{ color: team2Color }}>{getTeamAbbr(match.team2)}</span>
              <TeamLogo team={match.team2} size={32} />
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-text-secondary text-sm">
              <span className="font-mono">{formatDate(match.date)}</span>
              {match.season && (
                <Badge text={`Season ${match.season}`} color="muted" />
              )}
            </div>
          </div>
          {/* Score summary */}
          <div className="flex items-center gap-4">
            {innings.map((inn) => (
              <div key={inn.innings_number} className="text-center">
                <p className="text-xs text-text-muted font-medium">
                  {getTeamAbbr(inn.batting_team)}
                </p>
                <p className="text-xl font-heading font-bold text-text-primary font-mono">
                  {inn.total_runs}/{inn.total_wickets}
                </p>
                <p className="text-xs text-text-muted font-mono">
                  ({inn.total_balls ? `${Math.floor(inn.total_balls / 6)}${inn.total_balls % 6 ? '.' + (inn.total_balls % 6) : ''}` : '20'} ov)
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Result Banner */}
        <div
          className="rounded-lg px-4 py-3 flex items-center gap-3"
          style={{
            backgroundColor: winnerColor ? winnerColor + '15' : 'rgba(136, 136, 160, 0.1)',
            borderLeft: `4px solid ${winnerColor || '#8888A0'}`,
          }}
        >
          <p className="text-text-primary font-heading font-semibold text-sm">
            {resultText}
          </p>
        </div>
      </div>

      {/* MVP Spotlight */}
      {match.player_of_match && (
        <div className="card !p-0 overflow-hidden bg-gradient-to-br from-white/5 to-transparent border-accent-amber/20 animate-in" style={{ animationDelay: '100ms' }}>
          <div className="flex flex-col sm:flex-row items-center gap-6 p-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-accent-amber blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
              <PlayerAvatar name={match.player_of_match} size={100} ringColor="#FFB800" />
              <div className="absolute -bottom-2 -right-2 bg-accent-amber text-bg-primary text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter">MVP</div>
            </div>
            <div className="flex-1 text-center sm:text-left space-y-2">
              <h3 className="text-2xl font-heading font-black text-text-primary tracking-tight">{match.player_of_match}</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Awarded Player of the Match for a standout performance that turned the tide in favor of {match.winner}.
              </p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-4 pt-2">
                <div className="text-center">
                   <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Impact Score</p>
                   <p className="text-lg font-black text-accent-amber">94.2</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                   <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Innings</p>
                   <p className="text-lg font-black text-text-primary">{match.winner === match.team1 ? '1st' : '2nd'}</p>
                </div>
              </div>
            </div>
            <Link 
              to={`/batting/${encodeURIComponent(match.player_of_match)}`}
              className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 hover:border-accent-amber/50 transition-all"
            >
              Full Profile
            </Link>
          </div>
        </div>
      )}

      {/* Match Info Card */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {match.venue && (
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider mb-0.5">Venue</p>
              <p className="text-text-secondary">
                {match.venue}{match.city ? `, ${match.city}` : ''}
              </p>
            </div>
          )}
          {match.toss_winner && (
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider mb-0.5">Toss</p>
              <p className="text-text-secondary">
                {match.toss_winner} chose to {match.toss_decision}
              </p>
            </div>
          )}
          {match.player_of_match && (
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider mb-0.5">Player of Match</p>
              <p className="text-accent-amber font-medium">{match.player_of_match}</p>
            </div>
          )}
          {match.umpire1 && (
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider mb-0.5">Umpires</p>
              <p className="text-text-secondary">
                {match.umpire1}{match.umpire2 ? `, ${match.umpire2}` : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border-subtle pb-px">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-body whitespace-nowrap transition-colors relative ${
              activeTab === tab
                ? 'text-accent-cyan font-medium'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-cyan rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'Scorecard' && renderScorecard()}
        {activeTab === 'Match Report' && renderMatchReport()}
        {activeTab === 'Worm' && renderWorm()}
        {activeTab === 'Run Rate Battle' && renderRunRateBattle()}
        {activeTab === 'Partnerships' && renderPartnerships()}
      </div>
    </div>
  )
}
