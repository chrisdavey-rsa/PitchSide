/**
 * PitchSide schedule ingestion with per-sport daily quota ledger.
 *
 * Usage (Windows):
 *   npm.cmd run seed:full
 *
 * Priority spend (via scripts/lib/apiSportsClient.ts → reserve_api_quota):
 *   1) Settlement candidates (DB) — skipped here if none (sync-settlement owns grading)
 *   2) Live scores: date=today (same call shape as schedule; skip if no
 *      matches in the live kickoff window). No live=all.
 *   3) Near-term schedule: ONE date-only call per sport per date
 *      (yesterday / today / tomorrow — free-plan date window)
 *      GET /fixtures?date=X or /games?date=X — no league, no season.
 *      Filter to LEAGUE_CATALOG client-side.
 *
 * Optional (env SEED_HISTORICAL_SEASON=1): league+season=2024 bulk pull —
 * historical fallback only. Free plan season entitlement is 2022–2024; do not
 * use that path for current-season fixtures (use date-only instead).
 *
 * Never uses next=. Bare date= outside ~yesterday..tomorrow is plan-blocked
 * (9-day horizon is NOT reachable on free plan).
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ApiSportsClient,
  DAILY_BUDGET_CAP,
  type Sport,
} from "./lib/apiSportsClient";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/** ONLY these league IDs are ingested. */
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

const LIVE_WINDOW_BEFORE_MS = 15 * 60 * 1000;
const LIVE_WINDOW_AFTER_MS = 150 * 60 * 1000;

/** Sentinel league_id in api_fixture_checks for sport-wide date-only polls. */
const DATE_ONLY_CACHE_LEAGUE_ID = 0;

function addUtcDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Free-plan bare date= window: yesterday..tomorrow (UTC). */
function nearTermDates(now = new Date()): string[] {
  return [-1, 0, 1].map((offset) => addUtcDays(now, offset));
}

const FINISHED = new Set([
  "FT",
  "AET",
  "PEN",
  "AWD",
  "WO",
  "ABD",
  "CANC",
  "PST",
]);
const LIVE = new Set([
  "1H",
  "2H",
  "HT",
  "ET",
  "BT",
  "P",
  "LIVE",
  "INT",
  "SUSP",
]);

type CompetitionRow = {
  id: string;
  api_sports_id: number;
  sport: Sport;
  name: string;
  country: string | null;
  season: number | null;
  logo_url: string | null;
  type: string | null;
  updated_at: string;
};

type MatchRow = {
  id: string;
  competition_id: string | null;
  competition_name: string | null;
  sport: Sport;
  home_team: string | null;
  away_team: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  kickoff_time: string | null;
  status: string;
  round_name: string | null;
  venue_name: string | null;
  actual_home_score: number | null;
  actual_away_score: number | null;
  provisional_home_score: number | null;
  provisional_away_score: number | null;
  match_minute: string | null;
  is_visible: boolean;
  updated_at: string;
};

function requireEnv(names: string[]): string {
  for (const name of names) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  throw new Error(`Missing env: one of ${names.join(", ")}`);
}

function competitionIdFor(sport: Sport, apiLeagueId: number): string {
  return (
    SLUG_BY_SPORT_AND_API[`${sport}:${apiLeagueId}`] ||
    `${sport}-${apiLeagueId}`
  );
}

function mapStatus(shortRaw: string): string {
  const short = (shortRaw || "").toUpperCase();
  if (FINISHED.has(short)) return "completed";
  if (LIVE.has(short)) return "live";
  return "upcoming";
}

async function loadTeamLookup(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await supabase
    .from("teams")
    .select("id, sport, api_sports_id")
    .not("api_sports_id", "is", null);
  if (error) throw error;
  for (const row of data || []) {
    if (row.api_sports_id == null) continue;
    map.set(`${row.sport}:${row.api_sports_id}`, row.id);
  }
  console.log(`[seed-full] Loaded ${map.size} teams with api_sports_id`);
  return map;
}

