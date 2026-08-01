/**
 * Match status helpers — normalize provider short-codes and classify feed buckets.
 *
 * App domain statuses: upcoming | live | completed
 * Provider short-codes (API-Sports) may appear transiently and are mapped here.
 */

import type { Match } from "../types";

const LIVE_STATUSES = new Set([
  "LIVE",
  "IN PLAY",
  "INPLAY",
  "IN_PLAY",
  "1H",
  "2H",
  "HT",
  "ET",
  "BT",
  "P",
  "SUSP",
  "INT",
  "BREAK",
  "LIVE_HALFTIME",
]);

const FINISHED_STATUSES = new Set([
  "FT",
  "AET",
  "PEN",
  "CANC",
  "POSTP",
  "PST",
  "ABD",
  "AWD",
  "WO",
  "COMPLETED",
  "FINISHED",
]);

/** Map a raw DB / provider status string into the app domain status. */
export function normalizeMatchStatus(
  raw: string | null | undefined,
): Match["status"] {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/_/g, " ");
  if (!s) return "upcoming";
  if (s === "UPCOMING" || s === "NS" || s === "TBD" || s === "SCHEDULED") {
    return "upcoming";
  }
  if (s === "LIVE" || LIVE_STATUSES.has(s)) return "live";
  if (s === "COMPLETED" || FINISHED_STATUSES.has(s)) return "completed";
  return "upcoming";
}

export function isLiveMatch(
  match: Pick<Match, "status"> | string | null | undefined,
): boolean {
  if (typeof match === "string" || match == null) {
    return normalizeMatchStatus(match) === "live";
  }
  return normalizeMatchStatus(match.status) === "live";
}

export function isFinishedMatch(
  match: Pick<Match, "status"> | string | null | undefined,
): boolean {
  if (typeof match === "string" || match == null) {
    return normalizeMatchStatus(match) === "completed";
  }
  return normalizeMatchStatus(match.status) === "completed";
}

/**
 * Active Predictions feed membership.
 * Keep upcoming + live (including past kick-off not yet settled).
 * History is reserved for finished statuses only.
 */
export function belongsInActiveFeed(
  match: Pick<Match, "status" | "matchDate">,
  _now = Date.now(),
): boolean {
  // Kickoff in the past is NOT enough to bury a fixture — only finished statuses leave the feed.
  return !isFinishedMatch(match);
}

export function belongsInGameHistory(
  match: Pick<Match, "status" | "matchDate">,
  now = Date.now(),
  historyWindowMs = 7 * 24 * 60 * 60 * 1000,
): boolean {
  if (!isFinishedMatch(match)) return false;
  const kickoff = new Date(match.matchDate).getTime();
  if (Number.isNaN(kickoff)) return false;
  return kickoff >= now - historyWindowMs;
}
