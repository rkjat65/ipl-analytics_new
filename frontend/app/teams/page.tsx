export const dynamic = "force-dynamic";

import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import SeasonPicker from "@/components/SeasonPicker";
import TeamBadge from "@/components/TeamBadge";
import { SkeletonTable } from "@/components/Skeleton";
import { api } from "@/lib/api";
import TeamWinChart from "@/components/charts/TeamWinChart";

async function TeamTable({ season }: { season?: string }) {
  const [teams, venues] = await Promise.all([
    api.teamStats(season),
    api.venues(season),
  ]);

  const major = teams.filter(t => t.played >= 30);
  const others = teams.filter(t => t.played < 30);

  return (
    <div className="space-y-8">
      {/* Win % chart (all-time only) */}
      {!season && <TeamWinChart data={teams} />}

      {/* Main team table */}
      <div className="card overflow-x-auto">
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Franchise Performance {season ? `· ${season}` : "· All-Time"}
          </h2>
        </div>
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="text-center">#</th>
              <th className="text-left">Team</th>
              <th className="text-right">Played</th>
              <th className="text-right">Won</th>
              <th className="text-right">Win %</th>
              <th className="text-right">Toss Wins</th>
              <th className="text-right">Toss Win %</th>
            </tr>
          </thead>
          <tbody>
            {major.map((t, i) => (
              <tr key={t.team}>
                <td className="text-center" style={{ color: "var(--color-text-muted)" }}>{i + 1}</td>
                <td><TeamBadge team={t.team} /></td>
                <td className="text-right stat-num">{t.played}</td>
                <td className="text-right stat-num">{t.wins}</td>
                <td className="text-right stat-num font-semibold"
                  style={{ color: t.win_pct >= 55 ? "var(--color-success)" : t.win_pct < 45 ? "var(--color-danger)" : "var(--color-text-primary)" }}>
                  {t.win_pct}%
                </td>
                <td className="text-right stat-num">{t.toss_wins}</td>
                <td className="text-right stat-num" style={{ color: "var(--color-text-muted)" }}>
                  {t.toss_win_pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Defunct teams collapsed */}
        {others.length > 0 && (
          <details className="px-5 py-3 border-t" style={{ borderColor: "var(--color-border)" }}>
            <summary className="text-xs cursor-pointer select-none"
              style={{ color: "var(--color-text-muted)" }}>
              Defunct / short-run franchises ({others.length})
            </summary>
            <table className="w-full data-table mt-2">
              <tbody>
                {others.map(t => (
                  <tr key={t.team}>
                    <td><TeamBadge team={t.team} /></td>
                    <td className="text-right stat-num">{t.played}</td>
                    <td className="text-right stat-num">{t.wins}</td>
                    <td className="text-right stat-num">{t.win_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>

      {/* Venue breakdown */}
      <div className="card overflow-x-auto">
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Venue Statistics {season ? `· ${season}` : "· All-Time"}
          </h2>
        </div>
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="text-left">Venue</th>
              <th className="text-right">Matches</th>
              <th className="text-right">Avg 1st Inn</th>
              <th className="text-right">Avg 2nd Inn</th>
              <th className="text-right">Bat-first Win%</th>
            </tr>
          </thead>
          <tbody>
            {venues.slice(0, 15).map(v => (
              <tr key={v.venue}>
                <td>
                  <p className="font-medium text-sm truncate max-w-[220px]"
                    style={{ color: "var(--color-text-secondary)" }}>
                    {v.venue}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{v.city}</p>
                </td>
                <td className="text-right stat-num">{v.matches}</td>
                <td className="text-right stat-num">{v.avg_first_innings}</td>
                <td className="text-right stat-num">{v.avg_second_innings}</td>
                <td className="text-right stat-num font-semibold"
                  style={{ color: v.bat_first_win_pct > 55 ? "var(--color-success)" : v.bat_first_win_pct < 45 ? "var(--color-danger)" : "var(--color-text-primary)" }}>
                  {v.bat_first_win_pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TeamsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  return (
    <div>
      <PageHeader
        title="Team Analytics"
        subtitle="Franchise win records, toss impact, and venue intelligence"
        action={
          <Suspense>
            <SeasonPicker />
          </Suspense>
        }
      />
      <Suspense fallback={<SkeletonTable rows={12} />}>
        <TeamPageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TeamPageContent({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season } = await searchParams;
  return <TeamTable season={season} />;
}
