// ============================================================================
// sync-live — API-Sports live score ingestion (Phase 2)
// ----------------------------------------------------------------------------
// Football: GET /fixtures?live=all (freshest minute/score ticks).
// Rugby:    GET /games?date=today (no live=all equivalent).
// Skips the upstream call entirely when DB has no matches in the live
// kickoff window — exits gracefully without consuming API quota.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ApiSportsClient,
  DAILY_BUDGET_CAP,
  UpstreamAuthError,
  getApiSportsKey,
  reportSystemMetric,
  type Sport,
  utcDay,
} from "../_shared/apiSportsClient.ts";
import { FOOTBALL_API_IDS } from "../_shared/footballLeagues.ts";
import {
  formatMatchMinuteFromProvider,
  providerStatusFromItem,
} from "../_shared/matchClock.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LIVE_WINDOW_BEFORE_MS = 15 * 60 * 1000;
const LIVE_WINDOW_AFTER_MS = 150 * 60 * 1000;

type SportT = Sport;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function normalizeLiveUpdate(sport: SportT, item: any) {
  // Football (verified): fixture.status.short, goals.home/away, fixture.id
  // Rugby: status.short + scores.home/away
  const fixture = item.fixture ?? item;
  const goals = item.goals ?? item.scores ?? {};
  const apiId = fixture.id ?? item.id;
  if (apiId == null) return null;

  const statusShort = String(
    fixture.status?.short ?? item.status?.short ?? "",
  ).toUpperCase();
  const finished = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
  if (finished.has(statusShort)) return null;

  const home = goals.home ?? null;
  const away = goals.away ?? null;
  const externalFixtureId = Number.isFinite(Number(apiId))
    ? Number(apiId)
    : null;

  return {
    id: `${sport}-${apiId}`,
    external_fixture_id: externalFixtureId,
    status: "live" as const,
    match_minute: formatMatchMinuteFromProvider(providerStatusFromItem(item)),
    provisional_home_score: home != null ? Number(home) : null,
    provisional_away_score: away != null ? Number(away) : null,
    updated_at: new Date().toISOString(),
  };
}

async function hasLiveWindow(
  supabase: ReturnType<typeof createClient>,
  sport: SportT,
): Promise<boolean> {
  const now = Date.now();
  const from = new Date(now - LIVE_WINDOW_BEFORE_MS).toISOString();
  const to = new Date(now + LIVE_WINDOW_AFTER_MS).toISOString();
  const { count, error } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("sport", sport)
    .neq("status", "completed")
    .gte("kickoff_time", from)
    .lte("kickoff_time", to);
  if (error) {
    console.warn(`[sync-live] window query failed: ${error.message}`);
    return true;
  }
  return (count ?? 0) > 0;
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

  let payload: { sport?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const sport = payload.sport as SportT;
  if (sport !== "football" && sport !== "rugby") {
    return jsonResponse(
      { error: "`sport` must be 'football' or 'rugby'." },
      400,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const client = new ApiSportsClient({
    supabase,
    apiKey,
    caller: "sync-live",
    budgetCap: DAILY_BUDGET_CAP,
  });

  const serviceName =
    sport === "football" ? "Football Live Sync" : "Rugby Live Sync";

  try {
  const need = await hasLiveWindow(supabase, sport);
  if (!need) {
    console.log(
      `[sync-live] No ${sport} matches in live kickoff window — skipping upstream (0 API calls)`,
    );
    client.stats.skippedNoNeed.push(`live ${sport} (no matches in window)`);
    client.logRunSummary({ sport, skipped: "no_live_window" });
    await reportSystemMetric(supabase, {
      serviceName,
      status: "STABLE",
      apiQuotaRemaining: client.lastRemaining,
    });
    return jsonResponse({
      sport,
      skipped: "no_live_window",
      message: "No matches currently in the live window. 0 API calls made.",
      fetched: 0,
      updated: 0,
      budget: DAILY_BUDGET_CAP,
    });
  }

  const today = utcDay();
  const path = sport === "football" ? "/fixtures" : "/games";
  const params: Record<string, string> = sport === "football"
    ? { live: "all" }
    : { date: today };
  const label = sport === "football"
    ? `live football live=all`
    : `live rugby date=${today}`;
  console.log(
    `[sync-live] Active window open — fetching ${sport} (${
      sport === "football" ? "live=all" : `date=${today}`
    })`,
  );

  const result = await client.get(sport, path, params, label);
  if (!result.ok) {
    if (result.reason === "budget_exhausted") {
      client.logRunSummary({ sport, skipped: "budget_exhausted" });
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

  // Keep only in-progress statuses for live score updates.
  const NOT_LIVE = new Set([
    "FT",
    "AET",
    "PEN",
    "AWD",
    "WO",
    "NS",
    "TBD",
    "PST",
    "CANC",
    "ABD",
  ]);
  const upstream: any[] = Array.isArray(result.json?.response)
    ? result.json.response
    : [];
  const items = upstream.filter((item: any) => {
    const short = String(
      item?.fixture?.status?.short ?? item?.status?.short ?? "",
    ).toUpperCase();
    if (short === "" || NOT_LIVE.has(short)) return false;
    if (sport === "football") {
      const leagueId = Number(item?.league?.id);
      return Number.isFinite(leagueId) && FOOTBALL_API_IDS.has(leagueId);
    }
    return true;
  });

  console.log(
    `[sync-live] Upstream ${sport}: ${upstream.length} raw → ${items.length} catalog in-play`,
  );

  const rows = items
    .map((item) => normalizeLiveUpdate(sport, item))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  let updated = 0;
  const errors: string[] = [];
  const progress: string[] = [];
  for (const row of rows) {
    const { id, ...liveFields } = row;
    const { data, error } = await supabase
      .from("matches")
      .update(liveFields)
      .eq("id", id)
      .select("id");
    if (error) {
      errors.push(`${id}: ${error.message}`);
      continue;
    }
    if (data && data.length > 0) {
      updated++;
      progress.push(
        `${id} ${liveFields.match_minute ?? ""} ${liveFields.provisional_home_score ?? "-"}-${liveFields.provisional_away_score ?? "-"}`,
      );
    }
  }

  if (progress.length > 0) {
    console.log(
      `[sync-live] Updated ${updated} fixture(s): ${progress.slice(0, 12).join(" | ")}`,
    );
  } else {
    console.log(
      `[sync-live] No catalog fixtures matched for update (${items.length} in-play upstream)`,
    );
  }

  const usage = await client.getUsageToday(sport).catch(() => null);
  client.logRunSummary({
    sport,
    fetched: items.length,
    updated,
    callsMadeToday: usage?.calls_made ?? null,
    remainingBudget:
      usage != null ? Math.max(0, DAILY_BUDGET_CAP - usage.calls_made) : null,
  });

  await reportSystemMetric(supabase, {
    serviceName,
    status: errors.length > 0 && updated === 0 ? "ERROR" : "STABLE",
    apiQuotaRemaining: client.lastRemaining,
    errorMessage: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
  });

  return jsonResponse({
    sport,
    fetched: items.length,
    updated,
    skipped: rows.length - updated,
    callsThisRun: client.stats.callsThisRun,
    callsMadeToday: usage?.calls_made ?? null,
    budget: DAILY_BUDGET_CAP,
    ...(errors.length > 0 ? { warnings: errors } : {}),
  });
  } catch (err) {
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
