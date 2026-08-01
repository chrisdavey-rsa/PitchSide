#!/usr/bin/env node
/** Build/validate runtime deploy payloads for all 4 sync functions. */
const fs = require("fs");
const path = require("path");

const base = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(base, rel), "utf8");
}

const shared = {
  "../_shared/apiSportsClient.ts": read(
    "supabase/functions/_shared/apiSportsClient.ts",
  ),
  "../_shared/footballLeagues.ts": read(
    "supabase/functions/_shared/footballLeagues.ts",
  ),
  "deno.json": read("supabase/functions/deno.json"),
};

const jwt = {
  "sync-schedule": true,
  "sync-live": true,
  "sync-live-settle": false,
  "sync-settlement": true,
};

const outDir = path.join(__dirname, "deploy-payloads");
for (const fn of Object.keys(jwt)) {
  const payload = {
    project_id: "rdxilidssfrixvlylnjq",
    name: fn,
    entrypoint_path: "index.ts",
    import_map_path: "deno.json",
    verify_jwt: jwt[fn],
    files: [
      { name: "index.ts", content: read(`supabase/functions/${fn}/index.ts`) },
      {
        name: "../_shared/apiSportsClient.ts",
        content: shared["../_shared/apiSportsClient.ts"],
      },
      {
        name: "../_shared/footballLeagues.ts",
        content: shared["../_shared/footballLeagues.ts"],
      },
      { name: "deno.json", content: shared["deno.json"] },
    ],
  };
  const out = path.join(outDir, `_runtime-deploy-${fn}.json`);
  fs.writeFileSync(out, JSON.stringify(payload), "utf8");
  const idx = payload.files[0].content;
  const fl = payload.files[2].content;
  console.log(
    JSON.stringify({
      fn,
      bytes: fs.statSync(out).size,
      idxStart: idx.slice(0, 25),
      placeholder: idx.includes("PLACEHOLDER"),
      eflcup: fl.includes("f-eflcup"),
      api48: fl.includes("apiId: 48"),
    }),
  );
}
