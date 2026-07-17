// ============================================================================
// sync-live — API-Sports live score ingestion (Phase 2)
// ----------------------------------------------------------------------------
// Fetches in-play fixtures from API-Sports and updates ONLY the live scoring
// columns on public.matches (status, match_minute, provisional scores).
// Schedule metadata seeded by sync-schedule is left untouched.
//
// Invoke (POST):
//   { "sport": "football" | "rugby" }
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

const API_CONFIG: Record<"football" | "rugby", { url: string }> = {
  football: { url: "https://v3.football.api-sports.io/fixtures?live=all" },
  rugby: { url: "https://v1.rugby.api-sports.io/games?live=all" },
};

type Sport = "football" | "rugby";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * Formats the live match clock for display (e.g. "67'").
 * Falls back to status short code (e.g. "HT") when elapsed is unavailable.
 */
function formatMatchMinute(fixture: any, item: any): string | null {
  const elapsed = fixture.status?.elapsed ?? item.status?.elapsed;
  if (elapsed != null && elapsed !== "") {
    return `${elapsed}'`;
  }
  const short = fixture.status?.short ?? item.status?.short;
  return short ? String(short) : null;
}

/**
 * Normalizes a live API-Sports item into the partial matches row we update.
 * Football nests under `fixture` and uses `goals`; rugby is flatter and uses `scores`.
 */
function normalizeLiveUpdate(sport: Sport, item: any) {
  const fixture = item.fixture ?? item;

  const apiId = fixture.id ?? item.id;
  if (apiId == null) return null;

  const homeScore = sport === "football"
    ? item.goals?.home ?? fixture.goals?.home
    : item.scores?.home ?? fixture.scores?.home;

  const awayScore = sport === "football"
    ? item.goals?.away ?? fixture.goals?.away
    : item.scores?.away ?? fixture.scores?.away;

  return {
    id: `${sport}-${apiId}`,
    status: "live" as const,
    match_minute: formatMatchMinute(fixture, item),
    provisional_home_score: homeScore != null ? Number(homeScore) : null,
    provisional_away_score: awayScore != null ? Number(awayScore) : null,
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
  let payload: { sport?: string };
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

  // ---- Fetch live fixtures from API-Sports ----------------------------------
  const endpoint = API_CONFIG[sport].url;

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

  const liveItems: any[] = Array.isArray(apiJson?.response)
    ? apiJson.response
    : [];
  const rows = liveItems
    .map((item) => normalizeLiveUpdate(sport, item))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    return jsonResponse({ sport, fetched: liveItems.length, updated: 0 });
  }

  // ---- Update live columns only (service role bypasses RLS) ------------------
  // We use per-row UPDATE (not a full upsert) so schedule fields seeded by
  // sync-schedule are never overwritten. Matches not yet in the DB are skipped.
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

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

  if (errors.length > 0 && updated === 0) {
    return jsonResponse(
      { error: "All live updates failed.", detail: errors },
      500,
    );
  }

  return jsonResponse({
    sport,
    fetched: liveItems.length,
    updated,
    skipped: rows.length - updated,
    ...(errors.length > 0 ? { warnings: errors } : {}),
  });
});
