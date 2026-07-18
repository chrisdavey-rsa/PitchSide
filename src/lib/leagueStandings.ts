/**
 * League Hub dual-pillar standings (New Game Rules §3).
 * Sport-scoped + time-horizon point aggregation for league members.
 */

import { Match, SportType } from "../types";
import { calculatePoints } from "../utils";
import { BASE_SEASON_YEAR, getLatestSeason } from "../seasons";

export type StandingsHorizon = "season" | "month" | "week";

export type LeaguePredictionRow = {
  userId: string;
  matchId: string;
  sport: SportType;
  home: number;
  away: number;
  submitted: boolean;
  pointsWon?: number | null;
};

export type LeagueStandingRow = {
  playerId: string;
  nickname: string;
  nationality?: string;
  points: number;
  predictionsMade: number;
  accuracy: string;
  correctOutcomes: number;
  perfectHits: number;
};

/** Labels for the Season pill (e.g. "2026 Season"). */
export function seasonHorizonLabel(now: Date = new Date()): string {
  return `${getLatestSeason(now)} Season`;
}

export function isMatchInHorizon(
  match: Match,
  horizon: StandingsHorizon,
  now: Date = new Date(),
): boolean {
  if (match.status !== "completed") return false;
  const settled = new Date(match.matchDate);
  if (Number.isNaN(settled.getTime())) return false;

  if (horizon === "season") {
    return settled.getUTCFullYear() >= BASE_SEASON_YEAR;
  }

  if (horizon === "month") {
    return (
      settled.getUTCFullYear() === now.getUTCFullYear() &&
      settled.getUTCMonth() === now.getUTCMonth()
    );
  }

  // This Week — last 7 days (UTC wall clock)
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  return settled.getTime() >= weekAgo && settled.getTime() <= now.getTime();
}

function pointsForPrediction(
  row: LeaguePredictionRow,
  match: Match | undefined,
): number {
  if (
    match &&
    match.status === "completed" &&
    match.homeScore !== undefined &&
    match.awayScore !== undefined
  ) {
    return calculatePoints(
      match.sport,
      row.home,
      row.away,
      match.homeScore,
      match.awayScore,
    );
  }
  if (typeof row.pointsWon === "number") return row.pointsWon;
  return 0;
}

/**
 * Count submitted picks for a user in a sport (unlock gate — not horizon-scoped).
 */
export function countSubmittedForSport(
  rows: LeaguePredictionRow[],
  userId: string,
  sport: SportType,
): number {
  return rows.filter(
    (r) => r.userId === userId && r.submitted && r.sport === sport,
  ).length;
}

/**
 * Build ranked standings for one sport + horizon.
 * Members with zero submitted picks in that sport are excluded from the list.
 */
export function buildLeagueSportStandings(options: {
  memberIds: string[];
  nicknameById: Record<string, string>;
  nationalityById?: Record<string, string>;
  predictions: LeaguePredictionRow[];
  matches: Match[];
  sport: SportType;
  horizon: StandingsHorizon;
  now?: Date;
}): LeagueStandingRow[] {
  const {
    memberIds,
    nicknameById,
    nationalityById = {},
    predictions,
    matches,
    sport,
    horizon,
    now = new Date(),
  } = options;

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const memberSet = new Set(memberIds);

  const totals = new Map<
    string,
    { points: number; made: number; correct: number; perfect: number }
  >();

  for (const id of memberIds) {
    totals.set(id, { points: 0, made: 0, correct: 0, perfect: 0 });
  }

  for (const row of predictions) {
    if (!row.submitted || row.sport !== sport) continue;
    if (!memberSet.has(row.userId)) continue;

    const match = matchById.get(row.matchId);
    // Prefer match sport when available (guards mismatched rows).
    if (match && match.sport !== sport) continue;
    if (match && !isMatchInHorizon(match, horizon, now)) continue;
    // If match missing from local cache, only count season-wide via points_won.
    if (!match) {
      if (horizon !== "season") continue;
      const pts = typeof row.pointsWon === "number" ? row.pointsWon : 0;
      const bucket = totals.get(row.userId);
      if (!bucket) continue;
      bucket.made += 1;
      bucket.points += pts;
      if (pts > 0) bucket.correct += 1;
      if (pts === 5) bucket.perfect += 1;
      continue;
    }

    const pts = pointsForPrediction(row, match);
    const bucket = totals.get(row.userId);
    if (!bucket) continue;
    bucket.made += 1;
    bucket.points += pts;
    if (pts > 0) bucket.correct += 1;
    if (pts === 5) bucket.perfect += 1;
  }

  const rows: LeagueStandingRow[] = [];
  for (const playerId of memberIds) {
    const stats = totals.get(playerId)!;
    if (stats.made === 0) continue; // unlock / cross-pollination: hide zero-pick members
    const accuracy =
      stats.made > 0
        ? `${Math.round((stats.correct / stats.made) * 100)}%`
        : "0%";
    rows.push({
      playerId,
      nickname: nicknameById[playerId] || "Player",
      nationality: nationalityById[playerId],
      points: stats.points,
      predictionsMade: stats.made,
      accuracy,
      correctOutcomes: stats.correct,
      perfectHits: stats.perfect,
    });
  }

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.predictionsMade !== a.predictionsMade) {
      return b.predictionsMade - a.predictionsMade;
    }
    return a.nickname.localeCompare(b.nickname);
  });

  return rows;
}
