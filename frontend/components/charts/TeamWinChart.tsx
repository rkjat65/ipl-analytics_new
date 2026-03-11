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
import type { TeamStats } from "@/lib/api";

interface Props {
  data: TeamStats[];
}

// Map team → brand hex for bars
const TEAM_HEX: Record<string, string> = {
  "Mumbai Indians":               "#003B72",
  "Chennai Super Kings":          "#FABB00",
  "Royal Challengers Bangalore":  "#EC1C24",
  "Royal Challengers Bengaluru":  "#EC1C24",
  "Kolkata Knight Riders":        "#3A225D",
  "Sunrisers Hyderabad":          "#F7A721",
  "Delhi Capitals":               "#00508F",
  "Delhi Daredevils":             "#00508F",
  "Rajasthan Royals":             "#EA1A8E",
  "Punjab Kings":                 "#D71920",
  "Kings XI Punjab":              "#D71920",
  "Gujarat Titans":               "#1B2A5E",
  "Lucknow Super Giants":         "#002147",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as TeamStats;
  return (
    <div className="card-raised px-3 py-2.5 text-xs space-y-1 shadow-lg" style={{ minWidth: 160 }}>
      <p className="font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>{d.team}</p>
      <div className="flex justify-between gap-4">
        <span style={{ color: "var(--color-text-muted)" }}>Played</span>
        <span className="stat-num">{d.played}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span style={{ color: "var(--color-text-muted)" }}>Won</span>
        <span className="stat-num">{d.wins}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span style={{ color: "var(--color-success)" }}>Win %</span>
        <span className="stat-num font-bold" style={{ color: "var(--color-success)" }}>{d.win_pct}%</span>
      </div>
      <div className="flex justify-between gap-4">
        <span style={{ color: "var(--color-text-muted)" }}>Toss Win %</span>
        <span className="stat-num">{d.toss_win_pct}%</span>
      </div>
    </div>
  );
}

function shortName(team: string): string {
  const abbr: Record<string, string> = {
    "Mumbai Indians": "MI", "Chennai Super Kings": "CSK",
    "Royal Challengers Bangalore": "RCB", "Royal Challengers Bengaluru": "RCB",
    "Kolkata Knight Riders": "KKR", "Sunrisers Hyderabad": "SRH",
    "Delhi Capitals": "DC", "Delhi Daredevils": "DD",
    "Rajasthan Royals": "RR", "Punjab Kings": "PBKS",
    "Kings XI Punjab": "KXIP", "Gujarat Titans": "GT",
    "Lucknow Super Giants": "LSG",
  };
  return abbr[team] ?? team.split(" ").map(w => w[0]).join("").slice(0, 3);
}

export default function TeamWinChart({ data }: Props) {
  const major = data.filter((t) => t.played >= 30).slice(0, 12);

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
        Franchise Win % — All-Time
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={major} layout="vertical" margin={{ top: 0, right: 64, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis type="number" domain={[0, 70]} tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
            tickFormatter={(v) => `${v}%`} />
          <YAxis dataKey="team" type="category" width={48}
            tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
            tickFormatter={shortName} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-bg-hover)" }} />
          <Bar dataKey="win_pct" name="Win %" radius={[0, 4, 4, 0]} maxBarSize={24}>
            <LabelList
              dataKey="win_pct"
              position="right"
              style={{ fill: "var(--color-text-muted)", fontSize: 10 }}
              formatter={(v: unknown) => `${Number(v)}%`}
            />
            {major.map((entry, i) => (
              <Cell
                key={i}
                fill={TEAM_HEX[entry.team] ?? `hsl(${i * 37}, 65%, 50%)`}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