async function ensureTeam(
  supabase: SupabaseClient,
  lookup: Map<string, string>,
  sport: Sport,
  apiId: number,
  name: string,
): Promise<string | null> {
  const key = `${sport}:${apiId}`;
  const existing = lookup.get(key);
  if (existing) return existing;

  const row = {
    name,
    type: "club" as const,
    country_code: null as string | null,
    api_sports_id: apiId,
    sport,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("teams")
    .upsert(row, { onConflict: "sport,type,api_sports_id" })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn(
      `[seed-full] Could not upsert team ${name} (${key}): ${error.message}`,
    );
    return null;
  }
  if (data?.id) {
    lookup.set(key, data.id);
    return data.id;
  }
  return null;
}

function leagueIdFromItem(item: any): number | null {
  const id = item?.league?.id ?? item?.league_id ?? null;
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

async function mapFixtureItem(
  sport: Sport,
  item: any,
  catalogSet: Set<number>,
  supabase: SupabaseClient,
  teamLookup: Map<string, string>,
): Promise<{ match: MatchRow; competition: CompetitionRow } | null> {
  const apiLeagueId = leagueIdFromItem(item);
  if (apiLeagueId == null || !catalogSet.has(apiLeagueId)) return null;

  const fixture = item.fixture ?? item;
  const leagueMeta = item.league ?? {};
  const teams = item.teams ?? {};
  const goals = item.goals ?? item.scores ?? {};

  const apiFixtureId = fixture.id ?? item.id;
  if (apiFixtureId == null) return null;

  const homeName = String(teams.home?.name || "").trim();
  const awayName = String(teams.away?.name || "").trim();
  const homeApiId = teams.home?.id;
  const awayApiId = teams.away?.id;
  const kickoff = fixture.date ?? item.date ?? null;
  const statusShort = String(fixture.status?.short ?? item.status?.short ?? "");
  const status = mapStatus(statusShort);
  const now = new Date().toISOString();

  let homeTeamId: string | null = null;
  let awayTeamId: string | null = null;
  if (homeApiId != null && homeName) {
    homeTeamId = await ensureTeam(
      supabase,
      teamLookup,
      sport,
      Number(homeApiId),
      homeName,
    );
  }
  if (awayApiId != null && awayName) {
    awayTeamId = await ensureTeam(
      supabase,
      teamLookup,
      sport,
      Number(awayApiId),
      awayName,
    );
  }

  const homeScore =
    goals.home ?? item.scores?.home ?? fixture.score?.fulltime?.home ?? null;
  const awayScore =
    goals.away ?? item.scores?.away ?? fixture.score?.fulltime?.away ?? null;
  const minute = fixture.status?.elapsed ?? item.status?.elapsed ?? null;

  const competitionId = competitionIdFor(sport, apiLeagueId);
  const competitionName =
    String(leagueMeta.name || "").trim() || `League ${apiLeagueId}`;

  const match: MatchRow = {
    id: `${sport}-${apiFixtureId}`,
    competition_id: competitionId,
    competition_name: competitionName,
    sport,
    home_team: homeName || null,
    away_team: awayName || null,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    kickoff_time: kickoff,
    status,
    round_name: leagueMeta.round ?? item.week ?? null,
    venue_name: fixture.venue?.name ?? item.venue?.name ?? null,
    actual_home_score:
      status === "completed" && homeScore != null ? Number(homeScore) : null,
    actual_away_score:
      status === "completed" && awayScore != null ? Number(awayScore) : null,
    provisional_home_score:
      status === "live" && homeScore != null ? Number(homeScore) : null,
    provisional_away_score:
      status === "live" && awayScore != null ? Number(awayScore) : null,
    match_minute: status === "live" && minute != null ? String(minute) : null,
    is_visible: true,
    updated_at: now,
  };

  const competition: CompetitionRow = {
    id: competitionId,
    api_sports_id: apiLeagueId,
    sport,
    name: competitionName,
    country:
      typeof leagueMeta.country === "string"
        ? leagueMeta.country
        : leagueMeta.country?.name || null,
    season: leagueMeta.season != null ? Number(leagueMeta.season) : null,
    logo_url: leagueMeta.logo || null,
    type: leagueMeta.type || null,
    updated_at: now,
  };

  return { match, competition };
}

async function upsertChunks<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string,
  chunkSize = 150,
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, {
      onConflict,
      ignoreDuplicates: false,
    });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

