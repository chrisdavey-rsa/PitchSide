// ============================================================================
// sync-settlement — API-Sports final score ingestion + automated grading (Phase 3)
// ----------------------------------------------------------------------------
// Fetches fixtures via ONE date-only call (GET /fixtures?date=X or /games?date=X —
// no league/season), filters to LEAGUE_CATALOG, settles completed matches, then
// grades linked predictions server-side (with multiplier).
//
// Invoke (POST):
//   { "sport": "football" | "rugby", "date": "YYYY-MM-DD" (optional) }
//
// Required secrets (Deno.env):
//   API_SPORTS_KEY               — your API-Sports key
//   SUPABASE_URL                 — project URL (auto-injected on deploy)
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (auto-injected on deploy)
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import {
  ApiSportsClient,
  DAILY_BUDGET_CAP,
  type Sport as SharedSport,
} from "../_shared/apiSportsClient.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FOOTBALL_FINISHED = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
const RUGBY_FINISHED = new Set([
  "FT",
  "FINISHED",
  "ENDED",
  "AET",
  "AWD",
  "WO",
]);

type Sport = "football" | "rugby";

/** ONLY these league IDs are settled (must match seed-full / sync-schedule). */
const LEAGUE_CATALOG: Record<Sport, ReadonlySet<number>> = {
  football: new Set([39, 40, 179, 45, 2, 3, 1, 48, 52]),
  rugby: new Set([13, 16, 22, 14, 15, 26, 19, 10]),
};

interface FinalScores {
  home: number;
  away: number;
}

