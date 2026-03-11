export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SeasonPicker from "@/components/SeasonPicker";
import TeamBadge from "@/components/TeamBadge";
import { SkeletonTable } from "@/components/Skeleton";
import { api } from "@/lib/api";

function resultLabel(m: { result: string; winner: string | null; win_by_runs: number | null; win_by_wickets: number | null }) {
  if (m.result === "no result") return "No Result";
  if (m.result === "tie") return "Tie";
  if (!m.winner) return "—";
  if (m.win_by_wickets) return `${m.winner} won by ${m.win_by_wickets} wkt${m.win_by_wickets > 1 ? "s" : ""}`;
  if (m.win_by_runs)    return `${m.winner} won by ${m.win_by_runs} run${m.win_by_runs > 1 ? "s" : ""}`;
  return `${m.winner} won`;
}

async function MatchTable({ season }: { season?: string }) {
  const { data: matches, total } = await api.matches({ season, limit: 50 });

  return (
    <div>
      <p className="mb-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Showing {matches.length} of {total} matches{season ? ` in ${season}` : ""}
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="text-left">Date</th>
              <th className="text-left">Teams</th>
              <th className="text-left">Result</th>
              <th className="text-left">Venue</th>
              <th className="text-left">POM</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(m => (
              <tr key={m.match_id}>
                <td className="whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
                  {new Date(m.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td>
                  <Link href={`/matches/${m.match_id}`}
                    className="flex flex-col gap-1 group">
                    <div className="flex items-center gap-2">
                      <TeamBadge team={m.team1} short />
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>vs</span>
                      <TeamBadge team={m.team2} short />
                    </div>
                    <span className="text-xs group-hover:underline" style={{ color: "var(--color-brand)" }}>
                      View scorecard →
                    </span>
                  </Link>
                </td>
                <td className="text-sm max-w-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {resultLabel(m)}
                </td>
                <td className="text-sm max-w-[180px] truncate" style={{ color: "var(--color-text-muted)" }}>
                  {m.city ?? m.venue}
                </td>
                <td className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  {m.player_of_match ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  return (
    <div>
      <PageHeader
        title="Match Centre"
        subtitle="Browse every IPL game with full scorecards"
        action={
          <Suspense>
            <SeasonPicker />
          </Suspense>
        }
      />
      <Suspense fallback={<SkeletonTable rows={12} />}>
        <SeasonAwareTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SeasonAwareTable({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season } = await searchParams;
  return <MatchTable season={season} />;
}
