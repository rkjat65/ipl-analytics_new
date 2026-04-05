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

// Detect the best label column for a dataset (prefers player/name cols)
function pickLabelCol(cols) {
  const preferred = ['player_of_match', 'player', 'name', 'batter', 'bowler', 'team']
  for (const p of preferred) {
    const match = cols.find(c => c.toLowerCase().includes(p))
    if (match) return match
  }
  return cols[0]
}

// Detect the best value column (prefers numeric stat cols over name/date cols)
function pickValueCol(cols, labelCol) {
  const skip = new Set([labelCol, 'date', 'match_id', 'season', 'city', 'venue', 'event_name',
    'team1', 'team2', 'winner', 'toss_winner', 'toss_decision', 'result',
    'player_of_match', 'non_striker', 'fielder1'])
  const numeric = cols.filter(c => !skip.has(c))
  if (numeric.length > 0) return numeric[numeric.length - 1]
  // fallback: any col that's not the label
  return cols.find(c => c !== labelCol) || cols[0]
}

// Get a secondary info string for a row (e.g. winner or date)
function getSecondaryInfo(row, labelCol, valueCol) {
  const secondary = []
  if (row.winner && row.winner !== row[labelCol]) secondary.push(row.winner)
  else if (row.date) secondary.push(String(row.date).slice(0, 10))
  if (row.date && row.winner) secondary.push(String(row.date).slice(0, 10))
  return secondary.slice(0, 2).join(' · ')
}

// Timeline/list row for MOTM-style data
function TimelineRow({ index, label, secondary, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 14px',
      background: `${color}11`,
      border: `1px solid ${color}33`,
      borderRadius: '8px',
    }}>
      <span style={{
        fontFamily: FONTS.mono, fontSize: '13px', fontWeight: 700,
        color: `${color}99`, minWidth: '22px', textAlign: 'right',
      }}>
        {index}
      </span>
      <span style={{
        fontFamily: FONTS.mono, fontSize: '15px', fontWeight: 700,
        color: color, flex: 1, letterSpacing: '0.04em',
      }}>
        {label}
      </span>
      {secondary && (
        <span style={{
          fontFamily: FONTS.mono, fontSize: '11px', color: NEON_COLORS.textMuted,
          letterSpacing: '0.04em',
        }}>
          {secondary}
        </span>
      )}
    </div>
  )
}

export default function QueryResultCard({
  question = 'Query Result',
  data = [],
  insight = '',
  dimensions = CARD_DIMENSIONS.twitter,
}) {
  const cols = Object.keys(data[0] || {})
  const labelCol = pickLabelCol(cols)
  const valueCol = pickValueCol(cols, labelCol)

  // Determine if this is a timeline/list-style result (player names as primary info)
  const isTimeline = cols.includes('player_of_match') || cols.includes('date')
  const isStatList = !isTimeline && data.length > 1

  const MAX_ROWS = 10
  const displayData = data.slice(0, MAX_ROWS)

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
        padding: '36px 48px 40px 48px', zIndex: 2, position: 'relative',
      }}>
        {/* Badge */}
        <div style={{
          fontFamily: FONTS.mono, fontSize: '13px', color: NEON_COLORS.amber,
          letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 600,
        }}>
          ASK CRICKET • IPL ANALYTICS
        </div>

        {/* Question */}
        <div style={{
          fontFamily: FONTS.heading, fontSize: '30px', fontWeight: 700,
          color: NEON_COLORS.textPrimary, lineHeight: 1.25, marginBottom: '16px',
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
          marginBottom: '14px',
        }} />

        {/* Insight text */}
        {insight && (
          <div style={{
            fontFamily: FONTS.body, fontSize: '16px', color: NEON_COLORS.textSecondary,
            lineHeight: 1.5, marginBottom: '16px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {insight}
          </div>
        )}

        {/* Data — single row */}
        {data.length === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', flex: 1, alignContent: 'start' }}>
            {Object.entries(data[0]).map(([key, val], i) => (
              <StatRow key={i} label={key.replace(/_/g, ' ')} value={val} color={accentColors[i % accentColors.length]} />
            ))}
          </div>
        )}

        {/* Data — timeline/MOTM list */}
        {data.length > 1 && isTimeline && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: displayData.length > 5 ? '1fr 1fr' : '1fr',
            gap: '7px', flex: 1, alignContent: 'start',
          }}>
            {displayData.map((row, i) => {
              const label = String(row[labelCol] ?? row['player_of_match'] ?? '—')
              const secondary = getSecondaryInfo(row, labelCol, valueCol)
              const color = accentColors[i % accentColors.length]
              return (
                <TimelineRow key={i} index={i + 1} label={label} secondary={secondary} color={color} />
              )
            })}
          </div>
        )}

        {/* Data — stat list (label + numeric value) */}
        {data.length > 1 && isStatList && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: displayData.length <= 4 ? '1fr' : '1fr 1fr',
            gap: '9px', flex: 1, alignContent: 'start',
          }}>
            {displayData.map((row, i) => (
              <StatRow
                key={i}
                label={String(row[labelCol] ?? '')}
                value={row[valueCol]}
                color={accentColors[i % accentColors.length]}
              />
            ))}
          </div>
        )}
      </div>

      <div style={watermarkStyle()}><img src="/logo.png" alt="" style={watermarkLogoStyle()} />crickrida.rkjat.in</div>
    </div>
  )
}
