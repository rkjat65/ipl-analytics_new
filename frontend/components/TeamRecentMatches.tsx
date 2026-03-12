import React from "react";
import { Calendar, MapPin } from "lucide-react";
import TeamBadge from "./TeamBadge";

interface RecentMatch {
  match_id: string;
  season: string;
  date: string;
  venue: string;
  team1: string;
  team2: string;
  winner: string | null;
  result: string;
  toss_winner: string;
  toss_decision: string;
}

interface TeamRecentMatchesProps {
  team1: string;
  team2: string;
  matches: RecentMatch[];
}

export default function TeamRecentMatches({
  team1,
  team2,
  matches,
}: TeamRecentMatchesProps) {
  if (!matches || matches.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-gray-500">No recent matches available.</p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Matches</h3>
      <div className="space-y-4">
        {matches.map((match) => (
          <div
            key={match.match_id}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-600">
                {new Date(match.date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                Season {match.season}
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">{match.team1}</div>
              <div className="text-sm text-gray-600">vs</div>
              <div className="font-semibold">{match.team2}</div>
            </div>

            <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
              <MapPin size={14} />
              <span>{match.venue}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">{match.result}</span>
              {match.winner && (
                <span
                  className={`text-sm font-medium ${
                    match.winner === team1 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {match.winner} won
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