async function dbHasLiveWindow(
  supabase: SupabaseClient,
  sport: Sport,
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
    console.warn(`[seed-full] live-window query failed: ${error.message}`);
    return true; // fail open — still allow a live poll
  }
  return (count ?? 0) > 0;
}

async function dbHasSettlementPending(
  supabase: SupabaseClient,
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { count: liveCount, error: e1 } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("status", "live");
  if (e1) return true;
  if ((liveCount ?? 0) > 0) return true;

  const { count: overdue, error: e2 } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .neq("status", "completed")
    .lt("kickoff_time", nowIso);
  if (e2) return true;
  return (overdue ?? 0) > 0;
}

type AbsorbCtx = {
  sport: Sport;
  catalogSet: Set<number>;
  supabase: SupabaseClient;
  teamLookup: Map<string, string>;
  matchById: Map<string, MatchRow>;
  competitionById: Map<string, CompetitionRow>;
};

async function absorbItems(ctx: AbsorbCtx, items: any[]) {
  for (const item of items) {
    const mapped = await mapFixtureItem(
      ctx.sport,
      item,
      ctx.catalogSet,
      ctx.supabase,
      ctx.teamLookup,
    );
    if (!mapped) continue;
    ctx.matchById.set(mapped.match.id, mapped.match);
    ctx.competitionById.set(mapped.competition.id, mapped.competition);
  }
}

type FetchOutcome = "ok" | "stop_budget" | "abort_path";

/**
 * HISTORICAL FALLBACK ONLY — league+season (free plan: 2022–2024).
 * Do not use for current-season fixtures; those come from date-only polls.
 * Enabled via SEED_HISTORICAL_SEASON=1.
 */
async function fetchLeagueSeasonHistorical(
  client: ApiSportsClient,
  ctx: AbsorbCtx,
  leagueId: number,
  season: number,
): Promise<{ outcome: FetchOutcome; fixturesFound: number }> {
  const label = `historical-season ${ctx.sport} league=${leagueId} season=${season}`;
  const path = ctx.sport === "football" ? "/fixtures" : "/games";
  const result = await client.get(
    ctx.sport,
    path,
    { league: leagueId, season },
    label,
  );

  if (!result.ok) {
    if (result.reason === "budget_exhausted") {
      return { outcome: "stop_budget", fixturesFound: 0 };
    }
    if (result.reason === "validation_error") {
      console.error(
        `[seed-full] VALIDATION ERROR — aborting historical season path for ${ctx.sport}: ${label}: ${result.message}`,
      );
      return { outcome: "abort_path", fixturesFound: 0 };
    }
    if (result.reason === "plan_blocked") {
      console.error(
        `[seed-full] PLAN BLOCKED — aborting historical season path for ${ctx.sport}: ${label}: ${result.message}`,
      );
      return { outcome: "abort_path", fixturesFound: 0 };
    }
    console.error(`[seed-full] Fetch failed ${label}: ${result.message}`);
    return { outcome: "abort_path", fixturesFound: 0 };
  }

  const items = result.json?.response || [];
  console.log(`[seed-full] ${label}: ${items.length} fixtures`);
  if (items.length === 0) {
    console.warn(
      `[seed-full] ${label} returned 0 fixtures (HTTP ok, no errors)`,
    );
  }
  await absorbItems(ctx, items);
  return { outcome: "ok", fixturesFound: items.length };
}

/**
 * Primary near-term schedule: ONE bare date= call (no league, no season).
 * Free plan returns current-season fixtures; filter to catalog client-side.
 */
