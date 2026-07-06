/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import { UserProfile, Prediction, League, SportType, Match } from "./types";

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
      result[p.match_id] = { home: p.predicted_home_score, away: p.predicted_away_score, submitted: p.submitted ?? true };
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
