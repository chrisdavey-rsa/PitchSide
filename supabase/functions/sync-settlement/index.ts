// ============================================================================
// sync-settlement — API-Sports final score ingestion + automated grading (Phase 3)
// ----------------------------------------------------------------------------
// Fetches fixtures for a given date, settles completed matches with final
// scores, then grades all linked predictions server-side (with multiplier).
//
// Invoke (POST):
//   { "sport": "football" | "rugby", "date": "YYYY-MM-DD" (optional) }
//
// Required secrets (Deno.env):
//   API_SPORTS_KEY               — your API-Sports key
//   SUPABASE_URL                 — project URL (auto-injected on deploy)
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (auto-injected on deploy)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const API_CONFIG: Record<"football" | "rugby", { url: string }> = {
  football: { url: "https://v3.football.api-sports.io/fixtures" },
  rugby: { url: "https://v1.rugby.api-sports.io/games" },
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

/** Keep in sync with src/utils.ts calculateFootballPoints */
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

  return 2;
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

  const endpoint = `${API_CONFIG[sport].url}?date=${date}`;

  let apiJson: any;
  try {
    const apiRes = await fetch(endpoint, {
      headers: { "x-apisports-key": apiKey },
    });
    apiJson = await apiRes.json();
    if (!apiRes.ok) {
      return jsonResponse(
        {
          error: "API-Sports request failed.",
          status: apiRes.status,
          detail: apiJson,
        },
        502,
      );
    }
  } catch (err) {
    return jsonResponse(
      { error: "Failed to reach API-Sports.", detail: String(err) },
      502,
    );
  }

  const apiErrors = apiJson?.errors;
  const hasApiErrors = apiErrors &&
    ((Array.isArray(apiErrors) && apiErrors.length > 0) ||
      (typeof apiErrors === "object" && Object.keys(apiErrors).length > 0));
  if (hasApiErrors) {
    return jsonResponse(
      { error: "API-Sports returned errors.", detail: apiErrors },
      502,
    );
  }

  const fixtures: any[] = Array.isArray(apiJson?.response)
    ? apiJson.response
    : [];
  const completed = fixtures
    .map((item) => normalizeCompletedMatch(sport, item))
    .filter((row): row is SettledMatch => row !== null);

  if (completed.length === 0) {
    return jsonResponse({
      sport,
      date,
      fetched: fixtures.length,
      completed: 0,
      matches_settled: 0,
      predictions_graded: 0,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

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

  return jsonResponse({
    sport,
    date,
    fetched: fixtures.length,
    completed: completed.length,
    matches_settled: matchesSettled,
    predictions_graded: predictionsGraded,
    ...(errors.length > 0 ? { warnings: errors } : {}),
  });
});
