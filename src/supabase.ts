/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import { UserProfile, Prediction, League, SportType, Match, ActiveCompetition } from "./types";
import { calculatePoints } from "./utils";
import { ALL_COMPETITIONS } from "./data";

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

/**
 * Sum of provisional_points per user for currently live matches.
 * Powers the amber "+X (Live)" badges on the leaderboard.
 */
export async function dbFetchLiveProvisionalByUser(
  liveMatchIds: string[],
): Promise<Record<string, number>> {
  if (!supabase || liveMatchIds.length === 0) return {};

  const { data, error } = await supabase
    .from("predictions")
    .select("user_id, provisional_points, match_id")
    .in("match_id", liveMatchIds)
    .gt("provisional_points", 0);
  if (error) throw error;

  const totals: Record<string, number> = {};
  (data || []).forEach((row: any) => {
    const uid = row.user_id;
    if (!uid) return;
    totals[uid] = (totals[uid] || 0) + (Number(row.provisional_points) || 0);
  });
  return totals;
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
};

export async function dbFetchMatches(
  options: FetchMatchesOptions = {},
): Promise<Match[]> {
  if (!supabase) throw new Error("Database not connected.");
  const horizonDays =
    options.horizonDays === undefined ? MATCH_HORIZON_DAYS : options.horizonDays;
  const visibleOnly = options.visibleOnly !== false;

  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff_time", { ascending: true });
  if (error) throw error;

  let mapped = data ? data.map(mapMatchRow) : [];
  // Client-side so feeds still work before the is_visible migration is applied
  // (mapMatchRow treats missing column as visible).
  if (visibleOnly) {
    mapped = mapped.filter((match) => match.isVisible !== false);
  }
  if (horizonDays == null) return mapped;

  return mapped.filter((match) => isWithinMatchHorizon(match, horizonDays));
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

/** Map a raw leagues row. Never reads the deprecated JSONB `members` column. */
function mapLeagueRow(d: any, members: string[] = []): League {
  const isPrivate =
    typeof d.is_private === "boolean"
      ? d.is_private
      : !(d.is_public ?? true);
  const rawMax = d.max_players ?? d.max_participants ?? 20;
  const maxPlayers = Math.min(20, Math.max(1, Number(rawMax) || 20));

  return {
    id: d.id,
    name: d.name,
    password: d.password || "",
    competitionId: d.competition_id,
    creatorId: d.creator_id,
    creatorName: d.creator_name,
    members,
    isPrivate,
    isPublic: !isPrivate,
    maxPlayers,
    maxParticipants: maxPlayers,
    season: d.season || undefined,
    createdAt: d.created_at || new Date().toISOString(),
    updatedAt: d.updated_at || new Date().toISOString(),
  };
}

export type FetchLeaguesOptions = {
  /** When set, private leagues are only returned if this user is already a member. */
  viewerUserId?: string | null;
  /** Admin / ops: return every league including private ones. */
  includeAllPrivate?: boolean;
};

export async function dbFetchLeagues(
  options: FetchLeaguesOptions = {},
): Promise<League[]> {
  if (!supabase) throw new Error("Database not connected.");
  const { data, error } = await supabase
    .from("leagues")
    .select("*")
    .order("created_at", { ascending: false });
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

/** Fetch a single league by id (invite / join deep-links). */
export async function dbFetchLeagueById(leagueId: string): Promise<League | null> {
  if (!supabase) throw new Error("Database not connected.");
  const { data, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const membership = await dbFetchLeaguesMembership([leagueId]);
  return mapLeagueRow(data, membership[leagueId] || []);
}

export async function dbCreateLeague(league: League): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const isPrivate = league.isPrivate ?? !(league.isPublic ?? true);
  const maxPlayers = Math.min(
    20,
    Math.max(1, league.maxPlayers ?? league.maxParticipants ?? 20),
  );
  const payload = {
    id: league.id,
    name: league.name,
    password: league.password || "",
    competition_id: league.competitionId,
    creator_id: league.creatorId,
    creator_name: league.creatorName,
    is_private: isPrivate,
    is_public: !isPrivate,
    max_players: maxPlayers,
    max_participants: maxPlayers,
    created_at: league.createdAt || new Date().toISOString(),
    updated_at: league.updatedAt || new Date().toISOString(),
  };

  const { error } = await supabase.from("leagues").upsert(payload);
  if (error) throw error;
  await dbJoinLeague(league.id, league.creatorId);
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

export async function dbJoinLeague(leagueId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const { error } = await supabase.from("league_members").insert({ league_id: leagueId, user_id: userId });
  if (error) throw error;
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

  // Step 2: fetch the league records themselves.
  const { data: leagueRows, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .in("id", leagueIds);
  if (leagueError) throw leagueError;

  // Step 3: hydrate full member lists from league_members (not the deprecated JSONB).
  const membership = await dbFetchLeaguesMembership(leagueIds);
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

// Applies the dynamic drops mechanic to one competition's settled scores.
// Drops the worst results, up to the competition's allowance, but never more
// than would leave the player with fewer kept games than the allowance.
function applyCompetitionDrops(
  scores: number[],
  dropsAllowed: number,
): { best: number; ghost: number; dropsUsed: number } {
  const ghost = scores.reduce((sum, s) => sum + s, 0);
  const dropsUsed = Math.min(dropsAllowed, Math.max(0, scores.length - dropsAllowed));
  const droppedTotal = [...scores]
    .sort((a, b) => a - b)
    .slice(0, dropsUsed)
    .reduce((sum, s) => sum + s, 0);
  return { best: ghost - droppedTotal, ghost, dropsUsed };
}

// Aggregates one sport's per-competition settled scores into sport totals,
// applying each competition's own drop allowance.
function aggregateSportDrops(scoresByComp: Record<string, number[]>): {
  best: number;
  ghost: number;
  dropsUsed: number;
  dropsAllowed: number;
} {
  let best = 0;
  let ghost = 0;
  let dropsUsed = 0;
  let dropsAllowed = 0;

  for (const [competitionId, scores] of Object.entries(scoresByComp)) {
    const allowance = dropsAllowedForCompetition(competitionId);
    const comp = applyCompetitionDrops(scores, allowance);
    best += comp.best;
    ghost += comp.ghost;
    dropsUsed += comp.dropsUsed;
    dropsAllowed += allowance;
  }

  return { best, ghost, dropsUsed, dropsAllowed };
}

function formatAccuracy(points: number, predictions: number): string {
  if (predictions <= 0) return "0%";
  return `${Math.round((points / (predictions * 5)) * 100)}%`;
}

async function computeLeaderboardClientSide(
  currentUserId?: string,
  matches: Match[] = [],
): Promise<LeaderboardRecord[]> {
  const playersList = await dbFetchPlayers();

  return Promise.all(
    playersList.map(async (profile) => {
      let predictionsFootball = 0;
      let predictionsRugby = 0;
      // Settled scores grouped per competition so drops can be applied per comp.
      const footballScoresByComp: Record<string, number[]> = {};
      const rugbyScoresByComp: Record<string, number[]> = {};

      const userPredictions = await dbFetchPredictions(profile.id);
      const submittedMatchIds = Object.keys(userPredictions).filter(
        (matchId) => userPredictions[matchId].submitted,
      );

      submittedMatchIds.forEach((matchId) => {
        const pred = userPredictions[matchId];
        const matchedMatch = matches.find((match) => match.id === matchId);

        if (!matchedMatch) return;

        if (matchedMatch.sport === SportType.FOOTBALL) {
          predictionsFootball++;
        } else if (matchedMatch.sport === SportType.RUGBY) {
          predictionsRugby++;
        }

        if (
          matchedMatch.status === "completed" &&
          matchedMatch.homeScore !== undefined &&
          matchedMatch.awayScore !== undefined
        ) {
          const pts = calculatePoints(
            matchedMatch.sport,
            pred.home,
            pred.away,
            matchedMatch.homeScore,
            matchedMatch.awayScore,
          );

          const compId = matchedMatch.competitionId || "unknown";
          if (matchedMatch.sport === SportType.FOOTBALL) {
            (footballScoresByComp[compId] ??= []).push(pts);
          } else if (matchedMatch.sport === SportType.RUGBY) {
            (rugbyScoresByComp[compId] ??= []).push(pts);
          }
        }
      });

      const football = aggregateSportDrops(footballScoresByComp);
      const rugby = aggregateSportDrops(rugbyScoresByComp);

      const pointsFootball = football.best;
      const pointsRugby = rugby.best;
      const totalPoints = pointsFootball + pointsRugby;
      const totalPredictions = predictionsFootball + predictionsRugby;

      return {
        playerId: profile.id,
        nickname: profile.nickname,
        nationality: profile.nationality || "United Kingdom",
        points: totalPoints,
        pointsFootball,
        pointsRugby,
        predictionsMade: totalPredictions,
        predictionsFootball,
        predictionsRugby,
        accuracy: formatAccuracy(totalPoints, totalPredictions),
        accuracyFootball: formatAccuracy(pointsFootball, predictionsFootball),
        accuracyRugby: formatAccuracy(pointsRugby, predictionsRugby),
        isCurrentUser: profile.id === currentUserId,
        isProfilePublic: profile.isProfilePublic ?? true,
        ghostPoints: football.ghost + rugby.ghost,
        ghostPointsFootball: football.ghost,
        ghostPointsRugby: rugby.ghost,
        dropsUsed: football.dropsUsed + rugby.dropsUsed,
        dropsUsedFootball: football.dropsUsed,
        dropsUsedRugby: rugby.dropsUsed,
        dropsAllowed: football.dropsAllowed + rugby.dropsAllowed,
        dropsAllowedFootball: football.dropsAllowed,
        dropsAllowedRugby: rugby.dropsAllowed,
        predictions: userPredictions,
      };
    }),
  );
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
  matches: Match[] = [],
): Promise<LeaderboardRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("get_global_leaderboard", {
    p_current_user_id: currentUserId ?? null,
  });

  if (!error && Array.isArray(data)) {
    return data.map((row) => mapRpcLeaderboardRow(row as Record<string, unknown>, currentUserId));
  }

  if (error) {
    console.warn("Leaderboard RPC unavailable, using client fallback:", error.message);
  }

  return computeLeaderboardClientSide(currentUserId, matches);
}
