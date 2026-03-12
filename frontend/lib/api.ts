/**
 * Typed API client — all calls go to /api/* which Next.js proxies
 * to the FastAPI backend at http://localhost:8000.
 */

/**
 * On the server (SSR/RSC), relative URLs don't work — we call FastAPI directly.
 * On the client, we go through the Next.js proxy at /api/*.
 */
const SERVER_BASE = "http://localhost:8000/api";
const CLIENT_BASE = "/api";

function getBase(): string {
  return typeof window === "undefined" ? SERVER_BASE : CLIENT_BASE;
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const base = getBase();
  const url  = new URL(`${base}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }

  // 10-second timeout so SSR never hangs if the backend is slow/down
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface Season { season: string }
export interface Team   { team: string }

export interface Match {
  match_id: string;
  season: string;
  date: string;
  venue: string;
  city: string;
  team1: string;
  team2: string;
  toss_winner: string;
  toss_decision: string;
  winner: string | null;
  win_by_runs: number | null;
  win_by_wickets: number | null;
  result: string;
  player_of_match: string | null;
}

export interface MatchListResponse {
  total: number;
  limit: number;
  offset: number;
  data: Match[];
}

export interface InningsSummary {
  innings_number: number;
  is_super_over: boolean;
  batting_team: string;
  bowling_team: string;
  total_runs: number;
  total_wickets: number;
  total_balls: number;
  legal_balls: number;
}

export interface BatterLine {
  innings_number: number;
  batter: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strike_rate: number;
  dismissed_by: string | null;
}

export interface BowlerLine {
  innings_number: number;
  bowler: string;
  balls: number;
  runs_conceded: number;
  wickets: number;
  economy: number;
}

export interface OverProgression {
  innings_number: number;
  over_number: number;
  runs_in_over: number;
  wickets_in_over: number;
  cumulative_runs: number;
}

export interface MatchDetail {
  match: Match;
  innings: InningsSummary[];
  batting: BatterLine[];
  bowling: BowlerLine[];
  over_progression: OverProgression[];
}

export interface KPIs {
  total_matches: number;
  total_runs: number;
  total_wickets: number;
  avg_first_innings_score: number;
  highest_team_total: number;
  total_sixes: number;
  total_fours: number;
}

export interface PhaseStats {
  phase: string;
  balls: number;
  runs: number;
  wickets: number;
  run_rate: number;
  balls_per_wicket: number;
}

export interface SeasonTrend {
  season: string;
  matches: number;
  total_runs: number;
  total_wickets: number;
  avg_first_innings_score: number;
  overall_run_rate: number;
  boundary_pct: number;
}

export interface VenueStats {
  venue: string;
  city: string;
  matches: number;
  avg_first_innings: number;
  avg_second_innings: number;
  bat_first_win_pct: number;
}

export interface TeamStats {
  team: string;
  played: number;
  wins: number;
  win_pct: number;
  toss_wins: number;
  toss_win_pct: number;
}

export interface PlayerCareer {
  innings: number;
  runs: number;
  highest_score: number;
  average: number;
  strike_rate: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  ducks: number;
}

export interface PlayerBowling {
  balls: number;
  overs: string;
  runs_conceded: number;
  wickets: number;
  economy: number;
  average: number | null;
  strike_rate: number | null;
}

export interface SeasonBatting {
  season: string;
  innings: number;
  runs: number;
  highest_score: number;
  average: number;
  strike_rate: number;
  fifties_plus: number;
}

export interface SeasonBowling {
  season: string;
  balls: number;
  runs_conceded: number;
  wickets: number;
  economy: number;
}

export interface RecentInnings {
  match_id: string;
  date: string;
  team1: string;
  team2: string;
  innings_number: number;
  runs: number;
  balls: number;
  was_dismissed: number;
  how_out: string | null;
}

export interface Dismissal {
  dismissal_kind: string;
  count: number;
}

export interface VsTeam {
  opponent: string;
  innings: number;
  runs: number;
  average: number;
  strike_rate: number;
}

export interface PlayerProfile {
  name: string;
  batting: PlayerCareer;
  bowling: PlayerBowling;
  season_batting: SeasonBatting[];
  season_bowling: SeasonBowling[];
  recent_form: RecentInnings[];
  dismissals: Dismissal[];
  vs_teams: VsTeam[];
}

export interface LeaderboardRow {
  name: string;
  innings: number;
  runs: number;
  highest_score: number;
  average: number;
  strike_rate: number;
  fifties: number;
  hundreds: number;
  ducks: number;
}

export interface BowlingLeaderboardRow {
  name: string;
  legal_balls: number;
  overs: string;
  runs_conceded: number;
  wickets: number;
  economy: number;
  average: number | null;
  strike_rate: number | null;
}

export interface DismissalType {
  dismissal_kind: string;
  count: number;
  pct: number;
}

export interface PowerplayKing {
  name: string;
  runs?: number;
  balls: number;
  strike_rate?: number;
  sixes?: number;
  legal_balls?: number;
  runs_conceded?: number;
  wickets?: number;
  economy?: number;
}

export interface RunRatePoint {
  innings_number: number;
  over_number: number;
  ball_number: number;
  ball_seq: number;
  runs_total: number;
  is_wicket: boolean;
  cumulative_runs: number;
  run_rate: number;
}

export interface HeadToHead {
  batter: string;
  bowler: string;
  balls: number;
  runs: number;
  dismissals: number | null;
  strike_rate: number | null;
  average: number | null;
}

export interface TeamHeadToHeadRecord {
  team1: string;
  team2: string;
  record: {
    total_matches?: number;
    team1_wins?: number;
    team2_wins?: number;
    ties?: number;
    team1_win_pct?: number;
  };
  recent_matches?: Match[];
  season_filter?: string | null;
}

// ─── API functions ────────────────────────────────────────────────────────

export const api = {
  // Meta
  seasons: () => get<Season[]>("/meta/seasons"),
  teams:   () => get<Team[]>("/meta/teams"),
  health:  () => get<{ status: string; database: Record<string, number> }>("/health"),

  // Matches
  matches: (params?: { season?: string; team?: string; limit?: number; offset?: number }) =>
    get<MatchListResponse>("/matches", params),
  matchSeasons: () => get<{ season: string; matches: number }[]>("/matches/seasons"),
  teamHeadToHead: (team1: string, team2: string, season?: string) =>
    get<TeamHeadToHeadRecord>(`/matches/${encodeURIComponent(team1)}/vs/${encodeURIComponent(team2)}`, { season }),
  matchDetail: (id: string) => get<MatchDetail>(`/matches/${id}`),

  // Analytics
  kpis:            (season?: string) => get<KPIs[]>("/analytics/kpis", { season }),
  phase:           (season?: string) => get<PhaseStats[]>("/analytics/phase", { season }),
  seasonTrends:    ()                => get<SeasonTrend[]>("/analytics/seasons"),
  venues:          (season?: string) => get<VenueStats[]>("/analytics/venues", { season }),
  teamStats:       (season?: string) => get<TeamStats[]>("/analytics/teams", { season }),
  dismissalTypes:  (season?: string) => get<DismissalType[]>("/analytics/dismissal-types", { season }),
  powerplayKings:  (role: "bat" | "bowl", season?: string, limit = 10) =>
    get<PowerplayKing[]>("/analytics/powerplay-kings", { role, season, limit }),
  runRateProgression: (match_id: string) =>
    get<RunRatePoint[]>("/analytics/run-rate-progression", { match_id }),

  // Players
  playerSearch:        (q: string)   => get<{ name: string }[]>("/players", { q, limit: 10 }),
  battingLeaderboard:  (params?: { season?: string; min_innings?: number; limit?: number }) =>
    get<LeaderboardRow[]>("/players/leaderboard", params),
  bowlingLeaderboard:  (params?: { season?: string; min_overs?: number; limit?: number }) =>
    get<BowlingLeaderboardRow[]>("/players/bowling-leaderboard", params),
  playerProfile: (name: string, season?: string) =>
    get<PlayerProfile>(`/players/${encodeURIComponent(name)}`, { season }),
  headToHead: (p1: string, p2: string) =>
    get<Record<string, HeadToHead>>(`/players/${encodeURIComponent(p1)}/vs/${encodeURIComponent(p2)}`),
};
