/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  dob: string;
  nickname: string;
  createdAt: string;
  emailVerified?: boolean;
  emailConfirmedAt?: string | null;
  isAdmin: boolean;
  agreedToTerms: boolean;
  nationality?: string;
  phone?: string;
  supportedTeam?: string;
  preferredSport?: SportType;
  password?: string;
  isProfilePublic?: boolean;
  suspendedUntil?: string;
  /**
   * Persistent feature-tour map from profiles.seen_features (JSONB).
   * Keys like main_walkthrough, football_intro, golf_tutorial — see src/lib/seenFeatures.ts.
   */
  seenFeatures?: Record<string, boolean>;
}

export enum SportType {
  FOOTBALL = "football",
  RUGBY = "rugby",
}

export interface Competition {
  id: string;
  name: string;
  sport: SportType;
  nationality?: string;
  logoUrl?: string;
  season?: string;
}

export interface Match {
  id: string;
  competitionId: string;
  /** Display name from the fixtures provider when available. */
  competitionName?: string;
  sport: SportType;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number; // Actual result (once played)
  awayScore?: number; // Actual result (once played)
  matchDate: string;
  status: "upcoming" | "live" | "completed";
  season?: string;
  /**
   * Optional "high stakes" label for premium fixtures (e.g. "Derby",
   * "Barrage Bout", "Cup Run"). Rendered as a badge on the fixture card and
   * reserved for upcoming point-multiplier mechanics.
   */
  matchTag?: string;

  // --- Live API-Sports data (see 20260715_api_automation_schema.sql) ---
  /** Competition round/stage label from the data provider (e.g. "Round 12"). */
  roundName?: string;
  /** Venue / stadium name from the data provider. */
  venueName?: string;
  /** Pre-match decimal odds for a home win. */
  oddsHomeWin?: number;
  /** Pre-match decimal odds for a draw. */
  oddsDraw?: number;
  /** Pre-match decimal odds for an away win. */
  oddsAwayWin?: number;
  /** Automated point multiplier applied to this fixture (defaults to 1.0). */
  baseMultiplier?: number;
  /** Live in-play home score ("As It Stands"). */
  provisionalHomeScore?: number;
  /** Live in-play away score ("As It Stands"). */
  provisionalAwayScore?: number;
  /** Live match clock, as text (e.g. "45+2", "HT", "78"). */
  matchMinute?: string;
  /**
   * Admin visibility override. When false, the fixture is hidden from
   * player-facing feeds but still manageable in the Admin Panel.
   * Defaults to true.
   */
  isVisible?: boolean;
}

/** Competition currently hosting live or upcoming fixtures in the DB. */
export interface ActiveCompetition {
  competitionId: string;
  competitionName: string;
  sportType: SportType;
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  pointsEarned?: number;
  createdAt: string;
  /**
   * Live running score this prediction is currently tracking, before the match
   * is settled ("As It Stands"). See 20260715_api_automation_schema.sql.
   */
  provisionalPoints?: number;
}

export interface League {
  id: string;
  name: string;
  password?: string;
  /**
   * Deprecated under New Game Rules — leagues are multi-sport social groups.
   * Null/undefined means all competitions. Legacy leagues may still have a value.
   */
  competitionId?: string | null;
  creatorId: string;
  creatorName: string;
  members: string[];
  /** Hidden from the global directory when true (alias of !isPublic). */
  isPrivate?: boolean;
  /** Hard membership cap (1–20). Null/undefined on the Global League = uncapped. */
  maxPlayers?: number | null;
  /** Legacy mirror of !isPrivate — kept for existing UI. */
  isPublic?: boolean;
  /** Legacy mirror of maxPlayers. */
  maxParticipants?: number | null;
  season?: string;
  /** Soft-deleted / archived — hidden from player-facing UIs. */
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}
