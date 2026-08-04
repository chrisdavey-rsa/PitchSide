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

/** Game History only keeps settled fixtures from the last 72 hours. */
export const GAME_HISTORY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Map a raw DB / provider status string into the app domain status. */
export function normalizeMatchStatus(
  raw: string | null | undefined | Pick<Match, "status">,
): Match["status"] {
  const value =
    typeof raw === "object" && raw != null && "status" in raw
      ? raw.status
      : raw;
  const s = String(value ?? "")
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
  return normalizeMatchStatus(match) === "live";
}

export function isFinishedMatch(
  match: Pick<Match, "status"> | string | null | undefined,
): boolean {
  return normalizeMatchStatus(match) === "completed";
}

/** True when kickoff falls on the viewer's local calendar day. */
export function isSameLocalDay(
  dateIso: string,
  now: Date = new Date(),
): boolean {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Active Predictions feed membership.
 * Same-day fixtures stay here for the whole local day — including FT.
 * Unfinished fixtures always stay in the active feed.
 */
export function belongsInActiveFeed(
  match: Pick<Match, "status" | "matchDate">,
  now = Date.now(),
): boolean {
  const nowDate = new Date(now);
  if (isSameLocalDay(match.matchDate, nowDate)) return true;
  return !isFinishedMatch(match);
}

/**
 * Game History: settled fixtures from a previous local day, within 72 hours.
 */
export function belongsInGameHistory(
  match: Pick<Match, "status" | "matchDate">,
  now = Date.now(),
  historyWindowMs = GAME_HISTORY_WINDOW_MS,
): boolean {
  const nowDate = new Date(now);
  if (isSameLocalDay(match.matchDate, nowDate)) return false;
  if (!isFinishedMatch(match)) return false;
  const kickoff = new Date(match.matchDate).getTime();
  if (Number.isNaN(kickoff) || kickoff >= now) return false;
  return kickoff >= now - historyWindowMs;
}
