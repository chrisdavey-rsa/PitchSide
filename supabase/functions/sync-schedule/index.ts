// ============================================================================
// sync-schedule — API-Sports schedule ingestion (Phase 1)
// ----------------------------------------------------------------------------
// Fetches a rolling window:
//   fromDate = today - 7 days  (historic results for grading)
//   toDate   = today + 14 days (upcoming fixtures)
//
// Day-loop across the window (API-Sports from/to requires league/season).
// Filter to LEAGUE_CATALOG client-side. Canonical competition titles applied.
//
// Invoke (POST):
//   { "sport": "football" | "rugby", "date": "YYYY-MM-DD" (optional anchor) }
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ApiSportsClient,
  DAILY_BUDGET_CAP,
  UpstreamAuthError,
  getApiSportsKey,
  reportSystemMetric,
  type Sport,
} from "../_shared/apiSportsClient.ts";
import {
  FOOTBALL_API_IDS,
  footballSlugForApiId,
  footballTitleForSlug,
} from "../_shared/footballLeagues.ts";
import {
  shouldIngestFixture,
  tagPitchsidePick,
} from "../_shared/fixtureIngestion.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

const HISTORY_DAYS = 7;
const UPCOMING_DAYS = 14;

const RUGBY_API_IDS = new Set([13, 16, 22, 14, 15, 26, 19, 10]);
const RUGBY_SLUG_BY_API: Record<string, string> = {
  "rugby:13": "r-top14",
  "rugby:16": "r-prem",
  "rugby:26": "r-urc",
  "rugby:22": "r-sixnations",
  "rugby:14": "r-championship",
  "rugby:15": "r-nations",
  "rugby:19": "r-heineken",
  "rugby:10": "r-worldcup",
};
const RUGBY_TITLES: Record<string, string> = {
  "r-top14": "Top 14",
  "r-prem": "Premiership Rugby",
  "r-urc": "URC (United Rugby Championship)",
  "r-sixnations": "Six Nations",
  "r-championship": "The Rugby Championship",
  "r-nations": "Nations Championship",
  "r-heineken": "Heineken Champions Cup",
  "r-worldcup": "Rugby World Cup",
};

