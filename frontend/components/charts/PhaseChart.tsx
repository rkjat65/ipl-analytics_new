"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { PhaseStats } from "@/lib/api";

interface Props {
  data: PhaseStats[];
}

const PHASE_COLOURS = ["#f97316", "#3b82f6", "#a855f7"];

const PHASE_LABELS: Record<string, string> = {
  "Powerplay (0-5)": "Powerplay",
  "Middle (6-14)":   "Middle",
  "Death (15-19)":   "Death",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-raised px-3 py-2.5 text-xs space-y-1 shadow-lg">
      <p className="font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="stat-num font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PhaseChart({ data }: Props) {
  const formatted = data.map((d, i) => ({
    ...d,
    phase:  PHASE_LABELS[d.phase] ?? d.phase,
    colour: PHASE_COLOURS[i] ?? "#999",
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Run Rate by phase */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
          Run Rate by Phase
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={formatted} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" domain={[0, 12]} tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} />
            <YAxis dataKey="phase" type="category" tick={{ fill: "var(--color-text-secondary)", fontSize: 12, fontWeight: 500 }} width={80} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="run_rate" name="Run Rate" radius={[0, 4, 4, 0]} maxBarSize={36}>
              <LabelList
                dataKey="run_rate"
                position="right"
                style={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                formatter={(v: unknown) => Number(v).toFixed(2)}
              />
              {formatted.map((entry, i) => (
                <Cell key={i} fill={entry.colour} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Balls per wicket by phase */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
          Balls per Wicket by Phase
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={formatted} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} />
            <YAxis dataKey="phase" type="category" tick={{ fill: "var(--color-text-secondary)", fontSize: 12, fontWeight: 500 }} width={80} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="balls_per_wicket" name="Balls / Wicket" radius={[0, 4, 4, 0]} maxBarSize={36}>
              <LabelList
                dataKey="balls_per_wicket"
                position="right"
                style={{ fill: "var(--color-text-muted)", fontSize: 11 }}
              />
              {formatted.map((entry, i) => (
                <Cell key={i} fill={entry.colour} fillOpacity={0.65} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
