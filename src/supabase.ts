/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import { UserProfile, Prediction, League, SportType, Match } from "./types";
import { calculatePoints } from "./utils";

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

export async function dbFetchPredictions(userId: string): Promise<Record<string, { home: number; away: number; submitted: boolean }>> {
  if (!supabase) throw new Error("Database not connected.");
  const { data, error } = await supabase.from("predictions").select("*").eq("user_id", userId);
  if (error) throw error;
  
  const result: Record<string, { home: number; away: number; submitted: boolean }> = {};
  if (data) {
    data.forEach((p: any) => {
      result[p.match_id] = { home: p.predicted_home_score, away: p.predicted_away_score, submitted: p.submitted ?? false };
    });
  }
  return result;
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

export async function dbFetchMatches(): Promise<Match[]> {
  if (!supabase) throw new Error("Database not connected.");
  const { data, error } = await supabase.from("matches").select("*").order("kickoff_time", { ascending: true });
  if (error) throw error;
  return data ? data.map((d: any) => ({
    id: d.id,
    competitionId: d.competition_id,
    sport: d.sport as SportType,
    homeTeam: d.home_team,
    awayTeam: d.away_team,
    homeScore: d.actual_home_score ?? undefined,
    awayScore: d.actual_away_score ?? undefined,
    matchDate: d.kickoff_time,
    status: d.status || "upcoming",
  })) : [];
}

export async function dbSaveMatch(match: Match): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const { error } = await supabase.from("matches").upsert({
    id: match.id,
    competition_id: match.competitionId,
    sport: match.sport,
    home_team: match.homeTeam,
    away_team: match.awayTeam,
    actual_home_score: match.homeScore,
    actual_away_score: match.awayScore,
    kickoff_time: match.matchDate,
    status: match.status,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ==========================================
// DB OPERATIONS: LEAGUE MANAGEMENT
// ==========================================

export async function dbFetchLeagues(): Promise<League[]> {
  if (!supabase) throw new Error("Database not connected.");
  const { data, error } = await supabase.from("leagues").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ? data.map((d: any) => ({
    id: d.id,
    name: d.name,
    password: d.password || "",
    competitionId: d.competition_id,
    creatorId: d.creator_id,
    creatorName: d.creator_name,
    members: Array.isArray(d.members) ? d.members : [],
    isPublic: d.is_public ?? false,
    maxParticipants: d.max_participants || undefined,
    season: d.season || undefined,
    createdAt: d.created_at || new Date().toISOString(),
    updatedAt: d.updated_at || new Date().toISOString(),
  })) : [];
}

export async function dbCreateLeague(league: League): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const payload = {
    id: league.id,
    name: league.name,
    password: league.password || "",
    competition_id: league.competitionId,
    creator_id: league.creatorId,
    creator_name: league.creatorName,
    is_public: league.isPublic ?? false,
    max_participants: league.maxParticipants || null,
    created_at: league.createdAt || new Date().toISOString(),
    updated_at: league.updatedAt || new Date().toISOString(),
  };

  const { error } = await supabase.from("leagues").upsert(payload);
  if (error) throw error;
  await dbJoinLeague(league.id, league.creatorId);
}

export async function dbUpdateLeagueSettings(leagueId: string, isPublic: boolean, maxParticipants: number | null): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const { error } = await supabase.from("leagues").update({ is_public: isPublic, max_participants: maxParticipants, updated_at: new Date().toISOString() }).eq("id", leagueId);
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
  const { data, error } = await supabase.from("league_members").select(`league_id, leagues (*)`).eq("user_id", userId);
  if (error) throw error;
  
  return data ? data.map((d: any) => {
    const l = Array.isArray(d.leagues) ? d.leagues[0] : d.leagues;
    return {
      id: l.id,
      name: l.name,
      password: l.password || "",
      competitionId: l.competition_id,
      creatorId: l.creator_id,
      creatorName: l.creator_name,
      isPublic: l.is_public ?? false,
      maxParticipants: l.max_participants || undefined,
      season: l.season || undefined,
      createdAt: l.created_at || new Date().toISOString(),
      updatedAt: l.updated_at || new Date().toISOString(),
      members: [] 
    };
  }) : [];
}

export async function dbFetchLeagueMembers(leagueId: string): Promise<UserProfile[]> {
  if (!supabase) throw new Error("Database not connected.");
  const { data, error } = await supabase.from("league_members").select(`user_id, profiles (*)`).eq("league_id", leagueId);
  if (error) throw error;
  
  return data ? data.map((d: any) => {
    const p = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
    return {
      id: p.id,
      email: p.email || "",
      firstName: p.first_name || "",
      surname: p.last_name || "",
      dob: p.dob || "",
      nickname: p.nickname || "Anonymous",
      createdAt: p.created_at || new Date().toISOString(),
      emailVerified: p.email_verified || false,
      isAdmin: p.is_admin || false,
      agreedToTerms: p.agreed_to_terms || false,
      nationality: p.nationality || "",
      isProfilePublic: p.is_profile_public ?? true,
      supportedTeam: p.supported_team || ""
    };
  }) : [];
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
// sync: EPL = 4, Championship = 6, everything else (rugby / cups) = 0.
const COMPETITION_DROPS_ALLOWED: Record<string, number> = {
  "f-epl": 4,
  "f-championship": 6,
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
