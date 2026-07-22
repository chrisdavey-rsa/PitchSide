/**
 * Seed public.teams from API-Sports (countries + top-league clubs).
 *
 * Usage (Windows):
 *   npm.cmd run seed:teams
 *
 * Required env (project-root .env):
 *   API_SPORTS_KEY  (or API-SPORTS_KEY)
 *   VITE_SUPABASE_URL  (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   FOOTBALL_SEASON=2025
 *   RUGBY_SEASON=2025
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// Always load project-root .env (not cwd), so `npm.cmd run seed:teams` works on Windows.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

type Sport = "football" | "rugby";
type TeamType = "country" | "club";

type TeamRow = {
  name: string;
  type: TeamType;
  country_code: string | null;
  api_sports_id: number | null;
  sport: Sport;
  updated_at: string;
};

const FOOTBALL_HOST = "https://v3.football.api-sports.io";
const RUGBY_HOST = "https://v1.rugby.api-sports.io";

/** Top leagues — keep this short to stay within the free daily quota. */
const FOOTBALL_LEAGUES: { id: number; label: string }[] = [
  { id: 39, label: "Premier League" },
  { id: 140, label: "La Liga" },
  { id: 135, label: "Serie A" },
  { id: 78, label: "Bundesliga" },
  { id: 61, label: "Ligue 1" },
  { id: 88, label: "Eredivisie" },
  { id: 94, label: "Primeira Liga" },
  { id: 179, label: "Scottish Premiership" },
];

/** Rugby league ids vary by provider season; adjust if a call returns empty. */
const RUGBY_LEAGUES: { id: number; label: string }[] = [
  { id: 16, label: "Premiership" },
  { id: 13, label: "Top 14" },
  { id: 26, label: "United Rugby Championship" },
  { id: 12, label: "Super Rugby" },
];

/** Map awkward API codes → FlagCDN path segments. */
const FLAGCDN_ALIASES: Record<string, string> = {
  en: "gb-eng",
  eng: "gb-eng",
  "gb-eng": "gb-eng",
  wal: "gb-wls",
  wls: "gb-wls",
  "gb-wls": "gb-wls",
  sco: "gb-sct",
  sct: "gb-sct",
  "gb-sct": "gb-sct",
  nir: "gb-nir",
  "gb-nir": "gb-nir",
  uk: "gb",
  gbr: "gb",
  "united kingdom": "gb",
  england: "gb-eng",
  scotland: "gb-sct",
  wales: "gb-wls",
  "northern ireland": "gb-nir",
};

let requestCount = 0;

function requireEnv(names: string[]): string {
  for (const name of names) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  throw new Error(`Missing env: one of ${names.join(", ")}`);
}

/** Normalize to lowercase FlagCDN codes (`gb-eng`, `fr`, `nz`). */
function toFlagCdnCode(
  code?: string | null,
  countryName?: string | null,
): string | null {
  const fromCode = (code || "").trim().toLowerCase().replace(/_/g, "-");
  if (fromCode) {
    return FLAGCDN_ALIASES[fromCode] || fromCode;
  }
  const fromName = (countryName || "").trim().toLowerCase();
  if (fromName && FLAGCDN_ALIASES[fromName]) {
    return FLAGCDN_ALIASES[fromName];
  }
  return null;
}

async function apiSportsGet(
  host: string,
  path: string,
  params: Record<string, string | number>,
  apiKey: string,
): Promise<any> {
  const url = new URL(path, host);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  requestCount += 1;
  console.log(`[seed-teams] GET ${url.pathname}?${url.searchParams} (#${requestCount})`);

  const res = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": apiKey,
      Accept: "application/json",
    },
  });

  const remaining = res.headers.get("x-ratelimit-requests-remaining");
  const limit = res.headers.get("x-ratelimit-requests-limit");
  if (remaining != null) {
    console.log(`[seed-teams] rate-limit remaining=${remaining}/${limit ?? "?"}`);
  }

  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `API-Sports ${res.status} on ${url.pathname}: ${JSON.stringify(json).slice(0, 400)}`,
    );
  }
  if (json?.errors && Object.keys(json.errors).length > 0) {
    console.warn(`[seed-teams] API errors on ${url.pathname}:`, json.errors);
  }
  return json;
}

function upsertKey(row: TeamRow): string {
  return `${row.sport}|${row.type}|${row.name.trim().toLowerCase()}`;
}

