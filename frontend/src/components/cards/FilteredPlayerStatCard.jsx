import { NEON_COLORS, BOX_COLORS, FONTS, cardContainerStyle, dotGridBackground, watermarkStyle, watermarkLogoStyle, formatNumber, formatDecimal, CARD_DIMENSIONS, scaledFont, scaledSize } from './cardStyles'
import { getTeamColor } from '../../constants/teams'
import PlayerAvatar from '../ui/PlayerAvatar'

export default function FilteredPlayerStatCard({ playerName, stats = {}, type = 'batting', seasons = [], teams = [], availableTeams = [], dimensions = CARD_DIMENSIONS.twitter }) {
  const accentColor = type === 'batting' ? NEON_COLORS.cyan : type === 'bowling' ? NEON_COLORS.magenta : NEON_COLORS.green
  const teamColor = accentColor
  const isPortrait = dimensions.height > dimensions.width
  const sf = (px) => scaledFont(px, dimensions)

  const battingGrid = stats.batting ? [
    { label: 'Runs', value: formatNumber(stats.batting.runs) },
    { label: 'Matches', value: formatNumber(stats.batting.matches) },
    { label: 'HS', value: formatNumber(stats.batting.highest) },
    { label: 'Average', value: formatDecimal(stats.batting.avg) },
    { label: 'Strike Rate', value: formatDecimal(stats.batting.sr) },
    { label: '50s', value: formatNumber(stats.batting.fifties) },
    { label: '100s', value: formatNumber(stats.batting.hundreds) },
    { label: '6s', value: formatNumber(stats.batting.sixes) },
    { label: '4s', value: formatNumber(stats.batting.fours) },
  ] : []

  const bowlingGrid = stats.bowling ? [
    { label: 'Wickets', value: formatNumber(stats.bowling.wickets) },
    { label: 'Matches', value: formatNumber(stats.bowling.matches) },
    { label: 'Economy', value: formatDecimal(stats.bowling.economy) },
    { label: 'Average', value: formatDecimal(stats.bowling.avg) },
    { label: 'Strike Rate', value: formatDecimal(stats.bowling.sr) },
    { label: 'Best', value: stats.bowling.best_figures || '-' },
    { label: '4W', value: formatNumber(stats.bowling.four_wickets) },
    { label: '5W', value: formatNumber(stats.bowling.five_wickets) },
  ] : []

  const gridItems = type === 'batting' ? battingGrid : type === 'bowling' ? bowlingGrid : [...battingGrid.slice(0, 4), ...bowlingGrid.slice(0, 4)]
  const heroStat = type === 'batting' && stats.batting ? { label: 'RUNS', value: formatNumber(stats.batting.runs) } :
                   type === 'bowling' && stats.bowling ? { label: 'WICKETS', value: formatNumber(stats.bowling.wickets) } :
                   stats.batting && stats.bowling ? { label: 'ALL-ROUND', value: `${formatNumber(stats.batting.runs)}/${formatNumber(stats.bowling.wickets)}` } :
                   { label: 'STATS', value: 'N/A' }

  const filtersText = []
  if (seasons.length > 0 && !seasons.includes('all')) filtersText.push(`Seasons: ${seasons.join(', ')}`)
  if (teams.length > 0 && !teams.includes('all')) filtersText.push(`Teams: ${teams.join(', ')}`)

  // Get team logos - for now, show all selected teams or all teams if 'all'
  const teamNameToImage = {
    'Chennai Super Kings': 'CSK',
    'Delhi Capitals': 'DC',
    'Gujarat Titans': 'GT',
    'Kolkata Knight Riders': 'KKR',
    'Lucknow Super Giants': 'LSG',
    'Mumbai Indians': 'MI',
    'Punjab Kings': 'PK',
    'Rajasthan Royals': 'RR',
    'Royal Challengers Bangalore': 'RCB',
    'Sunrisers Hyderabad': 'SRH',
    'Kings XI Punjab': 'PK', // old name
    'Delhi Daredevils': 'DC', // old name
    'Deccan Chargers': 'Decaan',
    'Pune Warriors': 'PW',
    'Gujarat Lions': 'GL',
    'Kochi Tuskers Kerala': 'KT',
    'Rising Pune Supergiant': 'RPSG'
  }

  const displayTeams = teams.includes('all') ? availableTeams.slice(0, 4).map(t => teamNameToImage[t] || t).filter(Boolean) : teams.filter(t => t !== 'all').map(t => teamNameToImage[t] || t).filter(Boolean)

  return (
    <div style={cardContainerStyle(dimensions)}>
      <div style={dotGridBackground()} />

      <div style={{ height: '5px', background: `linear-gradient(90deg, ${accentColor}, ${teamColor})`, zIndex: 2 }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: isPortrait ? '48px 40px 56px 40px' : '44px 56px 48px 56px', zIndex: 2, position: 'relative' }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: isPortrait ? 'column' : 'row', justifyContent: isPortrait ? 'flex-start' : 'space-between', alignItems: isPortrait ? 'center' : 'flex-start', marginBottom: isPortrait ? '40px' : '32px', gap: isPortrait ? '28px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isPortrait ? '28px' : '28px', flexDirection: isPortrait ? 'column' : 'row', textAlign: isPortrait ? 'center' : 'left' }}>
            <PlayerAvatar
              name={playerName || 'Player Name'}
              imageUrl={null}
              teamColor={teamColor}
              size={isPortrait ? scaledSize(200, dimensions) : scaledSize(140, dimensions)}
              inline
              shape="rounded"
            />
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: sf(18), color: accentColor, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700 }}>
                {type === 'all-rounder' ? 'All-Rounder Stats' : `${type.charAt(0).toUpperCase() + type.slice(1)} Stats`}
              </div>
              <div style={{ fontFamily: FONTS.heading, fontSize: sf(52), fontWeight: 700, color: '#F0F0F5', lineHeight: 1.1, letterSpacing: '-0.02em', wordWrap: 'break-word', overflowWrap: 'break-word', maxWidth: '550px' }}>
                {playerName || 'Player Name'}
              </div>
              {filtersText.length > 0 && (
                <div style={{ fontFamily: FONTS.mono, fontSize: sf(12), color: '#F0F0F5', opacity: 0.7, marginTop: '8px', lineHeight: 1.3 }}>
                  {filtersText.join(' | ')}
                </div>
              )}
              {displayTeams.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {displayTeams.slice(0, 4).map(team => (
                    <img
                      key={team}
                      src={`/api/teams/${team}/image`}
                      alt={team}
                      style={{
                        width: scaledSize(32, dimensions),
                        height: scaledSize(32, dimensions),
                        borderRadius: '50%',
                        border: `2px solid ${accentColor}40`,
                        objectFit: 'contain'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  ))}
                  {displayTeams.length > 4 && (
                    <div style={{
                      width: scaledSize(32, dimensions),
                      height: scaledSize(32, dimensions),
                      borderRadius: '50%',
                      background: accentColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: FONTS.mono,
                      fontSize: sf(14),
                      fontWeight: 700,
                      color: '#000'
                    }}>
                      +{displayTeams.length - 4}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{ textAlign: isPortrait ? 'center' : 'right' }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: sf(76), fontWeight: 700, color: '#00E5FF', lineHeight: 1, textShadow: '0 0 30px rgba(0,229,255,0.2)' }}>
              {heroStat.value}
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: sf(18), color: '#F0F0F5', letterSpacing: '0.1em', marginTop: '6px', fontWeight: 700, opacity: 0.8 }}>
              {heroStat.label}
            </div>
          </div>
        </div>

        <div style={{ height: '3px', background: `linear-gradient(90deg, ${accentColor}66, transparent)`, marginBottom: '28px' }} />

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isPortrait ? 'repeat(2, 1fr)' : type === 'all-rounder' ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: isPortrait ? '4px' : '16px', flex: 1 }}>
          {gridItems.slice(0, type === 'all-rounder' ? 8 : 9).map((item, i) => {
            const boxColor = BOX_COLORS[i % BOX_COLORS.length]
            return (
              <div key={item.label} style={{
                background: boxColor.bg, borderRadius: '12px',
                padding: isPortrait ? '20px 16px' : '8px 10px',
                border: `1px solid ${boxColor.border}`, textAlign: 'center',
              }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: sf(24), color: boxColor.accent, letterSpacing: '0.1em', textTransform: 'uppercase',  fontWeight: 700, opacity: 0.8, }}>
                  {item.label}
                </div>
                <div style={{ fontFamily: FONTS.mono, fontSize: sf(46), fontWeight: 700, color: '#F0F0F5' }}>
                  {item.value}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={watermarkStyle()}><img src="/logo.png" alt="" style={watermarkLogoStyle()} />crickrida.rkjat.in</div>
    </div>
  )
}