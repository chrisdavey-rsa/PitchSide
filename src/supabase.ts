/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { UserProfile, Prediction, League, SportType, Match, ActiveCompetition } from "./types";
import type { Database, Tables, TablesInsert, TablesUpdate } from "./types/supabase";
import { getCompetitionTitle } from "./data";
import { GLOBAL_LEAGUE_ID } from "./lib/leaguesConfig";
import {
  parseSeenFeatures,
  type SeenFeatureKey,
  type SeenFeatures,
} from "./lib/seenFeatures";
import { normalizeMatchStatus } from "./lib/matchStatus";
import { formatLiveMatchClock } from "./lib/matchClock";
import {
  formatAccuracyFromBasePoints,
} from "./lib/formatAccuracy";
import type { SupportedTeamOption, TeamSport } from "./data/supportedTeams";

export { formatAccuracyPercent } from "./lib/formatAccuracy";
export type { Database, Tables, TablesInsert, TablesUpdate };
export type PitchsideClient = SupabaseClient<Database>;

/** Convenience aliases for public table rows. */
export type DbProfile = Tables<"profiles">;
export type DbMatch = Tables<"matches">;
export type DbPrediction = Tables<"predictions">;
export type DbLeague = Tables<"leagues">;
export type DbLeagueMember = Tables<"league_members">;
export type DbTeam = Tables<"teams">;
export type DbArchivedPlayer = Tables<"archived_players">;

type DbFunctions = Database["public"]["Functions"];
export type LeagueMemberPredictionRpc =
  DbFunctions["get_league_member_predictions"]["Returns"][number];
export type PlayerChipUsageRpc =
  DbFunctions["get_player_chip_usage"]["Returns"][number];

/** Client-facing archive backup shape (JSON fields parsed from archived_players). */
export type ArchivedPlayerBackup = {
  id: string;
  deletedUser: {
    nickname?: string;
    email?: string;
    firstName?: string;
    surname?: string;
    isAdmin?: boolean;
    deletedAt?: string;
    [key: string]: unknown;
  } | null;
  predictions: unknown;
  deletedAt: string | null;
};

// Retrieve environment variables and clean them of common copy-paste errors
type ViteClientEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  DEV?: boolean;
  MODE?: string;
};
const metaEnv = (import.meta as unknown as { env: ViteClientEnv }).env;
const cleanUrl = (url: string) => {
  if (!url) return "";
  const baseUrl = url.split("https://")[1] || url.split("http://")[1];
  return `https://${baseUrl.split("https://")[0].replace(/\/+$/, "")}`;
};

const rawUrl = metaEnv.VITE_SUPABASE_URL || "";
const supabaseUrl = cleanUrl(rawUrl);
const supabaseAnonKey = (metaEnv.VITE_SUPABASE_ANON_KEY || "").trim();

export const isSupabaseConfigured = () => !!(supabaseUrl && supabaseAnonKey);

export const supabase: PitchsideClient | null = isSupabaseConfigured()
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      realtime: {
        // Cap client event intake — live score ticks are small; this protects
        // free-tier Realtime quotas if a tab is left open across many fixtures.
        params: { eventsPerSecond: 10 },
      },
    })
  : null;

if (!isSupabaseConfigured()) {
  console.error(
    "CRITICAL: Supabase environment variables are not set. The app cannot function without Supabase configured. Setup VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return String(err);
}

// Connection test for UI validation
export async function testSupabaseConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase client not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: errorMessage(err) };
  }
}

// ==========================================
// DB OPERATIONS: PLAYERS/CONTESTANTS PROFILE
// ==========================================

/** Columns needed to hydrate UserProfile from profiles (no SELECT *). */
const PROFILE_LIST_COLUMNS =
  "id, first_name, surname, email, username, dob, phone, nationality, supported_team, preferred_sport, is_admin, is_verified, is_profile_public, created_at, seen_features, selected_sports, favorite_f1_team, favorite_golfer, role, golf_mulligans_available, age_confirmed_13, terms_accepted_at, privacy_accepted_at, subscribed_leagues, golf_coverage_tier, preferred_nation, favorite_teams, weekly_email_opt_in, push_enabled, email_enabled, friend_activity_opt_in, golden_tickets";

/** Match columns used by mapMatchRow — keep in sync with Match domain model. */
const MATCH_LIST_COLUMNS =
  "id, external_fixture_id, competition_id, competition_name, sport, home_team, away_team, actual_home_score, actual_away_score, kickoff_time, status, match_tag, round_name, venue_name, odds_home_win, odds_draw, odds_away_win, base_multiplier, provisional_home_score, provisional_away_score, match_minute, is_visible, is_pitchside_pick, is_golden_ticket";

const ARCHIVED_PLAYER_COLUMNS = "id, deleted_user, predictions, created_at";

const PREDICTION_USER_COLUMNS =
  "match_id, predicted_home_score, predicted_away_score, submitted, created_at, provisional_points, points_won, sport, applied_chip_id";

export async function dbFetchPlayers(): Promise<UserProfile[]> {
  const MOCK_NICKNAMES_FILTER = [
    "scrummaster", "striker99", "goalgetter", "lineoutking",
    "sidelineslicker", "flankerfan", "scraamaster", "striker 99",
    "gold getter", "lineout king",
  ];

  if (!supabase) throw new Error("Database not connected.");

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_LIST_COLUMNS)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  type ProfileRow = DbProfile;

  const activeData = data.filter(
    (d: ProfileRow) => d.username && !d.username.startsWith("freed_nick_"),
  );
  const seenIds = new Set<string>();
  const dedupedActiveData = activeData.filter((d: ProfileRow) => {
    if (!d.id || seenIds.has(d.id)) return false;
    seenIds.add(d.id);
    return true;
  });

  const mapped = dedupedActiveData.map((d: ProfileRow) => ({
    id: d.id!,
    firstName: d.first_name || "",
    surname: d.surname || "",
    email: d.email || "",
    dob: d.dob || "2000-01-01",
    nickname: d.username || "Contestant",
    phone: d.phone || "",
    createdAt: d.created_at || new Date().toISOString(),
    emailVerified: d.is_verified ?? false,
    isAdmin: Boolean(d.is_admin),
    agreedToTerms: Boolean(d.terms_accepted_at),
    nationality: d.nationality || "United Kingdom",
    supportedTeam: d.supported_team || "None",
    preferredSport: d.preferred_sport as SportType | undefined,
    selectedSports: Array.isArray(d.selected_sports)
      ? (d.selected_sports as UserProfile["selectedSports"])
      : undefined,
    favoriteF1Team: d.favorite_f1_team ?? null,
    favoriteGolfer: d.favorite_golfer ?? null,
    role: d.role ?? null,
    golfMulligansAvailable: d.golf_mulligans_available ?? null,
    subscribedLeagues: Array.isArray(d.subscribed_leagues)
      ? d.subscribed_leagues.map(String)
      : [],
    golfCoverageTier: (d.golf_coverage_tier as UserProfile["golfCoverageTier"]) ||
      "MAJORS_ONLY",
    preferredNation: d.preferred_nation ?? null,
    favoriteTeams: Array.isArray(d.favorite_teams)
      ? d.favorite_teams.map(String)
      : undefined,
    pushEnabled: d.push_enabled ?? undefined,
    emailEnabled: d.email_enabled ?? undefined,
    friendActivityOptIn: d.friend_activity_opt_in ?? undefined,
    weeklyEmailOptIn: d.weekly_email_opt_in ?? undefined,
    goldenTickets: Number(d.golden_tickets ?? 0),
    isProfilePublic: d.is_profile_public ?? undefined,
    seenFeatures: parseSeenFeatures(d.seen_features),
  }));

  return mapped.filter((item) => !MOCK_NICKNAMES_FILTER.includes(item.nickname.toLowerCase()));
}

