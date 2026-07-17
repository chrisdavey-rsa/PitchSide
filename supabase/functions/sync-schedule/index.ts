// ============================================================================
// sync-schedule — API-Sports schedule ingestion (Phase 1)
// ----------------------------------------------------------------------------
// Fetches fixtures from API-Sports for a given sport + date and upserts them
// into public.matches, keyed on a stable `<sport>-<apiId>` id.
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// API-Sports endpoints per sport. Host + base URL differ between sports.
const API_CONFIG: Record<
  "football" | "rugby",
  { url: string }
> = {
  football: { url: "https://v3.football.api-sports.io/fixtures" },
  rugby: { url: "v1.rugby.api-sports.io/games" },
};

// Status codes that mean the match is finished (points can be settled).
const FINISHED_STATUSES = new Set([
  "FT", // Full time
  "AET", // After extra time
  "PEN", // Penalties
  "AWD", // Awarded
  "WO", // Walkover
]);

type Sport = "football" | "rugby";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Normalizes a single API-Sports fixture into a public.matches row.
 * Handles both the football shape (nested under `fixture`) and the rugby shape
 * (fields at the top level), falling back gracefully between them.
 */
function normalizeFixture(sport: Sport, item: any) {
  // Football nests fixture metadata under `fixture`; rugby is flat.
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
    competition_id: league.id != null ? String(league.id) : null,
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

  // ---- Validate secrets ----------------------------------------------------
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

  // ---- Parse & validate payload -------------------------------------------
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

  // ---- Fetch from API-Sports ----------------------------------------------
  const endpoint = `${API_CONFIG[sport].url}?date=${date}`;

  let apiJson: any;
  try {
    const apiRes = await fetch(endpoint, {
      headers: { "x-apisports-key": apiKey },
    });
    apiJson = await apiRes.json();
    if (!apiRes.ok) {
      return jsonResponse(
        { error: "API-Sports request failed.", status: apiRes.status, detail: apiJson },
        502,
      );
    }
  } catch (err) {
    return jsonResponse(
      { error: "Failed to reach API-Sports.", detail: String(err) },
      502,
    );
  }

  // API-Sports returns validation problems in an `errors` field (often an
  // object or array). Surface them rather than silently upserting nothing.
  const apiErrors = apiJson?.errors;
  const hasApiErrors = apiErrors &&
    ((Array.isArray(apiErrors) && apiErrors.length > 0) ||
      (typeof apiErrors === "object" && Object.keys(apiErrors).length > 0));
  if (hasApiErrors) {
    return jsonResponse({ error: "API-Sports returned errors.", detail: apiErrors }, 502);
  }

  const fixtures: any[] = Array.isArray(apiJson?.response) ? apiJson.response : [];
  const rows = fixtures
    .map((item) => normalizeFixture(sport, item))
    .filter((row) => row.id && row.home_team && row.away_team);

  if (rows.length === 0) {
    return jsonResponse({ sport, date, fetched: fixtures.length, upserted: 0 });
  }

  // ---- Upsert into public.matches (service role bypasses RLS) --------------
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    return jsonResponse(
      { error: "Database upsert failed.", detail: error.message },
      500,
    );
  }

  return jsonResponse({
    sport,
    date,
    fetched: fixtures.length,
    upserted: rows.length,
  });
});
