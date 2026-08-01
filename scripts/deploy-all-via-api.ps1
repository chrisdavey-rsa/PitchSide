# Deploy all 4 sync functions via pre-built runtime payloads.
# Requires SUPABASE_ACCESS_TOKEN (sbp_...) from https://supabase.com/dashboard/account/tokens
param(
  [string]$Token = $env:SUPABASE_ACCESS_TOKEN
)

$ErrorActionPreference = 'Stop'
if (-not $Token) {
  Write-Error "Set SUPABASE_ACCESS_TOKEN before running."
  exit 2
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$deployScript = Join-Path $scriptDir 'deploy-one-via-api.ps1'
$functions = @('sync-schedule','sync-live','sync-live-settle','sync-settlement')

foreach ($fn in $functions) {
  Write-Host "Deploying $fn..."
  & $deployScript -FunctionName $fn -Token $Token
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "All deploys submitted."
