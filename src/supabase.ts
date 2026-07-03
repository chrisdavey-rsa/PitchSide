/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import { UserProfile, Prediction, League, SportType, Match } from "./types";

// Retrieve environment variables represented safely
const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || "";
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || "";

// Initialize client if configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey);
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Display a configuration helper log for the administrator
if (!isSupabaseConfigured()) {
  console.info(
    "💡 [Supabase Driver]: Supabase environment variables are not set yet. PitchSide is running in RELATIONAL SANDBOX OFFLINE MODE. All user records, custom league systems, scoring sheets, and backup archives persist inside local storage engines. Setup SUPABASE_URL and SUPABASE_SECRET_KEY inside the Settings/Environment variables panel to connect a real-time Cloud Database with RLS.",
  );
}

// ==========================================
// DB OPERATIONS: PLAYERS/CONTESTANTS PROFILE
// ==========================================

export async function dbFetchPlayers(): Promise<UserProfile[]> {
  const MOCK_NICKNAMES_FILTER = [
    "scrummaster",
    "striker99",
    "goalgetter",
    "lineoutking",
    "sidelineslicker",
    "flankerfan",
    "scraamaster",
    "striker 99",
    "gold getter",
    "lineout king",
  ];

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (data) {
        // Filter out binned/freed users from the default active list
        const activeData = data.filter(
          (d: any) => d.username && !d.username.startsWith("freed_nick_"),
        );

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

        return mapped.filter(
          (item) =>
            !MOCK_NICKNAMES_FILTER.includes(item.nickname.toLowerCase()),
        );
      }
    } catch (err) {
      console.error("Supabase fetch players query failed:", err);
    }
  }

  return [];
}

export async function dbCreatePlayer(profile: UserProfile): Promise<void> {
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

  if (supabase) {
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" });

      if (error) {
        if (
          error.message.includes("Could not find the table") ||
          error.message.includes("relation") ||
          error.message.includes("not found")
        ) {
          console.warn("⚠️ profiles table missing - falling back to offline Local Relational state.");
        } else {
          // CRITICAL: Actually throw the error so the frontend catches it
          throw error; 
        }
      }
    } catch (err) {
      console.error("Supabase create player profile failed:", err);
      // CRITICAL: Re-throw the error so AuthFlow.tsx stops the signup process
      throw err; 
    }
  }
}

  // Removed offline save logic that used pitchside_players


export async function dbUpdatePlayerAdmin(
  userId: string,
  isAdmin: boolean,
): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_admin: isAdmin })
        .eq("id", userId);
      if (error) throw error;
      return;
    } catch (err) {
      console.error("Supabase update player admin error:", err);
    }
  }

  // Removed local storage update
}

export async function dbDeletePlayerAccount(
  userId: string,
  email: string,
): Promise<void> {
  if (supabase) {
    try {
      // Fetch current profile nickname before updating
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .single();

      const currentNickname = currentProfile?.username || "Contestant";

      // Soft-delete the account by modifying unique credentials, freeing them up for others,
      // while retaining the profile row with the unique user id.
      const { error: pError } = await supabase
        .from("profiles")
        .update({
          email: `freed_${userId}_${email.toLowerCase()}`,
          username: `freed_nick_${userId}_${currentNickname}`,
          is_verified: false,
        })
        .eq("id", userId);

      if (pError) throw pError;

      // Predictions are fully preserved under the persistent userId!

      return;
    } catch (err) {
      console.error("Supabase user account soft-deletion/bin error:", err);
    }
  }

  // Removed local storage delete
}

// ==========================================
// DB OPERATIONS: PREDICTIONS & OUTCOMES
// ==========================================

export async function dbFetchPredictions(
  userId: string,
): Promise<Record<string, { home: number; away: number; submitted: boolean }>> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;
      if (data) {
        const result: Record<
          string,
          { home: number; away: number; submitted: boolean }
        > = {};
        data.forEach((p: any) => {
          result[p.match_id] = {
            home: p.predicted_home_score,
            away: p.predicted_away_score,
            submitted: p.submitted ?? true,
          };
        });
        return result;
      }
    } catch (err) {
      console.error("Supabase fetch predictions error:", err);
    }
  }

  // Fallback local storage
  const localStr = localStorage.getItem(`predictions_${userId}`);
  if (localStr) {
    try {
      return JSON.parse(localStr);
    } catch (e) {
      return {};
    }
  }
  return {};
}

