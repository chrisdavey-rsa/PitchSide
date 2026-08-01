// TEMPORARY test harness for API_SPORTS_KEY wiring.
// Calls API-Sports status + today's football fixtures so we can verify auth + payload shape.
// Revert verify_jwt / remove this function after testing.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const FOOTBALL_HOST = "https://v3.football.api-sports.io";

function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get("API_SPORTS_KEY");
  const present = typeof apiKey === "string" && apiKey.length > 0;

  if (!present) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: "Missing API_SPORTS_KEY secret.",
          apiSportsKey: { present: false, length: 0, preview: null },
        },
        null,
        2,
      ),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }

  const date = todayYmdUtc();
  const upstreamHeaders = {
    "x-apisports-key": apiKey!,
    Accept: "application/json",
  };

  try {
    const [statusRes, fixturesRes] = await Promise.all([
      fetch(`${FOOTBALL_HOST}/status`, { headers: upstreamHeaders }),
      fetch(`${FOOTBALL_HOST}/fixtures?date=${date}`, {
        headers: upstreamHeaders,
      }),
    ]);

    const statusText = await statusRes.text();
    const fixturesText = await fixturesRes.text();

    let statusJson: unknown = null;
    let fixturesJson: unknown = null;
    try {
      statusJson = JSON.parse(statusText);
    } catch {
      statusJson = { raw: statusText.slice(0, 400) };
    }
    try {
      fixturesJson = JSON.parse(fixturesText);
    } catch {
      fixturesJson = { raw: fixturesText.slice(0, 400) };
    }

    const fixturesObj = fixturesJson as {
      response?: unknown[];
      results?: number;
      errors?: unknown;
      message?: string;
    };
    const fixtureCount = Array.isArray(fixturesObj?.response)
      ? fixturesObj.response.length
      : 0;
    const sample = Array.isArray(fixturesObj?.response)
      ? fixturesObj.response.slice(0, 2)
      : [];

    const upstreamOk = statusRes.ok && fixturesRes.ok;
    const body = {
      ok: upstreamOk,
      message: upstreamOk
        ? "API_SPORTS_KEY accepted; football status + fixtures fetched."
        : "API_SPORTS_KEY present but upstream rejected one or more calls.",
      apiSportsKey: {
        present: true,
        length: apiKey!.length,
        preview: `${apiKey!.slice(0, 4)}…${apiKey!.slice(-4)}`,
      },
      upstream: {
        status: {
          httpStatus: statusRes.status,
          headers: {
            remaining: statusRes.headers.get("x-ratelimit-requests-remaining"),
            limit: statusRes.headers.get("x-ratelimit-requests-limit"),
          },
          body: statusJson,
        },
        fixtures: {
          httpStatus: fixturesRes.status,
          date,
          results: fixturesObj?.results ?? fixtureCount,
          errors: fixturesObj?.errors ?? null,
          message: fixturesObj?.message ?? null,
          sample,
        },
      },
    };

    return new Response(JSON.stringify(body, null, 2), {
      status: upstreamOk ? 200 : fixturesRes.status || statusRes.status || 502,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: "Upstream fetch failed",
          detail: message,
          apiSportsKey: {
            present: true,
            length: apiKey!.length,
            preview: `${apiKey!.slice(0, 4)}…${apiKey!.slice(-4)}`,
          },
        },
        null,
        2,
      ),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});
