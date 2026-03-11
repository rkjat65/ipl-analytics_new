"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { HeadToHead } from "@/lib/api";

interface Props {
  h2h: Record<string, HeadToHead>;
  player1: string;
  player2: string;
}

/* Normalise a stat to 0-100 scale for radar display */
function norm(val: number | null | undefined, min: number, max: number): number {
  if (val == null) return 0;
  return Math.round(((val - min) / (max - min)) * 100);
}

export default function HeadToHeadChart({ h2h, player1, player2 }: Props) {
  const key1 = `${player1}_vs_${player2}`;
  const key2 = `${player2}_vs_${player1}`;
  const d1 = h2h[key1];
  const d2 = h2h[key2];

  if (!d1?.balls && !d2?.balls) {
    return (
      <div className="card p-5 text-center" style={{ color: "var(--color-text-muted)" }}>
        <p className="text-sm">These two players have not faced each other (as batter vs bowler).</p>
      </div>
    );
  }

  const hasBothDirections = d1?.balls && d2?.balls;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-5" style={{ color: "var(--color-text-primary)" }}>
        Head-to-Head Battle
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stats cards */}
        {[
          { match: d1, batter: player1, bowler: player2 },
          { match: d2, batter: player2, bowler: player1 },
        ]
          .filter((x) => x.match?.balls)
          .map(({ match: m, batter, bowler }) => (
            <div key={batter} className="card-raised p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                  style={{ color: "var(--color-text-muted)" }}>
                  {batter} <span style={{ color: "var(--color-text-muted)" }}>batting vs</span> {bowler}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Runs",        val: m.runs,          color: "var(--chart-1)" },
                  { label: "Balls",       val: m.balls,         color: "var(--color-text-secondary)" },
                  { label: "Dismissals",  val: m.dismissals ?? 0, color: "var(--color-danger)" },
                  { label: "Strike Rate", val: m.strike_rate?.toFixed(1) ?? "—", color: "var(--chart-2)" },
                  { label: "Average",     val: m.average?.toFixed(1) ?? "—",     color: "var(--chart-4)" },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</p>
                    <p className="text-xl font-bold stat-num" style={{ color }}>{val}</p>
                  </div>
                ))}
              </div>

              {/* Dominance bar */}
              {m.runs != null && m.balls != null && (
                <div>
                  <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
                    Batter dominance score
                  </p>
                  {(() => {
                    const srScore = Math.min(100, ((m.strike_rate ?? 0) / 200) * 100);
                    return (
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-bg-hover)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${srScore}%`, background: "linear-gradient(90deg, var(--chart-1), var(--chart-2))" }}
                        />
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
