export const dynamic = "force-dynamic";

import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import SeasonPicker from "@/components/SeasonPicker";
import { SkeletonCard, SkeletonTable } from "@/components/Skeleton";
import { api } from "@/lib/api";
import PhaseChart from "@/components/charts/PhaseChart";
import DismissalChart from "@/components/charts/DismissalChart";

async function AnalyticsContent({ season }: { season?: string }) {
  const [phaseData, dismissals, ppKingsBat, ppKingsBowl, seasonTrends] = await Promise.all([
    api.phase(season),
    api.dismissalTypes(season),
    api.powerplayKings("bat",  season, 8),
    api.powerplayKings("bowl", season, 8),
    api.seasonTrends(),
  ]);

  const pp     = phaseData.find(p => p.phase.startsWith("Powerplay"));
  const middle = phaseData.find(p => p.phase.startsWith("Middle"));
  const death  = phaseData.find(p => p.phase.startsWith("Death"));

  return (
    <div className="space-y-8">

      {/* Phase Charts */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--color-text-muted)" }}>
          Match Phase Analysis
        </h2>
        <PhaseChart data={phaseData} />

        {/* Raw numbers */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          {phaseData.map(p => (
            <div key={p.phase} className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: "var(--color-text-muted)" }}>
                {p.phase}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  { label: "Wickets", value: p.wickets.toLocaleString() },
                  { label: "Runs",    value: p.runs.toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</p>
                    <p className="text-base font-bold stat-num" style={{ color: "var(--color-text-primary)" }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dismissal Chart */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--color-text-muted)" }}>
          Dismissal Breakdown
        </h2>
        <DismissalChart data={dismissals} />
      </section>

      {/* Powerplay kings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4"
            style={{ color: "var(--color-text-muted)" }}>
            Powerplay Batting Kings
          </h2>
          <div className="card overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th className="text-left">Player</th>
                  <th className="text-right">Runs</th>
                  <th className="text-right">Balls</th>
                  <th className="text-right">SR</th>
                  <th className="text-right">6s</th>
                </tr>
              </thead>
              <tbody>
                {ppKingsBat.map((p, i) => (
                  <tr key={p.name}>
                    <td>
                      <span className="text-xs mr-2" style={{ color: "var(--color-text-muted)" }}>{i + 1}</span>
                      <a href={`/players/${encodeURIComponent(p.name)}`}
                        className="hover:underline" style={{ color: "var(--color-brand)" }}>
                        {p.name}
                      </a>
                    </td>
                    <td className="text-right stat-num">{p.runs}</td>
                    <td className="text-right stat-num">{p.balls}</td>
                    <td className="text-right stat-num font-semibold">{p.strike_rate}</td>
                    <td className="text-right stat-num">{p.sixes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4"
            style={{ color: "var(--color-text-muted)" }}>
            Powerplay Bowling Kings
          </h2>
          <div className="card overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th className="text-left">Player</th>
                  <th className="text-right">Balls</th>
                  <th className="text-right">Wkts</th>
                  <th className="text-right">Eco</th>
                </tr>
              </thead>
              <tbody>
                {ppKingsBowl.map((p, i) => (
                  <tr key={p.name}>
                    <td>
                      <span className="text-xs mr-2" style={{ color: "var(--color-text-muted)" }}>{i + 1}</span>
                      <a href={`/players/${encodeURIComponent(p.name)}`}
                        className="hover:underline" style={{ color: "var(--color-accent)" }}>
                        {p.name}
                      </a>
                    </td>
                    <td className="text-right stat-num">{p.legal_balls}</td>
                    <td className="text-right stat-num font-semibold">{p.wickets}</td>
                    <td className="text-right stat-num">{p.economy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Season trends */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--color-text-muted)" }}>
          Season-by-Season Trends
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="text-left">Season</th>
                <th className="text-right">Matches</th>
                <th className="text-right">Total Runs</th>
                <th className="text-right">Wickets</th>
                <th className="text-right">Avg Score</th>
                <th className="text-right">Run Rate</th>
                <th className="text-right">Boundary%</th>
              </tr>
            </thead>
            <tbody>
              {[...seasonTrends].reverse().map(s => (
                <tr key={s.season}>
                  <td className="font-medium">{s.season}</td>
                  <td className="text-right stat-num">{s.matches}</td>
                  <td className="text-right stat-num">{s.total_runs.toLocaleString()}</td>
                  <td className="text-right stat-num">{s.total_wickets.toLocaleString()}</td>
                  <td className="text-right stat-num">{s.avg_first_innings_score}</td>
                  <td className="text-right stat-num font-semibold"
                    style={{ color: "var(--color-brand)" }}>
                    {s.overall_run_rate}
                  </td>
                  <td className="text-right stat-num">{s.boundary_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function AnalyticsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  return (
    <div>
      <PageHeader
        title="Deep Analytics"
        subtitle="Phase analysis, dismissal patterns, powerplay specialists, and season trends"
        action={
          <Suspense>
            <SeasonPicker />
          </Suspense>
        }
      />
      <Suspense fallback={
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <SkeletonTable rows={10} />
        </div>
      }>
        <AnalyticsPageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AnalyticsPageContent({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season } = await searchParams;
  return <AnalyticsContent season={season} />;
}
