"use client";

import { useState, useEffect, Suspense } from "react";
import { api } from "@/lib/api";
import TeamComparisonInput from "@/components/TeamComparisonInput";
import TeamHeadToHeadStats from "@/components/TeamHeadToHeadStats";
import TeamRecentMatches from "@/components/TeamRecentMatches";
import PageHeader from "@/components/PageHeader";
import { SkeletonCard } from "@/components/Skeleton";
import { useSearchParams } from "next/navigation";

function TeamComparisonContent() {
  const searchParams = useSearchParams();
  const [team1, setTeam1] = useState(searchParams.get("team1") || "");
  const [team2, setTeam2] = useState(searchParams.get("team2") || "");
  const [teams, setTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  // Fetch available teams
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await api.teamStats();
        setTeams(response.map((t) => t.team));
      } catch (err) {
        console.error("Failed to fetch teams:", err);
      }
    };
    fetchTeams();
  }, []);

  // Fetch team comparison data
  useEffect(() => {
    if (!team1 || !team2) {
      setData(null);
      setError("");
      return;
    }

    if (team1 === team2) {
      setError("Please select two different teams");
      setData(null);
      return;
    }

    const fetchComparison = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await api.teamHeadToHead(team1, team2);
        setData(result);
      } catch (err) {
        setError("Failed to load comparison data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [team1, team2]);

  const handleTeamsChange = (t1: string, t2: string) => {
    setTeam1(t1);
    setTeam2(t2);
    // Update URL
    const params = new URLSearchParams();
    params.set("team1", t1);
    params.set("team2", t2);
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <PageHeader
        title="Team Head-to-Head"
        subtitle="Compare performance between two IPL teams"
      />

      <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Team Selection */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Select Teams</h2>
          <TeamComparisonInput
            teams={teams}
            onTeamsChange={handleTeamsChange}
            isLoading={loading}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Comparison Results */}
        {data && !loading && (
          <>
            <TeamHeadToHeadStats
              team1={team1}
              team2={team2}
              record={data.record}
            />
            <TeamRecentMatches
              team1={team1}
              team2={team2}
              matches={data.recent_matches}
            />
          </>
        )}

        {/* Empty State */}
        {!team1 && !team2 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Select two teams to compare their head-to-head record</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamComparisonPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TeamComparisonContent />
    </Suspense>
  );
}
