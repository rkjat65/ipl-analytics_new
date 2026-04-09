export default function StatCard({
  label,
  value,
  delta,
  color = 'cyan',
  hint = '',
  className = '',
}) {
  const palette = {
    cyan: {
      text: 'text-accent-cyan stat-glow-cyan',
      chip: 'border-accent-cyan/25 bg-accent-cyan/10 text-accent-cyan',
      line: 'from-accent-cyan/80 via-accent-cyan/20 to-transparent',
    },
    magenta: {
      text: 'text-accent-magenta stat-glow-magenta',
      chip: 'border-accent-magenta/25 bg-accent-magenta/10 text-accent-magenta',
      line: 'from-accent-magenta/80 via-accent-magenta/20 to-transparent',
    },
    lime: {
      text: 'text-accent-lime stat-glow-lime',
      chip: 'border-accent-lime/25 bg-accent-lime/10 text-accent-lime',
      line: 'from-accent-lime/80 via-accent-lime/20 to-transparent',
    },
    amber: {
      text: 'text-accent-amber stat-glow-amber',
      chip: 'border-accent-amber/25 bg-accent-amber/10 text-accent-amber',
      line: 'from-accent-amber/80 via-accent-amber/20 to-transparent',
    },
  }

  const theme = palette[color] || palette.cyan

  return (
    <div className={`group relative overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(17,20,31,0.96),rgba(10,12,18,0.96))] px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15 animate-in ${className}`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${theme.line}`} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.07),transparent_42%)] opacity-80" />

      <div className="relative z-10">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${theme.chip}`}>
          {label}
        </span>

        <p className={`mt-3 text-3xl font-heading font-bold ${theme.text} leading-tight break-words`}>
          {value}
        </p>

        {delta !== undefined && (
          <p className={`text-xs mt-1.5 ${delta >= 0 ? 'text-success' : 'text-danger'}`}>
            {delta >= 0 ? '\u2191' : '\u2193'} {Math.abs(delta)}
          </p>
        )}

        {hint ? (
          <p className="mt-2 text-xs text-text-muted leading-relaxed">{hint}</p>
        ) : (
          <div className="mt-3 h-px w-full bg-white/5" />
        )}
      </div>
    </div>
  )
}
