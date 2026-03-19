import { NEON_COLORS, FONTS, cardContainerStyle, dotGridBackground, watermarkStyle, CARD_DIMENSIONS } from './cardStyles'
import { getTeamColor } from '../../constants/teams'

function AwardRow({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '18px 24px', background: NEON_COLORS.bgCard,
      border: `1px solid ${NEON_COLORS.border}`, borderRadius: '10px',
    }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: '15px', color: '#F0F0F5', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, opacity: 0.7 }}>
        {label}
      </div>
      <div style={{ fontFamily: FONTS.heading, fontSize: '22px', fontWeight: 700, color: color || '#F0F0F5' }}>
        {value || '-'}
      </div>
    </div>
  )
}

export default function SeasonRecapCard({ season, champion, topScorer, topWicketTaker, orangeCap, purpleCap, dimensions = CARD_DIMENSIONS.twitter }) {
  const champColor = champion ? getTeamColor(champion) : NEON_COLORS.amber

  return (
    <div style={cardContainerStyle(dimensions)}>
      <div style={dotGridBackground()} />

      {/* Top bar */}
      <div style={{ height: '5px', background: `linear-gradient(90deg, ${NEON_COLORS.amber}, ${champColor})`, zIndex: 2 }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: dimensions.height > dimensions.width ? '40px 40px 56px 40px' : '40px 56px 48px 56px', zIndex: 2, position: 'relative' }}>
        {/* Season header */}
        <div style={{ display: 'flex', flexDirection: dimensions.height > dimensions.width ? 'column' : 'row', justifyContent: dimensions.height > dimensions.width ? 'flex-start' : 'space-between', alignItems: dimensions.height > dimensions.width ? 'center' : 'flex-start', marginBottom: dimensions.height > dimensions.width ? '36px' : '28px', gap: dimensions.height > dimensions.width ? '24px' : '0', textAlign: dimensions.height > dimensions.width ? 'center' : undefined }}>
          <div style={{ textAlign: dimensions.height > dimensions.width ? 'center' : undefined }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: '16px', color: '#F0F0F5', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 600, opacity: 0.7 }}>
              Season Recap
            </div>
            <div style={{ fontFamily: FONTS.heading, fontSize: dimensions.height > dimensions.width ? '64px' : '56px', fontWeight: 700, color: '#F0F0F5', lineHeight: 1 }}>
              IPL {season || '20XX'}
            </div>
          </div>

          {/* Champion badge */}
          <div style={{
            textAlign: dimensions.height > dimensions.width ? 'center' : 'right', padding: '20px 28px', background: `${champColor}15`,
            border: `1px solid ${champColor}44`, borderRadius: '14px',
          }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: '15px', color: NEON_COLORS.amber, letterSpacing: '0.12em', marginBottom: '8px', fontWeight: 600 }}>
              CHAMPION
            </div>
            <div style={{ fontFamily: FONTS.heading, fontSize: '30px', fontWeight: 700, color: champColor }}>
              {champion || 'TBD'}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '2px', background: `linear-gradient(90deg, ${NEON_COLORS.amber}66, transparent)`, marginBottom: '24px' }} />

        {/* Awards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: dimensions.height > dimensions.width ? '1fr' : '1fr 1fr', gap: dimensions.height > dimensions.width ? '12px' : '14px', flex: 1 }}>
          <AwardRow label="Orange Cap" value={orangeCap} color={NEON_COLORS.amber} />
          <AwardRow label="Purple Cap" value={purpleCap} color={NEON_COLORS.magenta} />
          <AwardRow label="Top Scorer" value={topScorer} color={NEON_COLORS.cyan} />
          <AwardRow label="Top Wicket-Taker" value={topWicketTaker} color={NEON_COLORS.lime} />
        </div>
      </div>

      <div style={watermarkStyle()}>@Rkjat65 &bull; Data doesn&apos;t lie.</div>
    </div>
  )
}