export async function dbCreatePlayer(profile: UserProfile): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const payload = {
    id: profile.id,
    first_name: profile.firstName,
    surname: profile.surname,
    email: profile.email.toLowerCase(),
    username: profile.nickname,
    dob: profile.dob,
    nationality: profile.nationality || "United Kingdom",
    supported_team: profile.supportedTeam || "None",
    preferred_sport: profile.preferredSport || null,
    is_admin: Boolean(profile.isAdmin),
    is_verified: profile.emailVerified,
    created_at: profile.createdAt || new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) throw error;
}

/** Persist tournament opt-in preferences. */
export async function dbUpdateTournamentSubscriptions(
  userId: string,
  opts: {
    subscribedLeagues: string[];
    golfCoverageTier?: UserProfile["golfCoverageTier"];
    preferredNation?: string | null;
  },
): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const payload: TablesUpdate<"profiles"> = {
    subscribed_leagues: opts.subscribedLeagues,
  };
  if (opts.golfCoverageTier) {
    payload.golf_coverage_tier = opts.golfCoverageTier;
  }
  if (opts.preferredNation !== undefined) {
    payload.preferred_nation = opts.preferredNation;
  }
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}

/** Read profiles.seen_features for walkthrough / tutorial gating. */
export async function dbFetchSeenFeatures(userId: string): Promise<SeenFeatures> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("profiles")
    .select("seen_features")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return parseSeenFeatures(data?.seen_features);
}

/**
 * Mark a feature as seen (JSONB merge). Safe to call repeatedly.
 * Returns the updated map.
 */
export async function dbMarkFeatureSeen(
  userId: string,
  featureKey: SeenFeatureKey,
): Promise<SeenFeatures> {
  if (!supabase) throw new Error("Database not connected.");

  const current = await dbFetchSeenFeatures(userId);
  if (current[featureKey]) return current;

  const next: SeenFeatures = { ...current, [featureKey]: true };
  const { data, error } = await supabase
    .from("profiles")
    .update({ seen_features: next })
    .eq("id", userId)
    .select("seen_features")
    .maybeSingle();

  if (error) throw error;
  return parseSeenFeatures(data?.seen_features ?? next);
}

export async function dbUpdatePlayerAdmin(userId: string, isAdmin: boolean): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const { error } = await supabase.from("profiles").update({ is_admin: isAdmin }).eq("id", userId);
  if (error) throw error;
}

export async function dbDeletePlayerAccount(userId: string, email: string): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const { data: currentProfile } = await supabase.from("profiles").select("username").eq("id", userId).single();
  const currentNickname = currentProfile?.username || "Contestant";

  const { error } = await supabase
    .from("profiles")
    .update({
      email: `freed_${userId}_${email.toLowerCase()}`,
      username: `freed_nick_${userId}_${currentNickname}`,
      is_verified: false,
    })
    .eq("id", userId);

  if (error) throw error;
}

// ==========================================
// DB OPERATIONS: PREDICTIONS & OUTCOMES
// ==========================================

export type PredictionEntry = {
  home: number;
  away: number;
  submitted: boolean;
  /** ISO timestamp when the prediction was locked (predictions.created_at). */
  lockedAt?: string;
  /** Live "As It Stands" points while the match is in play. */
  provisionalPoints?: number;
  /** Settled points after FT (predictions.points_won). */
  pointsWon?: number | null;
  /** Attached chip instance id (consumed at lock). */
  appliedChipId?: string | null;
};

export type MatchConsensus = {
  total: number;
  home: number;
  draw: number;
  away: number;
};

/** Aggregate submitted picks for a fixture (threshold UI uses total >= 20). */
export async function dbFetchMatchConsensus(
  matchId: string,
): Promise<MatchConsensus> {
  if (!supabase) return { total: 0, home: 0, draw: 0, away: 0 };
  const { data, error } = await supabase.rpc("get_match_prediction_consensus", {
    p_match_id: matchId,
  });
  if (error || !data || typeof data !== "object") {
    return { total: 0, home: 0, draw: 0, away: 0 };
  }
  const row = data as Record<string, unknown>;
  return {
    total: Number(row.total) || 0,
    home: Number(row.home) || 0,
    draw: Number(row.draw) || 0,
    away: Number(row.away) || 0,
  };
}

export async function dbFetchPredictions(
  userId: string,
): Promise<Record<string, PredictionEntry>> {
  if (!supabase) throw new Error("Database not connected.");
  const { data, error } = await supabase
    .from("predictions")
    .select(PREDICTION_USER_COLUMNS)
    .eq("user_id", userId);
  if (error) throw error;

  const result: Record<string, PredictionEntry> = {};
  if (data) {
    data.forEach((p: {
      match_id: string;
      predicted_home_score: number;
      predicted_away_score: number;
      submitted?: boolean | null;
      created_at?: string | null;
      provisional_points?: number | null;
      points_won?: number | null;
      applied_chip_id?: string | null;
    }) => {
      result[p.match_id] = {
        home: p.predicted_home_score,
        away: p.predicted_away_score,
        submitted: p.submitted ?? false,
        lockedAt: p.submitted ? p.created_at ?? undefined : undefined,
        provisionalPoints: p.provisional_points ?? 0,
        pointsWon: p.points_won != null ? Number(p.points_won) : null,
        appliedChipId: p.applied_chip_id ?? null,
      };
    });
  }
  return result;
}

/** Submitted prediction rows for league standings (sport + horizon aggregation). */
export type LeagueSubmittedPredictionRow = {
  userId: string;
  matchId: string;
  sport: SportType;
  home: number;
  away: number;
  submitted: boolean;
  /** Settled / chip-adjusted points (0 is valid). */
  pointsWon: number | null;
  chipType?: string | null;
};

function mapChipType(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  return raw;
}

export async function dbFetchLeagueSubmittedPredictions(
  userIds: string[],
): Promise<LeagueSubmittedPredictionRow[]> {
  if (!supabase) throw new Error("Database not connected.");
  if (userIds.length === 0) return [];

  const { data, error } = await supabase
    .from("predictions")
    .select(
      "user_id, match_id, sport, predicted_home_score, predicted_away_score, submitted, points_won, applied_chip_id",
    )
    .in("user_id", userIds)
    .eq("submitted", true);

  if (error) throw error;

  return (data || []).map((p) => ({
    userId: p.user_id as string,
    matchId: p.match_id as string,
    sport: (p.sport as SportType) || SportType.FOOTBALL,
    home: Number(p.predicted_home_score) || 0,
    away: Number(p.predicted_away_score) || 0,
    submitted: true,
    pointsWon: p.points_won != null ? Number(p.points_won) : null,
    chipType: null,
  }));
}

/**
 * Submitted predictions for every member of a league (SECURITY DEFINER RPC).
 * Required because predictions RLS is own-row only.
 * `points_won` is settle+chip earned points for completed fixtures
 * (same engine as get_global_leaderboard).
 */
export async function dbFetchLeagueMemberPredictions(
  leagueId: string,
  sinceIso?: string,
): Promise<LeagueSubmittedPredictionRow[]> {
  if (!supabase) throw new Error("Database not connected.");
  if (!leagueId) return [];

  const { data, error } = await supabase.rpc("get_league_member_predictions", {
    p_league_id: leagueId,
    ...(sinceIso ? { p_since: sinceIso } : {}),
  });

  if (error) throw error;

  // Temporary diagnostics for league points vs global discrepancy.
  const metaEnv = (import.meta as { env?: { DEV?: boolean } }).env;
  if (metaEnv?.DEV) {
    console.log("League Data Payload:", data);
  }

  return (data || []).map((p: LeagueMemberPredictionRpc) => ({
    userId: String(p.user_id),
    matchId: String(p.match_id),
    sport: (p.sport as SportType) || SportType.FOOTBALL,
    home: Number(p.predicted_home_score) || 0,
    away: Number(p.predicted_away_score) || 0,
    submitted: p.submitted !== false,
    // Include 0 — do not treat as missing.
    pointsWon: p.points_won != null ? Number(p.points_won) : null,
    chipType: mapChipType(p.chip_type),
  }));
}

