// TEMPORARY test harness — JWT verification disabled via config.toml
// [functions.test-api] verify_jwt = false
// Revert verify_jwt to true (or remove the section) after testing.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get("API_SPORTS_KEY");
  const present = typeof apiKey === "string" && apiKey.length > 0;

  const body = {
    ok: true,
    message: "test-api reachable without Authorization header",
    apiSportsKey: {
      present,
      // Never return the full secret — just enough to confirm the env is wired.
      length: present ? apiKey!.length : 0,
      preview: present
        ? `${apiKey!.slice(0, 4)}…${apiKey!.slice(-4)}`
        : null,
    },
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: present ? 200 : 500,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
});
