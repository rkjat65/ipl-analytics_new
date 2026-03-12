export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Activity, Award, Target, TrendingUp, Wind, Zap } from "lucide-react";
import KPICard from "@/components/KPICard";
import PageHeader from "@/components/PageHeader";
import { SkeletonCard } from "@/components/Skeleton";
import { api } from "@/lib/api";
import Link from "next/link";
import TeamBadge from "@/components/TeamBadge";
import SeasonTrendsChart from "@/components/charts/SeasonTrendsChart";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

async function KPIs() {
  let kpisArr, teams, seasons;
  try {
    [kpisArr, teams, seasons] = await Promise.all([
      api.kpis(),
      api.teamStats(),
      api.seasonTrends(),
    ]);
  } catch (e) {
    return (
      <div className="card p-6 mb-8 text-center">
        <p className="text-sm font-medium mb-1" style={{ color: "var(--color-danger, #ef4444)" }}>
          Could not reach the API server
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Make sure the FastAPI backend is running: <code className="font-mono">uvicorn backend.main:app --port 8000</code>
        </p>
      </div>
    );
  }

  const k = kpisArr?.[0];
  if (!k) return <p style={{ color: "var(--color-text-muted)" }}>No KPI data returned.</p>;
  const latestSeason = seasons[seasons.length - 1];
  const topTeam = teams[0];

  return (
    <>
      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard label="Total Matches"    value={fmt(k.total_matches)}           sub="since 2007"         icon={Award}     accent="brand"   />
        <KPICard label="Runs Scored"      value={fmt(k.total_runs)}              sub="all innings"        icon={TrendingUp} accent="accent" />
        <KPICard label="Wickets Taken"    value={fmt(k.total_wickets)}           sub="regular play"       icon={Target}    accent="warn"    />
        <KPICard label="Avg 1st Innings"  value={k.avg_first_innings_score}      sub="runs per match"     icon={Activity}  accent="success" />
        <KPICard label="Total Sixes"      value={fmt(k.total_sixes)}             sub="across all seasons" icon={Zap}       accent="brand"   />
        <KPICard label="Total Fours"      value={fmt(k.total_fours)}             sub="across all seasons" icon={Wind}      accent="accent"  />
        <KPICard label="Highest Total"    value={k.highest_team_total}           sub="single team innings" icon={Award}    accent="warn"    />
        <KPICard label="Latest Season"    value={latestSeason.season}            sub={`${latestSeason.matches} matches`} icon={Activity} accent="success" />
      </div>

      {/* Season Trend mini table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent seasons */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between"
            style={{ borderColor: "var(--color-border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Season Overview
            </h2>
            <Link href="/analytics" className="text-xs hover:underline" style={{ color: "var(--color-brand)" }}>
              View all →
            </Link>
          </div>
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="text-left">Season</th>
                <th className="text-right">Matches</th>
                <th className="text-right">Avg Score</th>
                <th className="text-right">Run Rate</th>
                <th className="text-right">Sixes%</th>
              </tr>
            </thead>
            <tbody>
              {seasons.slice(-6).reverse().map(s => (
                <tr key={s.season}>
                  <td className="font-medium">{s.season}</td>
                  <td className="text-right stat-num">{s.matches}</td>
                  <td className="text-right stat-num">{s.avg_first_innings_score}</td>
                  <td className="text-right stat-num">{s.overall_run_rate}</td>
                  <td className="text-right stat-num">{s.boundary_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top teams */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between"
            style={{ borderColor: "var(--color-border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              All-Time Team Rankings
            </h2>
            <Link href="/teams" className="text-xs hover:underline" style={{ color: "var(--color-brand)" }}>
              View all →
            </Link>
          </div>
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="text-left">#</th>
                <th className="text-left">Team</th>
                <th className="text-right">W</th>
                <th className="text-right">P</th>
                <th className="text-right">Win%</th>
              </tr>
            </thead>
            <tbody>
              {teams.filter(t => t.played >= 30).slice(0, 6).map((t, i) => (
                <tr key={t.team}>
                  <td className="text-center" style={{ color: "var(--color-text-muted)" }}>{i + 1}</td>
                  <td><TeamBadge team={t.team} short /></td>
                  <td className="text-right stat-num">{t.wins}</td>
                  <td className="text-right stat-num">{t.played}</td>
                  <td className="text-right stat-num font-semibold"
                    style={{ color: t.win_pct >= 55 ? "var(--color-success)" : "var(--color-text-primary)" }}>
                    {t.win_pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Season Trends Chart */}
      <div className="mb-8">
        <SeasonTrendsChart data={seasons} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { href: "/matches",   label: "Browse Matches",   sub: "1,169 games", color: "var(--color-brand)" },
          { href: "/players",   label: "Player Profiles",  sub: "Career stats, head-to-head", color: "var(--color-accent)" },
          { href: "/analytics", label: "Deep Analytics",   sub: "Phase, venue, dismissal", color: "var(--color-success)" },
        ].map(({ href, label, sub, color }) => (
          <Link key={href} href={href}
            className="card p-5 flex flex-col gap-1 hover:border-[var(--color-border-subtle)] transition-all group">
            <p className="text-sm font-semibold group-hover:underline" style={{ color }}>
              {label} →
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{sub}</p>
          </Link>
        ))}
      </div>

      {/* Comparison Tools */}
      <div className="card p-6 mb-8">
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
          Compare & Analyze
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/teams/compare"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition"
            style={{ borderLeft: "3px solid var(--color-brand)" }}>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                Team Comparison
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Head-to-head records & stats
              </p>
            </div>
          </Link>

          <Link href="/analytics/seasons/compare"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-green-50 transition"
            style={{ borderLeft: "3px solid var(--color-success)" }}>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                Season Comparison
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Compare performance across seasons
              </p>
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="IPL Analytics"
        subtitle="Ball-by-ball data from every IPL season — 2007 to 2025"
      />
      <Suspense fallback={
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      }>
        <KPIs />
      </Suspense>
    </div>
  );
}