interface SettledMatch {
  id: string;
  actual_home_score: number;
  actual_away_score: number;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function isFinished(sport: Sport, item: any): boolean {
  const fixture = item.fixture ?? item;
  const short = String(fixture.status?.short ?? item.status?.short ?? "")
    .toUpperCase();
  const long = String(fixture.status?.long ?? item.status?.long ?? "")
    .toUpperCase();

  if (sport === "football") {
    return FOOTBALL_FINISHED.has(short);
  }

  return RUGBY_FINISHED.has(short) ||
    long === "FINISHED" ||
    long.includes("FINISHED");
}

/**
 * Football final score: prefer post-extra-time, excluding penalty shootout totals.
 * API-Sports exposes score.extratime / score.fulltime separately from penalties.
 */
function extractFootballFinalScores(item: any): FinalScores | null {
  const fixture = item.fixture ?? item;
  const statusShort = String(fixture.status?.short ?? item.status?.short ?? "")
    .toUpperCase();
  const score = item.score ?? fixture.score ?? {};

  if (statusShort === "PEN" || statusShort === "AET") {
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

function extractRugbyFinalScores(item: any): FinalScores | null {
  const scores = item.scores ?? item.fixture?.scores;
  if (scores?.home != null && scores?.away != null) {
    return { home: Number(scores.home), away: Number(scores.away) };
  }
  return null;
}

function extractFinalScores(sport: Sport, item: any): FinalScores | null {
  return sport === "football"
    ? extractFootballFinalScores(item)
    : extractRugbyFinalScores(item);
}

/**
 * Football scoring (5 / 3 / 1 / 0).
 * Keep in sync with src/utils.ts calculateFootballPoints and
 * SQL public.pitchside_football_points.
 */
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

  const predictedMargin = predictedHome - predictedAway;
  const actualMargin = actualHome - actualAway;
  if (predictedMargin === actualMargin) return 3;

  // Correct outcome, wrong margin (e.g. predicted 2–0, finished 1–0)
  return 1;
}

/** Keep in sync with src/utils.ts calculateRugbyPoints / pitchside_rugby_points */
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

  const predictedMargin = Math.abs(predictedHome - predictedAway);
  const actualMargin = Math.abs(actualHome - actualAway);
  const marginDifference = Math.abs(predictedMargin - actualMargin);

  if (marginDifference === 0) return 5;
  if (marginDifference <= 7) return 3;
  if (marginDifference <= 10) return 1;
  return 0;
}

function calculateBasePoints(
  sport: Sport,
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
): number {
  return sport === "football"
    ? calculateFootballPoints(predictedHome, predictedAway, actualHome, actualAway)
    : calculateRugbyPoints(predictedHome, predictedAway, actualHome, actualAway);
}

function applyMultiplier(basePoints: number, multiplier: number | null): number {
  const factor = multiplier != null && multiplier > 0 ? Number(multiplier) : 1;
  return Math.round(basePoints * factor);
}

function normalizeCompletedMatch(sport: Sport, item: any): SettledMatch | null {
  if (!isFinished(sport, item)) return null;

  const fixture = item.fixture ?? item;
  const apiId = fixture.id ?? item.id;
  if (apiId == null) return null;

  const scores = extractFinalScores(sport, item);
  if (!scores) return null;

  return {
    id: `${sport}-${apiId}`,
    actual_home_score: scores.home,
    actual_away_score: scores.away,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  const apiKey = Deno.env.get("API_SPORTS_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!apiKey) {
    return jsonResponse({ error: "Missing API_SPORTS_KEY secret." }, 500);
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret." },
      500,
    );
  }

  let payload: { sport?: string; date?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const sport = payload.sport as Sport;
  if (sport !== "football" && sport !== "rugby") {
    return jsonResponse(
      { error: "`sport` must be 'football' or 'rugby'." },
      400,
    );
  }

  const date = payload.date && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
    ? payload.date
    : todayUtc();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Skip API call when nothing in DB could need grading.
  const nowIso = new Date().toISOString();
  const { count: liveCount } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("sport", sport)
    .eq("status", "live");
  const { count: overdueCount } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("sport", sport)
    .neq("status", "completed")
    .lt("kickoff_time", nowIso);

  if ((liveCount ?? 0) === 0 && (overdueCount ?? 0) === 0) {
    console.log(
      `[sync-settlement] Skipping ${sport} — no pending matches in DB`,
    );
    return jsonResponse({
      sport,
      date,
      skipped: "nothing_pending",
      fetched: 0,
      completed: 0,
      matches_settled: 0,
      predictions_graded: 0,
      budget: DAILY_BUDGET_CAP,
    });
  }

  const client = new ApiSportsClient({
    supabase,
    apiKey,
    caller: "sync-settlement",
    budgetCap: DAILY_BUDGET_CAP,
  });

  const path = sport === "football" ? "/fixtures" : "/games";
  const label = `settlement ${sport} date=${date} (date-only)`;
  // Bare date= — no league/season. Current-season finals inside free date window.
  const result = await client.get(sport as SharedSport, path, { date }, label);

  if (!result.ok) {
    if (result.reason === "budget_exhausted") {
      client.logRunSummary({ sport, date, skipped: "budget_exhausted" });
      return jsonResponse(
        {
          error: "budget_exhausted",
          callsMadeToday: result.callsMadeToday,
          budget: DAILY_BUDGET_CAP,
        },
        429,
      );
    }
    if (result.reason === "validation_error") {
      return jsonResponse(
        { error: "API-Sports validation error.", detail: result.message },
        400,
      );
    }
    return jsonResponse(
      {
        error:
          result.reason === "plan_blocked"
            ? "API-Sports plan blocked."
            : "API-Sports request failed.",
        detail: result.message,
      },
      502,
    );
  }

  const fixtures: any[] = Array.isArray(result.json?.response)
    ? result.json.response
    : [];
  const catalog = LEAGUE_CATALOG[sport];
  const catalogFixtures = fixtures.filter((item) => {
    const leagueId = Number(item?.league?.id ?? item?.league_id);
    return Number.isFinite(leagueId) && catalog.has(leagueId);
  });
  const completed = catalogFixtures
    .map((item) => normalizeCompletedMatch(sport, item))
    .filter((row): row is SettledMatch => row !== null);

  if (completed.length === 0) {
    client.logRunSummary({
      sport,
      date,
      fetched: fixtures.length,
      completed: 0,
    });
    return jsonResponse({
      sport,
      date,
      fetched: fixtures.length,
      completed: 0,
      matches_settled: 0,
      predictions_graded: 0,
      callsThisRun: client.stats.callsThisRun,
      budget: DAILY_BUDGET_CAP,
    });
  }

  let matchesSettled = 0;
  let predictionsGraded = 0;
  const errors: string[] = [];

  for (const match of completed) {
    const { data: existing, error: fetchErr } = await supabase
      .from("matches")
      .select("id, base_multiplier")
      .eq("id", match.id)
      .maybeSingle();

    if (fetchErr) {
      errors.push(`${match.id}: failed to load match — ${fetchErr.message}`);
      continue;
    }
    if (!existing) {
      errors.push(`${match.id}: match not found in database (run sync-schedule first)`);
      continue;
    }

    const { error: matchErr } = await supabase
      .from("matches")
      .update({
        status: "completed",
        actual_home_score: match.actual_home_score,
        actual_away_score: match.actual_away_score,
        provisional_home_score: null,
        provisional_away_score: null,
        match_minute: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    if (matchErr) {
      errors.push(`${match.id}: match update failed — ${matchErr.message}`);
      continue;
    }
    matchesSettled++;

    const { data: predictions, error: predFetchErr } = await supabase
      .from("predictions")
      .select("id, predicted_home_score, predicted_away_score")
      .eq("match_id", match.id);

    if (predFetchErr) {
      errors.push(`${match.id}: prediction fetch failed — ${predFetchErr.message}`);
      continue;
    }

    const multiplier = existing.base_multiplier;
    for (const pred of predictions ?? []) {
      const basePoints = calculateBasePoints(
        sport,
        pred.predicted_home_score,
        pred.predicted_away_score,
        match.actual_home_score,
        match.actual_away_score,
      );
      const pointsWon = applyMultiplier(basePoints, multiplier);

      const { error: predUpdateErr } = await supabase
        .from("predictions")
        .update({ points_won: pointsWon })
        .eq("id", pred.id);

      if (predUpdateErr) {
        errors.push(`${pred.id}: prediction update failed — ${predUpdateErr.message}`);
        continue;
      }
      predictionsGraded++;
    }
  }

  if (errors.length > 0 && matchesSettled === 0) {
    return jsonResponse(
      { error: "Settlement failed.", detail: errors },
      500,
    );
  }

  const usage = await client.getUsageToday(sport as SharedSport).catch(() => null);
  client.logRunSummary({
    sport,
    date,
    fetched: fixtures.length,
    matchesSettled,
    predictionsGraded,
    callsMadeToday: usage?.calls_made ?? null,
    remainingBudget:
      usage != null ? Math.max(0, DAILY_BUDGET_CAP - usage.calls_made) : null,
  });

  return jsonResponse({
    sport,
    date,
    fetched: fixtures.length,
    completed: completed.length,
    matches_settled: matchesSettled,
    predictions_graded: predictionsGraded,
    callsThisRun: client.stats.callsThisRun,
    callsMadeToday: usage?.calls_made ?? null,
    budget: DAILY_BUDGET_CAP,
    ...(errors.length > 0 ? { warnings: errors } : {}),
  });
});
