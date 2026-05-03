/**
 * Shared Recharts styling — keeps visuals consistent across the app.
 */

export const CHART_PALETTE = [
  '#00E5FF',
  '#B8FF00',
  '#FFB800',
  '#FF2D78',
  '#8B5CF6',
  '#22D3EE',
  '#34D399',
  '#F472B6',
  '#A78BFA',
  '#EF4444',
]

/** Smooth entrance — noticeable but not sluggish */
export const CHART_ANIMATION = {
  isAnimationActive: true,
  animationBegin: 80,
  animationDuration: 900,
  animationEasing: 'ease-out',
}

export const chartMargins = {
  compact: { top: 8, right: 12, left: 0, bottom: 4 },
  default: { top: 12, right: 16, left: 4, bottom: 8 },
  withLegend: { top: 12, right: 20, left: 8, bottom: 12 },
}

/** X/Y axis tick styling */
export const axisTickPrimary = {
  fill: '#8888A0',
  fontSize: 11,
  fontWeight: 500,
}

export const axisTickBold = {
  fill: '#C8C8D8',
  fontSize: 11,
  fontWeight: 700,
}

export const axisLineSubtle = { stroke: '#2A2A3A' }

/** Cartesian grid — horizontal emphasis reads better on dark UI */
export const cartesianGridProps = {
  strokeDasharray: '3 6',
  stroke: '#1E1E2A',
  vertical: false,
}

export const cartesianGridFull = {
  strokeDasharray: '3 6',
  stroke: '#1E1E2A',
  strokeOpacity: 0.85,
}

/** Cursor fills for dim hover bands */
export const cursorBand = (rgb) => ({ fill: rgb })
