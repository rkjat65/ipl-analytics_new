"use client";

import { useState, useEffect, Suspense } from "react";
import { api } from "@/lib/api";
import SeasonComparisonInput from "@/components/SeasonComparisonInput";
import SeasonKPIComparison from "@/components/SeasonKPIComparison";
import SeasonTopBatters from "@/components/SeasonTopBatters";
import PageHeader from "@/components/PageHeader";
import { SkeletonCard } from "@/components/Skeleton";
import { useSearchParams } from "next/navigation";

function SeasonComparisonContent() {
  const searchParams = useSearchParams();
  const [season1, setSeason1] = useState(searchParams.get("season1") || "");
  const [season2, setSeason2] = useState(searchParams.get("season2") || "");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  // Fetch available seasons
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const response = await api.seasonTrends();
        setSeasons(response.map((s) => s.season).sort());
      } catch (err) {
        console.error("Failed to fetch seasons:", err);
      }
    };
    fetchSeasons();
  }, []);

  // Fetch season comparison data
  useEffect(() => {
    if (!season1 || !season2) {
      setData(null);
      setError("");
      return;
    }

    if (season1 === season2) {
      setError("Please select two different seasons");
      setData(null);
      return;
    }

    const fetchComparison = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await api.seasonComparison(season1, season2);
        setData(result);
      } catch (err) {
        setError("Failed to load comparison data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [season1, season2]);

  const handleSeasonsChange = (s1: string, s2: string) => {
    setSeason1(s1);
    setSeason2(s2);
    // Update URL
    const params = new URLSearchParams();
    params.set("season1", s1);
    params.set("season2", s2);
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <PageHeader
        title="Season Comparison"
        subtitle="Compare statistics between two IPL seasons"
      />

      <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Season Selection */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Select Seasons</h2>
          <SeasonComparisonInput
            seasons={seasons}
            onSeasonsChange={handleSeasonsChange}
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
            <SeasonKPIComparison
              season1={season1}
              season2={season2}
              kpis1={data.kpis_s1}
              kpis2={data.kpis_s2}
            />
            <SeasonTopBatters
              season1={season1}
              season2={season2}
              batters1={data.top_batsmen_s1}
              batters2={data.top_batsmen_s2}
            />
          </>
        )}

        {/* Empty State */}
        {!season1 && !season2 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Select two seasons to compare their statistics</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SeasonComparisonPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SeasonComparisonContent />
    </Suspense>
  );
}
