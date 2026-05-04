import clsx from 'clsx'

const ACCENT_RING = {
  cyan: 'from-accent-cyan/90 via-accent-cyan/25 to-transparent shadow-[0_0_40px_rgba(0,229,255,0.08)]',
  lime: 'from-accent-lime/90 via-accent-lime/25 to-transparent shadow-[0_0_40px_rgba(184,255,0,0.08)]',
  amber: 'from-accent-amber/90 via-accent-amber/25 to-transparent shadow-[0_0_40px_rgba(255,184,0,0.08)]',
  magenta: 'from-accent-magenta/90 via-accent-magenta/25 to-transparent shadow-[0_0_40px_rgba(255,45,120,0.08)]',
}

const INSIGHT_BORDER = {
  cyan: 'border-accent-cyan/45',
  lime: 'border-accent-lime/45',
  amber: 'border-accent-amber/45',
  magenta: 'border-accent-magenta/45',
}

/**
 * Wraps chart blocks with a consistent premium panel + optional narrative insight.
 */
export default function AnalyticsChartShell({
  title,
  subtitle,
  insight,
  accent = 'cyan',
  badge,
  actions,
  children,
  className = '',
  chartClassName = 'min-h-[260px]',
}) {
  const ring = ACCENT_RING[accent] || ACCENT_RING.cyan
  const insightBorder = INSIGHT_BORDER[accent] || INSIGHT_BORDER.cyan

  return (
    <div
      className={clsx(
        'chart-surface group relative overflow-hidden rounded-[28px] border border-white/[0.08]',
        'bg-[linear-gradient(145deg,rgba(18,20,28,0.98),rgba(8,9,14,0.98))] p-6 sm:p-8',
        'shadow-[0_24px_56px_rgba(0,0,0,0.35)] transition-all duration-300 hover:border-white/[0.12]',
        className
      )}
    >
      <div className={clsx('pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-90', ring)} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.035),transparent_28%,rgba(0,229,255,0.025)_55%,transparent_78%)] opacity-80" />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl space-y-1">
          {badge && (
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.28em] text-text-muted">
              {badge}
            </span>
          )}
          <h3 className="text-xl font-black font-heading tracking-tight text-text-primary sm:text-2xl">{title}</h3>
          {subtitle && <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{subtitle}</p>}
          {insight && (
            <p className={`mt-2 border-l-2 pl-3 text-sm leading-relaxed text-text-secondary ${insightBorder}`}>{insight}</p>
          )}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>

      <div className={clsx('relative z-10 mt-6', chartClassName)}>{children}</div>
    </div>
  )
}
