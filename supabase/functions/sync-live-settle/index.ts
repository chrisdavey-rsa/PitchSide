// ============================================================================
// sync-live-settle — combined live scores + kill-switch settlement (cron)
// ----------------------------------------------------------------------------
// Port of scripts/sync-live-settle.ts for Supabase Edge + Cron.
//
// Gatekeeper: query matches first. If no catalog match is `live` or `upcoming`
// with kickoff in the last 3 hours → return immediately (0 API calls).
//
// Poll shape (per active sport), then filter to LEAGUE_CATALOG client-side:
//   football → GET /fixtures?live=all  (freshest minute/score; no date cache)
//   rugby    → GET /games?date=YYYY-MM-DD
//
// Kill switch: FT/AET/PEN/AWD → actual scores, status=completed, clear minute,
// grade predictions. Completed matches never re-enter the active window.
//
// Invoke (POST or GET — Cron-friendly). Optional JSON body ignored.
//
// Required secrets:
//   API_SPORTS_KEY
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto-injected on hosted)
// Optional:
//   API_SPORTS_MIN_INTERVAL_MS (default 7000)
//   API_SPORTS_DAILY_BUDGET (default 7000)
// ============================================================================

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  ApiSportsClient,
  DAILY_BUDGET_CAP,
  UpstreamAuthError,
  getApiSportsKey,
  utcDay,
  type Sport,
} from "../_shared/apiSportsClient.ts";
import {
  FOOTBALL_API_IDS,
  FOOTBALL_LEAGUES,
  FOOTBALL_SLUG_BY_API,
} from "../_shared/footballLeagues.ts";
import {
  formatMatchMinuteFromProvider,
  providerStatusFromItem,
} from "../_shared/matchClock.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/** ONLY these API-Sports league IDs are monitored / settled. */
const LEAGUE_CATALOG: Record<Sport, readonly number[]> = {
  football: FOOTBALL_LEAGUES.map((l) => l.apiId),
  rugby: [13, 16, 22, 14, 15, 26, 19, 10],
};

const SLUG_BY_SPORT_AND_API: Record<string, string> = {
  ...FOOTBALL_SLUG_BY_API,
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
  football: FOOTBALL_API_IDS,
  rugby: new Set(LEAGUE_CATALOG.rugby),
};

const CATALOG_COMPETITION_IDS: string[] = [
  ...FOOTBALL_LEAGUES.map((l) => l.slug),
  ...LEAGUE_CATALOG.rugby.map(
    (id) => SLUG_BY_SPORT_AND_API[`rugby:${id}`] || `rugby-${id}`,
  ),
];

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

