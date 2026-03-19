import { useState, useEffect, useRef, useCallback } from 'react'
import { getSeasons, getTeams, searchPlayers, getPlayerBatting, getPlayerBowling, getMatches, getMatch, getSeasonSummary, generateCardImage } from '../lib/api'
import SEO from '../components/SEO'
import { exportAsImage, downloadImage, copyToClipboard } from '../utils/exportCard'
import { CARD_DIMENSIONS } from '../components/cards/cardStyles'
import PlayerStatCard from '../components/cards/PlayerStatCard'
import MatchSummaryCard from '../components/cards/MatchSummaryCard'
import ComparisonCard from '../components/cards/ComparisonCard'
import RecordCard from '../components/cards/RecordCard'
import SeasonRecapCard from '../components/cards/SeasonRecapCard'
import PlayerAvatar from '../components/ui/PlayerAvatar'

const TEMPLATES = [
  { id: 'player', label: 'Player Stats', color: '#00E5FF' },
  { id: 'match', label: 'Match Summary', color: '#FF2D78' },
  { id: 'comparison', label: 'Comparison', color: '#B8FF00' },
  { id: 'record', label: 'Record Card', color: '#FFB800' },
  { id: 'season', label: 'Season Recap', color: '#00E5FF' },
  { id: 'ai-image', label: 'AI Image', color: '#A78BFA' },
]

const FORMAT_OPTIONS = [
  { id: 'twitter', label: 'Twitter', dims: CARD_DIMENSIONS.twitter },
  { id: 'instagram', label: 'Instagram', dims: CARD_DIMENSIONS.instagram },
  { id: 'linkedin', label: 'LinkedIn', dims: CARD_DIMENSIONS.linkedin },
  { id: 'portrait', label: 'Portrait 9:16', dims: CARD_DIMENSIONS.portrait },
]

