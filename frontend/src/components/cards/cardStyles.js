// Shared styles and constants for card templates

export const CARD_DIMENSIONS = {
  twitter: { width: 1200, height: 675 },
  instagram: { width: 1080, height: 1080 },
  linkedin: { width: 1200, height: 628 },
  portrait: { width: 1080, height: 1920 },
}

export const NEON_COLORS = {
  cyan: '#00E5FF',
  magenta: '#FF2D78',
  lime: '#B8FF00',
  amber: '#FFB800',
  bg: '#0A0A0F',
  bgCard: '#12121A',
  bgElevated: '#1A1A25',
  textPrimary: '#F0F0F5',
  textSecondary: '#A0A0B8',
  textMuted: '#60607A',
  border: '#2A2A3A',
}

export const FONTS = {
  heading: "'Space Grotesk', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Consolas', monospace",
  body: "'Inter', 'Segoe UI', sans-serif",
}

export function cardContainerStyle(dimensions = CARD_DIMENSIONS.twitter) {
  return {
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
    background: NEON_COLORS.bg,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: FONTS.body,
    color: NEON_COLORS.textPrimary,
  }
}

export function dotGridBackground() {
  return {
    position: 'absolute',
    inset: 0,
    backgroundImage: `radial-gradient(${NEON_COLORS.textMuted}22 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
    pointerEvents: 'none',
    zIndex: 0,
  }
}

export function watermarkStyle() {
  return {
    position: 'absolute',
    bottom: '20px',
    right: '32px',
    fontFamily: FONTS.mono,
    fontSize: '18px',
    color: NEON_COLORS.textMuted,
    letterSpacing: '0.05em',
    zIndex: 10,
  }
}

export function formatNumber(n) {
  if (n == null) return '-'
  return Number(n).toLocaleString('en-IN')
}

export function formatDecimal(n, digits = 2) {
  if (n == null) return '-'
  return Number(n).toFixed(digits)
}
