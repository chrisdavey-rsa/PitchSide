// ============================================================================
// sync-live — API-Sports live score ingestion (Phase 2)
// ----------------------------------------------------------------------------
// Both sports: ONE date-only call for today (GET /fixtures?date=X or
// /games?date=X — no league/season, no live=all). Empirically equivalent to
// live=all for status/elapsed/score; filter to in-progress fixtures client-side.
// Skips the API call when DB has no matches in the live kickoff window.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import {
  ApiSportsClient,
  DAILY_BUDGET_CAP,
  type Sport,
  utcDay,
} from "../_shared/apiSportsClient.ts";

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

function formatMatchMinute(fixture: any, item: any): string | null {
  const elapsed = fixture.status?.elapsed ?? item.status?.elapsed;
  if (elapsed != null && elapsed !== "") {
    return `${elapsed}'`;
  }
  const short = fixture.status?.short ?? item.status?.short;
  return short ? String(short) : null;
}

function normalizeLiveUpdate(sport: SportT, item: any) {
  const fixture = item.fixture ?? item;
  const teams = item.teams ?? {};
  const goals = item.goals ?? item.scores ?? {};
  const apiId = fixture.id ?? item.id;
  if (apiId == null) return null;

  const statusShort = String(
    fixture.status?.short ?? item.status?.short ?? "",
  ).toUpperCase();
  const finished = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
  if (finished.has(statusShort)) return null;

  const home =
    goals.home ?? item.scores?.home ?? fixture.score?.fulltime?.home ?? null;
  const away =
    goals.away ?? item.scores?.away ?? fixture.score?.fulltime?.away ?? null;

  return {
    id: `${sport}-${apiId}`,
    status: "live" as const,
    match_minute: formatMatchMinute(fixture, item),
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

  const need = await hasLiveWindow(supabase, sport);
  if (!need) {
    client.stats.skippedNoNeed.push(`live ${sport} (no matches in window)`);
    client.logRunSummary({ sport, skipped: "no_live_window" });
    return jsonResponse({
      sport,
      skipped: "no_live_window",
      fetched: 0,
      updated: 0,
      budget: DAILY_BUDGET_CAP,
    });
  }

  const today = utcDay();
  const path = sport === "football" ? "/fixtures" : "/games";
  const label = `live ${sport} date=${today} (date-only)`;
  console.log(`[sync-live] Fetching ${sport} fixtures for date=${today} (date-only)`);

  const result = await client.get(sport, path, { date: today }, label);
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

  // date=today returns all fixtures that day; keep only in-progress for live updates.
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
  const items: any[] = (result.json?.response || []).filter((item: any) => {
    const short = String(
      item?.status?.short ?? item?.fixture?.status?.short ?? "",
    ).toUpperCase();
    return short !== "" && !NOT_LIVE.has(short);
  });

  const rows = items
    .map((item) => normalizeLiveUpdate(sport, item))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  let updated = 0;
  const errors: string[] = [];
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
    if (data && data.length > 0) updated++;
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
});
