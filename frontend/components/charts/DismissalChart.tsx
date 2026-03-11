"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DismissalType } from "@/lib/api";

interface Props {
  data: DismissalType[];
}

const COLOURS = [
  "#f97316", "#3b82f6", "#a855f7", "#22c55e",
  "#eab308", "#ec4899", "#06b6d4", "#f43f5e",
  "#84cc16", "#8b5cf6",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="card-raised px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold capitalize mb-0.5" style={{ color: "var(--color-text-primary)" }}>
        {d.name}
      </p>
      <p style={{ color: d.payload?.fill }}>
        {d.value?.toLocaleString()} dismissals ({d.payload?.pct}%)
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderCustomLabel(props: any) {
  // pct is already a percentage (e.g. 62.7), not a 0-1 fraction
  const { cx, cy, midAngle, innerRadius, outerRadius, pct } = props;
  if (!pct || pct < 3) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={10} fontWeight={600}>
      {Number(pct).toFixed(0)}%
    </text>
  );
}

export default function DismissalChart({ data }: Props) {
  const coloured = data.map((d, i) => ({ ...d, fill: COLOURS[i % COLOURS.length] }));

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
        Dismissal Types
      </h3>
      <div className="flex flex-col md:flex-row items-center gap-6">
        <ResponsiveContainer width={220} height={220}>
          <PieChart>
            <Pie
              data={coloured}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={100}
              dataKey="count"
              nameKey="dismissal_kind"
              labelLine={false}
              label={renderCustomLabel}
            >
              {coloured.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="var(--color-bg-card)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <ul className="flex-1 space-y-2 min-w-0">
          {coloured.map((d) => (
            <li key={d.dismissal_kind} className="flex items-center gap-2.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.fill }} />
              <span className="capitalize flex-1 truncate" style={{ color: "var(--color-text-secondary)" }}>
                {d.dismissal_kind}
              </span>
              <span className="stat-num font-semibold shrink-0" style={{ color: "var(--color-text-primary)" }}>
                {(d as DismissalType).count.toLocaleString()}
              </span>
              <span className="shrink-0" style={{ color: "var(--color-text-muted)" }}>
                {(d as DismissalType).pct}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
