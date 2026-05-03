import { formatNumber, formatDecimal } from '../../utils/format'

const SURFACE =
  'rounded-xl border border-white/[0.12] bg-[#12121A]/95 px-3.5 py-2.5 text-xs shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md'

/**
 * Glass-style tooltip container — wrap custom insights or use StandardTooltipBody.
 */
export function GlassTooltipSurface({ eyebrow, title, children, className = '' }) {
  return (
    <div className={`${SURFACE} ${className}`}>
      {eyebrow && (
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{eyebrow}</p>
      )}
      {title && <p className="mb-1.5 font-semibold text-text-primary">{title}</p>}
      {children}
    </div>
  )
}

/**
 * Default multi-series tooltip for Recharts (payload / label).
 */
export function StandardTooltipBody({
  payload,
  label,
  labelPrefix = '',
  valueFormatter = (v) => (typeof v === 'number' ? formatNumber(v) : String(v)),
}) {
  if (!payload?.length) return null
  return (
    <>
      {label != null && label !== '' && (
        <p className="mb-1.5 border-b border-white/10 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
          {labelPrefix}
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-text-secondary">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="text-[11px] font-semibold">{p.name}</span>
            </span>
            <span className="font-mono text-[11px] font-bold text-text-primary">{valueFormatter(p.value)}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * Full Recharts tooltip — drop-in for simple charts.
 */
export function AnalyticsTooltip({ active, payload, label, labelPrefix, valueFormatter }) {
  if (!active || !payload?.length) return null
  return (
    <GlassTooltipSurface>
      <StandardTooltipBody payload={payload} label={label} labelPrefix={labelPrefix} valueFormatter={valueFormatter} />
    </GlassTooltipSurface>
  )
}

/** Decimal-friendly formatter */
export function tooltipDecimal(v, digits = 2) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return formatDecimal(v, digits)
}
