import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  LabelList,
} from 'recharts'
import {
  AnalyticsChartShell,
  GlassTooltipSurface,
  cartesianGridProps,
  CHART_ANIMATION,
  axisTickPrimary,
} from '../charts'

function isNumericColumn(rows, key) {
  if (!rows?.length || !key) return false
  let n = 0
  for (const row of rows.slice(0, 50)) {
    const v = row[key]
    if (v === null || v === undefined || v === '') continue
    const num = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
    if (!Number.isFinite(num)) return false
    n++
  }
  return n > 0
}

function parseCellNumber(row, key) {
  if (!key) return null
  const raw = row[key]
  if (raw === null || raw === undefined || raw === '') return null
  const num = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''))
  return Number.isFinite(num) ? num : null
}

/** Purple (low) → yellow (high), similar to sports heat maps */
function heatmapColor(t) {
  const u = Math.max(0, Math.min(1, t))
  // #6b21a8 → #facc15
  const r = Math.round(107 + (250 - 107) * u)
  const g = Math.round(33 + (204 - 33) * u)
  const b = Math.round(168 + (21 - 168) * u)
  return `rgb(${r},${g},${b})`
}

/** Notebook-style viz + pandas-like export from admin SQL rows */
function firstNumericKey(columns, rows) {
  for (const c of columns || []) {
    if (isNumericColumn(rows, c)) return c
  }
  return ''
}

/** Prefer a categorical column for X when both label and value columns exist */
function firstCategoryKey(columns, rows) {
  const cols = columns || []
  const numeric = new Set(cols.filter((c) => isNumericColumn(rows, c)))
  const cat = cols.find((c) => !numeric.has(c))
  return cat || cols[0] || ''
}

function defaultComboKeys(columns, rows, xKey) {
  const nums = (columns || []).filter((c) => c !== xKey && isNumericColumn(rows, c))
  return { barKey: nums[0] || '', lineKey: nums[1] || '' }
}

