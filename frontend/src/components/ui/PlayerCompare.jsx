import { useState, useMemo } from 'react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip
} from 'recharts'
import PlayerAvatar from './PlayerAvatar'
import { formatDecimal, formatNumber } from '../../utils/format'
import { GlassTooltipSurface, CHART_ANIMATION } from '../charts'

export default function PlayerCompare({ players = [], onRemove, mode = 'batting' }) {
  if (!players || players.length === 0) return null

  const isBatting = mode === 'batting'

  // Normalize stats for radar chart (0-100 scale)
  const normalizedData = isBatting ? [
    { subject: 'Runs', fullMark: 100 },
    { subject: 'Avg', fullMark: 100 },
    { subject: 'SR', fullMark: 100 },
    { subject: '6s', fullMark: 100 },
    { subject: '4s', fullMark: 100 },
  ].map(attr => {
    const entry = { subject: attr.subject }
    players.forEach((p, i) => {
      let val = 0
      if (attr.subject === 'Runs') val = (p.runs / 600) * 100
      if (attr.subject === 'Avg') val = (p.avg / 45) * 100
      if (attr.subject === 'SR') val = (p.sr / 160) * 100
      if (attr.subject === '6s') val = (p.sixes / 35) * 100
      if (attr.subject === '4s') val = (p.fours / 70) * 100
      entry[`p${i}`] = Math.min(val, 110)
    })
    return entry
  }) : [
    { subject: 'Wkts', fullMark: 100 },
    { subject: 'Avg', fullMark: 100 },
    { subject: 'Econ', fullMark: 100 },
    { subject: 'SR', fullMark: 100 },
    { subject: 'Dots', fullMark: 100 },
  ].map(attr => {
    const entry = { subject: attr.subject }
    players.forEach((p, i) => {
      let val = 0
      if (attr.subject === 'Wkts') val = (p.wickets / 25) * 100
      if (attr.subject === 'Avg') val = p.avg > 0 ? (20 / p.avg) * 100 : 0
      if (attr.subject === 'Econ') val = p.economy > 0 ? (7.5 / p.economy) * 100 : 0
      if (attr.subject === 'SR') val = p.sr > 0 ? (18 / p.sr) * 100 : 0
      if (attr.subject === 'Dots') val = (p.dot_pct / 45) * 100
      entry[`p${i}`] = Math.min(val, 110)
    })
    return entry
  })

  const COLORS = isBatting ? ['#00E5FF', '#FF2D78', '#B8FF00'] : ['#FF2D78', '#00E5FF', '#B8FF00']

  return (
    <div className="card !p-6 animate-in mb-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-heading font-black text-text-primary uppercase tracking-tight">
              {isBatting ? 'Batting' : 'Bowling'} Clash
            </h3>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-text-muted uppercase tracking-widest">Head to Head</span>
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-x-8 gap-y-4 items-center">
            <div className="h-6" />
            {players.map((p, i) => (
              <div key={p.player} className="flex flex-col items-center gap-2 px-4 relative">
                <PlayerAvatar name={p.player} size={48} ringColor={COLORS[i % COLORS.length]} />
                <button 
                  onClick={() => onRemove(p.player)}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger/20 border border-danger/40 text-danger flex items-center justify-center text-[10px] hover:bg-danger hover:text-white transition-colors"
                >
                  ✕
                </button>
                <div className="text-center">
                   <p className="text-xs font-black text-text-primary truncate w-24">{p.player.split(' ').pop()}</p>
                   <p className="text-[10px] text-text-muted font-mono">{p.matches} Mat</p>
                </div>
              </div>
            ))}

            {isBatting ? (
              <>
                <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Total Runs</div>
                {players.map((p, i) => (
                  <div key={p.player} className="text-center font-mono font-black text-lg" style={{ color: COLORS[i % COLORS.length] }}>{formatNumber(p.runs)}</div>
                ))}
                <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Average</div>
                {players.map((p) => (
                  <div key={p.player} className="text-center font-mono font-bold text-sm text-text-primary">{formatDecimal(p.avg)}</div>
                ))}
                <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Strike Rate</div>
                {players.map((p) => (
                  <div key={p.player} className="text-center font-mono font-bold text-sm text-text-primary">{formatDecimal(p.sr)}</div>
                ))}
              </>
            ) : (
              <>
                <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Wickets</div>
                {players.map((p, i) => (
                  <div key={p.player} className="text-center font-mono font-black text-lg" style={{ color: COLORS[i % COLORS.length] }}>{p.wickets}</div>
                ))}
                <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Economy</div>
                {players.map((p) => (
                  <div key={p.player} className="text-center font-mono font-bold text-sm text-text-primary">{formatDecimal(p.economy)}</div>
                ))}
                <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Average</div>
                {players.map((p) => (
                  <div key={p.player} className="text-center font-mono font-bold text-sm text-text-primary">{formatDecimal(p.avg)}</div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="w-full lg:w-80 h-80 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={normalizedData}>
              <PolarGrid stroke="#2A2A3A" strokeDasharray="4 6" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#8888A0', fontSize: 10, fontWeight: 700 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              {players.map((p, i) => (
                <Radar
                  key={p.player}
                  name={p.player}
                  dataKey={`p${i}`}
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.15}
                  strokeWidth={2.5}
                  {...CHART_ANIMATION}
                />
              ))}
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <GlassTooltipSurface eyebrow={label}>
                      {payload.map((item, idx) => (
                        <div key={idx} className="flex justify-between gap-6 text-[11px]">
                          <span className="font-semibold text-text-secondary">{item.name}</span>
                          <span className="font-mono font-bold text-text-primary">{formatDecimal(item.value, 1)}</span>
                        </div>
                      ))}
                    </GlassTooltipSurface>
                  )
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
