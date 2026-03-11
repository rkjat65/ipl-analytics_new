export const dynamic = "force-dynamic";

import RunRateChart from "@/components/charts/RunRateChart";
import OverByOverChart from "@/components/charts/OverByOverChart";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TeamBadge from "@/components/TeamBadge";
import { api } from "@/lib/api";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const { match: m } = await api.matchDetail(id);
    return { title: `${m.team1} vs ${m.team2} – ${m.date}` };
  } catch {
    return { title: "Match Detail" };
  }
}

function ScorecardTable({ title, rows, cols }: {
  title: string;
  rows: Record<string, unknown>[];
  cols: { key: string; label: string; align?: "left" | "right" }[];
}) {
  return (
    <div className="card overflow-x-auto mb-6">
      <div className="px-5 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{title}</h3>
      </div>
      <table className="w-full data-table">
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} className={c.align === "right" ? "text-right" : "text-left"}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map(c => (
                <td key={c.key} className={c.align === "right" ? "text-right stat-num" : ""}>
                  {String(row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail;
  let rrData;
  try {
    [detail, rrData] = await Promise.all([
      api.matchDetail(id),
      api.runRateProgression(id),
    ]);
  } catch {
    notFound();
  }

  const { match: m, innings, batting, bowling, over_progression } = detail;

  const matchResult = (() => {
    if (m.result === "no result") return "No Result";
    if (m.result === "tie") return "Tie";
    if (!m.winner) return "—";
    if (m.win_by_wickets) return `${m.winner} won by ${m.win_by_wickets} wicket${m.win_by_wickets > 1 ? "s" : ""}`;
    if (m.win_by_runs)    return `${m.winner} won by ${m.win_by_runs} run${m.win_by_runs > 1 ? "s" : ""}`;
    return `${m.winner} won`;
  })();

  return (
    <div className="max-w-5xl">
      {/* Back */}
      <Link href="/matches" className="inline-flex items-center gap-1.5 text-sm mb-5 hover:underline"
        style={{ color: "var(--color-text-muted)" }}>
        <ArrowLeft size={14} /> Back to matches
      </Link>

      {/* Match header */}
      <div className="card p-6 mb-6">
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "var(--color-text-muted)" }}>
              {m.season} · {new Date(m.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <div className="flex items-center gap-3 mb-3">
              <TeamBadge team={m.team1} />
              <span className="text-sm font-bold" style={{ color: "var(--color-text-muted)" }}>vs</span>
              <TeamBadge team={m.team2} />
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-brand)" }}>{matchResult}</p>
          </div>
          <div className="text-right text-sm space-y-1" style={{ color: "var(--color-text-muted)" }}>
            <p>{m.venue}</p>
            <p>Toss: <span style={{ color: "var(--color-text-secondary)" }}>{m.toss_winner} chose to {m.toss_decision}</span></p>
            {m.player_of_match && (
              <p>POM: <Link href={`/players/${encodeURIComponent(m.player_of_match)}`}
                className="hover:underline" style={{ color: "var(--color-accent)" }}>
                {m.player_of_match}
              </Link></p>
            )}
          </div>
        </div>

        {/* Innings summary row */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          {innings.filter(i => !i.is_super_over).map(inn => (
            <div key={inn.innings_number} className="card-raised p-4">
              <div className="flex items-center justify-between mb-2">
                <TeamBadge team={inn.batting_team} />
                <span className="badge text-xs" style={{ background: "var(--color-bg-hover)", color: "var(--color-text-muted)" }}>
                  Inn {inn.innings_number}
                </span>
              </div>
              <p className="stat-num text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                {inn.total_runs}<span className="text-lg font-normal" style={{ color: "var(--color-text-muted)" }}>/{inn.total_wickets}</span>
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                {Math.floor(inn.legal_balls / 6)}.{inn.legal_balls % 6} overs ·{" "}
                RR: {inn.legal_balls > 0 ? (inn.total_runs / (inn.legal_balls / 6)).toFixed(2) : "—"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      {rrData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          <RunRateChart data={rrData} team1={m.team1} team2={m.team2} />
          <OverByOverChart data={over_progression} team1={m.team1} team2={m.team2} />
        </div>
      )}

      {/* Scorecards per innings */}
      {innings.filter(i => !i.is_super_over).map(inn => (
        <div key={inn.innings_number} className="mb-8">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2"
            style={{ color: "var(--color-text-primary)" }}>
            <TeamBadge team={inn.batting_team} />
            <span style={{ color: "var(--color-text-muted)" }}>Batting</span>
          </h2>

          <ScorecardTable
            title={`${inn.batting_team} – Batting`}
            rows={batting.filter(b => b.innings_number === inn.innings_number).map(b => ({
              batter:       b.batter,
              how_out:      b.dismissed_by ?? "not out",
              runs:         b.runs,
              balls:        b.balls,
              fours:        b.fours,
              sixes:        b.sixes,
              strike_rate:  b.strike_rate,
            }))}
            cols={[
              { key: "batter",      label: "Batter",       align: "left" },
              { key: "how_out",     label: "Dismissal",    align: "left" },
              { key: "runs",        label: "R",            align: "right" },
              { key: "balls",       label: "B",            align: "right" },
              { key: "fours",       label: "4s",           align: "right" },
              { key: "sixes",       label: "6s",           align: "right" },
              { key: "strike_rate", label: "SR",           align: "right" },
            ]}
          />

          <ScorecardTable
            title={`${inn.bowling_team} – Bowling`}
            rows={bowling.filter(b => b.innings_number === inn.innings_number).map(b => ({
              bowler:       b.bowler,
              overs:        `${Math.floor(b.balls / 6)}.${b.balls % 6}`,
              runs:         b.runs_conceded,
              wickets:      b.wickets,
              economy:      b.economy,
            }))}
            cols={[
              { key: "bowler",  label: "Bowler",  align: "left" },
              { key: "overs",   label: "O",       align: "right" },
              { key: "runs",    label: "R",        align: "right" },
              { key: "wickets", label: "W",        align: "right" },
              { key: "economy", label: "Eco",      align: "right" },
            ]}
          />
        </div>
      ))}
    </div>
  );
}