async function fetchDateOnly(
  client: ApiSportsClient,
  ctx: AbsorbCtx,
  date: string,
): Promise<{ outcome: FetchOutcome; rawCount: number; catalogCount: number }> {
  const label = `near-term ${ctx.sport} date=${date} (date-only)`;
  const cached = await client.getFixtureCheck(
    ctx.sport,
    DATE_ONLY_CACHE_LEAGUE_ID,
    date,
  );
  if (cached) {
    client.stats.skippedCache.push(label);
    console.log(
      `[seed-full] CACHE HIT — skip ${label} (fixtures_found=${cached.fixtures_found})`,
    );
    return {
      outcome: "ok",
      rawCount: cached.fixtures_found,
      catalogCount: 0,
    };
  }

  const path = ctx.sport === "football" ? "/fixtures" : "/games";
  const result = await client.get(ctx.sport, path, { date }, label);

  if (!result.ok) {
    if (result.reason === "budget_exhausted") {
      return { outcome: "stop_budget", rawCount: 0, catalogCount: 0 };
    }
    if (result.reason === "validation_error") {
      console.error(
        `[seed-full] VALIDATION ERROR — aborting near-term path for ${ctx.sport}: ${label}: ${result.message}`,
      );
      return { outcome: "abort_path", rawCount: 0, catalogCount: 0 };
    }
    if (result.reason === "plan_blocked") {
      console.error(
        `[seed-full] PLAN BLOCKED — aborting near-term path for ${ctx.sport}: ${label}: ${result.message}`,
      );
      return { outcome: "abort_path", rawCount: 0, catalogCount: 0 };
    }
    console.error(`[seed-full] Fetch failed ${label}: ${result.message}`);
    return { outcome: "abort_path", rawCount: 0, catalogCount: 0 };
  }

  const items = result.json?.response || [];
  const before = ctx.matchById.size;
  await absorbItems(ctx, items);
  const catalogCount = ctx.matchById.size - before;
  console.log(
    `[seed-full] ${label}: ${items.length} raw → ${catalogCount} catalog`,
  );
  await client.recordFixtureCheck(
    ctx.sport,
    DATE_ONLY_CACHE_LEAGUE_ID,
    date,
    items.length,
  );
  return { outcome: "ok", rawCount: items.length, catalogCount };
}

