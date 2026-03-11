export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import KPICard from "@/components/KPICard";
import { Activity, Target, TrendingUp, Zap } from "lucide-react";
import { api } from "@/lib/api";
import type { Metadata } from "next";
import PlayerSeasonChart from "@/components/charts/PlayerSeasonChart";
import HeadToHeadChart from "@/components/charts/HeadToHeadChart";
import HeadToHeadInput from "@/components/HeadToHeadInput";

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  return { title: decodeURIComponent(name) };
}

function StatRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0"
      style={{ borderColor: "var(--color-border)" }}>
      <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span className="text-sm font-semibold stat-num" style={{ color: "var(--color-text-primary)" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { name: encodedName } = await params;
  const { season } = await searchParams;
  const name = decodeURIComponent(encodedName);

  const { opponent } = await searchParams as { season?: string; opponent?: string };

  let profile;
  let h2hData = null;
  try {
    profile = await api.playerProfile(name, season);
    if (opponent) {
      h2hData = await api.headToHead(name, opponent).catch(() => null);
    }
  } catch {
    notFound();
  }

  const { batting: b, bowling: w, season_batting, recent_form, dismissals, vs_teams } = profile;
  const hasBatting = (b?.innings ?? 0) > 0;
  const hasBowling = (w?.wickets ?? 0) > 0;

  return (
    <div className="max-w-5xl">
      {/* Back */}
      <Link href="/players" className="inline-flex items-center gap-1.5 text-sm mb-5 hover:underline"
        style={{ color: "var(--color-text-muted)" }}>
        <ArrowLeft size={14} /> Back to leaderboard
      </Link>

      {/* Player name */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
          {name}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          {season ? `Season: ${season}` : "All-time IPL career"} ·{" "}
          {b?.innings ?? 0} innings · {b?.runs?.toLocaleString() ?? 0} runs
        </p>
      </div>

      {/* KPI ribbon */}
      {hasBatting && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <KPICard label="Runs"         value={b.runs?.toLocaleString() ?? 0} sub={`in ${b.innings} innings`} icon={TrendingUp} accent="brand"   />
          <KPICard label="Average"      value={b.average ?? "—"}              sub="per dismissal"              icon={Activity}  accent="accent"  />
          <KPICard label="Strike Rate"  value={b.strike_rate ?? "—"}          sub="runs per 100 balls"         icon={Zap}       accent="warn"    />
          <KPICard label="Highest"      value={b.highest_score ?? "—"}        sub={`${b.fifties} 50s · ${b.hundreds} 100s`} icon={Target} accent="success" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Batting detail */}
        {hasBatting && (
          <div className="card p-5 lg:col-span-1">
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
              Batting Stats
            </h2>
            <StatRow label="Innings"      value={b.innings} />
            <StatRow label="Runs"         value={b.runs?.toLocaleString()} />
            <StatRow label="Highest"      value={b.highest_score} />
            <StatRow label="Average"      value={b.average} />
            <StatRow label="Strike Rate"  value={b.strike_rate} />
            <StatRow label="Balls Faced"  value={b.balls_faced?.toLocaleString()} />
            <StatRow label="Fours"        value={b.fours} />
            <StatRow label="Sixes"        value={b.sixes} />
            <StatRow label="Fifties"      value={b.fifties} />
            <StatRow label="Hundreds"     value={b.hundreds} />
            <StatRow label="Ducks"        value={b.ducks} />
          </div>
        )}

        {/* Bowling detail */}
        {hasBowling && (
          <div className="card p-5 lg:col-span-1">
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
              Bowling Stats
            </h2>
            <StatRow label="Overs"        value={w.overs} />
            <StatRow label="Runs Conceded" value={w.runs_conceded?.toLocaleString()} />
            <StatRow label="Wickets"      value={w.wickets} />
            <StatRow label="Economy"      value={w.economy} />
            <StatRow label="Average"      value={w.average ?? "—"} />
            <StatRow label="Strike Rate"  value={w.strike_rate ?? "—"} />
          </div>
        )}

        {/* Dismissal breakdown */}
        {dismissals.length > 0 && (
          <div className="card p-5 lg:col-span-1">
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
              How Dismissed
            </h2>
            <div className="space-y-3">
              {dismissals.map(d => {
                const total = dismissals.reduce((s, x) => s + x.count, 0);
                const pct = ((d.count / total) * 100).toFixed(0);
                return (
                  <div key={d.dismissal_kind}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize" style={{ color: "var(--color-text-secondary)" }}>
                        {d.dismissal_kind}
                      </span>
                      <span className="stat-num" style={{ color: "var(--color-text-muted)" }}>
                        {d.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-bg-hover)" }}>
                      <div className="h-full rounded-full" style={{
                        width: `${pct}%`,
                        background: "var(--color-brand)",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Season chart */}
      {season_batting.length > 1 && (
        <div className="mb-8">
          <PlayerSeasonChart data={season_batting} playerName={name} />
        </div>
      )}

      {/* Head-to-head */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-text-muted)" }}>
            Head-to-Head Comparison
          </h2>
        </div>
        <HeadToHeadInput currentPlayer={name} currentOpponent={opponent} />
        {h2hData && opponent && (
          <div className="mt-4">
            <HeadToHeadChart h2h={h2hData} player1={name} player2={opponent} />
          </div>
        )}
      </div>

      {/* Season breakdown */}
      {season_batting.length > 0 && (
        <div className="card overflow-x-auto mb-8">
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Season-by-Season (Batting)
            </h2>
          </div>
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="text-left">Season</th>
                <th className="text-right">Inn</th>
                <th className="text-right">Runs</th>
                <th className="text-right">HS</th>
                <th className="text-right">Avg</th>
                <th className="text-right">SR</th>
                <th className="text-right">50+</th>
              </tr>
            </thead>
            <tbody>
              {[...season_batting].reverse().map(s => (
                <tr key={s.season}>
                  <td className="font-medium">{s.season}</td>
                  <td className="text-right stat-num">{s.innings}</td>
                  <td className="text-right stat-num font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {s.runs}
                  </td>
                  <td className="text-right stat-num">{s.highest_score}</td>
                  <td className="text-right stat-num">{s.average ?? "—"}</td>
                  <td className="text-right stat-num">{s.strike_rate}</td>
                  <td className="text-right stat-num">{s.fifties_plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent form */}
      {recent_form.length > 0 && (
        <div className="card overflow-x-auto mb-8">
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Recent Form (last 10 innings)
            </h2>
          </div>
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="text-left">Date</th>
                <th className="text-left">Match</th>
                <th className="text-right">Runs</th>
                <th className="text-right">Balls</th>
                <th className="text-left">How out</th>
              </tr>
            </thead>
            <tbody>
              {recent_form.map(f => (
                <tr key={`${f.match_id}-${f.innings_number}`}>
                  <td style={{ color: "var(--color-text-muted)" }}>
                    {new Date(f.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                  </td>
                  <td>
                    <Link href={`/matches/${f.match_id}`} className="text-xs hover:underline"
                      style={{ color: "var(--color-text-secondary)" }}>
                      {f.team1} vs {f.team2}
                    </Link>
                  </td>
                  <td className="text-right stat-num font-semibold"
                    style={{ color: f.runs >= 50 ? "var(--color-success)" : f.runs === 0 ? "var(--color-danger)" : "var(--color-text-primary)" }}>
                    {f.runs}{!f.was_dismissed ? "*" : ""}
                  </td>
                  <td className="text-right stat-num">{f.balls}</td>
                  <td className="capitalize text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {f.how_out ?? "not out"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* vs teams */}
      {vs_teams.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Performance vs Teams
            </h2>
          </div>
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="text-left">Opponent</th>
                <th className="text-right">Inn</th>
                <th className="text-right">Runs</th>
                <th className="text-right">Avg</th>
                <th className="text-right">SR</th>
              </tr>
            </thead>
            <tbody>
              {vs_teams.map(t => (
                <tr key={t.opponent}>
                  <td className="font-medium" style={{ color: "var(--color-text-secondary)" }}>{t.opponent}</td>
                  <td className="text-right stat-num">{t.innings}</td>
                  <td className="text-right stat-num">{t.runs}</td>
                  <td className="text-right stat-num">{t.average ?? "—"}</td>
                  <td className="text-right stat-num">{t.strike_rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
