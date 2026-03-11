"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { SeasonBatting } from "@/lib/api";

interface Props {
  data: SeasonBatting[];
  playerName: string;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-raised px-3 py-2.5 text-xs space-y-1 shadow-lg" style={{ minWidth: 150 }}>
      <p className="font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>
        {label}
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="stat-num font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {typeof p.value === "number"
              ? p.name === "Average" || p.name === "Strike Rate"
                ? p.value.toFixed(1)
                : p.value
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PlayerSeasonChart({ data, playerName }: Props) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
        {playerName} — Season-by-Season Runs &amp; Strike Rate
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 24, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="season"
            tick={{ fill: "var(--color-text-muted)", fontSize: 9 }}
            angle={-40}
            textAnchor="end"
            height={40}
          />
          <YAxis
            yAxisId="runs"
            orientation="left"
            tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
            label={{ value: "Runs", angle: -90, position: "insideLeft", fill: "var(--color-text-muted)", fontSize: 10, dx: 12 }}
          />
          <YAxis
            yAxisId="sr"
            orientation="right"
            domain={[80, 200]}
            tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
            label={{ value: "SR", angle: 90, position: "insideRight", fill: "var(--color-text-muted)", fontSize: 10, dx: -6 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(v) => <span style={{ color: "var(--color-text-secondary)" }}>{v}</span>}
          />

          <Bar
            yAxisId="runs"
            dataKey="runs"
            name="Runs"
            fill="var(--chart-1)"
            fillOpacity={0.75}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
          <Line
            yAxisId="sr"
            type="monotone"
            dataKey="strike_rate"
            name="Strike Rate"
            stroke="var(--chart-2)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--chart-2)", stroke: "var(--color-bg-base)", strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="runs"
            type="monotone"
            dataKey="average"
            name="Average"
            stroke="var(--chart-4)"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
