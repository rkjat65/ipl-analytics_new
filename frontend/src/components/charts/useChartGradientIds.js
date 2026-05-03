import { useId } from 'react'

/** Stable unique IDs for SVG defs when multiple charts mount on one page */
export function useChartGradientIds(prefix = 'g') {
  const raw = useId().replace(/:/g, '')
  const base = `${prefix}-${raw}`
  return {
    area: `${base}-area`,
    areaAlt: `${base}-area-alt`,
    bar: `${base}-bar`,
    glow: `${base}-glow`,
  }
}
