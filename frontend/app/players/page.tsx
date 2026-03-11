export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SeasonPicker from "@/components/SeasonPicker";
import { SkeletonTable } from "@/components/Skeleton";
import { api } from "@/lib/api";

async function BattingTable({ season }: { season?: string }) {
  const rows = await api.battingLeaderboard({ season, limit: 30, min_innings: season ? 3 : 10 });

  return (
    <div className="card overflow-x-auto">
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Batting Leaderboard {season ? `· ${season}` : "· All-Time"}
        </h2>
      </div>
      <table className="w-full data-table">
        <thead>
          <tr>
            <th className="text-center">#</th>
            <th className="text-left">Player</th>
            <th className="text-right">Inn</th>
            <th className="text-right">Runs</th>
            <th className="text-right">HS</th>
            <th className="text-right">Avg</th>
            <th className="text-right">SR</th>
            <th className="text-right">50+</th>
            <th className="text-right">100s</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name}>
              <td className="text-center" style={{ color: "var(--color-text-muted)" }}>{i + 1}</td>
              <td>
                <Link href={`/players/${encodeURIComponent(r.name)}${season ? `?season=${season}` : ""}`}
                  className="font-medium hover:underline" style={{ color: "var(--color-brand)" }}>
                  {r.name}
                </Link>
              </td>
              <td className="text-right stat-num">{r.innings}</td>
              <td className="text-right stat-num font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {r.runs.toLocaleString()}
              </td>
              <td className="text-right stat-num">{r.highest_score}</td>
              <td className="text-right stat-num">{r.average ?? "—"}</td>
              <td className="text-right stat-num">{r.strike_rate}</td>
              <td className="text-right stat-num">{r.fifties}</td>
              <td className="text-right stat-num">{r.hundreds}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function BowlingTable({ season }: { season?: string }) {
  const rows = await api.bowlingLeaderboard({ season, limit: 20, min_overs: season ? 5 : 10 });

  return (
    <div className="card overflow-x-auto mt-8">
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Bowling Leaderboard {season ? `· ${season}` : "· All-Time"}
        </h2>
      </div>
      <table className="w-full data-table">
        <thead>
          <tr>
            <th className="text-center">#</th>
            <th className="text-left">Player</th>
            <th className="text-right">Overs</th>
            <th className="text-right">Runs</th>
            <th className="text-right">Wkts</th>
            <th className="text-right">Eco</th>
            <th className="text-right">Avg</th>
            <th className="text-right">SR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name}>
              <td className="text-center" style={{ color: "var(--color-text-muted)" }}>{i + 1}</td>
              <td>
                <Link href={`/players/${encodeURIComponent(r.name)}${season ? `?season=${season}` : ""}`}
                  className="font-medium hover:underline" style={{ color: "var(--color-accent)" }}>
                  {r.name}
                </Link>
              </td>
              <td className="text-right stat-num">{r.overs}</td>
              <td className="text-right stat-num">{r.runs_conceded.toLocaleString()}</td>
              <td className="text-right stat-num font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {r.wickets}
              </td>
              <td className="text-right stat-num">{r.economy}</td>
              <td className="text-right stat-num">{r.average ?? "—"}</td>
              <td className="text-right stat-num">{r.strike_rate ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PlayersPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  return (
    <div>
      <PageHeader
        title="Player Profiles"
        subtitle="Career stats, season breakdowns, and head-to-head matchups"
        action={
          <Suspense>
            <SeasonPicker />
          </Suspense>
        }
      />
      <Suspense fallback={<SkeletonTable rows={15} />}>
        <PlayerTables searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PlayerTables({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season } = await searchParams;
  return (
    <>
      <BattingTable season={season} />
      <BowlingTable season={season} />
    </>
  );
}