async function fetchCountries(
  sport: Sport,
  apiKey: string,
): Promise<TeamRow[]> {
  const host = sport === "football" ? FOOTBALL_HOST : RUGBY_HOST;
  const json = await apiSportsGet(host, "/countries", {}, apiKey);
  const now = new Date().toISOString();
  const rows: TeamRow[] = [];

  for (const item of json?.response || []) {
    const name = String(item.name || "").trim();
    if (!name) continue;
    rows.push({
      name,
      type: "country",
      country_code: toFlagCdnCode(item.code, name),
      api_sports_id: null,
      sport,
      updated_at: now,
    });
  }
  return rows;
}

async function fetchLeagueClubs(
  sport: Sport,
  leagueId: number,
  season: number,
  apiKey: string,
): Promise<TeamRow[]> {
  const host = sport === "football" ? FOOTBALL_HOST : RUGBY_HOST;
  const json = await apiSportsGet(
    host,
    "/teams",
    { league: leagueId, season },
    apiKey,
  );
  const now = new Date().toISOString();
  const rows: TeamRow[] = [];

  for (const item of json?.response || []) {
    // Football nests under `team`; rugby is often flatter.
    const team = item.team ?? item;
    const id = team?.id != null ? Number(team.id) : null;
    const name = String(team?.name || "").trim();
    if (!name || id == null || Number.isNaN(id)) continue;

    // National sides are covered by /countries — skip to avoid name collisions.
    if (team?.national === true) continue;

    rows.push({
      name,
      type: "club",
      country_code: toFlagCdnCode(null, team?.country || item.country),
      api_sports_id: id,
      sport,
      updated_at: now,
    });
  }
  return rows;
}

async function upsertChunk(
  supabase: ReturnType<typeof createClient>,
  chunk: TeamRow[],
  onConflict: string,
): Promise<void> {
  const { error } = await supabase.from("teams").upsert(chunk, {
    onConflict,
    ignoreDuplicates: false,
  });
  if (error) throw error;
}

async function upsertTeams(
  supabase: ReturnType<typeof createClient>,
  rows: TeamRow[],
): Promise<void> {
  // Deduplicate by sport+type+name (last write wins).
  const map = new Map<string, TeamRow>();
  for (const row of rows) {
    map.set(upsertKey(row), row);
  }
  const unique = Array.from(map.values());
  const withApiId = unique.filter((r) => r.api_sports_id != null);
  const withoutApiId = unique.filter((r) => r.api_sports_id == null);
  const chunkSize = 200;

  for (let i = 0; i < withApiId.length; i += chunkSize) {
    await upsertChunk(
      supabase,
      withApiId.slice(i, i + chunkSize),
      "sport,type,api_sports_id",
    );
  }
  for (let i = 0; i < withoutApiId.length; i += chunkSize) {
    await upsertChunk(
      supabase,
      withoutApiId.slice(i, i + chunkSize),
      "sport,type,name",
    );
  }
}

async function main() {
  const apiKey = requireEnv(["API_SPORTS_KEY", "API-SPORTS_KEY"]);
  const supabaseUrl = requireEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const serviceKey = requireEnv(["SUPABASE_SERVICE_ROLE_KEY"]);
  const footballSeason = Number(process.env.FOOTBALL_SEASON || "2025");
  const rugbySeason = Number(process.env.RUGBY_SEASON || "2025");

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const all: TeamRow[] = [];

  console.log("[seed-teams] Fetching football countries…");
  all.push(...(await fetchCountries("football", apiKey)));

  console.log("[seed-teams] Fetching rugby countries…");
  all.push(...(await fetchCountries("rugby", apiKey)));

  for (const league of FOOTBALL_LEAGUES) {
    console.log(`[seed-teams] Football clubs: ${league.label} (${league.id})`);
    all.push(
      ...(await fetchLeagueClubs("football", league.id, footballSeason, apiKey)),
    );
  }

  for (const league of RUGBY_LEAGUES) {
    console.log(`[seed-teams] Rugby clubs: ${league.label} (${league.id})`);
    try {
      all.push(
        ...(await fetchLeagueClubs("rugby", league.id, rugbySeason, apiKey)),
      );
    } catch (err) {
      console.warn(
        `[seed-teams] Skipping rugby league ${league.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`[seed-teams] Upserting ${all.length} rows (deduped in writer)…`);
  await upsertTeams(supabase, all);

  const { count, error } = await supabase
    .from("teams")
    .select("*", { count: "exact", head: true });
  if (error) throw error;

  console.log(
    `[seed-teams] Done. API calls=${requestCount}. teams table count≈${count ?? "?"}.`,
  );
}

main().catch((err) => {
  console.error("[seed-teams] FAILED:", err);
  process.exit(1);
});
