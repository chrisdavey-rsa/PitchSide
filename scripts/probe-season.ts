/**
 * One-shot probe: which season year returns real fixtures for league 39 / rugby 26?
 * Usage: npm.cmd exec -- tsx scripts/probe-season.ts
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const key = process.env.API_SPORTS_KEY || process.env["API-SPORTS_KEY"];
if (!key) throw new Error("Missing API_SPORTS_KEY");

async function probe(
  host: string,
  pathName: string,
  params: Record<string, string | number>,
) {
  const url = new URL(pathName, host);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": key!, Accept: "application/json" },
  });
  const json = await res.json().catch(() => ({}));
  const results = typeof json?.results === "number" ? json.results : null;
  const count = Array.isArray(json?.response) ? json.response.length : 0;
  const errors = json?.errors ?? null;
  const rem = res.headers.get("x-ratelimit-requests-remaining");
  const lim = res.headers.get("x-ratelimit-requests-limit");
  console.log(
    JSON.stringify(
      {
        url: url.toString().replace(key!, "***"),
        http: res.status,
        results,
        responseCount: count,
        errors,
        rateLimit: { remaining: rem, limit: lim },
        sampleIds: (json?.response || [])
          .slice(0, 2)
          .map((x: any) => x?.fixture?.id ?? x?.id),
      },
      null,
      2,
    ),
  );
  return { count, errors, results };
}

async function main() {
  const fb = "https://v3.football.api-sports.io";
  const rb = "https://v1.rugby.api-sports.io";

  console.log("--- football league=39 season=2025 ---");
  const f25 = await probe(fb, "/fixtures", { league: 39, season: 2025 });
  console.log("--- football league=39 season=2026 ---");
  const f26 = await probe(fb, "/fixtures", { league: 39, season: 2026 });

  console.log("--- rugby league=26 season=2025 ---");
  const r25 = await probe(rb, "/games", { league: 26, season: 2025 });
  console.log("--- rugby league=26 season=2026 ---");
  const r26 = await probe(rb, "/games", { league: 26, season: 2026 });

  console.log("--- football league=39 season=2025 date=today (control) ---");
  const today = new Date().toISOString().slice(0, 10);
  await probe(fb, "/fixtures", { league: 39, season: 2025, date: today });

  const pick = (a: typeof f25, b: typeof f26, label: string) => {
    const aOk = a.count > 0 && !a.errors?.length && (!a.errors || Object.keys(a.errors).length === 0);
    const bOk = b.count > 0 && (!b.errors || Object.keys(b.errors).length === 0);
    console.log(
      `[pick] ${label}: season2025 count=${a.count} season2026 count=${b.count} → prefer ${aOk && !bOk ? 2025 : bOk && !aOk ? 2026 : a.count >= b.count ? 2025 : 2026}`,
    );
  };
  pick(f25, f26, "football/39");
  pick(r25, r26, "rugby/26");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
