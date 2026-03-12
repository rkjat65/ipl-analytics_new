import React from "react";
import { BarChart3, TrendingUp } from "lucide-react";

interface SeasonKPI {
  total_matches?: number;
  total_runs?: number;
  total_wickets?: number;
  avg_first_innings_score?: number;
  highest_team_total?: number;
  total_sixes?: number;
  total_fours?: number;
  overall_run_rate?: number;
}

interface SeasonKPIComparisonProps {
  season1: string;
  season2: string;
  kpis1: SeasonKPI;
  kpis2: SeasonKPI;
}

function formatNumber(n: number | undefined): string {
  if (!n) return "—";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

export default function SeasonKPIComparison({
  season1,
  season2,
  kpis1,
  kpis2,
}: SeasonKPIComparisonProps) {
  const metrics = [
    { label: "Total Matches", key: "total_matches" },
    { label: "Total Runs", key: "total_runs" },
    { label: "Total Wickets", key: "total_wickets" },
    { label: "Avg 1st Innings", key: "avg_first_innings_score" },
    { label: "Highest Total", key: "highest_team_total" },
    { label: "Sixes", key: "total_sixes" },
    { label: "Fours", key: "total_fours" },
    { label: "Overall Run Rate", key: "overall_run_rate" },
  ];

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 size={20} className="text-blue-500" />
        <h3 className="text-lg font-semibold">KPI Comparison</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 font-medium">Metric</th>
              <th className="text-right py-2 px-2 font-medium bg-blue-50">
                {season1}
              </th>
              <th className="text-right py-2 px-2 font-medium bg-green-50">
                {season2}
              </th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => {
              const val1 = kpis1?.[metric.key as keyof SeasonKPI] || 0;
              const val2 = kpis2?.[metric.key as keyof SeasonKPI] || 0;
              const diff = (val2 as number) - (val1 as number);
              const diffPct =
                val1 !== 0 && val2 !== 0
                  ? ((diff / (val1 as number)) * 100).toFixed(1)
                  : "—";

              return (
                <tr key={metric.key} className="border-b border-gray-100">
                  <td className="py-3 px-2 font-medium">{metric.label}</td>
                  <td className="text-right py-3 px-2 bg-blue-50/50">
                    {formatNumber(val1 as number)}
                  </td>
                  <td className="text-right py-3 px-2 bg-green-50/50">
                    {formatNumber(val2 as number)}
                  </td>
                  <td
                    className={`text-right py-3 px-2 font-medium ${
                      diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {diff > 0 ? "+" : ""}
                    {formatNumber(diff)} {diffPct !== "—" && `(${diffPct}%)`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
