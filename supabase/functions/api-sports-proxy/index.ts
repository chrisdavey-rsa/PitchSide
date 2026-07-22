// ============================================================================
// api-sports-proxy — generic API-Sports proxy (manual / admin use)
// ----------------------------------------------------------------------------
// Routes through the shared daily quota ledger. Prefer sync-* / seed-full for
// automated ingestion; this is for ad-hoc paths (/teams, /leagues, etc.).
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import {
  ApiSportsClient,
  DAILY_BUDGET_CAP,
  type Sport,
} from "../_shared/apiSportsClient.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ProxyRequest = {
  sport: Sport;
  path: string;
  params: Record<string, string>;
};

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function resolveApiKey(): string | undefined {
  return Deno.env.get("API_SPORTS_KEY") ?? Deno.env.get("API-SPORTS_KEY");
}

function normalizePath(rawPath: string): string | null {
  const trimmed = (rawPath || "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return null;
  if (trimmed.includes("..")) return null;

  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const pathOnly = withSlash.split("?")[0].split("#")[0];
  if (!/^\/[A-Za-z0-9/_-]+$/.test(pathOnly)) return null;
  return pathOnly;
}

async function parseProxyRequest(req: Request): Promise<ProxyRequest | Response> {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const sport = (url.searchParams.get("sport") || "").toLowerCase() as Sport;
    const path = url.searchParams.get("path") || "";
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      if (key === "sport" || key === "path") return;
      params[key] = value;
    });
    if (sport !== "football" && sport !== "rugby") {
      return jsonResponse({ error: "`sport` must be 'football' or 'rugby'." }, 400);
    }
    const normalized = normalizePath(path);
    if (!normalized) {
      return jsonResponse(
        {
          error:
            "Invalid `path`. Use a relative API path like `/teams` or `/fixtures`.",
        },
        400,
      );
    }
    return { sport, path: normalized, params };
  }

  if (req.method === "POST") {
    let body: {
      sport?: string;
      path?: string;
      params?: Record<string, unknown>;
    };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    const sport = String(body.sport || "").toLowerCase() as Sport;
    if (sport !== "football" && sport !== "rugby") {
      return jsonResponse({ error: "`sport` must be 'football' or 'rugby'." }, 400);
    }

    const normalized = normalizePath(String(body.path || ""));
    if (!normalized) {
      return jsonResponse(
        {
          error:
            "Invalid `path`. Use a relative API path like `/teams` or `/fixtures`.",
        },
        400,
      );
    }

    const params: Record<string, string> = {};
    if (body.params && typeof body.params === "object") {
      for (const [key, value] of Object.entries(body.params)) {
        if (value == null) continue;
        params[key] = String(value);
      }
    }

    return { sport, path: normalized, params };
  }

  return jsonResponse({ error: "Method not allowed. Use GET or POST." }, 405);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const apiKey = resolveApiKey();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!apiKey) {
    return jsonResponse(
      {
        error:
          "Missing API sports key secret. Set API_SPORTS_KEY (or API-SPORTS_KEY).",
      },
      500,
    );
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." },
      500,
    );
  }

  const parsed = await parseProxyRequest(req);
  if (parsed instanceof Response) return parsed;

  const { sport, path, params } = parsed;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const client = new ApiSportsClient({
    supabase,
    apiKey,
    caller: "api-sports-proxy",
    budgetCap: DAILY_BUDGET_CAP,
  });

  const label = `proxy ${sport} ${path}`;
  const result = await client.get(sport, path, params, label);

  if (!result.ok) {
    if (result.reason === "budget_exhausted") {
      client.logRunSummary({ sport, path, skipped: "budget_exhausted" });
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
    return jsonResponse(
      { error: "Upstream request failed.", detail: result.message },
      502,
    );
  }

  const usage = await client.getUsageToday(sport).catch(() => null);
  client.logRunSummary({
    sport,
    path,
    callsMadeToday: usage?.calls_made ?? null,
    remainingBudget:
      usage != null ? Math.max(0, DAILY_BUDGET_CAP - usage.calls_made) : null,
  });

  const headers: Record<string, string> = {
    "x-pitchside-budget-cap": String(DAILY_BUDGET_CAP),
  };
  if (usage?.calls_made != null) {
    headers["x-pitchside-calls-made-today"] = String(usage.calls_made);
  }
  if (result.rateLimit.remaining != null) {
    headers["x-apisports-requests-remaining"] = String(
      result.rateLimit.remaining,
    );
  }
  if (result.rateLimit.limit != null) {
    headers["x-apisports-requests-limit"] = String(result.rateLimit.limit);
  }

  return jsonResponse(result.json, result.status, headers);
});
