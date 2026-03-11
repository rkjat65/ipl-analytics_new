/**
 * Renders a coloured pill for an IPL team name.
 * Colours are approximate franchise brand colours.
 */

const TEAM_COLOURS: Record<string, { bg: string; text: string }> = {
  "Mumbai Indians":               { bg: "#003B72", text: "#f0c04a" },
  "Chennai Super Kings":          { bg: "#FABB00", text: "#1a1a1a" },
  "Royal Challengers Bangalore":  { bg: "#EC1C24", text: "#ffffff" },
  "Royal Challengers Bengaluru":  { bg: "#EC1C24", text: "#ffffff" },
  "Kolkata Knight Riders":        { bg: "#3A225D", text: "#f5c518" },
  "Sunrisers Hyderabad":          { bg: "#F7A721", text: "#1a1a1a" },
  "Delhi Capitals":               { bg: "#00508F", text: "#ef4444" },
  "Delhi Daredevils":             { bg: "#00508F", text: "#ef4444" },
  "Rajasthan Royals":             { bg: "#EA1A8E", text: "#ffffff" },
  "Punjab Kings":                 { bg: "#D71920", text: "#ffffff" },
  "Kings XI Punjab":              { bg: "#D71920", text: "#ffffff" },
  "Gujarat Titans":               { bg: "#1B2A5E", text: "#a0c4ff" },
  "Lucknow Super Giants":         { bg: "#002147", text: "#f6c000" },
  "Deccan Chargers":              { bg: "#002d72", text: "#f97316" },
  "Kochi Tuskers Kerala":         { bg: "#EF7C00", text: "#ffffff" },
  "Pune Warriors":                { bg: "#023e8a", text: "#90e0ef" },
  "Rising Pune Supergiant":       { bg: "#6b21a8", text: "#e9d5ff" },
  "Rising Pune Supergiants":      { bg: "#6b21a8", text: "#e9d5ff" },
  "Gujarat Lions":                { bg: "#FF6900", text: "#ffffff" },
};

const DEFAULT = { bg: "#1e2128", text: "#a0a0a8" };

interface Props {
  team: string;
  short?: boolean;
  className?: string;
}

function abbreviate(name: string): string {
  const words = name.split(" ");
  if (words.length >= 2) return words.map(w => w[0]).join("").slice(0, 3).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

export default function TeamBadge({ team, short = false, className = "" }: Props) {
  const { bg, text } = TEAM_COLOURS[team] ?? DEFAULT;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${className}`}
      style={{ background: bg, color: text }}
    >
      {short ? abbreviate(team) : team}
    </span>
  );
}
