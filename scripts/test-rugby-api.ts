/**
 * Standalone diagnostic: API-Sports Rugby status + weekend games + rate limits.
 *
 * Usage:
 *   npm.cmd exec -- tsx scripts/test-rugby-api.ts
 *
 * Env:
 *   API_SPORTS_KEY (or API-SPORTS_KEY)
 *   RUGBY_TEST_DATE (optional — default 2026-08-08)
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local"), override: true });

const RUGBY_HOST = "https://v1.rugby.api-sports.io";
const TEST_DATE = process.env.RUGBY_TEST_DATE || "2026-08-08";

const apiKey = process.env.API_SPORTS_KEY || process.env["API-SPORTS_KEY"];
if (!apiKey) {
  throw new Error("Missing API_SPORTS_KEY (or API-SPORTS_KEY) in environment");
}

function readRateLimitHeaders(headers: Headers) {
  // API-Sports uses the *-requests-* names; also check short aliases.
  const limit =
    headers.get("x-ratelimit-requests-limit") ??
    headers.get("x-ratelimit-limit");
  const remaining =
    headers.get("x-ratelimit-requests-remaining") ??
    headers.get("x-ratelimit-remaining");
  return { limit, remaining };
}

async function rugbyGet(pathname: string, params: Record<string, string> = {}) {
  const url = new URL(pathname, RUGBY_HOST);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  console.log(`\n=== GET ${url.toString()} ===`);

  const res = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": apiKey!,
      Accept: "application/json",
    },
  });

  const { limit, remaining } = readRateLimitHeaders(res.headers);
  console.log(`HTTP status: ${res.status}`);
  console.log(`x-ratelimit-limit: ${limit ?? "(missing)"}`);
  console.log(`x-ratelimit-remaining: ${remaining ?? "(missing)"}`);

  const json = await res.json().catch((err) => ({
    _parseError: err instanceof Error ? err.message : String(err),
  }));

  const errors = (json as { errors?: unknown })?.errors ?? null;
  const results = (json as { results?: unknown })?.results ?? null;

  console.log(`errors: ${JSON.stringify(errors, null, 2)}`);
  console.log(`results: ${results}`);
  console.log("full JSON:");
  console.log(JSON.stringify(json, null, 2));

  return { res, json, errors, results };
}

function findSaVsArg(json: unknown): unknown[] {
  const response = (json as { response?: unknown })?.response;
  if (!Array.isArray(response)) return [];

  const needle = (s: string) => /south\s*africa|argentina|springbok|puma/i.test(s);

  return response.filter((game: any) => {
    const teams = game?.teams ?? {};
    const home =
      teams?.home?.name ?? game?.home?.name ?? game?.team1?.name ?? "";
    const away =
      teams?.away?.name ?? game?.away?.name ?? game?.team2?.name ?? "";
    return needle(String(home)) || needle(String(away));
  });
}

async function main() {
  console.log(`[test-rugby-api] host=${RUGBY_HOST} date=${TEST_DATE}`);

  await rugbyGet("/status");

  const games = await rugbyGet("/games", { date: TEST_DATE });

  const matches = findSaVsArg(games.json);
  console.log(
    `\n=== South Africa / Argentina scan (date=${TEST_DATE}) ===`,
  );
  console.log(`candidates: ${matches.length}`);
  if (matches.length > 0) {
    console.log(JSON.stringify(matches, null, 2));
  } else {
    console.log(
      "No SA/Argentina match found in this response (check date, plan access, or errors above).",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
