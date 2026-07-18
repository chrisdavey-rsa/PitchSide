/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import { UserProfile, Prediction, League, SportType, Match, ActiveCompetition } from "./types";
import { ALL_COMPETITIONS } from "./data";
import { GLOBAL_LEAGUE_ID } from "./lib/leaguesConfig";
import {
  parseSeenFeatures,
  type SeenFeatureKey,
  type SeenFeatures,
} from "./lib/seenFeatures";

// Retrieve environment variables and clean them of common copy-paste errors
const metaEnv = (import.meta as any).env || {};
const cleanUrl = (url: string) => {
  if (!url) return "";
  const baseUrl = url.split("https://")[1] || url.split("http://")[1];
  return `https://${baseUrl.split("https://")[0].replace(/\/+$/, "")}`;
};

const rawUrl = metaEnv.VITE_SUPABASE_URL || "";
const supabaseUrl = cleanUrl(rawUrl);
const supabaseAnonKey = (metaEnv.VITE_SUPABASE_ANON_KEY || "").trim();

export const isSupabaseConfigured = () => !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isSupabaseConfigured()) {
  console.error(
    "CRITICAL: Supabase environment variables are not set. The app cannot function without Supabase configured. Setup VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

// Connection test for UI validation
export async function testSupabaseConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase client not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ==========================================
// DB OPERATIONS: PLAYERS/CONTESTANTS PROFILE
// ==========================================

export async function dbFetchPlayers(): Promise<UserProfile[]> {
  const MOCK_NICKNAMES_FILTER = [
    "scrummaster", "striker99", "goalgetter", "lineoutking",
    "sidelineslicker", "flankerfan", "scraamaster", "striker 99",
    "gold getter", "lineout king",
  ];

  if (!supabase) throw new Error("Database not connected.");

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  const activeData = data.filter((d: any) => d.username && !d.username.startsWith("freed_nick_"));
  const seenIds = new Set();
  const dedupedActiveData = activeData.filter((d: any) => {
    if (!d.id || seenIds.has(d.id)) return false;
    seenIds.add(d.id);
    return true;
  });

  const mapped = dedupedActiveData.map((d: any) => ({
    id: d.id,
    firstName: d.first_name || "",
    surname: d.surname || "",
    email: d.email || "",
    dob: d.dob || "2000-01-01",
    nickname: d.username || d.nickname || "Contestant",
    phone: d.phone || "",
    createdAt: d.created_at || new Date().toISOString(),
    emailVerified: d.is_verified ?? false,
    isAdmin: Boolean(d.is_admin),
    agreedToTerms: true,
    nationality: d.nationality || "United Kingdom",
    supportedTeam: d.supported_team || "None",
    preferredSport: d.preferred_sport as SportType | undefined,
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
};

export async function dbFetchPredictions(
  userId: string,
): Promise<Record<string, PredictionEntry>> {
  if (!supabase) throw new Error("Database not connected.");
  const { data, error } = await supabase.from("predictions").select("*").eq("user_id", userId);
  if (error) throw error;

  const result: Record<string, PredictionEntry> = {};
  if (data) {
    data.forEach((p: any) => {
      result[p.match_id] = {
        home: p.predicted_home_score,
        away: p.predicted_away_score,
        submitted: p.submitted ?? false,
        lockedAt: p.submitted ? p.created_at : undefined,
        provisionalPoints: p.provisional_points ?? 0,
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
  pointsWon: number | null;
};

export async function dbFetchLeagueSubmittedPredictions(
  userIds: string[],
): Promise<LeagueSubmittedPredictionRow[]> {
  if (!supabase) throw new Error("Database not connected.");
  if (userIds.length === 0) return [];

  const { data, error } = await supabase
    .from("predictions")
    .select(
      "user_id, match_id, sport, predicted_home_score, predicted_away_score, submitted, points_won",
    )
    .in("user_id", userIds)
    .eq("submitted", true);

  if (error) throw error;

  return (data || []).map((p: any) => ({
    userId: p.user_id as string,
    matchId: p.match_id as string,
    sport: (p.sport as SportType) || SportType.FOOTBALL,
    home: Number(p.predicted_home_score) || 0,
    away: Number(p.predicted_away_score) || 0,
    submitted: true,
    pointsWon: p.points_won != null ? Number(p.points_won) : null,
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
  (data || []).forEach((row: any) => {
    const uid = row.user_id as string | undefined;
    const matchId = row.match_id as string | undefined;
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
  if (error) throw error;
}

// ==========================================
// DB OPERATIONS: MATCH MANAGEMENT
// ==========================================

/** Sliding prediction window — upcoming fixtures within this many days. */
export const MATCH_HORIZON_DAYS = 9;

function resolveCompetitionName(
  competitionId: string | null | undefined,
  storedName?: string | null,
): string {
  const trimmed = storedName?.trim();
  if (trimmed) return trimmed;
  if (!competitionId) return "Unknown Competition";
  const catalog = ALL_COMPETITIONS.find((c) => c.id === competitionId);
  if (catalog) return catalog.name;
  return `Competition ${competitionId}`;
}

function isWithinMatchHorizon(
  match: Pick<Match, "matchDate" | "status">,
  horizonDays: number,
  now = new Date(),
): boolean {
  if (match.status === "live") return true;
  const kickoff = new Date(match.matchDate).getTime();
  if (Number.isNaN(kickoff)) return false;
  // Small past buffer so just-kicked-off fixtures remain visible.
  const start = now.getTime() - 3 * 60 * 60 * 1000;
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
export function mapMatchRow(d: any): Match {
  return {
    id: d.id,
    competitionId: d.competition_id,
    competitionName: d.competition_name || undefined,
    sport: d.sport as SportType,
    homeTeam: d.home_team,
    awayTeam: d.away_team,
    homeScore: d.actual_home_score ?? undefined,
    awayScore: d.actual_away_score ?? undefined,
    matchDate: d.kickoff_time,
    status: d.status || "upcoming",
    season: d.season || undefined,
    matchTag: d.match_tag || undefined,
    roundName: d.round_name || undefined,
    venueName: d.venue_name || undefined,
    oddsHomeWin: d.odds_home_win != null ? Number(d.odds_home_win) : undefined,
    oddsDraw: d.odds_draw != null ? Number(d.odds_draw) : undefined,
    oddsAwayWin: d.odds_away_win != null ? Number(d.odds_away_win) : undefined,
    baseMultiplier: d.base_multiplier != null ? Number(d.base_multiplier) : undefined,
    provisionalHomeScore:
      d.provisional_home_score != null ? Number(d.provisional_home_score) : undefined,
    provisionalAwayScore:
      d.provisional_away_score != null ? Number(d.provisional_away_score) : undefined,
    matchMinute: d.match_minute || undefined,
    isVisible: d.is_visible !== false,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (query: any) => {
    let q = query;
    if (visibleOnly) q = q.eq("is_visible", true);
    if (statusFilter) {
      q = Array.isArray(statusFilter)
        ? q.in("status", statusFilter)
        : q.eq("status", statusFilter);
    }
    return q.order("kickoff_time", { ascending: true });
  };

  // Unbounded / status-scoped fetch (admin, standings) — still filtered in PostgREST.
  if (horizonDays == null) {
    const { data, error } = await applyFilters(
      supabase.from("matches").select("*"),
    );
    if (error) throw error;
    return (data || []).map(mapMatchRow);
  }

  const now = new Date();
  const start = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const end = new Date(
    now.getTime() + horizonDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Two targeted queries (kickoff window + live) instead of SELECT * + JS filter.
  const [windowRes, liveRes] = await Promise.all([
    applyFilters(
      supabase
        .from("matches")
        .select("*")
        .gte("kickoff_time", start)
        .lte("kickoff_time", end),
    ),
    // Skip redundant live fetch when caller already constrained status away from live.
    statusFilter &&
      !(Array.isArray(statusFilter) ? statusFilter.includes("live") : statusFilter === "live")
      ? Promise.resolve({ data: [] as unknown[], error: null })
      : applyFilters(supabase.from("matches").select("*").eq("status", "live")),
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
  const { error } = await supabase.from("matches").upsert({
    id: match.id,
    competition_id: match.competitionId,
    competition_name: match.competitionName || null,
    sport: match.sport,
    home_team: match.homeTeam,
    away_team: match.awayTeam,
    actual_home_score: match.homeScore,
    actual_away_score: match.awayScore,
    kickoff_time: match.matchDate,
    status: match.status,
    is_visible: match.isVisible !== false,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
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

/** Map a raw leagues row. Never reads the deprecated JSONB `members` column. */
function mapLeagueRow(d: any, members: string[] = []): League {
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
  const membership = await dbFetchLeaguesMembership(data.map((d: any) => d.id));
  const mapped = data.map((d: any) => mapLeagueRow(d, membership[d.id] || []));

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
  const payload: Record<string, unknown> = {
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
  const payload: Record<string, unknown> = {
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
    new Set((membershipRows || []).map((r: any) => r.league_id).filter(Boolean)),
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
  const activeIds = (leagueRows || []).map((d: any) => d.id as string);
  const membership = await dbFetchLeaguesMembership(activeIds);
  return (leagueRows || []).map((d: any) => mapLeagueRow(d, membership[d.id] || []));
}

/**
 * Fetch the member user-ids for several leagues in a single round-trip.
 * Returns a map of leagueId -> array of member user-ids. Used to pick the
 * user's most populated private league for the dashboard "My League" tab and
 * to scope the leaderboard to that league's members.
 */
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
  (data || []).forEach((row: any) => {
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
    new Set((memberRows || []).map((r: any) => r.user_id).filter(Boolean)),
  );
  if (userIds.length === 0) return [];

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);
  if (profileError) throw profileError;

  const profileMap: Record<string, any> = {};
  (profileRows || []).forEach((p: any) => {
    profileMap[p.id] = p;
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
        nickname: p.username || p.nickname || "Anonymous",
        createdAt: p.created_at || new Date().toISOString(),
        emailVerified: p.is_verified || p.email_verified || false,
        isAdmin: p.is_admin || false,
        agreedToTerms: p.agreed_to_terms || false,
        nationality: p.nationality || "",
        isProfilePublic: p.is_profile_public ?? true,
        supportedTeam: p.supported_team || "",
        preferredSport: p.preferred_sport || undefined,
      } as UserProfile;
    })
    .filter((p): p is UserProfile => p !== null);
}

// ==========================================
// DB OPERATIONS: MAILING EXCLUSIONS & BACKUPS
// ==========================================

export async function dbFetchArchivedPlayers(): Promise<any[]> {
  if (!supabase) throw new Error("Database not connected.");
  const { data, error } = await supabase.from("archived_players").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  
  return data ? data.map((d: any) => ({
    id: d.id,
    deletedUser: typeof d.deleted_user === "string" ? JSON.parse(d.deleted_user) : d.deleted_user,
    predictions: typeof d.predictions === "string" ? JSON.parse(d.predictions) : d.predictions,
    deletedAt: d.created_at,
  })) : [];
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
async function fetchAllRows<T extends Record<string, unknown>>(
  buildQuery: () => any,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
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

export async function dbSaveArchivedPlayer(id: string, backupPayload: any): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const payload = {
    id: id,
    deleted_user: JSON.stringify(backupPayload.deletedUser),
    predictions: JSON.stringify(backupPayload.predictions),
    created_at: backupPayload.deletedUser?.deletedAt || new Date().toISOString(),
  };
  const { error } = await supabase.from("archived_players").upsert(payload);
  if (error) throw error;
}

export async function dbSaveUnsubscribedEmail(email: string, details: any): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const payload = {
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
  nationality: string;
  points: number;
  pointsFootball: number;
  pointsRugby: number;
  predictionsMade: number;
  predictionsFootball: number;
  predictionsRugby: number;
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
  predictions: Record<string, { home: number; away: number; submitted: boolean }>;
}

// Per-competition drop allowance. Mirrors public.pitchside_competition_drops()
// in supabase/migrations/20260713130000_leaderboard_best34.sql. Keep the two in
// sync: EPL = 4, Championship = 6, Scottish Premiership = 4, everything else
// (rugby / cups) = 0.
const COMPETITION_DROPS_ALLOWED: Record<string, number> = {
  "f-epl": 4,
  "f-championship": 6,
  "f-spfl": 4,
};

export function dropsAllowedForCompetition(competitionId?: string | null): number {
  if (!competitionId) return 0;
  return COMPETITION_DROPS_ALLOWED[competitionId] ?? 0;
}

function formatAccuracy(points: number, predictions: number): string {
  if (predictions <= 0) return "0%";
  return `${Math.round((points / (predictions * 5)) * 100)}%`;
}

function mapRpcLeaderboardRow(
  row: Record<string, unknown>,
  currentUserId?: string,
): LeaderboardRecord {
  const pointsFootball = Number(row.points_football ?? 0);
  const pointsRugby = Number(row.points_rugby ?? 0);
  const predictionsFootball = Number(row.predictions_football ?? 0);
  const predictionsRugby = Number(row.predictions_rugby ?? 0);
  const totalPoints = Number(row.total_points ?? pointsFootball + pointsRugby);
  const totalPredictions = predictionsFootball + predictionsRugby;

  const ghostPointsFootball = Number(row.ghost_points_football ?? pointsFootball);
  const ghostPointsRugby = Number(row.ghost_points_rugby ?? pointsRugby);
  const ghostPoints = Number(row.ghost_points ?? ghostPointsFootball + ghostPointsRugby);
  const dropsUsedFootball = Number(row.drops_used_football ?? 0);
  const dropsUsedRugby = Number(row.drops_used_rugby ?? 0);
  const dropsUsed = Number(row.drops_used ?? dropsUsedFootball + dropsUsedRugby);
  const dropsAllowedFootball = Number(row.drops_allowed_football ?? 0);
  const dropsAllowedRugby = Number(row.drops_allowed_rugby ?? 0);
  const dropsAllowed = Number(row.drops_allowed ?? dropsAllowedFootball + dropsAllowedRugby);

  return {
    playerId: String(row.player_id),
    nickname: String(row.nickname ?? "Contestant"),
    nationality: String(row.nationality ?? "United Kingdom"),
    points: totalPoints,
    pointsFootball,
    pointsRugby,
    predictionsMade: totalPredictions,
    predictionsFootball,
    predictionsRugby,
    accuracy: formatAccuracy(totalPoints, totalPredictions),
    accuracyFootball: formatAccuracy(pointsFootball, predictionsFootball),
    accuracyRugby: formatAccuracy(pointsRugby, predictionsRugby),
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