/**
 * Per-user, per-match provisional points for currently live fixtures.
 * Cached as a matrix so realtime can patch a single cell without refetching.
 */
export type LiveProvisionalMatrix = Record<string, Record<string, number>>;

export async function dbFetchLiveProvisionalMatrix(
  liveMatchIds: string[],
): Promise<LiveProvisionalMatrix> {
  if (!supabase || liveMatchIds.length === 0) return {};

  const { data, error } = await supabase
    .from("predictions")
    .select("user_id, provisional_points, match_id")
    .in("match_id", liveMatchIds)
    .gt("provisional_points", 0);
  if (error) throw error;

  const matrix: LiveProvisionalMatrix = {};
  (data || []).forEach((row) => {
    const uid = row.user_id ?? undefined;
    const matchId = row.match_id ?? undefined;
    if (!uid || !matchId) return;
    const pts = Number(row.provisional_points) || 0;
    if (pts <= 0) return;
    (matrix[uid] ??= {})[matchId] = pts;
  });
  return matrix;
}

/** Sum matrix rows into per-user totals for leaderboard badges. */
export function sumLiveProvisionalMatrix(
  matrix: LiveProvisionalMatrix,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const [uid, byMatch] of Object.entries(matrix)) {
    const sum = Object.values(byMatch).reduce((a, b) => a + b, 0);
    if (sum > 0) totals[uid] = sum;
  }
  return totals;
}

/**
 * Sum of provisional_points per user for currently live matches.
 * Powers the amber "+X (Live)" badges on the leaderboard.
 */
export async function dbFetchLiveProvisionalByUser(
  liveMatchIds: string[],
): Promise<Record<string, number>> {
  return sumLiveProvisionalMatrix(await dbFetchLiveProvisionalMatrix(liveMatchIds));
}

/** Thrown / matched when kickoff lock has passed (DB trigger). */
export const PREDICTION_EVENT_LOCKED_MESSAGE =
  "Event locked. Predictions can no longer be submitted.";

export async function dbSavePrediction(userId: string, matchId: string, sport: SportType, compId: string, homeScore: number, awayScore: number, submitted: boolean): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const payload = {
    id: `${userId}_${matchId}`,
    user_id: userId,
    match_id: matchId,
    sport: sport,
    competition_id: compId,
    season: "2026",
    predicted_home_score: homeScore,
    predicted_away_score: awayScore,
    submitted: submitted,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("predictions").upsert(payload, { onConflict: "id" });
  if (error) {
    if (/event locked|predictions can no longer be submitted/i.test(error.message || "")) {
      throw new Error(PREDICTION_EVENT_LOCKED_MESSAGE);
    }
    throw error;
  }
}

/**
 * Lock a prediction and optionally consume a user_chips row (atomic RPC).
 */
export async function dbLockPrediction(
  userId: string,
  matchId: string,
  sport: SportType,
  compId: string,
  homeScore: number,
  awayScore: number,
  chipId?: string | null,
): Promise<{ applied_chip_id: string | null; consumed: boolean }> {
  if (!supabase) throw new Error("Database not connected.");

  // Column is `match_id` (fixture id). Validate before hitting PostgREST/RPC.
  if (!userId?.trim()) throw new Error("Missing user_id — cannot lock prediction.");
  if (!matchId?.trim()) {
    throw new Error("Missing fixture_id / match_id — cannot lock prediction.");
  }
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
    throw new Error("Invalid home_score / away_score — cannot lock prediction.");
  }

  const payload = {
    p_user_id: userId,
    p_match_id: matchId,
    p_sport: sport,
    p_competition_id: compId || "unknown",
    p_home: Math.max(0, Math.trunc(homeScore)),
    p_away: Math.max(0, Math.trunc(awayScore)),
    p_chip_id: chipId ?? null,
  };

  console.info("[dbLockPrediction] upsert lock", {
    user_id: payload.p_user_id,
    fixture_id: payload.p_match_id,
    home_score: payload.p_home,
    away_score: payload.p_away,
    sport: payload.p_sport,
    competition_id: payload.p_competition_id,
    chip_id: payload.p_chip_id,
  });

  const { data, error } = await supabase.rpc(
    "pitchside_lock_prediction",
    payload,
  );

  if (error) {
    console.error("[dbLockPrediction] RPC failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      payload,
    });
    if (/event locked|predictions can no longer be submitted/i.test(error.message || "")) {
      throw new Error(PREDICTION_EVENT_LOCKED_MESSAGE);
    }
    if (/row-level security|rls|not authorised|permission denied/i.test(error.message || "")) {
      throw new Error(`Prediction blocked (RLS / auth): ${error.message}`);
    }
    throw error;
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    applied_chip_id: (row.applied_chip_id as string) ?? null,
    consumed: Boolean(row.consumed),
  };
}

export type UserChipRow = {
  id: string;
  chip_type: string;
  sport_type: string;
  sport_season_id: string;
  status: "available" | "used" | "expired";
  earned_at: string | null;
  used_at: string | null;
  applied_fixture_id: string | null;
};

export async function dbFetchUserChips(
  userId: string,
  sportType?: string,
): Promise<UserChipRow[]> {
  if (!supabase) return [];
  let query = supabase
    .from("user_chips")
    .select(
      "id, chip_type, sport_type, sport_season_id, status, earned_at, used_at, applied_fixture_id",
    )
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  if (sportType) {
    query = query.eq(
      "sport_type",
      sportType as Database["public"]["Enums"]["chip_sport_type"],
    );
  }

  const { data, error } = await query;
  if (error) {
    console.warn("Failed to fetch user_chips:", error.message);
    return [];
  }
  return (data ?? []) as UserChipRow[];
}

export async function dbEnsureBaselineChips(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("grant_baseline_double_bubble", {
    p_user_id: userId,
  });
  if (error) {
    console.warn("grant_baseline_double_bubble:", error.message);
  }
}

// ==========================================
// DB OPERATIONS: MATCH MANAGEMENT
// ==========================================

/** Sliding prediction window — upcoming fixtures within this many days. */
export const MATCH_HORIZON_DAYS = 9;
/** Completed fixtures window for league standings (avoids full-table downloads). */
export const STANDINGS_COMPLETED_HORIZON_DAYS = 180;

function resolveCompetitionName(
  competitionId: string | null | undefined,
  storedName?: string | null,
): string {
  // Prefer canonical dictionary over raw API provider strings.
  return getCompetitionTitle(competitionId, storedName);
}

function isWithinMatchHorizon(
  match: Pick<Match, "matchDate" | "status">,
  horizonDays: number,
  now = new Date(),
): boolean {
  if (match.status === "live") return true;
  const kickoff = new Date(match.matchDate).getTime();
  if (Number.isNaN(kickoff)) return false;
  const start = now.getTime() - horizonDays * 24 * 60 * 60 * 1000;
  const end = now.getTime() + horizonDays * 24 * 60 * 60 * 1000;
  return kickoff >= start && kickoff <= end;
}

/** Client-side horizon slice for merged DB + local fixture lists. */
export function filterMatchesToHorizon(
  matches: Match[],
  horizonDays: number = MATCH_HORIZON_DAYS,
): Match[] {
  return matches.filter((match) => isWithinMatchHorizon(match, horizonDays));
}