// Extracted outside to prevent re-mount on every render (which causes input focus loss)
function PlayerSearchInput({ query, setQuery, results, setResults, onSelect, selectedName, label }) {
  return (
    <div className="relative">
      <label className="block text-xs font-mono text-text-muted mb-1">{label}</label>
      <div className="relative">
        {selectedName && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
            <PlayerAvatar name={selectedName} size={24} showBorder={false} />
          </div>
        )}
        <input
          type="text"
          value={selectedName || query}
          onChange={e => { setQuery(e.target.value); onSelect('') }}
          placeholder="Search player..."
          className={`w-full bg-bg-card border border-border-subtle rounded-lg py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50 ${selectedName ? 'pl-9 pr-3' : 'px-3'}`}
        />
      </div>
      {results.length > 0 && !selectedName && (
        <div className="absolute z-20 top-full mt-1 w-full bg-bg-elevated border border-border-subtle rounded-lg max-h-48 overflow-y-auto shadow-xl">
          {results.map(p => (
            <button
              key={p}
              onClick={() => { onSelect(p); setQuery(''); setResults([]) }}
              className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors flex items-center gap-2"
            >
              <PlayerAvatar name={p} size={24} showBorder={false} />
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ContentStudio() {
  const cardRef = useRef(null)
  const [template, setTemplate] = useState('player')
  const [format, setFormat] = useState('twitter')
  const [status, setStatus] = useState(null)

  // Data sources
  const [seasons, setSeasons] = useState([])
  const [teams, setTeams] = useState([])
  const [playerQuery, setPlayerQuery] = useState('')
  const [playerResults, setPlayerResults] = useState([])
  const [matchList, setMatchList] = useState([])

  // Player stat card state
  const [playerName, setPlayerName] = useState('')
  const [playerType, setPlayerType] = useState('batting')
  const [playerStats, setPlayerStats] = useState({})
  const [playerLoading, setPlayerLoading] = useState(false)

  // Match summary state
  const [matchId, setMatchId] = useState('')
  const [matchData, setMatchData] = useState({})

  // Comparison state
  const [p1Query, setP1Query] = useState('')
  const [p1Results, setP1Results] = useState([])
  const [p1Name, setP1Name] = useState('')
  const [p1Stats, setP1Stats] = useState({})
  const [p2Query, setP2Query] = useState('')
  const [p2Results, setP2Results] = useState([])
  const [p2Name, setP2Name] = useState('')
  const [p2Stats, setP2Stats] = useState({})
  const [compMetric, setCompMetric] = useState('batting')
  const [p1Type, setP1Type] = useState('batting')
  const [p2Type, setP2Type] = useState('batting')

  // Record card state
  const [recordTitle, setRecordTitle] = useState('')
  const [recordValue, setRecordValue] = useState('')
  const [recordSubtitle, setRecordSubtitle] = useState('')
  const [recordDesc, setRecordDesc] = useState('')

  // Season recap state
  const [selectedSeason, setSelectedSeason] = useState('')
  const [seasonData, setSeasonData] = useState({})

  // AI Image state
  const [aiStyle, setAiStyle] = useState('neon')
  const [aiTitle, setAiTitle] = useState('')
  const [aiSubtitle, setAiSubtitle] = useState('')
  const [aiHeroStat, setAiHeroStat] = useState('')
  const [aiHeroLabel, setAiHeroLabel] = useState('')
  const [aiStats, setAiStats] = useState('')
  const [aiTeamColor, setAiTeamColor] = useState('')
  const [aiGeneratedImage, setAiGeneratedImage] = useState(null)
  const [aiGenerating, setAiGenerating] = useState(false)

  // Load initial data
  useEffect(() => {
    getSeasons().then(setSeasons).catch(() => {})
    getTeams().then(setTeams).catch(() => {})
    getMatches({ limit: 50 }).then(r => setMatchList(r.matches || r || [])).catch(() => {})
  }, [])

  // Player search
  useEffect(() => {
    if (playerQuery.length < 2) { setPlayerResults([]); return }
    const t = setTimeout(() => {
      searchPlayers(playerQuery).then(setPlayerResults).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [playerQuery])

  // Load player stats when selected
  useEffect(() => {
    if (!playerName) return
    setPlayerLoading(true)
    const fetcher = playerType === 'batting' ? getPlayerBatting : getPlayerBowling
    fetcher(playerName)
      .then(data => {
        const c = data.career || data || {}
        if (playerType === 'batting') {
          setPlayerStats({
            runs: c.runs ?? c.total_runs,
            matches: c.matches,
            innings: c.innings,
            avg: c.avg ?? c.average,
            sr: c.sr ?? c.strike_rate,
            fifties: c.fifties ?? c.half_centuries,
            hundreds: c.hundreds ?? c.centuries,
            sixes: c.sixes,
            fours: c.fours,
          })
        } else {
          setPlayerStats({
            wickets: c.wickets ?? c.total_wickets,
            matches: c.matches,
            innings: c.innings,
            avg: c.avg ?? c.average,
            economy: c.economy,
            sr: c.sr ?? c.strike_rate,
            best_figures: c.best_figures ?? c.best,
            four_wickets: c.four_w ?? c.four_wickets,
            five_wickets: c.five_w ?? c.five_wickets,
          })
        }
      })
      .catch(() => setPlayerStats({}))
      .finally(() => setPlayerLoading(false))
  }, [playerName, playerType])

  // Load match data
  useEffect(() => {
    if (!matchId) return
    getMatch(matchId)
      .then(data => {
        const info = data.info || data || {}
        const sc = data.scorecards || []
        const team1Score = sc[0]?.total_runs
        const team2Score = sc[1]?.total_runs
        const margin = info.win_by_runs ? `${info.win_by_runs} runs` : info.win_by_wickets ? `${info.win_by_wickets} wickets` : ''
        setMatchData({ ...info, team1_score: team1Score, team2_score: team2Score, margin })
      })
      .catch(() => setMatchData({}))
  }, [matchId])

  // Comparison player search
  useEffect(() => {
    if (p1Query.length < 2) { setP1Results([]); return }
    const t = setTimeout(() => searchPlayers(p1Query).then(setP1Results).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [p1Query])

  useEffect(() => {
    if (p2Query.length < 2) { setP2Results([]); return }
    const t = setTimeout(() => searchPlayers(p2Query).then(setP2Results).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [p2Query])

  // Load comparison player stats (per-player type)
  useEffect(() => {
    if (!p1Name) return
    const fetcher = p1Type === 'batting' ? getPlayerBatting : getPlayerBowling
    fetcher(p1Name).then(data => {
      const d = data.career || data || {}
      setP1Stats(p1Type === 'batting' ? {
        runs: d.runs ?? d.total_runs, avg: d.avg ?? d.average, sr: d.sr ?? d.strike_rate,
        matches: d.matches, fifties: d.fifties ?? d.half_centuries,
        hundreds: d.hundreds ?? d.centuries, sixes: d.sixes,
      } : {
        wickets: d.wickets ?? d.total_wickets, avg: d.avg ?? d.average,
        economy: d.economy, sr: d.sr ?? d.strike_rate, matches: d.matches,
        four_wickets: d.four_w ?? d.four_wickets,
        five_wickets: d.five_w ?? d.five_wickets,
      })
    }).catch(() => setP1Stats({}))
  }, [p1Name, p1Type])

  useEffect(() => {
    if (!p2Name) return
    const fetcher = p2Type === 'batting' ? getPlayerBatting : getPlayerBowling
    fetcher(p2Name).then(data => {
      const d = data.career || data || {}
      setP2Stats(p2Type === 'batting' ? {
        runs: d.runs ?? d.total_runs, avg: d.avg ?? d.average, sr: d.sr ?? d.strike_rate,
        matches: d.matches, fifties: d.fifties ?? d.half_centuries,
        hundreds: d.hundreds ?? d.centuries, sixes: d.sixes,
      } : {
        wickets: d.wickets ?? d.total_wickets, avg: d.avg ?? d.average,
        economy: d.economy, sr: d.sr ?? d.strike_rate, matches: d.matches,
        four_wickets: d.four_w ?? d.four_wickets,
        five_wickets: d.five_w ?? d.five_wickets,
      })
    }).catch(() => setP2Stats({}))
  }, [p2Name, p2Type])

  // Season recap
  useEffect(() => {
    if (!selectedSeason) return
    getSeasonSummary(selectedSeason)
      .then(data => {
        // Normalize nested objects to strings for card rendering
        const oc = data.orange_cap
        const pc = data.purple_cap
        const mp = data.most_pom
        setSeasonData({
          ...data,
          champion: data.champion || data.winner || '',
          orange_cap: typeof oc === 'object' ? `${oc.player} (${oc.runs} runs)` : oc,
          purple_cap: typeof pc === 'object' ? `${pc.player} (${pc.wickets} wkts)` : pc,
          top_scorer: typeof oc === 'object' ? `${oc.player} (${oc.runs} runs)` : data.top_scorer,
          top_wicket_taker: typeof pc === 'object' ? `${pc.player} (${pc.wickets} wkts)` : data.top_wicket_taker,
          most_pom: typeof mp === 'object' ? `${mp.player} (${mp.awards ?? mp.count})` : mp,
        })
      })
      .catch(() => setSeasonData({}))
  }, [selectedSeason])

  const currentDims = FORMAT_OPTIONS.find(f => f.id === format)?.dims || CARD_DIMENSIONS.twitter

  const handleDownload = useCallback(async () => {
    try {
      setStatus('Exporting...')
      const dataUrl = await exportAsImage(cardRef.current, `rkjat65-${template}`, 'png')
      downloadImage(dataUrl, `rkjat65-${template}.png`)
      setStatus('Downloaded!')
      setTimeout(() => setStatus(null), 2000)
    } catch (err) {
      setStatus('Export failed')
      console.error(err)
      setTimeout(() => setStatus(null), 2000)
    }
  }, [template])

  const handleCopy = useCallback(async () => {
    try {
      setStatus('Copying...')
      await copyToClipboard(cardRef.current)
      setStatus('Copied to clipboard!')
      setTimeout(() => setStatus(null), 2000)
    } catch (err) {
      setStatus('Copy failed')
      console.error(err)
      setTimeout(() => setStatus(null), 2000)
    }
  }, [])

  // AI Image generation
  const handleGenerateAiImage = useCallback(async () => {
    setAiGenerating(true)
    try {
      const dims = FORMAT_OPTIONS.find(f => f.id === format)?.dims || CARD_DIMENSIONS.twitter
      // Parse stats string into object
      let statsObj = {}
      if (aiStats.trim()) {
        aiStats.split('\n').forEach(line => {
          const [key, val] = line.split(':').map(s => s.trim())
          if (key && val) statsObj[key] = val
        })
      }
      const result = await generateCardImage({
        style: aiStyle,
        width: dims.width,
        height: dims.height,
        title: aiTitle || undefined,
        subtitle: aiSubtitle || undefined,
        hero_stat: aiHeroStat || undefined,
        hero_label: aiHeroLabel || undefined,
        stats: Object.keys(statsObj).length > 0 ? statsObj : undefined,
        team_color: aiTeamColor || undefined,
      })
      setAiGeneratedImage(result.image)
    } catch (err) {
      console.error('AI image gen failed:', err)
      setStatus('Image generation failed')
      setTimeout(() => setStatus(null), 2000)
    } finally {
      setAiGenerating(false)
    }
  }, [aiStyle, aiTitle, aiSubtitle, aiHeroStat, aiHeroLabel, aiStats, aiTeamColor, format])

  function renderDataInputs() {
    switch (template) {
      case 'player':
        return (
          <div className="space-y-4">
            <PlayerSearchInput
              query={playerQuery} setQuery={setPlayerQuery}
              results={playerResults} setResults={setPlayerResults}
              onSelect={setPlayerName} selectedName={playerName}
              label="Player Name"
            />
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Stat Type</label>
              <div className="flex gap-2">
                {['batting', 'bowling'].map(t => (
                  <button key={t} onClick={() => setPlayerType(t)}
                    className={`px-4 py-2 text-sm rounded-lg border transition-colors ${playerType === t ? 'bg-accent-cyan/20 border-accent-cyan/40 text-accent-cyan' : 'border-border-subtle text-text-secondary hover:text-text-primary'}`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {playerLoading && <p className="text-xs text-text-muted font-mono">Loading stats...</p>}
          </div>
        )

      case 'match':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Select Match</label>
              <select
                value={matchId}
                onChange={e => setMatchId(e.target.value)}
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/50"
              >
                <option value="">Choose a match...</option>
                {matchList.map(m => (
                  <option key={m.match_id || m.id} value={m.match_id || m.id}>
                    {m.team1} vs {m.team2} ({m.date || m.season})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )

      case 'comparison':
        return (
          <div className="space-y-4">
            <PlayerSearchInput
              query={p1Query} setQuery={setP1Query}
              results={p1Results} setResults={setP1Results}
              onSelect={setP1Name} selectedName={p1Name}
              label="Player 1"
            />
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Player 1 Type</label>
              <div className="flex gap-2">
                {['batting', 'bowling'].map(t => (
                  <button key={t} onClick={() => setP1Type(t)}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${p1Type === t ? 'bg-accent-cyan/20 border-accent-cyan/40 text-accent-cyan' : 'border-border-subtle text-text-secondary hover:text-text-primary'}`}
                  >
                    {t === 'batting' ? 'Batsman' : 'Bowler'}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-border-subtle pt-4" />
            <PlayerSearchInput
              query={p2Query} setQuery={setP2Query}
              results={p2Results} setResults={setP2Results}
              onSelect={setP2Name} selectedName={p2Name}
              label="Player 2"
            />
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Player 2 Type</label>
              <div className="flex gap-2">
                {['batting', 'bowling'].map(t => (
                  <button key={t} onClick={() => setP2Type(t)}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${p2Type === t ? 'bg-accent-cyan/20 border-accent-cyan/40 text-accent-cyan' : 'border-border-subtle text-text-secondary hover:text-text-primary'}`}
                  >
                    {t === 'batting' ? 'Batsman' : 'Bowler'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case 'record':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Title</label>
              <input type="text" value={recordTitle} onChange={e => setRecordTitle(e.target.value)}
                placeholder="e.g. Most sixes in a season"
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Value</label>
              <input type="text" value={recordValue} onChange={e => setRecordValue(e.target.value)}
                placeholder="e.g. 59"
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Subtitle / Badge</label>
              <input type="text" value={recordSubtitle} onChange={e => setRecordSubtitle(e.target.value)}
                placeholder="e.g. Did you know?"
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Description</label>
              <textarea value={recordDesc} onChange={e => setRecordDesc(e.target.value)}
                placeholder="Additional context about this record..."
                rows={3}
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50 resize-none"
              />
            </div>
          </div>
        )

      case 'season':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Season</label>
              <select
                value={selectedSeason}
                onChange={e => setSelectedSeason(e.target.value)}
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-cyan/50"
              >
                <option value="">Choose season...</option>
                {seasons.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )

      case 'ai-image':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Style</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'neon', label: 'Neon Noir', color: '#00E5FF' },
                  { id: 'minimal', label: 'Minimal', color: '#B0B0C8' },
                  { id: 'vintage', label: 'Vintage Gold', color: '#FFB800' },
                  { id: 'electric', label: 'Electric', color: '#B8FF00' },
                ].map(s => (
                  <button key={s.id} onClick={() => setAiStyle(s.id)}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                      aiStyle === s.id ? 'border-accent-cyan/40 text-accent-cyan' : 'border-border-subtle text-text-secondary hover:text-text-primary'
                    }`}
                    style={aiStyle === s.id ? { borderColor: `${s.color}66`, color: s.color } : {}}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Title</label>
              <input type="text" value={aiTitle} onChange={e => setAiTitle(e.target.value)}
                placeholder="e.g. Virat Kohli" className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50" />
            </div>
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Subtitle</label>
              <input type="text" value={aiSubtitle} onChange={e => setAiSubtitle(e.target.value)}
                placeholder="e.g. Batting Stats" className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-mono text-text-muted mb-1">Hero Stat</label>
                <input type="text" value={aiHeroStat} onChange={e => setAiHeroStat(e.target.value)}
                  placeholder="e.g. 8,004" className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50" />
              </div>
              <div>
                <label className="block text-xs font-mono text-text-muted mb-1">Hero Label</label>
                <input type="text" value={aiHeroLabel} onChange={e => setAiHeroLabel(e.target.value)}
                  placeholder="e.g. RUNS" className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Stats (key: value, one per line)</label>
              <textarea value={aiStats} onChange={e => setAiStats(e.target.value)}
                placeholder={"Matches: 237\nInnings: 226\nAverage: 37.25\nStrike Rate: 131.6\n50s: 50\n100s: 8"}
                rows={5}
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50 resize-none font-mono" />
            </div>
            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Team Color (hex)</label>
              <div className="flex gap-2">
                <input type="text" value={aiTeamColor} onChange={e => setAiTeamColor(e.target.value)}
                  placeholder="#EC1C24" className="flex-1 bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50 font-mono" />
                {aiTeamColor && <div className="w-10 h-10 rounded-lg border border-border-subtle" style={{ background: aiTeamColor }} />}
              </div>
            </div>
            <button
              onClick={handleGenerateAiImage}
              disabled={aiGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-40"
            >
              {aiGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>✨ Generate Image</>
              )}
            </button>
          </div>
        )

      default:
        return null
    }
  }

  function renderCard() {
    switch (template) {
      case 'player':
        return <PlayerStatCard playerName={playerName || 'Select a Player'} stats={playerStats} type={playerType} dimensions={currentDims} />
      case 'match':
        return (
          <MatchSummaryCard
            team1={matchData.team1 || 'Team 1'} team2={matchData.team2 || 'Team 2'}
            team1Score={matchData.team1_score || matchData.score1} team2Score={matchData.team2_score || matchData.score2}
            winner={matchData.winner} margin={matchData.result_margin ? `${matchData.result_margin} ${matchData.result_type || ''}`.trim() : matchData.margin}
            venue={matchData.venue} date={matchData.date}
            potm={matchData.player_of_match || matchData.potm}
            dimensions={currentDims}
          />
        )
      case 'comparison':
        return (
          <ComparisonCard
            player1={{ name: p1Name || 'Player 1', stats: p1Stats }}
            player2={{ name: p2Name || 'Player 2', stats: p2Stats }}
            metric={p1Type}
            metric2={p2Type}
            dimensions={currentDims}
          />
        )
      case 'record':
        return <RecordCard title={recordTitle} value={recordValue} subtitle={recordSubtitle} description={recordDesc} dimensions={currentDims} />
      case 'season':
        return (
          <SeasonRecapCard
            season={selectedSeason || '20XX'}
            champion={seasonData.champion || seasonData.winner}
            topScorer={seasonData.top_scorer || seasonData.orange_cap}
            topWicketTaker={seasonData.top_wicket_taker || seasonData.purple_cap}
            orangeCap={seasonData.orange_cap || seasonData.top_scorer}
            purpleCap={seasonData.purple_cap || seasonData.top_wicket_taker}
            dimensions={currentDims}
          />
        )
      case 'ai-image':
        if (aiGeneratedImage) {
          return (
            <div style={{ width: currentDims.width, height: currentDims.height }}>
              <img src={aiGeneratedImage} alt="Generated card" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          )
        }
        return (
          <div style={{ width: currentDims.width, height: currentDims.height, background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid #2A2A3C' }}>
            <div style={{ textAlign: 'center', color: '#8888A0', fontFamily: 'monospace' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
              <div style={{ fontSize: '16px' }}>Configure settings and click Generate Image</div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <SEO
        title="Content Studio - Create Branded Cricket Cards"
        description="Create stunning branded IPL cricket stat cards, match summaries, player comparisons, and season recaps for social media sharing."
      />
      {/* Template picker */}
      <div>
        <h2 className="text-sm font-heading font-semibold text-text-primary mb-3">Choose Template</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              className={`shrink-0 px-5 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                template === t.id
                  ? 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan shadow-lg shadow-accent-cyan/5'
                  : 'border-border-subtle bg-bg-card text-text-secondary hover:text-text-primary hover:border-border-subtle/80'
              }`}
              style={template === t.id ? { borderColor: `${t.color}66`, color: t.color, background: `${t.color}15` } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        {/* Data input panel */}
        <div className="bg-bg-card border border-border-subtle rounded-xl p-5 space-y-6">
          <h3 className="text-sm font-heading font-semibold text-text-primary">Configure Data</h3>
          {renderDataInputs()}

          {/* Format toggle */}
          <div>
            <label className="block text-xs font-mono text-text-muted mb-2">Format</label>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map(f => (
                <button key={f.id} onClick={() => setFormat(f.id)}
                  className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                    format === f.id
                      ? 'bg-accent-cyan/20 border-accent-cyan/40 text-accent-cyan'
                      : 'border-border-subtle text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Export buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 rounded-lg text-sm font-medium hover:bg-accent-cyan/30 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PNG
            </button>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-bg-elevated text-text-secondary border border-border-subtle rounded-lg text-sm font-medium hover:text-text-primary hover:border-border-subtle/80 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy to Clipboard
            </button>
          </div>

          {status && (
            <div className="text-center text-xs font-mono text-accent-cyan py-1">{status}</div>
          )}
        </div>

        {/* Live preview */}
        <div className="space-y-3">
          <h3 className="text-sm font-heading font-semibold text-text-primary">Live Preview</h3>
          <div className="bg-bg-elevated border border-border-subtle rounded-xl p-6 overflow-auto">
            <div
              ref={cardRef}
              style={{ transform: 'scale(var(--preview-scale, 0.5))', transformOrigin: 'top left', width: 'fit-content' }}
              className="[--preview-scale:0.45] sm:[--preview-scale:0.5] lg:[--preview-scale:0.55] xl:[--preview-scale:0.6]"
            >
              {renderCard()}
            </div>
          </div>
          <p className="text-xs text-text-muted font-mono">
            Output: {currentDims.width} x {currentDims.height}px &bull; Exported at 2x for retina
          </p>
        </div>
      </div>
    </div>
  )
}
