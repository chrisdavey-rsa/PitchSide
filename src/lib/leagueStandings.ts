/**
 * League Hub dual-pillar standings (New Game Rules §3).
 * Sport-scoped + time-horizon point aggregation for league members.
 */

import { Match, SportType } from "../types";
import { BASE_SEASON_YEAR, getLatestSeason } from "../seasons";
import { outcomeOf, settlePredictionPoints } from "../services/scoringEngine";
import type { AppliedChip } from "../services/scoringEngine";
import { formatAccuracyPercent } from "./formatAccuracy";

export type StandingsHorizon = "season" | "month" | "week";

export type LeaguePredictionRow = {
  userId: string;
  matchId: string;
  sport: SportType;
  home: number;
  away: number;
  submitted: boolean;
  /** Settled / chip-adjusted points from RPC (may be 0). */
  pointsWon?: number | null;
  /** Chip type used at settle — mirrors global leaderboard JOIN. */
  chipType?: AppliedChip;
};

export type LeagueStandingRow = {
  playerId: string;
  nickname: string;
  firstName?: string;
  surname?: string;
  nationality?: string;
  points: number;
  predictionsMade: number;
  accuracy: string;
  correctOutcomes: number;
  perfectHits: number;
};

/** Labels for the Season pill (e.g. "YTD / 2026 Season"). */
export function seasonHorizonLabel(now: Date = new Date()): string {
  return `YTD / ${getLatestSeason(now)} Season`;
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

/**
 * Points for a standings row — NEVER recalculate base-only when settled
 * earned points are present (including 0). Global leaderboard uses
 * pitchside_settle_prediction_points; private boards must match.
 */
function pointsForPrediction(
  row: LeaguePredictionRow,
  match: Match | undefined,
): number {
  // Strict: a finite pointsWon from the settle RPC / column wins, including 0.
  if (typeof row.pointsWon === "number" && Number.isFinite(row.pointsWon)) {
    return row.pointsWon;
  }

  // Fallback only when payload omitted settle (legacy RPC / optimistic merge):
  // recompute with chip, same as global — never bare calculatePoints.
  if (
    match &&
    match.status === "completed" &&
    match.homeScore !== undefined &&
    match.awayScore !== undefined
  ) {
    return settlePredictionPoints(
      match.sport,
      row.home,
      row.away,
      match.homeScore,
      match.awayScore,
      row.chipType,
    ).earnedPoints;
  }

  return 0;
}

function isPerfectHit(
  row: LeaguePredictionRow,
  match: Match | undefined,
): boolean {
  if (
    !match ||
    match.status !== "completed" ||
    match.homeScore === undefined ||
    match.awayScore === undefined
  ) {
    // Fallback without scores: treat base exact (5 pts) as perfect.
    return row.pointsWon === 5;
  }
  if (match.sport === SportType.FOOTBALL || row.sport === SportType.FOOTBALL) {
    return row.home === match.homeScore && row.away === match.awayScore;
  }
  // Rugby perfect = correct outcome + exact margin.
  if (
    outcomeOf(row.home, row.away) !==
    outcomeOf(match.homeScore, match.awayScore)
  ) {
    return false;
  }
  const predMargin = Math.abs(row.home - row.away);
  const actualMargin = Math.abs(match.homeScore - match.awayScore);
  return predMargin === actualMargin;
}

function isCorrectOutcome(
  row: LeaguePredictionRow,
  match: Match | undefined,
): boolean {
  if (
    !match ||
    match.status !== "completed" ||
    match.homeScore === undefined ||
    match.awayScore === undefined
  ) {
    return typeof row.pointsWon === "number" && row.pointsWon > 0;
  }
  return (
    outcomeOf(row.home, row.away) ===
    outcomeOf(match.homeScore, match.awayScore)
  );
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
  firstNameById?: Record<string, string>;
  surnameById?: Record<string, string>;
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
    firstNameById = {},
    surnameById = {},
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
    if (isCorrectOutcome(row, match)) bucket.correct += 1;
    if (isPerfectHit(row, match)) bucket.perfect += 1;
  }

  const rows: LeagueStandingRow[] = [];
  for (const playerId of memberIds) {
    const stats = totals.get(playerId)!;
    if (stats.made === 0) continue; // unlock / cross-pollination: hide zero-pick members
    const accuracy =
      stats.made > 0
        ? formatAccuracyPercent((stats.correct / stats.made) * 100)
        : "0%";
    rows.push({
      playerId,
      nickname: nicknameById[playerId] || "Player",
      firstName: firstNameById[playerId] || "",
      surname: surnameById[playerId] || "",
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