const LEAGUE_CATALOG: Record<Sport, ReadonlySet<number>> = {
  football: FOOTBALL_API_IDS,
  rugby: RUGBY_API_IDS,
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

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function eachDateInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

function competitionId(sport: Sport, leagueId: unknown): string | null {
  if (sport === "football") return footballSlugForApiId(leagueId);
  if (leagueId == null) return null;
  const n = Number(leagueId);
  if (!Number.isFinite(n)) return String(leagueId);
  return RUGBY_SLUG_BY_API[`rugby:${n}`] || `rugby-${n}`;
}

function competitionTitle(
  sport: Sport,
  slug: string | null,
  apiName: string | null,
): string | null {
  if (sport === "football") return footballTitleForSlug(slug, apiName);
  if (slug && RUGBY_TITLES[slug]) return RUGBY_TITLES[slug];
  return apiName;
}

function normalizeFixture(sport: Sport, item: any) {
  const fixture = item.fixture ?? item;
  const league = item.league ?? {};
  const teams = item.teams ?? {};
  const goals = item.goals ?? item.scores ?? {};

  const apiId = fixture.id ?? item.id;
  const externalFixtureId =
    apiId != null && Number.isFinite(Number(apiId)) ? Number(apiId) : null;

  const statusShort = String(
    fixture.status?.short ?? item.status?.short ?? "",
  ).toUpperCase();
  const status = FINISHED_STATUSES.has(statusShort) ? "completed" : "upcoming";

  const homeScore =
    goals.home != null && goals.home !== "" ? Number(goals.home) : null;
  const awayScore =
    goals.away != null && goals.away !== "" ? Number(goals.away) : null;

  const slug = competitionId(sport, league.id);

  const row: Record<string, unknown> = {
    id: `${sport}-${apiId}`,
    external_fixture_id: externalFixtureId,
    competition_id: slug,
    competition_name: competitionTitle(sport, slug, league.name ?? null),
    sport,
    home_team: teams.home?.name ?? null,
    away_team: teams.away?.name ?? null,
    kickoff_time: fixture.date ?? item.date ?? null,
    status,
    round_name: league.round ?? item.week ?? null,
    venue_name: fixture.venue?.name ?? item.venue?.name ?? null,
    updated_at: new Date().toISOString(),
  };

  if (status === "completed" && homeScore != null && awayScore != null) {
    row.actual_home_score = homeScore;
    row.actual_away_score = awayScore;
  }

  row.is_pitchside_pick = tagPitchsidePick({
    sport,
    homeTeam: row.home_team as string | null,
    awayTeam: row.away_team as string | null,
  });

  return row;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  const apiKey = getApiSportsKey();
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

  const anchor =
    payload.date && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
      ? payload.date
      : todayUtc();
  const fromDate = addDaysYmd(anchor, -HISTORY_DAYS);
  const toDate = addDaysYmd(anchor, UPCOMING_DAYS);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const client = new ApiSportsClient({
    supabase,
    apiKey,
    caller: "sync-schedule",
    budgetCap: DAILY_BUDGET_CAP,
  });

  try {
    const path = sport === "football" ? "/fixtures" : "/games";
    const catalog = LEAGUE_CATALOG[sport];
    const fixtures: any[] = [];
    let callsMade = 0;
    let stoppedEarly = false;

    console.log(
      `[sync-schedule] ${sport} window ${fromDate} → ${toDate} (${HISTORY_DAYS}d history / ${UPCOMING_DAYS}d upcoming)`,
    );

    for (const date of eachDateInclusive(fromDate, toDate)) {
      const label = `schedule ${sport} date=${date}`;
      const result = await client.get(sport, path, { date }, label);
      callsMade += 1;
      if (!result.ok) {
        if (result.reason === "budget_exhausted") {
          console.warn(
            `[sync-schedule] Budget exhausted mid-window at ${date} — upserting partial`,
          );
          stoppedEarly = true;
          break;
        }
        if (result.reason === "auth_failure") {
          throw new UpstreamAuthError(result.status ?? 401, "sync-schedule");
        }
        console.warn(
          `[sync-schedule] Skipping ${date}: ${result.reason} ${result.message}`,
        );
        continue;
      }
      if (Array.isArray(result.json?.response)) {
        fixtures.push(...result.json.response);
      }
    }

    if (fixtures.length === 0 && callsMade > 0 && !stoppedEarly) {
      // No fixtures in window is valid; not an error.
    }

    const catalogFixtures = fixtures.filter((item) => {
      const leagueId = Number(item?.league?.id ?? item?.league_id);
      return Number.isFinite(leagueId) && catalog.has(leagueId);
    });

    const byId = new Map<string, Record<string, unknown>>();
    let skippedByPolicy = 0;
    for (const item of catalogFixtures) {
      const row = normalizeFixture(sport, item);
      if (!row.id || !row.home_team || !row.away_team) continue;
      const allow = shouldIngestFixture({
        competitionId: row.competition_id as string | null,
        roundName: row.round_name as string | null,
        homeTeam: row.home_team as string | null,
        awayTeam: row.away_team as string | null,
      });
      if (!allow) {
        skippedByPolicy += 1;
        continue;
      }
      byId.set(String(row.id), row);
    }
    const rows = [...byId.values()];
    if (skippedByPolicy > 0) {
      console.log(
        `[sync-schedule] ${sport}: skipped ${skippedByPolicy} fixtures (cup/UEFA/preeminent policy)`,
      );
    }

    const serviceName =
      sport === "football" ? "Football Schedule Sync" : "Rugby Schedule Sync";

    if (rows.length === 0) {
      client.logRunSummary({
        sport,
        fromDate,
        toDate,
        fetched: fixtures.length,
        catalog: catalogFixtures.length,
        upserted: 0,
      });
      await reportSystemMetric(supabase, {
        serviceName,
        status: "STABLE",
        apiQuotaRemaining: client.lastRemaining,
      });
      return jsonResponse({
        sport,
        fromDate,
        toDate,
        fetched: fixtures.length,
        catalog: catalogFixtures.length,
        upserted: 0,
        callsThisRun: client.stats.callsThisRun || callsMade,
        budget: DAILY_BUDGET_CAP,
      });
    }

    const { error } = await supabase
      .from("matches")
      .upsert(rows, { onConflict: "id" });

    if (error) {
      await reportSystemMetric(supabase, {
        serviceName,
        status: "ERROR",
        apiQuotaRemaining: client.lastRemaining,
        errorMessage: `Database upsert failed: ${error.message}`,
      });
      return jsonResponse(
        { error: "Database upsert failed.", detail: error.message },
        500,
      );
    }

    const completedInWindow = rows.filter((r) => r.status === "completed")
      .length;
    const usage = await client.getUsageToday(sport).catch(() => null);
    client.logRunSummary({
      sport,
      fromDate,
      toDate,
      fetched: fixtures.length,
      catalog: catalogFixtures.length,
      upserted: rows.length,
      completedInWindow,
      callsMadeToday: usage?.calls_made ?? null,
      remainingBudget:
        usage != null ? Math.max(0, DAILY_BUDGET_CAP - usage.calls_made) : null,
    });

    await reportSystemMetric(supabase, {
      serviceName,
      status: "STABLE",
      apiQuotaRemaining: client.lastRemaining,
    });

    return jsonResponse({
      sport,
      fromDate,
      toDate,
      fetched: fixtures.length,
      catalog: catalogFixtures.length,
      upserted: rows.length,
      completedInWindow,
      callsThisRun: client.stats.callsThisRun || callsMade,
      callsMadeToday: usage?.calls_made ?? null,
      budget: DAILY_BUDGET_CAP,
      ...(stoppedEarly ? { partial: true } : {}),
    });
  } catch (err) {
    const serviceName =
      (typeof payload !== "undefined" && payload.sport === "rugby")
        ? "Rugby Schedule Sync"
        : "Football Schedule Sync";
    if (err instanceof UpstreamAuthError) {
      await reportSystemMetric(supabase, {
        serviceName,
        status: "ERROR",
        errorMessage: "Upstream API-Sports authentication failure",
      });
      return jsonResponse(
        {
          error: "Upstream API-Sports authentication failure",
          status: err.status,
          caller: err.caller,
        },
        err.status,
      );
    }
    await reportSystemMetric(supabase, {
      serviceName,
      status: "ERROR",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});
