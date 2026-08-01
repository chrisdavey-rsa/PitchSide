# Deploy edge functions from pre-built mcp-args JSON payloads.
# Usage: run from repo root; requires Supabase MCP deploy_edge_function (via agent) or manual MCP calls.
param(
  [string[]]$Functions = @('sync-schedule','sync-live','sync-live-settle','sync-settlement')
)

$dir = Join-Path $PSScriptRoot "deploy-payloads"
$results = @()

foreach ($fn in $Functions) {
  $path = Join-Path $dir "$fn.mcp-args.json"
  if (-not (Test-Path $path)) { throw "Missing payload: $path" }
  $j = Get-Content -Raw $path | ConvertFrom-Json
  $idx = ($j.files | Where-Object { $_.name -eq 'index.ts' }).content
  if ($idx.Contains('PLACEHOLDER')) { throw "$fn index.ts contains PLACEHOLDER" }
  if (-not $idx.StartsWith('// ============')) { throw "$fn index.ts missing header" }
  $fl = ($j.files | Where-Object { $_.name -like '*footballLeagues*' }).content
  if ($fl.Contains('f-eflcup') -or $fl.Contains('apiId: 48')) {
    throw "$fn footballLeagues.ts still has EFL Cup entries"
  }
  $results += [ordered]@{
    name = $j.name
    project_id = $j.project_id
    entrypoint_path = $j.entrypoint_path
    import_map_path = $j.import_map_path
    verify_jwt = $j.verify_jwt
    files_count = $j.files.Count
    index_bytes = $idx.Length
    payload_path = $path
  }
}

$results | ConvertTo-Json -Depth 5
