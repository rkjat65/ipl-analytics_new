"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { OverProgression } from "@/lib/api";

interface Props {
  data: OverProgression[];
  team1: string;
  team2: string;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-raised px-3 py-2 text-xs space-y-1 shadow-lg">
      <p className="font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>
        Over {Number(label) + 1}
      </p>
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

export default function OverByOverChart({ data, team1, team2 }: Props) {
  const inn1 = data.filter((d) => d.innings_number === 1);
  const inn2 = data.filter((d) => d.innings_number === 2);

  const maxOvers = Math.max(inn1.length, inn2.length);
  const merged = Array.from({ length: maxOvers }, (_, i) => ({
    over:        i,
    [`${team1}`]: inn1[i]?.runs_in_over ?? 0,
    [`${team2}`]: inn2[i]?.runs_in_over ?? 0,
    wkt1:        inn1[i]?.wickets_in_over ?? 0,
    wkt2:        inn2[i]?.wickets_in_over ?? 0,
  }));

  const DEATH_START = 15;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
        Runs per Over
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={merged} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="over"
            tickFormatter={(v) => `${v + 1}`}
            tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
          />
          <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--color-text-secondary)" }}
            formatter={(value) => <span style={{ color: "var(--color-text-secondary)" }}>{value}</span>}
          />
          <Bar dataKey={team1} name={team1} maxBarSize={18}>
            {merged.map((entry, i) => (
              <Cell
                key={i}
                fill={i >= DEATH_START ? "#ea580c" : "#f97316"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
          <Bar dataKey={team2} name={team2} maxBarSize={18}>
            {merged.map((entry, i) => (
              <Cell
                key={i}
                fill={i >= DEATH_START ? "#1d4ed8" : "#3b82f6"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
