/**
 * PitchSide live score + settlement (quota-aware).
 *
 * Cold-path: check the local `matches` table first. If no catalog match is
 * `live` or `upcoming` with kickoff in the last 3 hours, exit with zero API
 * calls. Otherwise poll today's date-only fixtures/games once per active sport,
 * update provisional scores while live, and settle (kill-switch) on FT/AET/PEN/AWD.
 *
 * Usage (Windows):
 *   npm.cmd run sync:live-settle
 *
 * Required env (project-root .env):
 *   API_SPORTS_KEY              (or API-SPORTS_KEY)
 *   SUPABASE_URL                (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   API_SPORTS_MIN_INTERVAL_MS  (default 7000)
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ApiSportsClient,
  DAILY_BUDGET_CAP,
  utcDay,
  type Sport,
} from "./lib/apiSportsClient";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ── Catalog (must match seed-full / sync-schedule / sync-settlement) ─────────

/** ONLY these API-Sports league IDs are monitored / settled. */
const LEAGUE_CATALOG = {
  football: [39, 40, 179, 45, 2, 3, 1, 48, 52],
  rugby: [13, 16, 22, 14, 15, 26, 19, 10],
} as const;

const SLUG_BY_SPORT_AND_API: Record<string, string> = {
  "football:39": "f-epl",
  "football:40": "f-championship",
  "football:179": "f-spfl",
  "football:45": "f-facup",
  "football:48": "f-eflcup",
  "football:2": "f-ucl",
  "football:3": "f-uel",
  "football:1": "f-worldcup",
  "football:52": "f-shield",
  "rugby:13": "r-top14",
  "rugby:16": "r-prem",
  "rugby:26": "r-urc",
  "rugby:22": "r-sixnations",
  "rugby:14": "r-championship",
  "rugby:15": "r-nations",
  "rugby:19": "r-heineken",
  "rugby:10": "r-worldcup",
};

const CATALOG_SETS: Record<Sport, ReadonlySet<number>> = {
  football: new Set(LEAGUE_CATALOG.football),
  rugby: new Set(LEAGUE_CATALOG.rugby),
};

const CATALOG_COMPETITION_IDS: string[] = (
  Object.entries(LEAGUE_CATALOG) as [Sport, readonly number[]][]
).flatMap(([sport, ids]) =>
  ids.map((id) => SLUG_BY_SPORT_AND_API[`${sport}:${id}`] || `${sport}-${id}`),
);

/** Kickoff lookback for still-`upcoming` rows that should already be underway. */
const ACTIVE_KICKOFF_LOOKBACK_MS = 3 * 60 * 60 * 1000;

const LIVE_STATUSES = new Set([
  "1H",
  "2H",
  "HT",
  "LIVE",
  "ET",
  "BT",
  "P",
  "INT",
  "SUSP",
]);

