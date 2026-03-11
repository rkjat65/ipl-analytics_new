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
  ReferenceLine,
} from "recharts";
import type { RunRatePoint } from "@/lib/api";

interface Props {
  data: RunRatePoint[];
  team1: string;
  team2: string;
}

const COLOURS = {
  inn1_rr:  "#f97316",
  inn2_rr:  "#3b82f6",
  inn1_bar: "rgba(249,115,22,0.25)",
  inn2_bar: "rgba(59,130,246,0.25)",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-raised px-3 py-2 text-xs space-y-1 shadow-lg"
      style={{ minWidth: 140 }}>
      <p className="font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>
        Over {Math.floor(Number(label) / 6)}.{Number(label) % 6}
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="stat-num font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RunRateChart({ data, team1, team2 }: Props) {
  const inn1 = data.filter((d) => d.innings_number === 1);
  const inn2 = data.filter((d) => d.innings_number === 2);

  // Merge into a single array keyed by ball_seq for the chart
  const maxLen = Math.max(inn1.length, inn2.length);
  const merged = Array.from({ length: maxLen }, (_, i) => ({
    ball_seq:     (inn1[i] ?? inn2[i])?.ball_seq ?? i + 1,
    rr1:          inn1[i]?.run_rate ?? null,
    rr2:          inn2[i]?.run_rate ?? null,
    runs1:        inn1[i]?.runs_total ?? null,
    runs2:        inn2[i]?.runs_total ?? null,
    wicket1:      inn1[i]?.is_wicket ? inn1[i].cumulative_runs : null,
    wicket2:      inn2[i]?.is_wicket ? inn2[i].cumulative_runs : null,
  }));

  // x-axis tick: show over.ball labels at start of each over (every 6 balls)
  const ticks = Array.from({ length: 20 }, (_, i) => i * 6 + 1).filter(
    (t) => t <= maxLen
  );

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
        Run Rate Progression
      </h3>

      {/* Required Run Rate (target line) context */}
      <div className="flex gap-6 mb-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-0.5 inline-block rounded" style={{ background: COLOURS.inn1_rr }} />
          {team1} (Inn 1)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-0.5 inline-block rounded" style={{ background: COLOURS.inn2_rr }} />
          {team2} (Inn 2)
        </span>
        <span className="flex items-center gap-1.5 ml-auto italic">
          Wickets marked with ◆
        </span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={merged} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="ball_seq"
            ticks={ticks}
            tickFormatter={(v) => `${Math.floor((v - 1) / 6)}`}
            tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
            label={{ value: "Over", position: "insideBottom", offset: -2, fill: "var(--color-text-muted)", fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
            domain={[0, "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Run rate lines */}
          <Line
            type="monotone"
            dataKey="rr1"
            name={`${team1} RR`}
            stroke={COLOURS.inn1_rr}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="rr2"
            name={`${team2} RR`}
            stroke={COLOURS.inn2_rr}
            dot={false}
            strokeWidth={2}
            connectNulls
          />

          {/* Wicket markers as tiny dots using scatter-style dots on line */}
          <Line
            dataKey="wicket1"
            stroke={COLOURS.inn1_rr}
            dot={{ r: 4, fill: COLOURS.inn1_rr, stroke: "var(--color-bg-base)", strokeWidth: 1.5 }}
            activeDot={false}
            strokeWidth={0}
            legendType="none"
            name=""
          />
          <Line
            dataKey="wicket2"
            stroke={COLOURS.inn2_rr}
            dot={{ r: 4, fill: COLOURS.inn2_rr, stroke: "var(--color-bg-base)", strokeWidth: 1.5 }}
            activeDot={false}
            strokeWidth={0}
            legendType="none"
            name=""
          />

          {/* T20 average RR reference line */}
          <ReferenceLine y={8} stroke="var(--color-border-subtle)" strokeDasharray="4 4"
            label={{ value: "Avg 8.0", position: "right", fill: "var(--color-text-muted)", fontSize: 10 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