async function seedSport(
  sport: Sport,
  leagueIds: readonly number[],
  client: ApiSportsClient,
  supabase: SupabaseClient,
  teamLookup: Map<string, string>,
  opts: {
    historicalSeason: number | null;
    nearTerm: string[];
  },
): Promise<{
  matchCount: number;
  nearTermByDate: Record<string, number>;
  historicalFixturesByLeague: Record<number, number>;
}> {
  const catalogSet = new Set(leagueIds);
  const nearTermByDate: Record<string, number> = {};
  const historicalFixturesByLeague: Record<number, number> = {};

  const ctx: AbsorbCtx = {
    sport,
    catalogSet,
    supabase,
    teamLookup,
    matchById: new Map(),
    competitionById: new Map(),
  };

  // ---- Tier 2: Live via date=today (skip if nothing in window) --------------
  // Same endpoint as near-term; near-term loop below will cover today again
  // (cache hit). Kept separate so a live-window seed still refreshes scores
  // even when near-term dates are cache-skipped.
  {
    const needLive = await dbHasLiveWindow(supabase, sport);
    if (!needLive) {
      client.stats.skippedNoNeed.push(
        `live ${sport} (no matches in window)`,
      );
      console.log(
        `[seed-full] Skipping live ${sport} — no DB matches in live window`,
      );
    } else {
      const today = addUtcDays(new Date(), 0);
      console.log(
        `[seed-full] Fetching live via date=${today} (${sport}, date-only)`,
      );
      const path = sport === "football" ? "/fixtures" : "/games";
      const live = await client.get(
        sport,
        path,
        { date: today },
        `live ${sport} date=${today}`,
      );
      if (live.ok) {
        const items = live.json?.response || [];
        console.log(
          `[seed-full] Live date response: ${items.length} raw (filtering to catalog)`,
        );
        await absorbItems(ctx, items);
      } else if (live.reason === "validation_error") {
        console.error(
          `[seed-full] VALIDATION ERROR on live ${sport}: ${live.message}`,
        );
      } else if (live.reason === "plan_blocked") {
        console.error(
          `[seed-full] PLAN BLOCKED on live ${sport}: ${live.message}`,
        );
      }
    }
  }

  // ---- Tier 3: Near-term date-only (primary current schedule) --------------
  console.log(
    `[seed-full] Near-term schedule (${sport}): dates=[${opts.nearTerm.join(", ")}] (date-only, filter catalog)`,
  );
  for (const date of opts.nearTerm) {
    const { outcome, catalogCount } = await fetchDateOnly(client, ctx, date);
    nearTermByDate[date] = catalogCount;
    if (outcome === "stop_budget") {
      console.warn(
        `[seed-full] Stopping ${sport} near-term early (budget exhausted)`,
      );
      break;
    }
    if (outcome === "abort_path") {
      console.error(
        `[seed-full] Aborting remaining ${sport} near-term calls after failure on date=${date}`,
      );
      break;
    }
  }

  // ---- Optional: historical league+season=2024 (NOT for current fixtures) -
  if (opts.historicalSeason != null) {
    console.log(
      `[seed-full] HISTORICAL FALLBACK (${sport}): season=${opts.historicalSeason} — not current-season source`,
    );
    for (const leagueId of leagueIds) {
      const { outcome, fixturesFound } = await fetchLeagueSeasonHistorical(
        client,
        ctx,
        leagueId,
        opts.historicalSeason,
      );
      historicalFixturesByLeague[leagueId] = fixturesFound;
      if (outcome === "stop_budget") {
        console.warn(
          `[seed-full] Stopping ${sport} historical season early (budget exhausted)`,
        );
        break;
      }
      if (outcome === "abort_path") {
        console.error(
          `[seed-full] Aborting remaining ${sport} historical season after failure on league=${leagueId}`,
        );
        break;
      }
    }
  }

  const competitions = Array.from(ctx.competitionById.values());
  const matches = Array.from(ctx.matchById.values());

  if (competitions.length > 0) {
    console.log(
      `[seed-full] Upserting ${competitions.length} competitions (${sport})`,
    );
    try {
      await upsertChunks(supabase, "competitions", competitions, "id");
    } catch (err) {
      console.warn(
        `[seed-full] Competitions upsert failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`[seed-full] Upserting ${matches.length} matches (${sport})`);
  if (matches.length > 0) {
    await upsertChunks(supabase, "matches", matches, "id");
  }

  return { matchCount: matches.length, nearTermByDate, historicalFixturesByLeague };
}

async function main() {
  const apiKey = requireEnv(["API_SPORTS_KEY", "API-SPORTS_KEY"]);
  const supabaseUrl = requireEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const serviceKey = requireEnv(["SUPABASE_SERVICE_ROLE_KEY"]);
  const minIntervalMs = Number(
    process.env.API_SPORTS_MIN_INTERVAL_MS || "7000",
  );
  const runHistorical =
    process.env.SEED_HISTORICAL_SEASON === "1" ||
    process.env.SEED_HISTORICAL_SEASON === "true";
  const historicalSeason = runHistorical
    ? Number(process.env.API_SPORTS_SEASON || "2024")
    : null;

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const client = new ApiSportsClient({
    supabase,
    apiKey,
    caller: "seed-full",
    budgetCap: DAILY_BUDGET_CAP,
    minIntervalMs: Number.isFinite(minIntervalMs) ? minIntervalMs : 7000,
  });

  const nearTerm = nearTermDates();

  console.log("[seed-full] PitchSide fixture seed starting");
  console.log(
    `[seed-full] DAILY_BUDGET_CAP=${DAILY_BUDGET_CAP} per sport (football/rugby independent)`,
  );
  console.log(
    `[seed-full] LEAGUE_CATALOG football=[${LEAGUE_CATALOG.football.join(", ")}]`,
  );
  console.log(
    `[seed-full] LEAGUE_CATALOG rugby=[${LEAGUE_CATALOG.rugby.join(", ")}]`,
  );
  console.log(
    `[seed-full] Near-term dates (date-only): ${nearTerm.join(", ")}`,
  );
  console.log(
    `[seed-full] Historical league+season fallback: ${
      historicalSeason != null
        ? `ENABLED season=${historicalSeason}`
        : "off (set SEED_HISTORICAL_SEASON=1 to enable)"
    }`,
  );

  // Tier 1 observability: settlement is owned by sync-settlement; skip API here.
  const settlementPending = await dbHasSettlementPending(supabase);
  if (settlementPending) {
    console.log(
      "[seed-full] Settlement pending in DB — prefer running sync-settlement before schedule if budget is tight",
    );
  } else {
    client.stats.skippedNoNeed.push("settlement (nothing pending in DB)");
  }

  const teamLookup = await loadTeamLookup(supabase);
  const seedOpts = {
    historicalSeason:
      historicalSeason != null && Number.isFinite(historicalSeason)
        ? historicalSeason
        : null,
    nearTerm,
  };

  const football = await seedSport(
    "football",
    LEAGUE_CATALOG.football,
    client,
    supabase,
    teamLookup,
    seedOpts,
  );
  const rugby = await seedSport(
    "rugby",
    LEAGUE_CATALOG.rugby,
    client,
    supabase,
    teamLookup,
    seedOpts,
  );

  let footUsage: Awaited<ReturnType<typeof client.getUsageToday>> | null = null;
  let rugUsage: Awaited<ReturnType<typeof client.getUsageToday>> | null = null;
  try {
    footUsage = await client.getUsageToday("football");
    rugUsage = await client.getUsageToday("rugby");
  } catch (err) {
    console.warn(
      "[seed-full] Could not read quota usage:",
      err instanceof Error ? err.message : err,
    );
  }

  console.log(
    `[seed-full] Near-term catalog hits: football=${JSON.stringify(football.nearTermByDate)} rugby=${JSON.stringify(rugby.nearTermByDate)}`,
  );

  client.logRunSummary({
    nearTermDates: nearTerm,
    historicalSeason: seedOpts.historicalSeason,
    footballMatchesUpserted: football.matchCount,
    rugbyMatchesUpserted: rugby.matchCount,
    footballNearTermByDate: football.nearTermByDate,
    rugbyNearTermByDate: rugby.nearTermByDate,
    footballHistoricalByLeague: football.historicalFixturesByLeague,
    rugbyHistoricalByLeague: rugby.historicalFixturesByLeague,
    footballCallsMadeToday: footUsage?.calls_made ?? null,
    rugbyCallsMadeToday: rugUsage?.calls_made ?? null,
    footballHeaderRemaining: footUsage?.last_remaining_from_header ?? null,
    rugbyHeaderRemaining: rugUsage?.last_remaining_from_header ?? null,
    footballRemainingBudget:
      footUsage != null
        ? Math.max(0, DAILY_BUDGET_CAP - footUsage.calls_made)
        : null,
    rugbyRemainingBudget:
      rugUsage != null
        ? Math.max(0, DAILY_BUDGET_CAP - rugUsage.calls_made)
        : null,
    skippedBudget: client.stats.skippedBudget,
    skippedNoNeed: client.stats.skippedNoNeed,
    skippedCacheCount: client.stats.skippedCache.length,
    callsThisRun: client.stats.callsThisRun,
  });

  console.log(
    `[seed-full] Done. Upserted matches: football=${football.matchCount}, rugby=${rugby.matchCount}, total=${football.matchCount + rugby.matchCount}. ` +
      `API calls this run=${client.stats.callsThisRun}. ` +
      `Quota today: football=${footUsage?.calls_made ?? "?"}/${DAILY_BUDGET_CAP}, rugby=${rugUsage?.calls_made ?? "?"}/${DAILY_BUDGET_CAP}.`,
  );
}

main().catch((err) => {
  console.error("[seed-full] FAILED:", err);
  process.exit(1);
});
