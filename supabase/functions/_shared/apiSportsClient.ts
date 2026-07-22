/**
 * Shared API-Sports client for Supabase Edge Functions (Deno).
 * Port of scripts/lib/apiSportsClient.ts — keep behaviour in sync.
 * Per-sport daily budget (football and rugby each get DAILY_BUDGET_CAP).
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Sport = "football" | "rugby";

/** Soft safety margin under free-tier ~100/day, applied per sport. */
export const DAILY_BUDGET_CAP = 90;

export const FOOTBALL_HOST = "https://v3.football.api-sports.io";
export const RUGBY_HOST = "https://v1.rugby.api-sports.io";

export type ApiSportsResult =
  | {
      ok: true;
      status: number;
      json: any;
      rateLimit: { limit: number | null; remaining: number | null };
      callsMadeToday: number;
      remainingBudget: number;
    }
  | {
      ok: false;
      reason:
        | "budget_exhausted"
        | "network"
        | "http"
        | "plan_blocked"
        | "validation_error";
      message: string;
      callsMadeToday?: number;
      remainingBudget?: number;
      status?: number;
      json?: any;
    };

export type RunStats = {
  callsThisRun: number;
  skippedBudget: string[];
  skippedCache: string[];
  skippedNoNeed: string[];
  planBlocked: string[];
  validationErrors: string[];
};

export function createRunStats(): RunStats {
  return {
    callsThisRun: 0,
    skippedBudget: [],
    skippedCache: [],
    skippedNoNeed: [],
    planBlocked: [],
    validationErrors: [],
  };
}

export function classifyApiErrors(
  errors: unknown,
): "none" | "plan_blocked" | "validation_error" {
  if (errors == null) return "none";
  if (Array.isArray(errors) && errors.length === 0) return "none";
  if (typeof errors === "object" && !Array.isArray(errors)) {
    if (Object.keys(errors as object).length === 0) return "none";
  }
  const msg = JSON.stringify(errors);
  if (
    /plan|subscription|upgrade|free plans do not have access|do not have access to this (date|season)/i.test(
      msg,
    )
  ) {
    return "plan_blocked";
  }
  return "validation_error";
}

export function resolveSeasonYear(
  now: Date = new Date(),
  opts: { maxSeason?: number; override?: number | null } = {},
): { season: number; preferred: number; clamped: boolean } {
  if (opts.override != null && Number.isFinite(opts.override)) {
    return {
      season: opts.override,
      preferred: opts.override,
      clamped: false,
    };
  }
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const preferred = m >= 7 ? y : y - 1;
  const maxSeason = opts.maxSeason ?? 2024;
  const season = Math.min(preferred, maxSeason);
  return { season, preferred, clamped: season !== preferred };
}

