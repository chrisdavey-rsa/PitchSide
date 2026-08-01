#!/usr/bin/env node
/**
 * Deploy one edge function via Supabase Management API multipart deploy.
 * Requires SUPABASE_ACCESS_TOKEN in environment (sbp_...).
 * Usage: node scripts/deploy-one-via-api.cjs sync-schedule
 */
const fs = require("fs");
const path = require("path");

const fn = process.argv[2];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!fn) {
  console.error("usage: node deploy-one-via-api.cjs <function-name>");
  process.exit(1);
}
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN not set");
  process.exit(2);
}

const payloadPath = path.join(
  __dirname,
  "deploy-payloads",
  `_runtime-deploy-${fn}.json`,
);
const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
const projectId = payload.project_id;
const slug = payload.name;

const form = new FormData();
const metadata = {
  name: payload.name,
  entrypoint_path: payload.entrypoint_path,
  import_map_path: payload.import_map_path,
  verify_jwt: payload.verify_jwt,
};
form.append(
  "metadata",
  new Blob([JSON.stringify(metadata)], { type: "application/json" }),
);
for (const f of payload.files) {
  form.append(
    "file",
    new Blob([f.content], { type: "application/typescript" }),
    f.name,
  );
}

const url = `https://api.supabase.com/v1/projects/${projectId}/functions/deploy?slug=${encodeURIComponent(slug)}`;

fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
})
  .then(async (res) => {
    const text = await res.text();
    if (!res.ok) {
      console.error("HTTP", res.status, text);
      process.exit(1);
    }
    console.log(text);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