const FOOTBALL_FINISHED = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
const RUGBY_FINISHED = new Set([
  "FT",
  "FINISHED",
  "ENDED",
  "AET",
  "AWD",
  "WO",
  "PEN",
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireEnv(names: string[]): string {
  for (const name of names) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  throw new Error(`Missing env: one of ${names.join(", ")}`);
}

function statusShort(item: any): string {
  const fixture = item.fixture ?? item;
  return String(fixture.status?.short ?? item.status?.short ?? "").toUpperCase();
}

function statusLong(item: any): string {
  const fixture = item.fixture ?? item;
  return String(fixture.status?.long ?? item.status?.long ?? "").toUpperCase();
}

function leagueIdFromItem(item: any): number | null {
  const id = item?.league?.id ?? item?.league_id ?? null;
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function apiFixtureId(item: any): number | string | null {
  const fixture = item.fixture ?? item;
  return fixture.id ?? item.id ?? null;
}

function formatMatchMinute(item: any): string | null {
  const fixture = item.fixture ?? item;
  const elapsed = fixture.status?.elapsed ?? item.status?.elapsed;
  if (elapsed != null && elapsed !== "") return `${elapsed}'`;
  const short = statusShort(item);
  return short || null;
}

function isFinished(sport: Sport, item: any): boolean {
  const short = statusShort(item);
  const long = statusLong(item);
  if (sport === "football") return FOOTBALL_FINISHED.has(short);
  return (
    RUGBY_FINISHED.has(short) ||
    long === "FINISHED" ||
    long.includes("FINISHED")
  );
}

function isLiveStatus(item: any): boolean {
  return LIVE_STATUSES.has(statusShort(item));
}

function extractLiveScores(item: any): { home: number | null; away: number | null } {
  const fixture = item.fixture ?? item;
  const goals = item.goals ?? item.scores ?? {};
  const home =
    goals.home ?? item.scores?.home ?? fixture.score?.fulltime?.home ?? null;
  const away =
    goals.away ?? item.scores?.away ?? fixture.score?.fulltime?.away ?? null;
  return {
    home: home != null ? Number(home) : null,
    away: away != null ? Number(away) : null,
  };
}

/** Prefer extratime for AET/PEN; never use penalty-shootout totals as match score. */
function extractFootballFinalScores(
  item: any,
): { home: number; away: number } | null {
  const fixture = item.fixture ?? item;
  const short = statusShort(item);
  const score = item.score ?? fixture.score ?? {};

  if (short === "PEN" || short === "AET") {
    const extra = score.extratime;
    if (extra?.home != null && extra?.away != null) {
      return { home: Number(extra.home), away: Number(extra.away) };
    }
  }

  const fulltime = score.fulltime;
  if (fulltime?.home != null && fulltime?.away != null) {
    return { home: Number(fulltime.home), away: Number(fulltime.away) };
  }

  const goals = item.goals ?? fixture.goals;
  if (goals?.home != null && goals?.away != null) {
    return { home: Number(goals.home), away: Number(goals.away) };
  }
  return null;
}

function extractRugbyFinalScores(
  item: any,
): { home: number; away: number } | null {
  const scores = item.scores ?? item.fixture?.scores;
  if (scores?.home != null && scores?.away != null) {
    return { home: Number(scores.home), away: Number(scores.away) };
  }
  return null;
}

function extractFinalScores(
  sport: Sport,
  item: any,
): { home: number; away: number } | null {
  return sport === "football"
    ? extractFootballFinalScores(item)
    : extractRugbyFinalScores(item);
}

/** Keep in sync with src/utils.ts + sync-settlement. */
function calculateFootballPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
): number {
  const predictedWinner =
    predictedHome > predictedAway
      ? "home"
      : predictedHome < predictedAway
        ? "away"
        : "draw";
  const actualWinner =
    actualHome > actualAway ? "home" : actualHome < actualAway ? "away" : "draw";
  if (predictedWinner !== actualWinner) return 0;
  if (predictedHome === actualHome && predictedAway === actualAway) return 5;
  if (predictedHome - predictedAway === actualHome - actualAway) return 3;
  return 1;
}

function calculateRugbyPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
): number {
  const predictedWinner =
    predictedHome > predictedAway
      ? "home"
      : predictedHome < predictedAway
        ? "away"
        : "draw";
  const actualWinner =
    actualHome > actualAway ? "home" : actualHome < actualAway ? "away" : "draw";
  if (predictedWinner !== actualWinner) return 0;
  const marginDifference = Math.abs(
    Math.abs(predictedHome - predictedAway) - Math.abs(actualHome - actualAway),
  );
  if (marginDifference === 0) return 5;
  if (marginDifference <= 7) return 3;
  if (marginDifference <= 10) return 1;
  return 0;
}

function applyMultiplier(basePoints: number, multiplier: number | null): number {
  const factor = multiplier != null && multiplier > 0 ? Number(multiplier) : 1;
  return Math.round(basePoints * factor);
}

type DbMatch = {
  id: string;
  sport: Sport;
  status: string;
  kickoff_time: string | null;
  competition_id: string | null;
  base_multiplier: number | null;
};

/**
 * Active window = catalog matches that are `live`, OR `upcoming` with kickoff
 * in the last 3 hours. Completed rows never qualify (kill-switch already fired).
 */
async function loadActiveCatalogMatches(
  supabase: SupabaseClient,
): Promise<DbMatch[]> {
  const sinceIso = new Date(Date.now() - ACTIVE_KICKOFF_LOOKBACK_MS).toISOString();
  const nowIso = new Date().toISOString();

  const { data: liveRows, error: liveErr } = await supabase
    .from("matches")
    .select("id, sport, status, kickoff_time, competition_id, base_multiplier")
    .eq("status", "live")
    .in("competition_id", CATALOG_COMPETITION_IDS);

  if (liveErr) {
    console.warn(`[sync-live-settle] live query failed: ${liveErr.message}`);
  }

  const { data: upcomingRows, error: upErr } = await supabase
    .from("matches")
    .select("id, sport, status, kickoff_time, competition_id, base_multiplier")
    .eq("status", "upcoming")
    .gte("kickoff_time", sinceIso)
    .lte("kickoff_time", nowIso)
    .in("competition_id", CATALOG_COMPETITION_IDS);

  if (upErr) {
    console.warn(`[sync-live-settle] upcoming query failed: ${upErr.message}`);
  }

  const byId = new Map<string, DbMatch>();
  for (const row of [...(liveRows || []), ...(upcomingRows || [])]) {
    if (row.sport !== "football" && row.sport !== "rugby") continue;
    byId.set(row.id, row as DbMatch);
  }
  return Array.from(byId.values());
}

async function gradePredictions(
  supabase: SupabaseClient,
  sport: Sport,
  matchId: string,
  actualHome: number,
  actualAway: number,
  multiplier: number | null,
): Promise<number> {
  const { data: predictions, error } = await supabase
    .from("predictions")
    .select("id, predicted_home_score, predicted_away_score")
    .eq("match_id", matchId);

  if (error) {
    console.warn(
      `[sync-live-settle] prediction fetch failed for ${matchId}: ${error.message}`,
    );
    return 0;
  }

  let graded = 0;
  for (const pred of predictions ?? []) {
    const base =
      sport === "football"
        ? calculateFootballPoints(
            pred.predicted_home_score,
            pred.predicted_away_score,
            actualHome,
            actualAway,
          )
        : calculateRugbyPoints(
            pred.predicted_home_score,
            pred.predicted_away_score,
            actualHome,
            actualAway,
          );
    const pointsWon = applyMultiplier(base, multiplier);
    const { error: updErr } = await supabase
      .from("predictions")
      .update({ points_won: pointsWon })
      .eq("id", pred.id);
    if (updErr) {
      console.warn(
        `[sync-live-settle] prediction update failed ${pred.id}: ${updErr.message}`,
      );
      continue;
    }
    graded++;
  }
  return graded;
}

async function processSport(
  sport: Sport,
  client: ApiSportsClient,
  supabase: SupabaseClient,
  knownById: Map<string, DbMatch>,
): Promise<{
  liveUpdated: number;
  settled: number;
  predictionsGraded: number;
  fetched: number;
}> {
  const today = utcDay();
  const path = sport === "football" ? "/fixtures" : "/games";
  const label = `live-settle ${sport} date=${today}`;
  const catalog = CATALOG_SETS[sport];

  console.log(
    `[sync-live-settle] Fetching ${sport} ${path}?date=${today} (date-only)`,
  );

  const result = await client.get(sport, path, { date: today }, label);

  if (!result.ok) {
    if (result.reason === "budget_exhausted") {
      console.warn(
        `[sync-live-settle] Budget exhausted for ${sport} — skipping (calls_made=${result.callsMadeToday}/${DAILY_BUDGET_CAP})`,
      );
    } else if (result.reason === "plan_blocked") {
      console.warn(
        `[sync-live-settle] Subscription / plan block for ${sport}: ${result.message}`,
      );
    } else if (result.reason === "validation_error") {
      console.warn(
        `[sync-live-settle] API validation error for ${sport}: ${result.message}`,
      );
    } else {
      console.warn(
        `[sync-live-settle] API error for ${sport} (${result.reason}): ${result.message}`,
      );
    }
    return { liveUpdated: 0, settled: 0, predictionsGraded: 0, fetched: 0 };
  }

  const fixtures: any[] = Array.isArray(result.json?.response)
    ? result.json.response
    : [];

  const catalogItems = fixtures.filter((item) => {
    const leagueId = leagueIdFromItem(item);
    return leagueId != null && catalog.has(leagueId);
  });

  let liveUpdated = 0;
  let settled = 0;
  let predictionsGraded = 0;
  const nowIso = new Date().toISOString();

  for (const item of catalogItems) {
    const apiId = apiFixtureId(item);
    if (apiId == null) continue;
    const matchId = `${sport}-${apiId}`;
    const known = knownById.get(matchId);

    // Only touch rows already in our DB (schedule seed owns inserts).
    if (!known) continue;
    // Kill-switch already fired — never re-process completed.
    if (known.status === "completed") continue;

    if (isFinished(sport, item)) {
      const scores = extractFinalScores(sport, item);
      if (!scores) {
        console.warn(
          `[sync-live-settle] Finished ${matchId} but could not read final scores — skipping`,
        );
        continue;
      }

      const { error } = await supabase
        .from("matches")
        .update({
          status: "completed",
          actual_home_score: scores.home,
          actual_away_score: scores.away,
          provisional_home_score: null,
          provisional_away_score: null,
          match_minute: null,
          updated_at: nowIso,
        })
        .eq("id", matchId)
        .neq("status", "completed");

      if (error) {
        console.warn(
          `[sync-live-settle] settle update failed ${matchId}: ${error.message}`,
        );
        continue;
      }

      settled++;
      known.status = "completed";
      console.log(
        `[sync-live-settle] KILL SWITCH ${matchId} → completed ${scores.home}-${scores.away}`,
      );

      predictionsGraded += await gradePredictions(
        supabase,
        sport,
        matchId,
        scores.home,
        scores.away,
        known.base_multiplier,
      );
      continue;
    }

    if (isLiveStatus(item)) {
      const scores = extractLiveScores(item);
      const { error } = await supabase
        .from("matches")
        .update({
          status: "live",
          provisional_home_score: scores.home,
          provisional_away_score: scores.away,
          match_minute: formatMatchMinute(item),
          updated_at: nowIso,
        })
        .eq("id", matchId)
        .neq("status", "completed");

      if (error) {
        console.warn(
          `[sync-live-settle] live update failed ${matchId}: ${error.message}`,
        );
        continue;
      }

      liveUpdated++;
      known.status = "live";
    }
  }

  return {
    liveUpdated,
    settled,
    predictionsGraded,
    fetched: catalogItems.length,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = requireEnv(["API_SPORTS_KEY", "API-SPORTS_KEY"]);
  const supabaseUrl = requireEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const serviceRoleKey = requireEnv(["SUPABASE_SERVICE_ROLE_KEY"]);
  const minIntervalMs = Number(
    process.env.API_SPORTS_MIN_INTERVAL_MS || "7000",
  );

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const active = await loadActiveCatalogMatches(supabase);

  if (active.length === 0) {
    console.log("No active match window open. 0 API calls made.");
    return;
  }

  const sportsNeeded = [
    ...new Set(active.map((m) => m.sport)),
  ] as Sport[];

  console.log(
    `[sync-live-settle] Active window: ${active.length} match(es) across [${sportsNeeded.join(", ")}]`,
  );
  for (const m of active) {
    console.log(
      `  • ${m.id} status=${m.status} kickoff=${m.kickoff_time ?? "?"} comp=${m.competition_id}`,
    );
  }

  const client = new ApiSportsClient({
    supabase,
    apiKey,
    caller: "sync-live-settle",
    budgetCap: DAILY_BUDGET_CAP,
    minIntervalMs: Number.isFinite(minIntervalMs) ? minIntervalMs : 7000,
  });

  const knownById = new Map(active.map((m) => [m.id, m]));

  let liveUpdated = 0;
  let settled = 0;
  let predictionsGraded = 0;
  let fetched = 0;

  for (const sport of sportsNeeded) {
    const outcome = await processSport(sport, client, supabase, knownById);
    liveUpdated += outcome.liveUpdated;
    settled += outcome.settled;
    predictionsGraded += outcome.predictionsGraded;
    fetched += outcome.fetched;
  }

  const usageFb = await client.getUsageToday("football").catch(() => null);
  const usageRb = await client.getUsageToday("rugby").catch(() => null);

  client.logRunSummary({
    activeMatches: active.length,
    sports: sportsNeeded,
    fetched,
    liveUpdated,
    settled,
    predictionsGraded,
    footballCallsToday: usageFb?.calls_made ?? null,
    rugbyCallsToday: usageRb?.calls_made ?? null,
    budgetCap: DAILY_BUDGET_CAP,
  });

  console.log(
    `[sync-live-settle] Done — fetched=${fetched} liveUpdated=${liveUpdated} settled=${settled} predictionsGraded=${predictionsGraded} apiCallsThisRun=${client.stats.callsThisRun}`,
  );
}

main().catch((err) => {
  console.error("[sync-live-settle] Fatal:", err);
  process.exitCode = 1;
});