export async function dbSavePrediction(
  userId: string,
  matchId: string,
  sport: SportType,
  compId: string,
  homeScore: number,
  awayScore: number,
  submitted: boolean,
): Promise<void> {
  const predictionId = `${userId}_${matchId}`;
  const payload = {
    id: predictionId,
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

  if (supabase) {
    try {
      const { error } = await supabase
        .from("predictions")
        .upsert(payload, { onConflict: "id" });
      if (error) {
        if (
          error.message.includes("Could not find the table") ||
          error.message.includes("relation") ||
          error.message.includes("not found")
        ) {
          console.warn(
            "⚠️ predictions table missing - falling back to offline Local storage.",
          );
        } else {
          throw error;
        }
      } else {
        return;
      }
    } catch (err) {
      console.error("Supabase upsert prediction failed:", err);
      // Fallback local save is executed below
    }
  }

  // Fallback local store save
  const current = await dbFetchPredictions(userId);
  current[matchId] = {
    home: homeScore,
    away: awayScore,
    submitted: submitted,
  };
  localStorage.setItem(`predictions_${userId}`, JSON.stringify(current));
}

// ==========================================
// DB OPERATIONS: MATCH MANAGEMENT
// ==========================================

export async function dbFetchMatches(): Promise<Match[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .order("kickoff_time", { ascending: true });

      if (error) {
        console.warn("Could not fetch matches from Supabase:", error.message);
        return [];
      }
      if (data) {
        return data.map((d: any) => ({
          id: d.id,
          competitionId: d.competition_id,
          sport: d.sport as SportType,
          homeTeam: d.home_team,
          awayTeam: d.away_team,
          homeScore: d.actual_home_score ?? undefined,
          awayScore: d.actual_away_score ?? undefined,
          matchDate: d.kickoff_time,
          status: d.status || "upcoming",
        }));
      }
    } catch (err) {
      console.error("Supabase fetch matches warning:", err);
    }
  }
  return [];
}

export async function dbSaveMatch(match: Match): Promise<void> {
  if (supabase) {
    try {
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
    } catch (err) {
      console.error("Supabase save match error:", err);
      throw err;
    }
  }
}

// ==========================================
// DB OPERATIONS: LEAGUE MANAGEMENT
// ==========================================

export async function dbFetchLeagues(): Promise<League[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("leagues")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) {
        return data.map((d: any) => ({
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
        }));
      }
    } catch (err) {
      console.error("Supabase fetch leagues warning:", err);
    }
  }

  // Offline Sandbox mode for Custom Leagues
  const local = localStorage.getItem("pitchside_leagues");
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed as League[];
    } catch (e) {}
  }
  return [];
}

export async function dbCreateLeague(league: League): Promise<void> {
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

  if (supabase) {
    try {
      const { error } = await supabase.from("leagues").upsert(payload);
      if (error) throw error;
      await dbJoinLeague(league.id, league.creatorId);
      return;
    } catch (err) {
      console.error("Supabase write league failed:", err);
    }
  }

  // Backup store save
  const leagues = await dbFetchLeagues();
  leagues.push(league);
  localStorage.setItem("pitchside_leagues", JSON.stringify(leagues));
}

export async function dbUpdateLeagueSettings(
  leagueId: string,
  isPublic: boolean,
  maxParticipants: number | null,
): Promise<void> {
  const updatePayload: any = { is_public: isPublic, max_participants: maxParticipants, updated_at: new Date().toISOString() };
  if (supabase) {
    try {
      const { error } = await supabase
        .from("leagues")
        .update(updatePayload)
        .eq("id", leagueId);
      if (error) throw error;
      return;
    } catch (err) {
      console.error("Supabase league update settings error:", err);
    }
  }

  // Offline local store updates
  const leagues = await dbFetchLeagues();
  const updated = leagues.map((l) =>
    l.id === leagueId
      ? {
          ...l,
          isPublic,
          maxParticipants: maxParticipants ?? undefined,
          updatedAt: new Date().toISOString(),
        }
      : l,
  );
  localStorage.setItem("pitchside_leagues", JSON.stringify(updated));
}

export async function dbJoinLeague(leagueId: string, userId: string): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase
        .from("league_members")
        .insert({ league_id: leagueId, user_id: userId });
      if (error) throw error;
    } catch (err) {
      console.error("Supabase join league error:", err);
    }
  } else {
    // Offline local store updates
    const leagues = await dbFetchLeagues();
    const updated = leagues.map((l) => {
      if (l.id === leagueId) {
        if (!l.members) l.members = [];
        if (!l.members.includes(userId)) l.members.push(userId);
        return { ...l, updatedAt: new Date().toISOString() };
      }
      return l;
    });
    localStorage.setItem("pitchside_leagues", JSON.stringify(updated));
  }
}

