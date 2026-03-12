import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";

interface TeamComparisonInputProps {
  teams: string[];
  onTeamsChange: (team1: string, team2: string) => void;
  isLoading?: boolean;
}

export default function TeamComparisonInput({
  teams,
  onTeamsChange,
  isLoading = false,
}: TeamComparisonInputProps) {
  const [team1, setTeam1] = useState("");
  const [team2, setTeam2] = useState("");
  const [showTeamList, setShowTeamList] = useState(false);

  const handleTeam1Change = (value: string) => {
    setTeam1(value);
    if (value && team2 && value !== team2) {
      onTeamsChange(value, team2);
    }
  };

  const handleTeam2Change = (value: string) => {
    setTeam2(value);
    if (team1 && value && team1 !== value) {
      onTeamsChange(team1, value);
    }
  };

  const filteredTeams = (searchTerm: string, excludeTeam: string) => {
    return teams.filter(
      (t) =>
        t.toLowerCase().includes(searchTerm.toLowerCase()) && t !== excludeTeam
    );
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
      <div className="flex-1">
        <label className="block text-sm font-medium mb-2">Team 1</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search team..."
            value={team1}
            onChange={(e) => handleTeam1Change(e.target.value)}
            onFocus={() => setShowTeamList(true)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          {showTeamList && team1 && (
            <ul className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto z-10">
              {filteredTeams(team1, team2).map((t) => (
                <li
                  key={t}
                  onClick={() => {
                    handleTeam1Change(t);
                    setShowTeamList(false);
                  }}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                >
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex-1">
        <label className="block text-sm font-medium mb-2">Team 2</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search team..."
            value={team2}
            onChange={(e) => handleTeam2Change(e.target.value)}
            onFocus={() => setShowTeamList(true)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          {showTeamList && team2 && (
            <ul className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto z-10">
              {filteredTeams(team2, team1).map((t) => (
                <li
                  key={t}
                  onClick={() => {
                    handleTeam2Change(t);
                    setShowTeamList(false);
                  }}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                >
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-gray-500">
          <Search className="inline-block animate-spin mr-2" size={16} />
          Loading...
        </div>
      )}
    </div>
  );
}