/** Map a raw matches row into the Match domain model (including live fields). */
export function mapMatchRow(
  d: Partial<DbMatch> | Record<string, unknown>,
): Match {
  const row = d as Partial<DbMatch> & Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    competitionId: String(row.competition_id ?? ""),
    competitionName: getCompetitionTitle(
      row.competition_id ?? undefined,
      row.competition_name ?? undefined,
    ),
    sport: row.sport as SportType,
    homeTeam: String(row.home_team ?? ""),
    awayTeam: String(row.away_team ?? ""),
    homeScore: row.actual_home_score != null ? Number(row.actual_home_score) : undefined,
    awayScore: row.actual_away_score != null ? Number(row.actual_away_score) : undefined,
    matchDate: String(row.kickoff_time ?? ""),
    status: normalizeMatchStatus(
      typeof row.status === "string" ? row.status : String(row.status ?? "upcoming"),
    ),
    season: undefined,
    matchTag: row.match_tag || undefined,
    roundName: row.round_name || undefined,
    venueName: row.venue_name || undefined,
    oddsHomeWin: row.odds_home_win != null ? Number(row.odds_home_win) : undefined,
    oddsDraw: row.odds_draw != null ? Number(row.odds_draw) : undefined,
    oddsAwayWin: row.odds_away_win != null ? Number(row.odds_away_win) : undefined,
    baseMultiplier: row.base_multiplier != null ? Number(row.base_multiplier) : undefined,
    provisionalHomeScore:
      row.provisional_home_score != null ? Number(row.provisional_home_score) : undefined,
    provisionalAwayScore:
      row.provisional_away_score != null ? Number(row.provisional_away_score) : undefined,
    matchMinute:
      formatLiveMatchClock({
        status:
          typeof row.status === "string" ? row.status : String(row.status ?? ""),
        matchMinute:
          typeof row.match_minute === "string"
            ? row.match_minute
            : row.match_minute != null
              ? String(row.match_minute)
              : null,
      }) ?? undefined,
    isVisible: row.is_visible !== false,
    isPitchsidePick: row.is_pitchside_pick === true,
    isGoldenTicket: row.is_golden_ticket === true,
  };
}

export type FetchMatchesOptions = {
  /**
   * Restrict to live fixtures + kickoffs inside the sliding window.
   * Pass `null` for an unfiltered admin/history fetch.
   * Default: {@link MATCH_HORIZON_DAYS}.
   */
  horizonDays?: number | null;
  /**
   * When true (default), only return matches with is_visible !== false.
   * Admin tooling should pass `false` to see hidden / opted-out fixtures.
   */
  visibleOnly?: boolean;
  /** Optional PostgREST status filter (`completed`, `live`, …). */
  status?: string | string[];
};

