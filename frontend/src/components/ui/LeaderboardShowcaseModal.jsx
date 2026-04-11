import { useEffect, useMemo, useState } from 'react'
import PlayerAvatar from './PlayerAvatar'
import { formatDecimal, formatNumber } from '../../utils/format'
import { BarChart, Bar, Cell, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const SPEED_OPTIONS = [
  { value: 0.75, label: '0.75×' },
  { value: 1, label: '1×' },
  { value: 1.5, label: '1.5×' },
  { value: 2, label: '2×' },
]

const GLASS_BAR_COLORS = [
  '#00E5FF',
  '#B8FF00',
  '#FFB800',
  '#FF2D78',
  '#8B5CF6',
  '#22D3EE',
  '#34D399',
  '#60A5FA',
  '#F472B6',
  '#FB923C',
]

const defaultValueFormatter = (value) => {
  if (value == null || value === '') return '—'
  return typeof value === 'number' ? formatNumber(value) : value
}

export default function LeaderboardShowcaseModal({
  open,
  onClose,
  title,
  subtitle,
  items = [],
  metricLabel = 'Value',
  accent = '#B8FF00',
  valueFormatter = defaultValueFormatter,
  detailFields = [
    { key: 'avg', label: 'Average', formatter: (value) => formatDecimal(value) },
    { key: 'sr', label: 'Strike rate', formatter: (value) => formatDecimal(value) },
    { key: 'matches', label: 'Matches', formatter: (value) => formatNumber(value) },
  ],
  nameKey = 'player',
  allowReverse = true,
  defaultOrder = 'desc',
}) {
  const [speed, setSpeed] = useState(1)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [order, setOrder] = useState(defaultOrder)

  useEffect(() => {
    setOrder(defaultOrder)
  }, [defaultOrder, open])

  const normalizedItems = useMemo(() => (
    (Array.isArray(items) ? items : []).map((item, index) => ({
      ...item,
      __displayName: item?.[nameKey] ?? item?.player ?? item?.name ?? `Entry ${index + 1}`,
      __sequenceKey: item?.id ?? item?.[nameKey] ?? item?.player ?? item?.name ?? index,
      __baseColor: item?.color || GLASS_BAR_COLORS[index % GLASS_BAR_COLORS.length],
    }))
  ), [items, nameKey])

  const sequenceItems = useMemo(() => (
    [...normalizedItems].sort((a, b) => {
      const aValue = Number(a?.value ?? 0)
      const bValue = Number(b?.value ?? 0)
      return order === 'asc' ? aValue - bValue : bValue - aValue
    })
  ), [normalizedItems, order])

  const displayItems = useMemo(() => (
    [...normalizedItems].sort((a, b) => {
      const diff = Number(b?.value ?? 0) - Number(a?.value ?? 0)
      if (diff !== 0) return diff
      return String(a?.__displayName ?? '').localeCompare(String(b?.__displayName ?? ''))
    })
  ), [normalizedItems])

  useEffect(() => {
    if (!open) return
    setCurrentIndex(0)
    setIsPlaying(true)
  }, [open, sequenceItems.length, metricLabel, order])

  useEffect(() => {
    if (!open || !isPlaying || sequenceItems.length <= 1) return
    if (currentIndex >= sequenceItems.length - 1) {
      setIsPlaying(false)
      return
    }
    const timer = setTimeout(() => {
      setCurrentIndex((index) => Math.min(index + 1, sequenceItems.length - 1))
    }, Math.max(650, Math.round(1600 / speed)))
    return () => clearTimeout(timer)
  }, [open, isPlaying, currentIndex, sequenceItems.length, speed])

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  const visibleItems = useMemo(() => {
    const revealed = sequenceItems.slice(0, Math.min(currentIndex + 1, sequenceItems.length))
    return [...revealed].sort((a, b) => {
      const diff = Number(b?.value ?? 0) - Number(a?.value ?? 0)
      if (diff !== 0) return diff
      return String(a?.__displayName ?? '').localeCompare(String(b?.__displayName ?? ''))
    })
  }, [sequenceItems, currentIndex])

  const spotlight = sequenceItems[Math.min(currentIndex, Math.max(0, sequenceItems.length - 1))]
  const progressCount = Math.min(currentIndex + 1, sequenceItems.length)
  const isComplete = sequenceItems.length > 0 && progressCount >= sequenceItems.length
  const sequenceLabel = order === 'asc' ? 'Lowest → highest' : 'Highest → lowest'
  const completeHeading = `${title} • final order`

  const formatFieldValue = (item, field) => {
    const value = item?.[field.key]
    if (value == null || value === '') return '—'
    return field.formatter ? field.formatter(value) : defaultValueFormatter(value)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[95] bg-black/90 backdrop-blur-md p-3 md:p-5">
      <div className="h-full rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(184,255,0,0.12),transparent_0%,transparent_32%),radial-gradient(circle_at_bottom_right,rgba(0,229,255,0.12),transparent_0%,transparent_34%),linear-gradient(135deg,#06080D_0%,#0B1020_48%,#110D1A_100%)] shadow-[0_30px_100px_rgba(0,0,0,0.45)] overflow-hidden flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-accent-cyan">Animation mode</p>
            <h2 className="text-xl md:text-2xl font-heading font-bold text-text-primary">{title}</h2>
            <p className="text-xs md:text-sm text-text-secondary mt-1">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {sequenceLabel}
            </span>

            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <span>Speed</span>
              <select
                value={String(speed)}
                onChange={(event) => setSpeed(Number(event.target.value))}
                className="rounded-lg border border-border-subtle bg-bg-card px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-cyan/60"
              >
                {SPEED_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            {allowReverse && (
              <button
                type="button"
                onClick={() => setOrder((current) => (current === 'desc' ? 'asc' : 'desc'))}
                className="rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1.5 text-xs font-semibold text-accent-cyan hover:bg-accent-cyan/20"
              >
                Reverse order
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setCurrentIndex(0)
                setIsPlaying(true)
              }}
              className="rounded-lg border border-accent-magenta/30 bg-accent-magenta/10 px-3 py-1.5 text-xs font-semibold text-accent-magenta hover:bg-accent-magenta/20"
            >
              Replay
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentIndex(Math.max(sequenceItems.length - 1, 0))
                setIsPlaying(false)
              }}
              className="rounded-lg border border-accent-lime/30 bg-accent-lime/10 px-3 py-1.5 text-xs font-semibold text-accent-lime hover:bg-accent-lime/20"
            >
              Finish
            </button>

            <button
              type="button"
              onClick={() => setIsPlaying((playing) => !playing)}
              className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-1.5 text-xs font-semibold text-accent-amber hover:bg-accent-amber/20"
            >
              {isPlaying ? 'Pause' : 'Resume'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-white/10"
            >
              Exit
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 xl:grid-cols-[0.95fr_1.45fr] gap-0 min-h-0">
          <div className="border-b xl:border-b-0 xl:border-r border-white/10 p-4 md:p-6 flex flex-col gap-6 min-h-0 overflow-hidden">
            {!isComplete ? (
              <>
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center gap-2 rounded-full border border-accent-lime/25 bg-accent-lime/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-accent-lime">
                    <span className="h-2 w-2 rounded-full bg-accent-lime animate-pulse" />
                    Now entering
                  </span>

                  {spotlight ? (
                    <div className="mt-5 space-y-4">
                      <div className="flex items-center gap-4">
                        <PlayerAvatar name={spotlight.__displayName} size={96} showBorder />
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-text-muted">
                            Rank #{spotlight.rank ?? progressCount} • Step {progressCount} / {sequenceItems.length}
                          </p>
                          <h3 className="text-3xl md:text-4xl font-heading font-black text-text-primary leading-tight">
                            {spotlight.__displayName}
                          </h3>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-text-muted">{metricLabel}</p>
                        <p className="mt-2 text-4xl md:text-5xl font-heading font-black" style={{ color: accent }}>
                          {valueFormatter(spotlight.value)}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          {detailFields.slice(0, 3).map((field) => (
                            <div key={field.key}>
                              <p className="text-text-muted text-[11px] uppercase tracking-[0.16em]">{field.label}</p>
                              <p className="text-text-primary font-mono font-semibold">{formatFieldValue(spotlight, field)}</p>
                            </div>
                          ))}
                          <div>
                            <p className="text-text-muted text-[11px] uppercase tracking-[0.16em]">Progress</p>
                            <p className="text-text-primary font-mono font-semibold">{progressCount} / {sequenceItems.length}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-text-secondary">No data available for animation mode.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 min-h-[170px] flex-1 min-w-0 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between text-[11px] text-text-muted mb-2">
                    <span>Sequence progress</span>
                    <span>{progressCount} / {sequenceItems.length}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${sequenceItems.length ? (progressCount / sequenceItems.length) * 100 : 0}%`,
                        background: `linear-gradient(90deg, ${accent}, #00E5FF)`,
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="min-h-0 flex-1 overflow-hidden flex flex-col rounded-[24px] border border-accent-cyan/20 bg-white/5 px-4 py-4 md:px-5">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10 flex-shrink-0">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-accent-cyan">
                      <span className="h-2 w-2 rounded-full bg-accent-cyan" />
                      Showcase complete
                    </span>
                    <h3 className="mt-2 truncate text-lg md:text-xl font-heading font-black text-text-primary">{completeHeading}</h3>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Top {metricLabel}</p>
                    <p className="text-lg font-heading font-black" style={{ color: accent }}>
                      {spotlight ? valueFormatter(spotlight.value) : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5 flex-1 content-start overflow-hidden">
                  {displayItems.map((entry, index) => (
                    <div key={`${entry.__sequenceKey}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <PlayerAvatar name={entry.__displayName} size={32} showBorder />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-text-primary">{entry.__displayName}</p>
                          <p className="truncate text-[10px] text-text-muted">
                            {detailFields.slice(0, 2).map((field) => `${field.label}: ${formatFieldValue(entry, field)}`).join(' • ')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[9px] uppercase tracking-[0.14em] text-text-muted">#{entry.rank ?? index + 1}</p>
                        <p className="text-[13px] font-heading font-bold leading-none" style={{ color: accent }}>{valueFormatter(entry.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 md:p-6 min-h-0">
            <div className="h-full rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.12),transparent_0%,transparent_28%),radial-gradient(circle_at_bottom_right,rgba(184,255,0,0.12),transparent_0%,transparent_30%),linear-gradient(180deg,rgba(9,16,30,0.96)_0%,rgba(5,11,24,0.98)_100%)] p-3 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visibleItems} layout="vertical" margin={{ top: 10, right: 75, left: 40, bottom: 10 }}>
                  <defs>
                    {visibleItems.map((entry, idx) => {
                      const gradientId = `showcase-bar-${String(entry.__sequenceKey).replace(/[^a-zA-Z0-9_-]/g, '')}-${idx}`
                      const isSpotlight = entry.__sequenceKey === spotlight?.__sequenceKey
                      return (
                        <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={isSpotlight ? accent : entry.__baseColor} stopOpacity="0.95" />
                          <stop offset="55%" stopColor={isSpotlight ? accent : entry.__baseColor} stopOpacity="0.72" />
                          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={isSpotlight ? '0.18' : '0.08'} />
                        </linearGradient>
                      )
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(80,120,180,0.18)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: '#B6C2D9', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                    axisLine={{ stroke: 'rgba(105,131,173,0.45)' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="__displayName"
                    width={190}
                    tick={{ fill: '#F4F7FB', fontSize: 13, fontWeight: 800 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="rounded-lg px-3 py-2 text-xs shadow-xl border backdrop-blur-md" style={{ background: 'rgba(22,22,31,0.88)', borderColor: '#2A2A3A' }}>
                          <p className="text-text-primary font-semibold">{d?.__displayName}</p>
                          <p style={{ color: d?.__baseColor || accent }}>{metricLabel}: <span className="font-mono font-bold">{valueFormatter(d?.value)}</span></p>
                          <p className="text-text-muted">
                            {detailFields.slice(0, 2).map((field) => `${field.label}: ${formatFieldValue(d, field)}`).join(' • ')}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 12, 12, 0]} barSize={30} isAnimationActive animationDuration={Math.max(450, Math.round(950 / speed))}>
                    <LabelList
                      dataKey="value"
                      position="right"
                      fill="#F8FAFC"
                      fontSize={12}
                      fontWeight={900}
                      formatter={(value) => valueFormatter(value)}
                    />
                    {visibleItems.map((entry, idx) => {
                      const gradientId = `showcase-bar-${String(entry.__sequenceKey).replace(/[^a-zA-Z0-9_-]/g, '')}-${idx}`
                      return (
                        <Cell
                          key={`${entry.__sequenceKey}-${idx}`}
                          fill={`url(#${gradientId})`}
                          stroke={entry.__sequenceKey === spotlight?.__sequenceKey ? accent : entry.__baseColor}
                          strokeOpacity={0.95}
                          strokeWidth={1.2}
                        />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
