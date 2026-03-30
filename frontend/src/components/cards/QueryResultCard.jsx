import { NEON_COLORS, FONTS, cardContainerStyle, dotGridBackground, watermarkStyle, watermarkLogoStyle, CARD_DIMENSIONS, formatNumber } from './cardStyles'

function StatRow({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 20px',
      background: NEON_COLORS.bgCard,
      border: `1px solid ${NEON_COLORS.border}`,
      borderRadius: '8px',
    }}>
      <span style={{
        fontFamily: FONTS.mono, fontSize: '15px', color: NEON_COLORS.textMuted,
        letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: FONTS.mono, fontSize: '22px', fontWeight: 700,
        color: color || NEON_COLORS.cyan,
      }}>
        {typeof value === 'number' ? formatNumber(value) : String(value ?? '-')}
      </span>
    </div>
  )
}

export default function QueryResultCard({
  question = 'Query Result',
  data = [],
  insight = '',
  dimensions = CARD_DIMENSIONS.twitter,
}) {
  const rows = []
  if (data.length === 1) {
    const entry = data[0]
    Object.entries(entry).forEach(([key, val]) => {
      rows.push({ label: key.replace(/_/g, ' '), value: val })
    })
  } else if (data.length > 1) {
    const cols = Object.keys(data[0] || {})
    const labelCol = cols[0]
    const valueCol = cols.length > 1 ? cols[cols.length - 1] : cols[0]
    data.slice(0, 8).forEach((row) => {
      rows.push({
        label: String(row[labelCol] ?? ''),
        value: row[valueCol],
      })
    })
  }

  const accentColors = [NEON_COLORS.cyan, NEON_COLORS.magenta, NEON_COLORS.lime, NEON_COLORS.amber]

  return (
    <div style={cardContainerStyle(dimensions)}>
      <div style={dotGridBackground()} />

      {/* Top accent bar */}
      <div style={{
        height: '5px',
        background: `linear-gradient(90deg, ${NEON_COLORS.cyan}, ${NEON_COLORS.magenta}, ${NEON_COLORS.lime})`,
        zIndex: 2,
      }} />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '40px 52px 44px 52px', zIndex: 2, position: 'relative',
      }}>
        {/* Badge */}
        <div style={{
          fontFamily: FONTS.mono, fontSize: '15px', color: NEON_COLORS.amber,
          letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600,
        }}>
          ASK CRICKET
        </div>

        {/* Question */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: '34px', fontWeight: 700,
          color: NEON_COLORS.textPrimary, lineHeight: 1.25, marginBottom: '20px',
          maxWidth: '90%',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {question}
        </div>

        {/* Divider */}
        <div style={{
          height: '2px',
          background: `linear-gradient(90deg, ${NEON_COLORS.cyan}66, transparent)`,
          marginBottom: '20px',
        }} />

        {/* Insight text */}
        {insight && (
          <div style={{
            fontFamily: FONTS.body, fontSize: '18px', color: NEON_COLORS.textSecondary,
            lineHeight: 1.5, marginBottom: '20px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {insight}
          </div>
        )}

        {/* Data rows */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: rows.length <= 4 ? '1fr' : '1fr 1fr',
          gap: '10px', flex: 1, alignContent: 'start',
        }}>
          {rows.map((row, i) => (
            <StatRow
              key={i}
              label={row.label}
              value={row.value}
              color={accentColors[i % accentColors.length]}
            />
          ))}
        </div>
      </div>

      <div style={watermarkStyle()}><img src="/logo.png" alt="" style={watermarkLogoStyle()} />crickrida.rkjat.in</div>
    </div>
  )
}