export async function dbFetchMatches(
  options: FetchMatchesOptions = {},
): Promise<Match[]> {
  if (!supabase) throw new Error("Database not connected.");
  const horizonDays =
    options.horizonDays === undefined ? MATCH_HORIZON_DAYS : options.horizonDays;
  const visibleOnly = options.visibleOnly !== false;
  const statusFilter = options.status;

  // Detach from PostgREST's recursive builder generics (TS2589) while filtering.
  type LooseMatchQuery = {
    eq: (column: string, value: unknown) => LooseMatchQuery;
    in: (column: string, values: readonly string[]) => LooseMatchQuery;
    order: (
      column: string,
      options: { ascending: boolean },
    ) => LooseMatchQuery;
  };

  const applyFilters = <T>(query: T): T => {
    let q = query as unknown as LooseMatchQuery;
    if (visibleOnly) q = q.eq("is_visible", true);
    if (statusFilter) {
      q = Array.isArray(statusFilter)
        ? q.in("status", statusFilter)
        : q.eq("status", statusFilter);
    }
    return q.order("kickoff_time", { ascending: true }) as T;
  };

  // Unbounded / status-scoped fetch (admin, standings) — still filtered in PostgREST.
  if (horizonDays == null) {
    const { data, error } = await applyFilters(
      supabase.from("matches").select(MATCH_LIST_COLUMNS),
    );
    if (error) throw error;
    return (data || []).map((row) => mapMatchRow(row));
  }

  const now = new Date();
  // Symmetric window: look back `horizonDays` so week/month standings and
  // Game History (3d UI slice) have enough settled fixtures available.
  const start = new Date(
    now.getTime() - horizonDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const end = new Date(
    now.getTime() + horizonDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Two targeted queries (kickoff window + live) instead of SELECT * + JS filter.
  const [windowRes, liveRes] = await Promise.all([
    applyFilters(
      supabase
        .from("matches")
        .select(MATCH_LIST_COLUMNS)
        .gte("kickoff_time", start)
        .lte("kickoff_time", end),
    ),
    // Skip redundant live fetch when caller already constrained status away from live.
    statusFilter &&
      !(Array.isArray(statusFilter) ? statusFilter.includes("live") : statusFilter === "live")
      ? Promise.resolve({ data: [] as Partial<DbMatch>[], error: null })
      : applyFilters(supabase.from("matches").select(MATCH_LIST_COLUMNS).eq("status", "live")),
  ]);

  if (windowRes.error) throw windowRes.error;
  if (liveRes.error) throw liveRes.error;

  const byId = new Map<string, Match>();
  for (const row of [...(windowRes.data || []), ...(liveRes.data || [])]) {
    const mapped = mapMatchRow(row);
    byId.set(mapped.id, mapped);
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.matchDate.localeCompare(b.matchDate),
  );
}

/**
 * Distinct competitions that currently have live or upcoming fixtures
 * inside the prediction horizon. Dashboard filter chips are driven by this —
 * never by a hardcoded tournament catalog.
 */
export async function dbFetchActiveCompetitions(
  options: FetchMatchesOptions = {},
): Promise<ActiveCompetition[]> {
  const matches = await dbFetchMatches(options);
  const byKey = new Map<string, ActiveCompetition>();

  for (const match of matches) {
    if (!match.competitionId) continue;
    if (match.status === "completed") continue;
    // Horizon fetch already keeps live + upcoming; keep completed out of chips.
    const key = `${match.sport}::${match.competitionId}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      competitionId: match.competitionId,
      competitionName: resolveCompetitionName(
        match.competitionId,
        match.competitionName,
      ),
      sportType: match.sport,
    });
  }

  return Array.from(byKey.values()).sort((a, b) =>
    a.competitionName.localeCompare(b.competitionName),
  );
}

export async function dbSaveMatch(match: Match): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");

  const payload = {
    id: match.id,
    competition_id: match.competitionId,
    competition_name: match.competitionName || null,
    sport: match.sport,
    home_team: match.homeTeam,
    away_team: match.awayTeam,
    actual_home_score: match.homeScore ?? null,
    actual_away_score: match.awayScore ?? null,
    kickoff_time: match.matchDate,
    status: match.status,
    is_visible: match.isVisible !== false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("matches").upsert(payload, {
    onConflict: "id",
  });

  if (error) {
    const parts = [
      error.message,
      error.details,
      error.hint,
      error.code ? `code ${error.code}` : null,
    ].filter(Boolean);
    throw new Error(parts.join(" — ") || "Database rejected the fixture write.");
  }
}

/** Instantly toggle whether a fixture is shown in player-facing feeds. */
export async function dbSetMatchVisibility(
  matchId: string,
  isVisible: boolean,
): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const { error } = await supabase
    .from("matches")
    .update({
      is_visible: isVisible,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) throw error;
}

// ==========================================
// DB OPERATIONS: LEAGUE MANAGEMENT
// ==========================================

/**
 * Explicit league columns for client reads — never include `password`.
 * Join secrets are verified only inside `join_league_secure` RPC.
 */
const LEAGUE_PUBLIC_COLUMNS =
  "id, name, competition_id, creator_id, creator_name, is_private, is_public, max_players, max_participants, season, is_archived, created_at, updated_at";

/** Public league columns selected by client reads (never includes password). */
type LeaguePublicRow = Pick<
  DbLeague,
  | "id"
  | "name"
  | "competition_id"
  | "creator_id"
  | "creator_name"
  | "is_private"
  | "is_public"
  | "max_players"
  | "max_participants"
  | "season"
  | "is_archived"
  | "created_at"
  | "updated_at"
>;

/** Map a raw leagues row. Never reads the deprecated JSONB `members` column. */
function mapLeagueRow(d: LeaguePublicRow, members: string[] = []): League {
  const isPrivate =
    typeof d.is_private === "boolean"
      ? d.is_private
      : !(d.is_public ?? true);

  const isGlobal = d.id === GLOBAL_LEAGUE_ID;
  const maxPlayers = isGlobal
    ? null
    : Math.min(
        20,
        Math.max(1, Number(d.max_players ?? d.max_participants ?? 20) || 20),
      );

  return {
    id: d.id,
    name: d.name,
    // Password is never selected from Postgres for client payloads.
    password: "",
    competitionId: d.competition_id ?? null,
    creatorId: d.creator_id,
    creatorName: d.creator_name,
    members,
    isPrivate,
    isPublic: !isPrivate,
    maxPlayers,
    maxParticipants: maxPlayers,
    season: d.season || undefined,
    // Strict true only — null/undefined/false all count as active.
    isArchived: d.is_archived === true,
    createdAt: d.created_at || new Date().toISOString(),
    updatedAt: d.updated_at || new Date().toISOString(),
  };
}

export type FetchLeaguesOptions = {
  /** When set, private leagues are only returned if this user is already a member. */
  viewerUserId?: string | null;
  /** Admin / ops: return every league including private ones. */
  includeAllPrivate?: boolean;
  /** Admin: include soft-deleted (archived) leagues. Default false for player UIs. */
  includeArchived?: boolean;
};

export async function dbFetchLeagues(
  options: FetchLeaguesOptions = {},
): Promise<League[]> {
  if (!supabase) throw new Error("Database not connected.");
  let query = supabase
    .from("leagues")
    .select(LEAGUE_PUBLIC_COLUMNS)
    .order("created_at", { ascending: false });

  // Player-facing default: only active leagues.
  if (!options.includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Hydrate membership strictly from league_members — ignore deprecated JSONB.
  const membership = await dbFetchLeaguesMembership(data.map((d) => d.id));
  const mapped = data.map((d) => mapLeagueRow(d, membership[d.id] || []));

  if (options.includeAllPrivate) return mapped;

  const viewer = options.viewerUserId ?? null;
  return mapped.filter((league) => {
    if (!league.isPrivate) return true;
    if (!viewer) return false;
    return (league.members ?? []).includes(viewer);
  });
}

/** Fetch a single league by id (invite / join deep-links). Archived → null. */
export async function dbFetchLeagueById(leagueId: string): Promise<League | null> {
  if (!supabase) throw new Error("Database not connected.");
  const { data, error } = await supabase
    .from("leagues")
    .select(LEAGUE_PUBLIC_COLUMNS)
    .eq("id", leagueId)
    .eq("is_archived", false)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const membership = await dbFetchLeaguesMembership([leagueId]);
  return mapLeagueRow(data, membership[leagueId] || []);
}

export async function dbCreateLeague(league: League): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const isPrivate = league.isPrivate ?? !(league.isPublic ?? true);
  const rawMax = league.maxPlayers ?? league.maxParticipants;
  const maxPlayers =
    rawMax == null
      ? 20
      : Math.min(20, Math.max(1, Number(rawMax) || 20));
  const payload = {
    id: league.id,
    name: league.name,
    password: league.password || "",
    // New Game Rules: social leagues are not locked to one competition.
    competition_id: league.competitionId ?? null,
    creator_id: league.creatorId,
    creator_name: league.creatorName,
    is_private: isPrivate,
    is_public: !isPrivate,
    max_players: maxPlayers,
    max_participants: maxPlayers,
    season: league.season || null,
    is_archived: false,
    created_at: league.createdAt || new Date().toISOString(),
    updated_at: league.updatedAt || new Date().toISOString(),
  };

  const { error } = await supabase.from("leagues").upsert(payload);
  if (error) throw error;
  await dbJoinLeague(league.id, league.creatorId, league.password || "");
}

export async function dbUpdateLeagueSettings(
  leagueId: string,
  settings: {
    isPrivate: boolean;
    maxPlayers: number;
    password?: string;
  },
): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const maxPlayers = Math.min(20, Math.max(1, settings.maxPlayers));
  const payload: TablesUpdate<"leagues"> = {
    is_private: settings.isPrivate,
    is_public: !settings.isPrivate,
    max_players: maxPlayers,
    max_participants: maxPlayers,
    updated_at: new Date().toISOString(),
  };
  if (typeof settings.password === "string") {
    payload.password = settings.password;
  }

  const { error } = await supabase.from("leagues").update(payload).eq("id", leagueId);
  if (error) throw error;
}

/** Soft-delete: archive a league (avoids FK hard-delete failures). */
export async function dbArchiveLeague(leagueId: string): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  try {
    // PreferReturning: RLS can silently update 0 rows with no error — verify.
    const { data, error } = await supabase
      .from("leagues")
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq("id", leagueId)
      .select("id, is_archived")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error(
        "Archive failed: no row updated. Confirm is_archived exists and RLS allows admin UPDATE on leagues.",
      );
    }
    if (data.is_archived !== true) {
      throw new Error("Archive failed: league was not marked archived in the database.");
    }
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(
      typeof err === "string" ? err : "Network error: Could not connect to the database.",
    );
  }
}

/** Restore a previously archived league. */
export async function dbUnarchiveLeague(leagueId: string): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  try {
    const { data, error } = await supabase
      .from("leagues")
      .update({ is_archived: false, updated_at: new Date().toISOString() })
      .eq("id", leagueId)
      .select("id, is_archived")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error(
        "Unarchive failed: no row updated. Confirm RLS allows admin UPDATE on leagues.",
      );
    }
    if (data.is_archived === true) {
      throw new Error("Unarchive failed: league is still marked archived.");
    }
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(
      typeof err === "string" ? err : "Network error: Could not connect to the database.",
    );
  }
}

/** @deprecated Prefer dbArchiveLeague — hard delete is blocked by membership FKs. */
export async function dbDeleteLeague(leagueId: string): Promise<void> {
  return dbArchiveLeague(leagueId);
}

/** Admin patch for league name / privacy / cap / password. */
export async function dbAdminUpdateLeague(
  leagueId: string,
  patch: {
    name?: string;
    isPrivate?: boolean;
    maxPlayers?: number;
    password?: string;
  },
): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const payload: TablesUpdate<"leagues"> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof patch.name === "string") {
    payload.name = patch.name.trim();
  }
  if (typeof patch.isPrivate === "boolean") {
    payload.is_private = patch.isPrivate;
    payload.is_public = !patch.isPrivate;
  }
  if (typeof patch.maxPlayers === "number") {
    const maxPlayers = Math.min(20, Math.max(1, patch.maxPlayers));
    payload.max_players = maxPlayers;
    payload.max_participants = maxPlayers;
  }
  if (typeof patch.password === "string") {
    payload.password = patch.password;
  }

  const { error } = await supabase.from("leagues").update(payload).eq("id", leagueId);
  if (error) throw error;
}

/**
 * @deprecated Password is never returned to the client. Prefer `dbJoinLeague`
 * which verifies via `join_league_secure`. Kept as a thin existence check.
 */
export async function dbFetchLeagueByIdAndPassword(
  leagueId: string,
  _password: string,
): Promise<League | null> {
  return dbFetchLeagueById(leagueId);
}

/**
 * Fetch a league join password for Invite Friend links.
 * Server only returns the secret when `auth.uid()` is a league member.
 */
export async function dbGetLeaguePassword(leagueId: string): Promise<string> {
  if (!supabase) throw new Error("Database not connected.");
  const { data, error } = await supabase.rpc("get_league_password", {
    _league_id: leagueId,
  });
  if (error) {
    throw new Error(error.message || "Unable to fetch league password.");
  }
  return typeof data === "string" ? data : "";
}

/**
 * Join a league via `join_league_secure` RPC (server-side password check + insert).
 * Direct client INSERT into `league_members` is blocked by RLS.
 */
export async function dbJoinLeague(
  leagueId: string,
  userId: string,
  password: string = "",
): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");

  const { error } = await supabase.rpc("join_league_secure", {
    _league_id: leagueId,
    _user_id: userId,
    _password: password,
  });

  if (!error) return;

  const message = error.message || "Failed to join league.";
  if (/incorrect password/i.test(message)) {
    throw new Error("Incorrect password");
  }
  if (/league not found/i.test(message)) {
    throw new Error("League not found");
  }
  if (/league is full/i.test(message)) {
    throw new Error("League is full");
  }
  if (/duplicate|unique|already/i.test(message) || error.code === "23505") {
    return;
  }
  throw new Error(message);
}

export async function dbLeaveLeague(leagueId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const { error } = await supabase.from("league_members").delete().eq("league_id", leagueId).eq("user_id", userId);
  if (error) throw error;
}

export async function dbFetchUserLeagues(userId: string): Promise<League[]> {
  if (!supabase) throw new Error("Database not connected.");

  // Step 1: membership rows for this user (no PostgREST embed — avoids FK/join failures).
  const { data: membershipRows, error: memError } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId);
  if (memError) throw memError;

  const leagueIds = Array.from(
    new Set((membershipRows || []).map((r) => r.league_id).filter(Boolean)),
  );
  if (leagueIds.length === 0) return [];

  // Step 2: fetch active league records only (archived are hidden from players).
  const { data: leagueRows, error: leagueError } = await supabase
    .from("leagues")
    .select(LEAGUE_PUBLIC_COLUMNS)
    .in("id", leagueIds)
    .eq("is_archived", false);
  if (leagueError) throw leagueError;

  // Step 3: hydrate full member lists from league_members (not the deprecated JSONB).
  const activeIds = (leagueRows || []).map((d) => d.id);
  const membership = await dbFetchLeaguesMembership(activeIds);
  return (leagueRows || []).map((d) => mapLeagueRow(d, membership[d.id] || []));
}

/**
 * Fetch the member user-ids for several leagues in a single round-trip.
 * Returns a map of leagueId -> array of member user-ids. Used to pick the
 * user's most populated private league for the dashboard "My League" tab and
 * to scope the leaderboard to that league's members.
 */
/** Cached API-Sports teams for the profile / signup team picker. */
export async function dbFetchTeams(): Promise<SupportedTeamOption[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("teams")
    .select("id, name, type, country_code, api_sports_id, sport")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data || []).map((row): SupportedTeamOption => {
    const sportDb = String(row.sport || "").toLowerCase();
    const sport: TeamSport = sportDb === "rugby" ? "Rugby" : "Football";
    return {
      id: row.id,
      name: row.name || "",
      sport,
      category: row.type === "club" ? "club" : "country",
      countryCode: row.country_code || undefined,
      apiSportsId: row.api_sports_id ?? null,
    };
  });
}

export async function dbFetchLeaguesMembership(
  leagueIds: string[],
): Promise<Record<string, string[]>> {
  if (!supabase || leagueIds.length === 0) return {};
  const { data, error } = await supabase
    .from("league_members")
    .select("league_id, user_id")
    .in("league_id", leagueIds);
  if (error) throw error;

  const map: Record<string, string[]> = {};
  (data || []).forEach((row) => {
    if (!map[row.league_id]) map[row.league_id] = [];
    map[row.league_id].push(row.user_id);
  });
  return map;
}

export async function dbFetchLeagueMembers(leagueId: string): Promise<UserProfile[]> {
  if (!supabase) throw new Error("Database not connected.");

  // Fetch membership IDs and profiles separately so a missing/ambiguous FK
  // never empties the member list (same pattern as the admin Predictions fix).
  const { data: memberRows, error: memError } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);
  if (memError) throw memError;

  const userIds = Array.from(
    new Set((memberRows || []).map((r) => r.user_id).filter(Boolean)),
  );
  if (userIds.length === 0) return [];

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_LIST_COLUMNS)
    .in("id", userIds);
  if (profileError) throw profileError;

  const profileMap: Record<string, DbProfile> = {};
  (profileRows || []).forEach((p) => {
    if (p.id) profileMap[p.id] = p as DbProfile;
  });

  return userIds
    .map((uid) => {
      const p = profileMap[uid];
      if (!p) return null;
      return {
        id: p.id,
        email: p.email || "",
        firstName: p.first_name || "",
        surname: p.surname || "",
        dob: p.dob || "",
        // profiles.username is the canonical nickname column
        nickname: p.username || "Anonymous",
        createdAt: p.created_at || new Date().toISOString(),
        emailVerified: Boolean(p.is_verified),
        isAdmin: Boolean(p.is_admin),
        agreedToTerms: Boolean(p.terms_accepted_at),
        nationality: p.nationality || "",
        isProfilePublic: p.is_profile_public ?? true,
        supportedTeam: p.supported_team || "",
        preferredSport: (p.preferred_sport as SportType | undefined) || undefined,
      } as UserProfile;
    })
    .filter((p): p is UserProfile => p !== null);
}

// ==========================================
// DB OPERATIONS: MAILING EXCLUSIONS & BACKUPS
// ==========================================

export async function dbFetchArchivedPlayers(): Promise<ArchivedPlayerBackup[]> {
  if (!supabase) throw new Error("Database not connected.");
  const { data, error } = await supabase
    .from("archived_players")
    .select(ARCHIVED_PLAYER_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  
  return data
    ? data.map((d) => {
        let deletedUser: ArchivedPlayerBackup["deletedUser"] = null;
        try {
          const raw =
            typeof d.deleted_user === "string"
              ? JSON.parse(d.deleted_user)
              : d.deleted_user;
          deletedUser =
            raw && typeof raw === "object"
              ? (raw as NonNullable<ArchivedPlayerBackup["deletedUser"]>)
              : null;
        } catch {
          deletedUser = null;
        }
        let predictions: unknown = d.predictions;
        try {
          if (typeof d.predictions === "string") {
            predictions = JSON.parse(d.predictions);
          }
        } catch {
          predictions = d.predictions;
        }
        return {
          id: d.id,
          deletedUser,
          predictions,
          deletedAt: d.created_at,
        };
      })
    : [];
}

// ==========================================
// DB OPERATIONS: ADMIN ANALYTICS & INSIGHTS
// ==========================================

export interface AdminAnalyticsSnapshot {
  totalRegisteredPlayers: number;
  weeklyActivePredictors: number;
  totalPredictions: number;
  predictionsBySport: {
    football: number;
    rugby: number;
  };
  /** Cross-pollination: preferred_sport cohort × actual prediction sports. */
  crossPollination: {
    footballPrimary: {
      cohortSize: number;
      /** % of Football-primary users with ≥1 football prediction */
      pctPredictingFootball: number;
      /** % of Football-primary users with ≥1 rugby prediction */
      pctPredictingRugby: number;
    };
    rugbyPrimary: {
      cohortSize: number;
      /** % of Rugby-primary users with ≥1 rugby prediction */
      pctPredictingRugby: number;
      /** % of Rugby-primary users with ≥1 football prediction */
      pctPredictingFootball: number;
    };
  };
  generatedAt: string;
}

function analyticsPct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/** Page through a Supabase select until all rows are collected (PostgREST default page = 1000). */
async function fetchAllRows<T>(
  buildQuery: () => {
    range: (
      from: number,
      to: number,
    ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
  },
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

/**
 * Admin engagement / monetization analytics.
 * Uses profiles.preferred_sport crossed with predictions.sport.
 * Weekly activity uses predictions.created_at (rewritten on each upsert;
 * there is no separate updated_at column on predictions).
 */
export async function dbFetchAdminAnalytics(): Promise<AdminAnalyticsSnapshot> {
  if (!supabase) throw new Error("Database not connected.");

  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: footballPredCount, error: fbErr },
    { count: rugbyPredCount, error: rgErr },
    profileRows,
    predictionLite,
    weeklyRows,
  ] = await Promise.all([
    supabase
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .eq("sport", SportType.FOOTBALL),
    supabase
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .eq("sport", SportType.RUGBY),
    fetchAllRows<{ id: string; preferred_sport: string | null; username: string | null }>(() =>
      supabase!
        .from("profiles")
        .select("id, preferred_sport, username"),
    ),
    fetchAllRows<{ user_id: string; sport: string }>(() =>
      supabase!.from("predictions").select("user_id, sport"),
    ),
    fetchAllRows<{ user_id: string }>(() =>
      supabase!.from("predictions").select("user_id").gte("created_at", weekAgoIso),
    ),
  ]);

  if (fbErr) throw fbErr;
  if (rgErr) throw rgErr;

  const activeProfiles = profileRows.filter(
    (p) => p.username && !String(p.username).startsWith("freed_nick_"),
  );
  const totalRegisteredPlayers = activeProfiles.length;

  const weeklyActivePredictors = new Set(weeklyRows.map((r) => r.user_id)).size;

  const predictionsFootball = footballPredCount ?? 0;
  const predictionsRugby = rugbyPredCount ?? 0;
  const totalPredictions = predictionsFootball + predictionsRugby;

  const footballPrimaryIds = new Set(
    activeProfiles
      .filter((p) => p.preferred_sport === SportType.FOOTBALL)
      .map((p) => p.id),
  );
  const rugbyPrimaryIds = new Set(
    activeProfiles
      .filter((p) => p.preferred_sport === SportType.RUGBY)
      .map((p) => p.id),
  );

  const footballPrimaryOnFootball = new Set<string>();
  const footballPrimaryOnRugby = new Set<string>();
  const rugbyPrimaryOnRugby = new Set<string>();
  const rugbyPrimaryOnFootball = new Set<string>();

  for (const row of predictionLite) {
    const uid = row.user_id;
    const sport = String(row.sport || "").toLowerCase();
    if (footballPrimaryIds.has(uid)) {
      if (sport === SportType.FOOTBALL) footballPrimaryOnFootball.add(uid);
      if (sport === SportType.RUGBY) footballPrimaryOnRugby.add(uid);
    }
    if (rugbyPrimaryIds.has(uid)) {
      if (sport === SportType.RUGBY) rugbyPrimaryOnRugby.add(uid);
      if (sport === SportType.FOOTBALL) rugbyPrimaryOnFootball.add(uid);
    }
  }

  const fbCohort = footballPrimaryIds.size;
  const rgCohort = rugbyPrimaryIds.size;

  return {
    totalRegisteredPlayers,
    weeklyActivePredictors,
    totalPredictions,
    predictionsBySport: {
      football: predictionsFootball,
      rugby: predictionsRugby,
    },
    crossPollination: {
      footballPrimary: {
        cohortSize: fbCohort,
        pctPredictingFootball: analyticsPct(footballPrimaryOnFootball.size, fbCohort),
        pctPredictingRugby: analyticsPct(footballPrimaryOnRugby.size, fbCohort),
      },
      rugbyPrimary: {
        cohortSize: rgCohort,
        pctPredictingRugby: analyticsPct(rugbyPrimaryOnRugby.size, rgCohort),
        pctPredictingFootball: analyticsPct(rugbyPrimaryOnFootball.size, rgCohort),
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function dbSaveArchivedPlayer(
  id: string,
  backupPayload: {
    deletedUser?: { deletedAt?: string } & Record<string, unknown>;
    predictions?: unknown;
  },
): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const payload: TablesInsert<"archived_players"> = {
    id: id,
    deleted_user: JSON.stringify(backupPayload.deletedUser),
    predictions: JSON.stringify(backupPayload.predictions),
    created_at: backupPayload.deletedUser?.deletedAt || new Date().toISOString(),
  };
  const { error } = await supabase.from("archived_players").upsert(payload);
  if (error) throw error;
}

export async function dbSaveUnsubscribedEmail(
  email: string,
  details: {
    unsubscribedAt?: string;
    userId?: string;
    nickname?: string;
  },
): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const payload: TablesInsert<"unsubscribed_emails"> = {
    email: email.toLowerCase(),
    unsubscribed_at: details.unsubscribedAt || new Date().toISOString(),
    user_id: details.userId || "",
    nickname: details.nickname || "",
  };
  const { error } = await supabase.from("unsubscribed_emails").upsert(payload, { onConflict: "email" });
  if (error) throw error;
}

// ==========================================
// LEADERBOARD (RPC with client-side fallback)
// ==========================================

export interface LeaderboardRecord {
  playerId: string;
  nickname: string;
  firstName: string;
  surname: string;
  nationality: string;
  points: number;
  pointsFootball: number;
  pointsRugby: number;
  /** All submitted predictions (engagement / activity). */
  predictionsMade: number;
  predictionsFootball: number;
  predictionsRugby: number;
  /** Completed (FT) predictions only — accuracy & yield denominator. */
  settledPredictionsFootball: number;
  settledPredictionsRugby: number;
  /** Raw base points (no chip multipliers) for accuracy %. */
  basePointsFootball: number;
  basePointsRugby: number;
  accuracy: string;
  accuracyFootball: string;
  accuracyRugby: string;
  isCurrentUser: boolean;
  isProfilePublic: boolean;
  // Dynamic "Drops" forgiveness mechanic. Ghost points are the ungoverned
  // totals (before any worst weeks are dropped); drops are how many worst
  // results were excluded per sport, and the allowance is the total drops
  // permitted across the competitions the player took part in.
  ghostPoints: number;
  ghostPointsFootball: number;
  ghostPointsRugby: number;
  dropsUsed: number;
  dropsUsedFootball: number;
  dropsUsedRugby: number;
  dropsAllowed: number;
  dropsAllowedFootball: number;
  dropsAllowedRugby: number;
  perfectHitsFootball: number;
  perfectHitsRugby: number;
  correctOutcomesFootball: number;
  correctOutcomesRugby: number;
  /** Base-point outcome tiers (5 / 3 / 1 / 0) for accuracy drill-down. */
  hitsExactFootball: number;
  hitsCloseFootball: number;
  hitsWinnerFootball: number;
  hitsWrongFootball: number;
  hitsExactRugby: number;
  hitsCloseRugby: number;
  hitsWinnerRugby: number;
  hitsWrongRugby: number;
  predictions: Record<string, { home: number; away: number; submitted: boolean }>;
}

// Per-competition drop allowance. Mirrors public.pitchside_competition_drops()
// and src/services/scoringEngine.ts: EPL = 3, Scottish Prem = 3,
// Championship = 4, everything else (rugby / cups) = 0.
const COMPETITION_DROPS_ALLOWED: Record<string, number> = {
  "f-epl": 3,
  "f-championship": 4,
  "f-spfl": 3,
};

export function dropsAllowedForCompetition(competitionId?: string | null): number {
  if (!competitionId) return 0;
  return COMPETITION_DROPS_ALLOWED[competitionId] ?? 0;
}

/** Coerce RPC / partial record values to a finite number (default 0). */
export function safeNum(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Accuracy = (base_points / (settled_predictions × 5)) × 100 — no chip multipliers. */
export function formatAccuracy(
  basePoints: number,
  settledPredictions: number,
): string {
  return formatAccuracyFromBasePoints(basePoints, settledPredictions);
}

/** Strike Rate = total_points / settled_predictions (includes chip scoring). */
export function formatStrikeRate(
  totalPoints: number,
  settledPredictions: number,
): number {
  const points = safeNum(totalPoints);
  const settled = safeNum(settledPredictions);
  if (settled <= 0) return 0;
  return points / settled;
}

/** @deprecated Prefer formatStrikeRate */
export function formatYield(
  totalPoints: number,
  settledPredictions: number,
): number {
  return formatStrikeRate(totalPoints, settledPredictions);
}

function mapRpcLeaderboardRow(
  row: Record<string, unknown>,
  currentUserId?: string,
): LeaderboardRecord {
  const pointsFootball = safeNum(row.points_football);
  const pointsRugby = safeNum(row.points_rugby);
  const predictionsFootball = safeNum(row.predictions_football);
  const predictionsRugby = safeNum(row.predictions_rugby);
  const settledPredictionsFootball = safeNum(
    row.settled_predictions_football ?? predictionsFootball,
  );
  const settledPredictionsRugby = safeNum(
    row.settled_predictions_rugby ?? predictionsRugby,
  );
  const totalPoints = safeNum(row.total_points, pointsFootball + pointsRugby);
  const totalPredictions = predictionsFootball + predictionsRugby;
  const perfectHitsFootball = safeNum(row.perfect_hits_football);
  const perfectHitsRugby = safeNum(row.perfect_hits_rugby);
  const basePointsFootball = safeNum(row.base_points_football);
  const basePointsRugby = safeNum(row.base_points_rugby);
  const settledTotal = settledPredictionsFootball + settledPredictionsRugby;
  const basePointsTotal = basePointsFootball + basePointsRugby;

  const ghostPointsFootball = safeNum(
    row.ghost_points_football,
    pointsFootball,
  );
  const ghostPointsRugby = safeNum(row.ghost_points_rugby, pointsRugby);
  const ghostPoints = safeNum(
    row.ghost_points,
    ghostPointsFootball + ghostPointsRugby,
  );
  const dropsUsedFootball = safeNum(row.drops_used_football);
  const dropsUsedRugby = safeNum(row.drops_used_rugby);
  const dropsUsed = safeNum(row.drops_used, dropsUsedFootball + dropsUsedRugby);
  const dropsAllowedFootball = safeNum(row.drops_allowed_football);
  const dropsAllowedRugby = safeNum(row.drops_allowed_rugby);
  const dropsAllowed = safeNum(
    row.drops_allowed,
    dropsAllowedFootball + dropsAllowedRugby,
  );

  return {
    playerId: String(row.player_id),
    nickname: String(row.nickname ?? "Contestant"),
    firstName: String(row.first_name ?? ""),
    surname: String(row.surname ?? ""),
    nationality: String(row.nationality ?? "United Kingdom"),
    points: totalPoints,
    pointsFootball,
    pointsRugby,
    predictionsMade: totalPredictions,
    predictionsFootball,
    predictionsRugby,
    settledPredictionsFootball,
    settledPredictionsRugby,
    basePointsFootball,
    basePointsRugby,
    accuracy: formatAccuracy(basePointsTotal, settledTotal),
    accuracyFootball: formatAccuracy(basePointsFootball, settledPredictionsFootball),
    accuracyRugby: formatAccuracy(basePointsRugby, settledPredictionsRugby),
    isCurrentUser: String(row.player_id) === currentUserId,
    isProfilePublic: row.is_profile_public !== false,
    ghostPoints,
    ghostPointsFootball,
    ghostPointsRugby,
    dropsUsed,
    dropsUsedFootball,
    dropsUsedRugby,
    dropsAllowed,
    dropsAllowedFootball,
    dropsAllowedRugby,
    perfectHitsFootball,
    perfectHitsRugby,
    correctOutcomesFootball: safeNum(row.correct_outcomes_football),
    correctOutcomesRugby: safeNum(row.correct_outcomes_rugby),
    hitsExactFootball: safeNum(row.hits_exact_football),
    hitsCloseFootball: safeNum(row.hits_close_football),
    hitsWinnerFootball: safeNum(row.hits_winner_football),
    hitsWrongFootball: safeNum(row.hits_wrong_football),
    hitsExactRugby: safeNum(row.hits_exact_rugby),
    hitsCloseRugby: safeNum(row.hits_close_rugby),
    hitsWinnerRugby: safeNum(row.hits_winner_rugby),
    hitsWrongRugby: safeNum(row.hits_wrong_rugby),
    predictions: {},
  };
}

export async function dbFetchGlobalLeaderboard(
  currentUserId?: string,
  _matches: Match[] = [],
): Promise<LeaderboardRecord[]> {
  if (!supabase) throw new Error("Database not connected.");

  const { data, error } = await supabase.rpc("get_global_leaderboard", {
    p_current_user_id: currentUserId ?? null,
  });

  if (error) {
    throw new Error(`Leaderboard RPC failed: ${error.message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("Leaderboard RPC returned an invalid payload.");
  }

  return data.map((row) =>
    mapRpcLeaderboardRow(row as Record<string, unknown>, currentUserId),
  );
}

/** Week / month scoped global leaderboard (no gameweek drops). */
export async function dbFetchGlobalLeaderboardHorizon(
  horizon: "week" | "month" | "season",
  currentUserId?: string,
): Promise<LeaderboardRecord[]> {
  if (!supabase) throw new Error("Database not connected.");

  const { data, error } = await supabase.rpc("get_global_leaderboard_horizon", {
    p_horizon: horizon,
    p_current_user_id: currentUserId ?? null,
  });

  if (error) {
    throw new Error(`Horizon leaderboard RPC failed: ${error.message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("Horizon leaderboard RPC returned an invalid payload.");
  }

  return data.map((row) =>
    mapRpcLeaderboardRow(row as Record<string, unknown>, currentUserId),
  );
}

export type PlayerChipUsageRow = {
  chipType: string;
  sport: string;
  timesUsed: number;
};

/** Aggregated chip deployments for a player's profile modal. */
export async function dbFetchPlayerChipUsage(
  playerId: string,
): Promise<PlayerChipUsageRow[]> {
  if (!supabase) throw new Error("Database not connected.");
  if (!playerId) return [];

  const { data, error } = await supabase.rpc("get_player_chip_usage", {
    p_player_id: playerId,
  });

  if (error) {
    console.warn("get_player_chip_usage:", error.message);
    return [];
  }

  return (data || []).map((row: PlayerChipUsageRpc) => ({
    chipType: String(row.chip_type ?? "unknown"),
    sport: String(row.sport ?? "football"),
    timesUsed: Number(row.times_used ?? 0),
  }));
}

export type PlayerRecentFormRow = {
  matchId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string | null;
  actualHome: number;
  actualAway: number;
  predictedHome: number;
  predictedAway: number;
  basePoints: number;
  earnedPoints: number;
  /** perfect | correct | wrong */
  outcomeTier: "perfect" | "correct" | "wrong";
};

/** Last N completed picks for profile recent-form strip. */
export async function dbFetchPlayerRecentForm(
  playerId: string,
  limit = 5,
): Promise<PlayerRecentFormRow[]> {
  if (!supabase) throw new Error("Database not connected.");
  if (!playerId) return [];

  const { data, error } = await supabase.rpc("get_player_recent_form", {
    p_player_id: playerId,
    p_limit: limit,
  });

  if (error) {
    console.warn("get_player_recent_form:", error.message);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => {
    const tier = String(row.outcome_tier ?? "wrong");
    return {
      matchId: String(row.match_id ?? ""),
      sport: String(row.sport ?? "football"),
      homeTeam: String(row.home_team ?? ""),
      awayTeam: String(row.away_team ?? ""),
      kickoffTime: row.kickoff_time ? String(row.kickoff_time) : null,
      actualHome: safeNum(row.actual_home),
      actualAway: safeNum(row.actual_away),
      predictedHome: safeNum(row.predicted_home),
      predictedAway: safeNum(row.predicted_away),
      basePoints: safeNum(row.base_points),
      earnedPoints: safeNum(row.earned_points),
      outcomeTier:
        tier === "perfect" || tier === "correct" ? tier : "wrong",
    };
  });
}

/** Admin: overwrite FT score and recalculate all prediction points for a match. */
export async function dbForceResettleFixture(
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<{ updatedPredictions: number }> {
  if (!supabase) throw new Error("Database not connected.");

  const { data, error } = await supabase.rpc("force_resettle_fixture", {
    p_fixture_id: matchId,
    p_home_score: homeScore,
    p_away_score: awayScore,
  });

  if (error) {
    throw new Error(error.message || "force_resettle_fixture failed");
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    updatedPredictions: safeNum(
      (row as Record<string, unknown> | undefined)?.updated_predictions,
    ),
  };
}