export default function AdminSqlNotebook({ sqlColumns = [], sqlResult = [] }) {
  const numericKeys = useMemo(() => {
    return (sqlColumns || []).filter((c) => isNumericColumn(sqlResult, c))
  }, [sqlColumns, sqlResult])

  const [chartPreset, setChartPreset] = useState('combo')
  const [chartType, setChartType] = useState('bar')
  const [xKey, setXKey] = useState(() => firstCategoryKey(sqlColumns, sqlResult))
  const [yKey, setYKey] = useState(() => firstNumericKey(sqlColumns, sqlResult))

  const [barKey, setBarKey] = useState(() =>
    defaultComboKeys(sqlColumns, sqlResult, firstCategoryKey(sqlColumns, sqlResult)).barKey
  )
  const [lineKey, setLineKey] = useState(() =>
    defaultComboKeys(sqlColumns, sqlResult, firstCategoryKey(sqlColumns, sqlResult)).lineKey
  )
  const [colorKey, setColorKey] = useState('')
  const [tagKey, setTagKey] = useState('')

  const chartRows = useMemo(() => {
    if (!xKey || !yKey || !sqlResult.length) return []
    return sqlResult
      .map((row, i) => {
        const raw = row[yKey]
        const num =
          typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/,/g, ''))
        if (!Number.isFinite(num)) return null
        const xv = row[xKey]
        return {
          __i: i,
          name: xv === null || xv === undefined ? `Row ${i + 1}` : String(xv),
          value: num,
        }
      })
      .filter(Boolean)
      .slice(0, 200)
  }, [sqlResult, xKey, yKey])

  const comboRows = useMemo(() => {
    if (!xKey || !barKey || !lineKey || !sqlResult.length) return []
    const heatVals = []
    if (colorKey && isNumericColumn(sqlResult, colorKey)) {
      for (const row of sqlResult.slice(0, 200)) {
        const h = parseCellNumber(row, colorKey)
        if (h !== null) heatVals.push(h)
      }
    }
    const hMin = heatVals.length ? Math.min(...heatVals) : 0
    const hMax = heatVals.length ? Math.max(...heatVals) : 1
    const hSpan = hMax - hMin || 1

    return sqlResult
      .map((row, i) => {
        const bar = parseCellNumber(row, barKey)
        const line = parseCellNumber(row, lineKey)
        if (bar === null || line === null) return null
        const xv = row[xKey]
        const heat = colorKey ? parseCellNumber(row, colorKey) : null
        const t = heat !== null ? (heat - hMin) / hSpan : 0.5
        const barFill = colorKey && heat !== null ? heatmapColor(t) : '#00E5FF'
        let tagLabel = ''
        if (tagKey && row[tagKey] !== undefined && row[tagKey] !== null) {
          tagLabel = String(row[tagKey])
        }
        return {
          __i: i,
          name: xv === null || xv === undefined ? `Row ${i + 1}` : String(xv),
          bar,
          line,
          heat,
          barFill,
          tagLabel,
        }
      })
      .filter(Boolean)
      .slice(0, 200)
  }, [sqlResult, xKey, barKey, lineKey, colorKey, tagKey])

  const pandasSnippet = useMemo(() => {
    const json = JSON.stringify(sqlResult, null, 2)
    return `import pandas as pd
import matplotlib.pyplot as plt

# Result set as records (same rows as admin console)
rows = ${json}

df = pd.DataFrame(rows)
print(df.head())
print(df.dtypes)

# Example: combo-style chart (bars + line on secondary axis) like a sports timeline
# ax = df.plot(x='season', y='runs', kind='bar', color=plt.cm.plasma(
#     (df['strike_rate'] - df['strike_rate'].min()) / (df['strike_rate'].max() - df['strike_rate'].min() + 1e-9)))
# df.plot(x='season', y='average', secondary_y=True, ax=ax, color='#B8FF00', marker='o')
# plt.show()
`
  }, [sqlResult])

  const [copied, setCopied] = useState(null)
  const copyText = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied('error')
    }
  }

  if (!sqlColumns.length || !sqlResult.length) return null

  const comboReady =
    comboRows.length > 0 && barKey && lineKey && numericKeys.filter((k) => k !== xKey).length >= 2

  return (
    <div className="space-y-5 pt-2 border-t border-border-subtle mt-4">
      <div>
        <h3 className="font-heading font-bold text-text-primary text-sm">Notebook — dataframe & charts</h3>
        <p className="text-[10px] text-text-muted font-mono mt-1">
          SQL output maps directly to <code className="text-accent-cyan">pd.DataFrame(rows)</code>.
          Use <strong className="text-text-secondary">Combo</strong> for bar + line dual-axis charts (e.g. runs vs average)
          with optional <strong className="text-text-secondary">heat</strong> coloring on bars (e.g. strike rate).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase text-text-muted">Chart preset</span>
          <select
            value={chartPreset}
            onChange={(e) => setChartPreset(e.target.value)}
            className="w-full rounded-lg bg-[#0A0A0F] border border-border-subtle px-3 py-2 text-xs text-text-primary font-mono"
          >
            <option value="combo">Combo (bars + line, dual Y)</option>
            <option value="single">Single series</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase text-text-muted">Category (X)</span>
          <select
            value={xKey}
            onChange={(e) => setXKey(e.target.value)}
            className="w-full rounded-lg bg-[#0A0A0F] border border-border-subtle px-3 py-2 text-xs text-text-primary font-mono"
          >
            {sqlColumns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        {chartPreset === 'single' ? (
          <>
            <label className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted">Value (Y)</span>
              <select
                value={yKey}
                onChange={(e) => setYKey(e.target.value)}
                className="w-full rounded-lg bg-[#0A0A0F] border border-border-subtle px-3 py-2 text-xs text-text-primary font-mono"
              >
                {numericKeys.length === 0 ? (
                  <option value="">No numeric columns detected</option>
                ) : (
                  numericKeys.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))
                )}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted">Series type</span>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className="w-full rounded-lg bg-[#0A0A0F] border border-border-subtle px-3 py-2 text-xs text-text-primary font-mono"
              >
                <option value="bar">Bar</option>
                <option value="line">Line</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted">Bars (left axis)</span>
              <select
                value={barKey}
                onChange={(e) => setBarKey(e.target.value)}
                className="w-full rounded-lg bg-[#0A0A0F] border border-border-subtle px-3 py-2 text-xs text-text-primary font-mono"
              >
                {numericKeys.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted">Line (right axis)</span>
              <select
                value={lineKey}
                onChange={(e) => setLineKey(e.target.value)}
                className="w-full rounded-lg bg-[#0A0A0F] border border-border-subtle px-3 py-2 text-xs text-text-primary font-mono"
              >
                {numericKeys.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      {chartPreset === 'combo' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-text-muted">Bar color heat (optional)</span>
            <select
              value={colorKey}
              onChange={(e) => setColorKey(e.target.value)}
              className="w-full rounded-lg bg-[#0A0A0F] border border-border-subtle px-3 py-2 text-xs text-text-primary font-mono"
            >
              <option value="">Solid cyan bars</option>
              {numericKeys.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-text-muted">Tag above bar (optional)</span>
            <select
              value={tagKey}
              onChange={(e) => setTagKey(e.target.value)}
              className="w-full rounded-lg bg-[#0A0A0F] border border-border-subtle px-3 py-2 text-xs text-text-primary font-mono"
            >
              <option value="">None</option>
              {sqlColumns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2 lg:col-span-2">
            <button
              type="button"
              onClick={() => copyText('pandas', pandasSnippet)}
              className="rounded-lg border border-accent-lime/30 bg-accent-lime/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-accent-lime hover:bg-accent-lime/20"
            >
              {copied === 'pandas' ? 'Copied' : 'Copy pandas'}
            </button>
            <button
              type="button"
              onClick={() => copyText('json', JSON.stringify(sqlResult, null, 2))}
              className="rounded-lg border border-border-subtle px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary hover:bg-bg-elevated"
            >
              {copied === 'json' ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
        </div>
      )}

      {chartPreset === 'single' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copyText('pandas', pandasSnippet)}
            className="rounded-lg border border-accent-lime/30 bg-accent-lime/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-accent-lime hover:bg-accent-lime/20"
          >
            {copied === 'pandas' ? 'Copied' : 'Copy pandas'}
          </button>
          <button
            type="button"
            onClick={() => copyText('json', JSON.stringify(sqlResult, null, 2))}
            className="rounded-lg border border-border-subtle px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary hover:bg-bg-elevated"
          >
            {copied === 'json' ? 'Copied' : 'Copy JSON'}
          </button>
        </div>
      )}

      {numericKeys.length === 0 && (
        <p className="text-xs text-accent-amber font-mono">No numeric column found — chart needs numeric columns.</p>
      )}

      {chartPreset === 'combo' && numericKeys.filter((k) => k !== xKey).length < 2 && (
        <p className="text-xs text-accent-amber font-mono">
          Combo mode needs at least two numeric columns (besides X if X is numeric). Add expressions in SQL or switch to single series.
        </p>
      )}

      {chartPreset === 'combo' && comboReady && (
        <AnalyticsChartShell
          title="SQL combo chart"
          subtitle={`${barKey} (bars) · ${lineKey} (line)${colorKey ? ` · heat: ${colorKey}` : ''}`}
          accent="cyan"
          badge="Combo"
          chartClassName="h-80 min-h-[280px]"
        >
          {colorKey && (
            <div className="flex items-center gap-3 px-1 pb-2 text-[9px] font-mono text-text-muted">
              <span>Low {colorKey}</span>
              <div className="h-2 flex-1 max-w-xs rounded-full bg-gradient-to-r from-[#6b21a8] to-[#facc15]" />
              <span>High {colorKey}</span>
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={comboRows} margin={{ top: 16, right: 20, left: 4, bottom: 44 }}>
              <CartesianGrid {...cartesianGridProps} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#8888A0', fontSize: 9 }}
                angle={-35}
                textAnchor="end"
                height={72}
                interval={0}
              />
              <YAxis
                yAxisId="left"
                tick={axisTickPrimary}
                width={52}
                label={{ value: barKey, fill: '#8888A0', fontSize: 10, angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#B8FF00', fontSize: 10 }}
                width={52}
                label={{ value: lineKey, fill: '#B8FF00', fontSize: 10, angle: 90, position: 'insideRight' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0]?.payload
                  if (!p) return null
                  return (
                    <GlassTooltipSurface eyebrow={String(p.name)}>
                      <div className="space-y-1 font-mono text-xs">
                        <div className="text-text-primary">{barKey}: <span className="font-bold">{p.bar}</span></div>
                        <div className="text-[#B8FF00]">{lineKey}: <span className="font-bold">{p.line}</span></div>
                        {colorKey && p.heat !== null && p.heat !== undefined && (
                          <div className="text-text-muted">{colorKey}: {p.heat}</div>
                        )}
                      </div>
                    </GlassTooltipSurface>
                  )
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="bar" name={barKey} radius={[6, 6, 0, 0]} {...CHART_ANIMATION}>
                {comboRows.map((entry, index) => (
                  <Cell key={`cell-${entry.__i}-${index}`} fill={entry.barFill} />
                ))}
                <LabelList dataKey="bar" position="insideTop" fill="rgba(255,255,255,0.92)" fontSize={10} fontWeight={700} />
                {tagKey ? (
                  <LabelList
                    dataKey="tagLabel"
                    position="top"
                    fill="#8b9cff"
                    fontSize={9}
                    formatter={(v) => (v ? String(v) : '')}
                  />
                ) : null}
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="line"
                name={lineKey}
                stroke="#B8FF00"
                strokeWidth={2}
                dot={{ r: 3, fill: '#B8FF00' }}
                {...CHART_ANIMATION}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </AnalyticsChartShell>
      )}

      {chartPreset === 'single' && chartRows.length > 0 && yKey && (
        <AnalyticsChartShell
          title="SQL chart preview"
          subtitle={`${yKey} by ${xKey}`}
          accent="cyan"
          badge="Recharts"
          chartClassName="h-72 min-h-[260px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={chartRows} margin={{ top: 8, right: 16, left: 4, bottom: 40 }}>
                <CartesianGrid {...cartesianGridProps} />
                <XAxis dataKey="name" tick={{ fill: '#8888A0', fontSize: 9 }} angle={-35} textAnchor="end" height={70} interval={0} />
                <YAxis tick={axisTickPrimary} width={48} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0]
                    return (
                      <GlassTooltipSurface eyebrow={String(p.payload?.name)}>
                        <span className="font-mono font-bold text-text-primary">{yKey}: {p.value}</span>
                      </GlassTooltipSurface>
                    )
                  }}
                />
                <Bar dataKey="value" fill="#00E5FF" radius={[6, 6, 0, 0]} name={yKey} {...CHART_ANIMATION} />
              </BarChart>
            ) : (
              <LineChart data={chartRows} margin={{ top: 8, right: 16, left: 4, bottom: 40 }}>
                <CartesianGrid {...cartesianGridProps} />
                <XAxis dataKey="name" tick={{ fill: '#8888A0', fontSize: 9 }} angle={-35} textAnchor="end" height={70} interval={0} />
                <YAxis tick={axisTickPrimary} width={48} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0]
                    return (
                      <GlassTooltipSurface eyebrow={String(p.payload?.name)}>
                        <span className="font-mono font-bold text-text-primary">{yKey}: {p.value}</span>
                      </GlassTooltipSurface>
                    )
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="value" name={yKey} stroke="#00E5FF" strokeWidth={2} dot={{ r: 3 }} {...CHART_ANIMATION} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </AnalyticsChartShell>
      )}

      <details className="rounded-xl border border-border-subtle bg-[#09090F] overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-xs font-mono text-text-muted hover:text-text-primary">
          Python / Jupyter snippet (pandas DataFrame + matplotlib hint)
        </summary>
        <pre className="px-4 pb-4 text-[11px] font-mono text-accent-lime/90 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto border-t border-border-subtle pt-3">
          {pandasSnippet}
        </pre>
      </details>
    </div>
  )
}
