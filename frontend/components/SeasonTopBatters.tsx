import React from "react";
import { Award, TrendingUp } from "lucide-react";

interface TopBatter {
  name: string;
  runs: number;
  innings: number;
  strike_rate: number;
}

interface SeasonTopBattersProps {
  season1: string;
  season2: string;
  batters1: TopBatter[];
  batters2: TopBatter[];
}

export default function SeasonTopBatters({
  season1,
  season2,
  batters1,
  batters2,
}: SeasonTopBattersProps) {
  const maxRuns = Math.max(
    ...[...batters1, ...batters2].map((b) => b.runs || 0)
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Season 1 Top Batters */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award size={20} className="text-yellow-500" />
          <h3 className="font-semibold text-lg">{season1} Top Batters</h3>
        </div>

        <div className="space-y-4">
          {batters1.length > 0 ? (
            batters1.map((batter, idx) => (
              <div key={batter.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{batter.name}</span>
                  <span className="text-sm font-bold text-blue-600">
                    {batter.runs} runs
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 rounded-full h-2"
                      style={{
                        width: `${(batter.runs / maxRuns) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-20 text-right">
                    SR {batter.strike_rate}%
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No data available</p>
          )}
        </div>
      </div>

      {/* Season 2 Top Batters */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award size={20} className="text-yellow-500" />
          <h3 className="font-semibold text-lg">{season2} Top Batters</h3>
        </div>

        <div className="space-y-4">
          {batters2.length > 0 ? (
            batters2.map((batter, idx) => (
              <div key={batter.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{batter.name}</span>
                  <span className="text-sm font-bold text-green-600">
                    {batter.runs} runs
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 rounded-full h-2"
                      style={{
                        width: `${(batter.runs / maxRuns) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-20 text-right">
                    SR {batter.strike_rate}%
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
