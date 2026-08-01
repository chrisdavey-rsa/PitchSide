#!/usr/bin/env python3
"""Build deploy payload JSON files for Supabase edge functions."""
import json
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "supabase", "functions")
BASE = os.path.normpath(BASE)

def read(rel):
    with open(os.path.join(BASE, rel), encoding="utf-8") as f:
        return f.read()

shared = {
    "../_shared/apiSportsClient.ts": read(os.path.join("_shared", "apiSportsClient.ts")),
    "../_shared/footballLeagues.ts": read(os.path.join("_shared", "footballLeagues.ts")),
    "deno.json": read("deno.json"),
}

jwt = {
    "sync-schedule": True,
    "sync-live": True,
    "sync-live-settle": False,
    "sync-settlement": True,
}

out_dir = os.path.join(os.path.dirname(__file__), "deploy-payloads")
os.makedirs(out_dir, exist_ok=True)

for fn in jwt:
    payload = {
        "project_id": "rdxilidssfrixvlylnjq",
        "name": fn,
        "entrypoint_path": "index.ts",
        "import_map_path": "../deno.json",
        "verify_jwt": jwt[fn],
        "files": [
            {"name": "index.ts", "content": read(os.path.join(fn, "index.ts"))},
            {"name": "../_shared/apiSportsClient.ts", "content": shared["../_shared/apiSportsClient.ts"]},
            {"name": "../_shared/footballLeagues.ts", "content": shared["../_shared/footballLeagues.ts"]},
            {"name": "deno.json", "content": shared["deno.json"]},
        ],
    }
    path = os.path.join(out_dir, f"{fn}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    print(f"Wrote {path} ({os.path.getsize(path)} bytes)")
