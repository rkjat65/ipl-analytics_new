import React from "react";
import { Trophy, TrendingUp, Zap } from "lucide-react";
import TeamBadge from "./TeamBadge";

interface TeamHeadToHeadProps {
  team1: string;
  team2: string;
  record: {
    total_matches?: number;
    team1_wins?: number;
    team2_wins?: number;
    ties?: number;
    team1_win_pct?: number;
  };
}

export default function TeamHeadToHead({
  team1,
  team2,
  record,
}: TeamHeadToHeadProps) {
  if (!record.total_matches) {
    return (
      <div className="card p-6 text-center">
        <p className="text-gray-500">No matches between these teams.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Match Record */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={20} className="text-yellow-500" />
          <h3 className="font-semibold">Head-to-Head Record</h3>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-500">Total Matches</p>
            <p className="text-2xl font-bold">{record.total_matches}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-blue-50 p-2 rounded">
              <p className="text-xs text-gray-600">{team1}</p>
              <p className="font-bold text-lg">{record.team1_wins}</p>
            </div>
            <div className="bg-gray-50 p-2 rounded text-center">
              <p className="text-xs text-gray-600">Ties</p>
              <p className="font-bold text-lg">{record.ties}</p>
            </div>
            <div className="bg-green-50 p-2 rounded text-right">
              <p className="text-xs text-gray-600">{team2}</p>
              <p className="font-bold text-lg">{record.team2_wins}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Win Percentage */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={20} className="text-blue-500" />
          <h3 className="font-semibold">Win Percentage</h3>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {record.team1_win_pct}%
            </div>
            <p className="text-sm text-gray-600">{team1}</p>
          </div>
        </div>
      </div>

      {/* Victory vs Defeat */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-yellow-500" />
          <h3 className="font-semibold">Match Summary</h3>
        </div>
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">{team1}</span> has won{" "}
            <span className="font-bold">{record.team1_wins}</span> out of{" "}
            <span className="font-bold">{record.total_matches}</span> matches
          </p>
          <p>
            <span className="font-medium">{team2}</span> has won{" "}
            <span className="font-bold">{record.team2_wins}</span> out of{" "}
            <span className="font-bold">{record.total_matches}</span> matches
          </p>
          {record.ties && record.ties > 0 && (
            <p>
              <span className="font-bold">{record.ties}</span> match(es)
              without a result
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
