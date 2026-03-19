import { NEON_COLORS, FONTS, cardContainerStyle, dotGridBackground, watermarkStyle, CARD_DIMENSIONS } from './cardStyles'
import { getTeamColor, getTeamAbbr } from '../../constants/teams'

export default function MatchSummaryCard({ team1, team2, team1Score, team2Score, winner, margin, venue, date, potm, dimensions = CARD_DIMENSIONS.twitter }) {
  const t1Color = getTeamColor(team1)
  const t2Color = getTeamColor(team2)
  const t1Abbr = getTeamAbbr(team1)
  const t2Abbr = getTeamAbbr(team2)
  const isT1Winner = winner === team1

  return (
    <div style={cardContainerStyle(dimensions)}>
      <div style={dotGridBackground()} />

      {/* Top gradient bar */}
      <div style={{ height: '5px', background: `linear-gradient(90deg, ${t1Color}, ${t2Color})`, zIndex: 2 }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: dimensions.height > dimensions.width ? '40px 40px 56px 40px' : '40px 56px 48px 56px', zIndex: 2, position: 'relative' }}>
        {/* Match label */}
        <div style={{ fontFamily: FONTS.mono, fontSize: '16px', color: '#F0F0F5', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600, opacity: 0.7, textAlign: 'center' }}>
          Match Summary
        </div>

        {/* Teams & Scores */}
        <div style={{ display: 'flex', flexDirection: dimensions.height > dimensions.width ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: dimensions.height > dimensions.width ? '32px' : '48px', flex: 1 }}>
          {/* Team 1 */}
          <div style={{ textAlign: 'center', flex: dimensions.height > dimensions.width ? undefined : 1 }}>
            <div style={{
              fontFamily: FONTS.heading, fontSize: '26px', fontWeight: 600,
              color: isT1Winner ? '#F0F0F5' : NEON_COLORS.textSecondary,
              marginBottom: '10px', lineHeight: 1.3,
            }}>
              {team1 || 'Team 1'}
            </div>
            <div style={{
              fontFamily: FONTS.heading, fontSize: '36px', fontWeight: 700,
              color: t1Color, letterSpacing: '0.05em', marginBottom: '14px',
            }}>
              {t1Abbr}
            </div>
            <div style={{
              fontFamily: FONTS.mono, fontSize: dimensions.height > dimensions.width ? '64px' : '56px', fontWeight: 700,
              color: isT1Winner ? '#00E5FF' : NEON_COLORS.textSecondary, lineHeight: 1,
            }}>
              {team1Score || '-'}
            </div>
          </div>

          {/* VS divider */}
          <div style={{ display: 'flex', flexDirection: dimensions.height > dimensions.width ? 'row' : 'column', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: dimensions.height > dimensions.width ? '60px' : '2px', height: dimensions.height > dimensions.width ? '2px' : '60px', background: NEON_COLORS.border }} />
            <div style={{ fontFamily: FONTS.heading, fontSize: '24px', fontWeight: 700, color: '#F0F0F5', opacity: 0.5 }}>
              VS
            </div>
            <div style={{ width: dimensions.height > dimensions.width ? '60px' : '2px', height: dimensions.height > dimensions.width ? '2px' : '60px', background: NEON_COLORS.border }} />
          </div>

          {/* Team 2 */}
          <div style={{ textAlign: 'center', flex: dimensions.height > dimensions.width ? undefined : 1 }}>
            <div style={{
              fontFamily: FONTS.heading, fontSize: '26px', fontWeight: 600,
              color: !isT1Winner ? '#F0F0F5' : NEON_COLORS.textSecondary,
              marginBottom: '10px', lineHeight: 1.3,
            }}>
              {team2 || 'Team 2'}
            </div>
            <div style={{
              fontFamily: FONTS.heading, fontSize: '36px', fontWeight: 700,
              color: t2Color, letterSpacing: '0.05em', marginBottom: '14px',
            }}>
              {t2Abbr}
            </div>
            <div style={{
              fontFamily: FONTS.mono, fontSize: dimensions.height > dimensions.width ? '64px' : '56px', fontWeight: 700,
              color: !isT1Winner ? '#00E5FF' : NEON_COLORS.textSecondary, lineHeight: 1,
            }}>
              {team2Score || '-'}
            </div>
          </div>
        </div>

        {/* Result */}
        <div style={{
          textAlign: 'center', fontFamily: FONTS.heading, fontSize: '24px', fontWeight: 600,
          color: NEON_COLORS.lime, marginBottom: dimensions.height > dimensions.width ? '28px' : '20px',
        }}>
          {winner ? `${winner} won${margin ? ' by ' + margin : ''}` : 'Result pending'}
        </div>

        {/* Footer info */}
        <div style={{
          display: 'flex', flexDirection: dimensions.height > dimensions.width ? 'column' : 'row', justifyContent: 'space-between', alignItems: dimensions.height > dimensions.width ? 'center' : 'center',
          borderTop: `1px solid ${NEON_COLORS.border}`, paddingTop: '18px', gap: dimensions.height > dimensions.width ? '16px' : '0',
          textAlign: dimensions.height > dimensions.width ? 'center' : undefined,
        }}>
          <div style={{ textAlign: dimensions.height > dimensions.width ? 'center' : undefined }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: '15px', color: '#F0F0F5', letterSpacing: '0.1em', marginBottom: '4px', fontWeight: 600, opacity: 0.6 }}>VENUE</div>
            <div style={{ fontFamily: FONTS.body, fontSize: '18px', color: '#F0F0F5', maxWidth: '350px', wordWrap: 'break-word', overflowWrap: 'break-word', opacity: 0.85 }}>{venue || '-'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: '15px', color: '#F0F0F5', letterSpacing: '0.1em', marginBottom: '4px', fontWeight: 600, opacity: 0.6 }}>DATE</div>
            <div style={{ fontFamily: FONTS.body, fontSize: '18px', color: '#F0F0F5', opacity: 0.85 }}>{date || '-'}</div>
          </div>
          <div style={{ textAlign: dimensions.height > dimensions.width ? 'center' : 'right' }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: '15px', color: '#F0F0F5', letterSpacing: '0.1em', marginBottom: '4px', fontWeight: 600, opacity: 0.6 }}>PLAYER OF MATCH</div>
            <div style={{ fontFamily: FONTS.heading, fontSize: '22px', fontWeight: 700, color: NEON_COLORS.amber }}>{potm || '-'}</div>
          </div>
        </div>
      </div>

      <div style={watermarkStyle()}>@Rkjat65 &bull; Data doesn&apos;t lie.</div>
    </div>
  )
}