export async function dbLeaveLeague(leagueId: string, userId: string): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", leagueId)
        .eq("user_id", userId);
      if (error) throw error;
    } catch (err) {
      console.error("Supabase leave league error:", err);
    }
  } else {
    // Offline local store updates
    const leagues = await dbFetchLeagues();
    const updated = leagues.map((l) => {
      if (l.id === leagueId) {
        return {
          ...l,
          members: l.members ? l.members.filter(id => id !== userId) : [],
          updatedAt: new Date().toISOString()
        };
      }
      return l;
    });
    localStorage.setItem("pitchside_leagues", JSON.stringify(updated));
  }
}

export async function dbFetchUserLeagues(userId: string): Promise<League[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("league_members")
        .select(`
          league_id,
          leagues (*)
        `)
        .eq("user_id", userId);

      if (error) throw error;
      if (data) {
        return data.map((d: any) => {
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
            members: [] // Not populated here by default, fetch separately
          };
        });
      }
    } catch (err) {
      console.error("Supabase fetch user leagues error:", err);
    }
  } else {
    const leagues = await dbFetchLeagues();
    return leagues.filter(l => l.members && l.members.includes(userId));
  }
  return [];
}

export async function dbFetchLeagueMembers(leagueId: string): Promise<UserProfile[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("league_members")
        .select(`
          user_id,
          profiles (*)
        `)
        .eq("league_id", leagueId);

      if (error) throw error;
      if (data) {
        return data.map((d: any) => {
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
        });
      }
    } catch (err) {
      console.error("Supabase fetch league members error:", err);
    }
  } else {
    // Offline local store updates - not fully supported for profiles
    return [];
  }
  return [];
}

// ==========================================
// DB OPERATIONS: MAILING EXCLUSIONS & BACKUPS
// ==========================================

export async function dbFetchArchivedPlayers(): Promise<any[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("archived_players")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) {
        return data.map((d: any) => ({
          id: d.id,
          deletedUser:
            typeof d.deleted_user === "string"
              ? JSON.parse(d.deleted_user)
              : d.deleted_user,
          predictions:
            typeof d.predictions === "string"
              ? JSON.parse(d.predictions)
              : d.predictions,
          deletedAt: d.created_at,
        }));
      }
    } catch (err) {
      console.warn("Supabase fetch archives failed:", err);
    }
  }

  try {
    return JSON.parse(
      localStorage.getItem("pitchside_archived_backups_log") || "[]",
    );
  } catch (e) {
    return [];
  }
}

export async function dbSaveArchivedPlayer(
  id: string,
  backupPayload: any,
): Promise<void> {
  const payload = {
    id: id,
    deleted_user: JSON.stringify(backupPayload.deletedUser),
    predictions: JSON.stringify(backupPayload.predictions),
    created_at:
      backupPayload.deletedUser?.deletedAt || new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { error } = await supabase.from("archived_players").upsert(payload);
      if (error) throw error;
      return;
    } catch (err) {
      console.error("Supabase write archive logger error:", err);
    }
  }

  // Offline localStorage list
  let offlineLogs = [];
  try {
    offlineLogs = JSON.parse(
      localStorage.getItem("pitchside_archived_backups_log") || "[]",
    );
  } catch (e) {}
  offlineLogs.push(backupPayload);
  localStorage.setItem(
    "pitchside_archived_backups_log",
    JSON.stringify(offlineLogs),
  );
}

export async function dbSaveUnsubscribedEmail(
  email: string,
  details: any,
): Promise<void> {
  const payload = {
    email: email.toLowerCase(),
    unsubscribed_at: details.unsubscribedAt || new Date().toISOString(),
    user_id: details.userId || "",
    nickname: details.nickname || "",
  };

  if (supabase) {
    try {
      const { error } = await supabase
        .from("unsubscribed_emails")
        .upsert(payload, { onConflict: "email" });
      if (error) throw error;
      return;
    } catch (err) {
      console.warn("Supabase unsubscribe emails error:", err);
    }
  }

  // Fallback logs
  let offlineExcludes: any[] = [];
  try {
    offlineExcludes = JSON.parse(
      localStorage.getItem("pitchside_unsubscribed_emails") || "[]",
    );
  } catch (e) {}
  offlineExcludes.push(payload);
  localStorage.setItem(
    "pitchside_unsubscribed_emails",
    JSON.stringify(offlineExcludes),
  );
}
