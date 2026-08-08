// ============================================================================
// evaluate-chip-milestones — weekly CRON scaffold for Chip unlock evaluation
// ----------------------------------------------------------------------------
// Intended schedule: weekly (e.g. Monday 06:00 UTC via pg_cron → edge invoke).
//
// Milestone rules (mirrors public.evaluate_chip_unlocks):
//   Insurance (safety_net):
//     3 consecutive active prediction weeks.
//   Precision Boost (sniper):
//     3 Perfect Predictions in a 10-week rolling window
//     (excludes Banker-flagged results via is_banker_exact).
//   PitchSide Master:
//     8 consecutive weeks + predictions across 2+ sports +
//     aggregate accuracy >= 65%.
//
// Baseline Double Bubble is granted separately via grant_baseline_double_bubble.
//
// Required secrets:
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto-injected on hosted)
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ChipSport = "football" | "rugby" | "f1" | "golf";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Active football / rugby seasons only — F1/Golf chip seasons reserved.
  const sports: ChipSport[] = ["football", "rugby"];

  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .not("username", "is", null)
    .limit(5000);

  if (profileErr) {
    return jsonResponse(
      { error: "Failed to load profiles", detail: profileErr.message },
      500,
    );
  }

  let evaluated = 0;
  let grantedTotal = 0;
  const errors: string[] = [];

  for (const profile of profiles ?? []) {
    const userId = profile.id as string;
    if (!userId) continue;

    for (const sport of sports) {
      const { data, error } = await supabase.rpc("evaluate_chip_unlocks", {
        p_user_id: userId,
        p_sport_type: sport,
        p_season_id: null,
      });

      if (error) {
        errors.push(`${userId}/${sport}: ${error.message}`);
        continue;
      }

      evaluated++;
      const granted = Array.isArray((data as { granted?: unknown })?.granted)
        ? ((data as { granted: unknown[] }).granted.length)
        : 0;
      grantedTotal += granted;
    }
  }

  return jsonResponse({
    ok: true,
    evaluated,
    granted_total: grantedTotal,
    sports,
    // Documented milestone checks (enforced inside evaluate_chip_unlocks):
    milestones: {
      insurance_safety_net: "3 consecutive active weeks",
      precision_boost_sniper:
        "3 perfect predictions in 10-week window (excludes banker)",
      pitchside_master:
        "8 consecutive weeks + 2+ sports + accuracy >= 65%",
    },
    errors: errors.slice(0, 25),
    truncated_errors: errors.length > 25,
  });
});
