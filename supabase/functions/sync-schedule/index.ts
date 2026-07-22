// ============================================================================
// sync-schedule — API-Sports schedule ingestion (Phase 1)
// ----------------------------------------------------------------------------
// ONE date-only call per sport: GET /fixtures?date=X or /games?date=X
// (no league, no season). Free plan returns current-season fixtures inside the
// ~yesterday..tomorrow window. Filter to LEAGUE_CATALOG client-side.
//
// Invoke (POST):
//   { "sport": "football" | "rugby", "date": "YYYY-MM-DD" (optional) }
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import {
  ApiSportsClient,
  DAILY_BUDGET_CAP,
  type Sport,
} from "../_shared/apiSportsClient.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FINISHED_STATUSES = new Set([
  "FT",
  "AET",
  "PEN",
  "AWD",
  "WO",
]);

/** ONLY these league IDs are ingested (must match seed-full). */
const LEAGUE_CATALOG: Record<Sport, ReadonlySet<number>> = {
  football: new Set([39, 40, 179, 45, 2, 3, 1, 48, 52]),
  rugby: new Set([13, 16, 22, 14, 15, 26, 19, 10]),
};

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function competitionId(sport: Sport, leagueId: unknown): string | null {
  if (leagueId == null) return null;
  const n = Number(leagueId);
  if (!Number.isFinite(n)) return String(leagueId);
  return SLUG_BY_SPORT_AND_API[`${sport}:${n}`] || `${sport}-${n}`;
}

function normalizeFixture(sport: Sport, item: any) {
  const fixture = item.fixture ?? item;
  const league = item.league ?? {};
  const teams = item.teams ?? {};

  const apiId = fixture.id ?? item.id;
  const statusShort = String(
    fixture.status?.short ?? item.status?.short ?? "",
  ).toUpperCase();

  const status = FINISHED_STATUSES.has(statusShort) ? "completed" : "upcoming";

  return {
    id: `${sport}-${apiId}`,
    competition_id: competitionId(sport, league.id),
    competition_name: league.name ?? item.league?.name ?? null,
    sport,
    home_team: teams.home?.name ?? null,
    away_team: teams.away?.name ?? null,
    kickoff_time: fixture.date ?? item.date ?? null,
    status,
    round_name: league.round ?? item.week ?? null,
    venue_name: fixture.venue?.name ?? item.venue?.name ?? null,
    updated_at: new Date().toISOString(),
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

  const date =
    payload.date && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
      ? payload.date
      : todayUtc();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const client = new ApiSportsClient({
    supabase,
    apiKey,
    caller: "sync-schedule",
    budgetCap: DAILY_BUDGET_CAP,
  });

  const path = sport === "football" ? "/fixtures" : "/games";
  const label = `schedule ${sport} date=${date} (date-only)`;
  // Bare date= — no league/season. Current-season data; filter to catalog.
  const result = await client.get(sport, path, { date }, label);

  if (!result.ok) {
    if (result.reason === "budget_exhausted") {
      client.logRunSummary({ sport, date, skipped: true });
      return jsonResponse(
        {
          error: "budget_exhausted",
          message: result.message,
          callsMadeToday: result.callsMadeToday,
          budget: DAILY_BUDGET_CAP,
        },
        429,
      );
    }
    if (result.reason === "plan_blocked") {
      client.logRunSummary({ sport, date, planBlocked: true });
      return jsonResponse(
        { error: "API-Sports plan blocked.", detail: result.message },
        502,
      );
    }
    if (result.reason === "validation_error") {
      return jsonResponse(
        { error: "API-Sports validation error.", detail: result.message },
        400,
      );
    }
    return jsonResponse(
      { error: "API-Sports request failed.", detail: result.message },
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
  const rows = catalogFixtures
    .map((item) => normalizeFixture(sport, item))
    .filter((row) => row.id && row.home_team && row.away_team);

  if (rows.length === 0) {
    client.logRunSummary({
      sport,
      date,
      fetched: fixtures.length,
      catalog: catalogFixtures.length,
      upserted: 0,
    });
    return jsonResponse({
      sport,
      date,
      fetched: fixtures.length,
      catalog: catalogFixtures.length,
      upserted: 0,
    });
  }

  const { error } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    return jsonResponse(
      { error: "Database upsert failed.", detail: error.message },
      500,
    );
  }

  const usage = await client.getUsageToday(sport).catch(() => null);
  client.logRunSummary({
    sport,
    date,
    fetched: fixtures.length,
    catalog: catalogFixtures.length,
    upserted: rows.length,
    callsMadeToday: usage?.calls_made ?? null,
    remainingBudget:
      usage != null ? Math.max(0, DAILY_BUDGET_CAP - usage.calls_made) : null,
  });

  return jsonResponse({
    sport,
    date,
    fetched: fixtures.length,
    catalog: catalogFixtures.length,
    upserted: rows.length,
    callsThisRun: client.stats.callsThisRun,
    callsMadeToday: usage?.calls_made ?? null,
    budget: DAILY_BUDGET_CAP,
  });
});