export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function hostFor(sport: Sport): string {
  return sport === "football" ? FOOTBALL_HOST : RUGBY_HOST;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class RateLimiter {
  private lastAt = 0;
  remaining: number | null = null;
  limit: number | null = null;

  constructor(private minIntervalMs: number) {}

  noteHeaders(headers: Headers) {
    const rem = headers.get("x-ratelimit-requests-remaining");
    const lim = headers.get("x-ratelimit-requests-limit");
    if (rem != null && rem !== "") this.remaining = Number(rem);
    if (lim != null && lim !== "") this.limit = Number(lim);
    if (this.remaining != null) {
      console.log(
        `[api-sports] rate-limit remaining=${this.remaining}/${this.limit ?? "?"}`,
      );
    }
  }

  async waitTurn() {
    const now = Date.now();
    const wait = Math.max(0, this.lastAt + this.minIntervalMs - now);
    if (wait > 0) {
      console.log(`[api-sports] throttling ${wait}ms…`);
      await sleep(wait);
    }
    if (this.remaining != null && this.remaining <= 3) {
      console.warn("[api-sports] upstream remaining ≤3 — sleeping 60s");
      await sleep(60_000);
    }
    this.lastAt = Date.now();
  }
}

export type ApiSportsClientOptions = {
  supabase: SupabaseClient;
  apiKey: string;
  caller: string;
  budgetCap?: number;
  minIntervalMs?: number;
  stats?: RunStats;
};

export class ApiSportsClient {
  private limiter: RateLimiter;
  private budgetCap: number;
  readonly stats: RunStats;

  constructor(private opts: ApiSportsClientOptions) {
    this.budgetCap = opts.budgetCap ?? DAILY_BUDGET_CAP;
    this.limiter = new RateLimiter(opts.minIntervalMs ?? 7000);
    this.stats = opts.stats ?? createRunStats();
  }

  async getUsageToday(sport: Sport) {
    const { data, error } = await this.opts.supabase.rpc("get_api_quota_usage", {
      p_date: utcDay(),
      p_sport: sport,
    });
    if (error) throw error;
    return data as {
      date: string;
      sport: string;
      calls_made: number;
      last_remaining_from_header: number | null;
      last_limit_from_header: number | null;
    };
  }

  async get(
    sport: Sport,
    apiPath: string,
    params: Record<string, string | number> = {},
    skipLabel?: string,
  ): Promise<ApiSportsResult> {
    const day = utcDay();

    const { data: reserved, error: reserveErr } = await this.opts.supabase.rpc(
      "reserve_api_quota",
      {
        p_date: day,
        p_sport: sport,
        p_budget: this.budgetCap,
        p_caller: this.opts.caller,
      },
    );

    if (reserveErr) {
      return {
        ok: false,
        reason: "http",
        message: `reserve_api_quota failed: ${reserveErr.message}`,
      };
    }

    const reservation = reserved as {
      allowed: boolean;
      calls_made: number;
      remaining_budget: number;
      budget: number;
    };

    if (!reservation.allowed) {
      const label = skipLabel || `${sport} ${apiPath}`;
      this.stats.skippedBudget.push(label);
      console.warn(
        `[api-sports] BUDGET EXHAUSTED (${sport}) — skipped ${label} (calls_made=${reservation.calls_made}/${this.budgetCap})`,
      );
      return {
        ok: false,
        reason: "budget_exhausted",
        message: `Daily ${sport} budget ${this.budgetCap} exhausted`,
        callsMadeToday: reservation.calls_made,
        remainingBudget: 0,
      };
    }

    await this.limiter.waitTurn();

    const url = new URL(apiPath, hostFor(sport));
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
    // Cache-bust: unique query param so edge / upstream never reuse a stale body.
    url.searchParams.set("_t", String(Date.now()));

    const fetchHeaders = {
      "x-apisports-key": this.opts.apiKey,
      Accept: "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    console.log(
      `[api-sports] GET ${url.pathname}?${url.searchParams} (caller=${this.opts.caller}, sport=${sport}, #${reservation.calls_made}/${this.budgetCap})`,
    );

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: fetchHeaders,
        cache: "no-store",
      });
    } catch (err) {
      return {
        ok: false,
        reason: "network",
        message: err instanceof Error ? err.message : String(err),
        callsMadeToday: reservation.calls_made,
        remainingBudget: reservation.remaining_budget,
      };
    }

    this.limiter.noteHeaders(res.headers);
    this.stats.callsThisRun += 1;

    await this.opts.supabase.rpc("record_api_quota_headers", {
      p_date: day,
      p_sport: sport,
      p_remaining: this.limiter.remaining,
      p_limit: this.limiter.limit,
    });

    if (res.status === 429) {
      console.warn("[api-sports] 429 — backing off 65s then retrying once");
      await sleep(65_000);
      // Retry does NOT re-reserve (slot already spent); fire again carefully.
      // Fresh timestamp so the retry itself is also uncacheable.
      url.searchParams.set("_t", String(Date.now()));
      const retry = await fetch(url.toString(), {
        headers: fetchHeaders,
        cache: "no-store",
      });
      this.limiter.noteHeaders(retry.headers);
      const retryJson = await retry.json().catch(() => ({}));
      return this.wrapOk(retry, retryJson, reservation);
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        reason: "http",
        message: `HTTP ${res.status}`,
        status: res.status,
        json,
        callsMadeToday: reservation.calls_made,
        remainingBudget: reservation.remaining_budget,
      };
    }

    return this.wrapOk(res, json, reservation);
  }

  private wrapOk(
    res: Response,
    json: any,
    reservation: { calls_made: number; remaining_budget: number },
  ): ApiSportsResult {
    const kind = classifyApiErrors(json?.errors);
    if (kind === "plan_blocked") {
      const msg = JSON.stringify(json.errors);
      console.error(`[api-sports] PLAN BLOCKED: ${msg}`);
      this.stats.planBlocked.push(msg);
      return {
        ok: false,
        reason: "plan_blocked",
        message: msg,
        status: res.status,
        json,
        callsMadeToday: reservation.calls_made,
        remainingBudget: reservation.remaining_budget,
      };
    }
    if (kind === "validation_error") {
      const msg = JSON.stringify(json.errors);
      console.error(
        `[api-sports] VALIDATION ERROR (malformed request — aborting this call path): ${msg}`,
      );
      this.stats.validationErrors.push(msg);
      return {
        ok: false,
        reason: "validation_error",
        message: msg,
        status: res.status,
        json,
        callsMadeToday: reservation.calls_made,
        remainingBudget: reservation.remaining_budget,
      };
    }

    return {
      ok: true,
      status: res.status,
      json,
      rateLimit: {
        limit: this.limiter.limit,
        remaining: this.limiter.remaining,
      },
      callsMadeToday: reservation.calls_made,
      remainingBudget: reservation.remaining_budget,
    };
  }

  logRunSummary(extra: Record<string, unknown> = {}) {
    console.log(
      JSON.stringify({
        tag: "api-sports-run-summary",
        caller: this.opts.caller,
        budgetCap: this.budgetCap,
        callsThisRun: this.stats.callsThisRun,
        skippedBudget: this.stats.skippedBudget,
        skippedCache: this.stats.skippedCache,
        skippedNoNeed: this.stats.skippedNoNeed,
        planBlocked: this.stats.planBlocked,
        validationErrors: this.stats.validationErrors,
        ...extra,
      }),
    );
  }
}
