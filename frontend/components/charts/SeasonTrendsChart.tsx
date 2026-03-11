"use client";

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { SeasonTrend } from "@/lib/api";

interface Props {
  data: SeasonTrend[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-raised px-3 py-2.5 text-xs space-y-1.5 shadow-lg" style={{ minWidth: 170 }}>
      <p className="font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>
        Season {label}
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="stat-num font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {typeof p.value === "number" ? p.value.toFixed(p.name?.includes("Rate") ? 2 : 1) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SeasonTrendsChart({ data }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Season Trends — Run Rate &amp; Avg Score Evolution
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="season"
            tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
            angle={-35}
            textAnchor="end"
            height={42}
          />
          {/* Left axis: avg first innings score */}
          <YAxis
            yAxisId="score"
            orientation="left"
            domain={[120, "auto"]}
            tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
            label={{ value: "Avg Score", angle: -90, position: "insideLeft", fill: "var(--color-text-muted)", fontSize: 10, dx: 10 }}
          />
          {/* Right axis: run rate */}
          <YAxis
            yAxisId="rr"
            orientation="right"
            domain={[7, 11]}
            tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
            label={{ value: "Run Rate", angle: 90, position: "insideRight", fill: "var(--color-text-muted)", fontSize: 10, dx: -6 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value) => <span style={{ color: "var(--color-text-secondary)" }}>{value}</span>}
          />

          {/* Avg 1st innings as bars */}
          <Bar
            yAxisId="score"
            dataKey="avg_first_innings_score"
            name="Avg 1st Inn Score"
            fill="var(--chart-1)"
            fillOpacity={0.3}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />

          {/* Run rate as line */}
          <Line
            yAxisId="rr"
            type="monotone"
            dataKey="overall_run_rate"
            name="Run Rate"
            stroke="var(--chart-2)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--chart-2)", stroke: "var(--color-bg-base)", strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
          />

          {/* Boundary % as secondary line */}
          <Line
            yAxisId="rr"
            type="monotone"
            dataKey="boundary_pct"
            name="Boundary %"
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