type DbMatch = {
  id: string;
  sport: Sport;
  status: string;
  kickoff_time: string | null;
  competition_id: string | null;
  base_multiplier: number | null;
  is_golden_ticket?: boolean | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
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
  return formatMatchMinuteFromProvider(providerStatusFromItem(item));
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

function extractLiveScores(
  item: any,
): { home: number | null; away: number | null } {
  // Football (verified): goals.home / goals.away. Rugby uses scores.*.
  const goals = item.goals ?? item.scores ?? {};
  return {
    home: goals.home != null ? Number(goals.home) : null,
    away: goals.away != null ? Number(goals.away) : null,
  };
}

function extractFootballFinalScores(
  item: any,
): { home: number; away: number } | null {
  const fixture = item.fixture ?? item;
  const short = statusShort(item);
  const score = item.score ?? fixture.score ?? {};
  const goals = item.goals ?? {};

  if (short === "PEN" || short === "AET") {
    const extra = score.extratime;
    if (extra?.home != null && extra?.away != null) {
      return { home: Number(extra.home), away: Number(extra.away) };
    }
  }

  if (goals.home != null && goals.away != null) {
    return { home: Number(goals.home), away: Number(goals.away) };
  }

  const fulltime = score.fulltime;
  if (fulltime?.home != null && fulltime?.away != null) {
    return { home: Number(fulltime.home), away: Number(fulltime.away) };
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

function calculateFootballPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
): number {
  const predictedWinner = predictedHome > predictedAway
    ? "home"
    : predictedHome < predictedAway
    ? "away"
    : "draw";
  const actualWinner = actualHome > actualAway
    ? "home"
    : actualHome < actualAway
    ? "away"
    : "draw";
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
  const predictedWinner = predictedHome > predictedAway
    ? "home"
    : predictedHome < predictedAway
    ? "away"
    : "draw";
  const actualWinner = actualHome > actualAway
    ? "home"
    : actualHome < actualAway
    ? "away"
    : "draw";
  if (predictedWinner !== actualWinner) return 0;
  const marginDifference = Math.abs(
    Math.abs(predictedHome - predictedAway) -
      Math.abs(actualHome - actualAway),
  );
  if (marginDifference === 0) return 5;
  if (marginDifference <= 7) return 3;
  if (marginDifference <= 10) return 1;
  return 0;
}

type ChipType =
  | "double_bubble"
  | "safety_net"
  | "sniper"
  | "banker"
  | "pitchside_master";

const EXACT_SCORE_POINTS = 5;
const SAFETY_FLOOR = 5;

/** Keep in sync with sync-settlement / scoringEngine / pitchside_apply_chip. */
function applyChip(
  basePoints: number,
  chip: ChipType | null | undefined,
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
): { points: number; isBankerExact: boolean } {
  let points = basePoints;
  let isBankerExact = false;

  const predictedWinner = predictedHome > predictedAway
    ? "home"
    : predictedHome < predictedAway
    ? "away"
    : "draw";
  const actualWinner = actualHome > actualAway
    ? "home"
    : actualHome < actualAway
    ? "away"
    : "draw";
  const outcomeCorrect = predictedWinner === actualWinner;
  const isExact = predictedHome === actualHome && predictedAway === actualAway;

  if (chip === "banker") {
    if (outcomeCorrect) {
      points = EXACT_SCORE_POINTS;
      isBankerExact = true;
    }
  } else if (chip === "sniper" && isExact) {
    points = Math.round(points * 1.5);
  }

  if (chip === "double_bubble") points *= 2;
  else if (chip === "pitchside_master") points *= 3;

  if (chip === "safety_net" && points === 0) points = SAFETY_FLOOR;

  return { points, isBankerExact };
}

function applyMultiplier(
  basePoints: number,
  multiplier: number | null,
): number {
  const factor = multiplier != null && multiplier > 0 ? Number(multiplier) : 1;
  return Math.round(basePoints * factor);
}

/**
 * Gatekeeper: catalog matches that are `live`, OR `upcoming` with kickoff
 * in the last 3 hours. Completed rows never qualify.
 */
async function loadActiveCatalogMatches(
  supabase: SupabaseClient,
): Promise<DbMatch[]> {
  const sinceIso = new Date(Date.now() - ACTIVE_KICKOFF_LOOKBACK_MS)
    .toISOString();
  const nowIso = new Date().toISOString();

  const { data: liveRows, error: liveErr } = await supabase
    .from("matches")
    .select("id, sport, status, kickoff_time, competition_id, base_multiplier, is_golden_ticket")
    .eq("status", "live")
    .in("competition_id", CATALOG_COMPETITION_IDS);

  if (liveErr) {
    console.warn(`[sync-live-settle] live query failed: ${liveErr.message}`);
  }

  const { data: upcomingRows, error: upErr } = await supabase
    .from("matches")
    .select("id, sport, status, kickoff_time, competition_id, base_multiplier, is_golden_ticket")
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
  isGoldenTicket = false,
): Promise<number> {
  const { data: predictions, error } = await supabase
    .from("predictions")
    .select(
      "id, user_id, predicted_home_score, predicted_away_score, applied_chip_id",
    )
    .eq("match_id", matchId);

  if (error) {
    console.warn(
      `[sync-live-settle] prediction fetch failed for ${matchId}: ${error.message}`,
    );
    return 0;
  }

  const chipIds = [
    ...new Set(
      (predictions ?? [])
        .map((p) => p.applied_chip_id as string | null)
        .filter((id): id is string => !!id),
    ),
  ];
  const chipTypeById = new Map<string, ChipType>();
  if (chipIds.length > 0) {
    const { data: chips } = await supabase
      .from("user_chips")
      .select("id, chip_type")
      .in("id", chipIds);
    for (const chip of chips ?? []) {
      chipTypeById.set(chip.id, chip.chip_type as ChipType);
    }
  }

  let graded = 0;
  for (const pred of predictions ?? []) {
    const chipType = pred.applied_chip_id
      ? chipTypeById.get(pred.applied_chip_id) ?? null
      : null;
    const base = sport === "football"
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
    const powered = applyChip(
      base,
      chipType,
      pred.predicted_home_score,
      pred.predicted_away_score,
      actualHome,
      actualAway,
    );
    const pointsWon = applyMultiplier(powered.points, multiplier);
    const { error: updErr } = await supabase
      .from("predictions")
      .update({
        points_won: pointsWon,
        is_banker_exact: powered.isBankerExact,
      })
      .eq("id", pred.id);
    if (updErr) {
      console.warn(
        `[sync-live-settle] prediction update failed ${pred.id}: ${updErr.message}`,
      );
      continue;
    }

    const isExact =
      pred.predicted_home_score === actualHome &&
      pred.predicted_away_score === actualAway;
    if (
      isGoldenTicket &&
      isExact &&
      !powered.isBankerExact &&
      pred.user_id
    ) {
      const { error: ticketErr } = await supabase.rpc(
        "increment_golden_tickets",
        { p_user_id: pred.user_id },
      );
      if (ticketErr) {
        console.warn(
          `[sync-live-settle] golden ticket award failed ${pred.id}: ${ticketErr.message}`,
        );
      }
    }

    // Chip is normally marked used at lock time; keep settlement idempotent.
    if (pred.applied_chip_id) {
      await supabase
        .from("user_chips")
        .update({
          status: "used",
          used_at: new Date().toISOString(),
          applied_fixture_id: matchId,
        })
        .eq("id", pred.applied_chip_id)
        .eq("status", "available");
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
  const apiPath = sport === "football" ? "/fixtures" : "/games";
  // Football: live=all for freshest minute/score ticks (bypass date-window cache).
  // Rugby: keep date=today (rugby API has no equivalent live=all shape here).
  const params: Record<string, string> = sport === "football"
    ? { live: "all" }
    : { date: today };
  const label = sport === "football"
    ? `live-settle ${sport} live=all`
    : `live-settle ${sport} date=${today}`;
  const catalog = CATALOG_SETS[sport];

  console.log(
    `[sync-live-settle] Fetching ${sport} ${apiPath}?${
      sport === "football" ? "live=all" : `date=${today}`
    }`,
  );

  const result = await client.get(sport, apiPath, params, label);

  if (!result.ok) {
    if (result.reason === "auth_failure") {
      throw new UpstreamAuthError(result.status ?? 401, "sync-live-settle");
    }
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

    if (!known) continue;
    if (known.status === "completed") continue;

    if (isFinished(sport, item)) {
      const scores = extractFinalScores(sport, item);
      if (!scores) {
        console.warn(
          `[sync-live-settle] Finished ${matchId} but could not read final scores — skipping`,
        );
        continue;
      }

      const externalFixtureId = Number.isFinite(Number(apiId))
        ? Number(apiId)
        : null;
      const { error } = await supabase
        .from("matches")
        .update({
          status: "completed",
          external_fixture_id: externalFixtureId,
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
        known.is_golden_ticket === true,
      );
      continue;
    }

    if (isLiveStatus(item)) {
      const scores = extractLiveScores(item);
      const externalFixtureId = Number.isFinite(Number(apiId))
        ? Number(apiId)
        : null;
      const { error } = await supabase
        .from("matches")
        .update({
          status: "live",
          external_fixture_id: externalFixtureId,
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed. Use GET or POST." }, 405);
  }

  const apiKey = getApiSportsKey();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const minIntervalRaw = Deno.env.get("API_SPORTS_MIN_INTERVAL_MS") ?? "7000";
  const minIntervalMs = Number(minIntervalRaw);

  if (!apiKey) {
    return jsonResponse({ error: "Missing API_SPORTS_KEY secret." }, 500);
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret." },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const active = await loadActiveCatalogMatches(supabase);

    if (active.length === 0) {
      console.log("No active match window open. 0 API calls made.");
      return jsonResponse({
        skipped: "no_active_window",
        message: "No active match window open. 0 API calls made.",
        activeMatches: 0,
        apiCallsThisRun: 0,
        fetched: 0,
        liveUpdated: 0,
        settled: 0,
        predictionsGraded: 0,
        budget: DAILY_BUDGET_CAP,
      });
    }

    const sportsNeeded = [
      ...new Set(active.map((m) => m.sport)),
    ] as Sport[];

    console.log(
      `[sync-live-settle] Active window: ${active.length} match(es) across [${sportsNeeded.join(", ")}]`,
    );

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

    return jsonResponse({
      date: utcDay(),
      sports: sportsNeeded,
      activeMatches: active.length,
      fetched,
      liveUpdated,
      settled,
      predictionsGraded,
      apiCallsThisRun: client.stats.callsThisRun,
      footballCallsToday: usageFb?.calls_made ?? null,
      rugbyCallsToday: usageRb?.calls_made ?? null,
      budget: DAILY_BUDGET_CAP,
      skippedBudget: client.stats.skippedBudget,
      planBlocked: client.stats.planBlocked,
    });
  } catch (err) {
    if (err instanceof UpstreamAuthError) {
      console.error(
        `[sync-live-settle] CRITICAL: Upstream API-Sports authentication failure (HTTP ${err.status})`,
      );
      return jsonResponse(
        {
          error: "Upstream API-Sports authentication failure",
          status: err.status,
          caller: err.caller,
        },
        err.status,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-live-settle] Fatal:", message);
    return jsonResponse({ error: "sync-live-settle failed", detail: message }, 500);
  }
});
