import { NEON_COLORS, FONTS, cardContainerStyle, dotGridBackground, watermarkStyle, CARD_DIMENSIONS } from './cardStyles'

export default function RecordCard({ title, value, subtitle, description, dimensions = CARD_DIMENSIONS.twitter }) {
  return (
    <div style={cardContainerStyle(dimensions)}>
      <div style={dotGridBackground()} />

      {/* Top accent */}
      <div style={{ height: '5px', background: `linear-gradient(90deg, ${NEON_COLORS.amber}, ${NEON_COLORS.lime})`, zIndex: 2 }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: dimensions.height > dimensions.width ? '60px 48px' : '48px 64px', zIndex: 2, position: 'relative', textAlign: 'center' }}>
        {/* Did you know badge */}
        <div style={{
          fontFamily: FONTS.mono, fontSize: '18px', color: NEON_COLORS.amber,
          letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: dimensions.height > dimensions.width ? '40px' : '28px',
          padding: '10px 32px', border: `1px solid ${NEON_COLORS.amber}44`,
          borderRadius: '24px', background: `${NEON_COLORS.amber}0A`, fontWeight: 600,
        }}>
          {subtitle || 'Did you know?'}
        </div>

        {/* Title */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: dimensions.height > dimensions.width ? '38px' : '36px', fontWeight: 600,
          color: '#F0F0F5', marginBottom: dimensions.height > dimensions.width ? '48px' : '24px', lineHeight: 1.4,
          maxWidth: '800px', wordWrap: 'break-word', overflowWrap: 'break-word',
        }}>
          {title || 'Record Title'}
        </div>

        {/* Big value */}
        <div style={{
          fontFamily: FONTS.mono, fontSize: dimensions.height > dimensions.width ? '128px' : '108px', fontWeight: 700,
          color: '#00E5FF', lineHeight: 1, marginBottom: dimensions.height > dimensions.width ? '48px' : '24px',
          textShadow: `0 0 40px ${NEON_COLORS.cyan}33`,
        }}>
          {value || '0'}
        </div>

        {/* Description */}
        <div style={{
          fontFamily: FONTS.body, fontSize: '24px', color: '#F0F0F5',
          lineHeight: 1.5, maxWidth: '700px', wordWrap: 'break-word', overflowWrap: 'break-word',
          opacity: 0.85,
        }}>
          {description || 'Description of this incredible record.'}
        </div>
      </div>

      <div style={watermarkStyle()}>@Rkjat65 &bull; Data doesn&apos;t lie.</div>
    </div>
  )
}
