#!/usr/bin/env node
/** Print deploy args JSON for MCP deploy_edge_function (stdout, no BOM). */
const fs = require("fs");
const path = require("path");
const fn = process.argv[2];
if (!fn) {
  console.error("usage: node load-deploy-args.cjs <function-name>");
  process.exit(1);
}
const p = path.join(
  __dirname,
  "deploy-payloads",
  `_runtime-deploy-${fn}.json`,
);
process.stdout.write(fs.readFileSync(p, "utf8"));
