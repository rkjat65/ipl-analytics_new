import React, { useState } from "react";

interface SeasonComparisonInputProps {
  seasons: string[];
  onSeasonsChange: (season1: string, season2: string) => void;
  isLoading?: boolean;
}

export default function SeasonComparisonInput({
  seasons,
  onSeasonsChange,
  isLoading = false,
}: SeasonComparisonInputProps) {
  const [season1, setSeason1] = useState("");
  const [season2, setSeason2] = useState("");

  const handleSeason1Change = (value: string) => {
    setSeason1(value);
    if (value && season2 && value !== season2) {
      onSeasonsChange(value, season2);
    }
  };

  const handleSeason2Change = (value: string) => {
    setSeason2(value);
    if (season1 && value && season1 !== value) {
      onSeasonsChange(season1, value);
    }
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
      <div className="flex-1">
        <label className="block text-sm font-medium mb-2">Season 1</label>
        <select
          value={season1}
          onChange={(e) => handleSeason1Change(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          <option value="">Select season...</option>
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label className="block text-sm font-medium mb-2">Season 2</label>
        <select
          value={season2}
          onChange={(e) => handleSeason2Change(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          <option value="">Select season...</option>
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="text-sm text-gray-500">Loading...</div>
      )}
    </div>
  );
}
