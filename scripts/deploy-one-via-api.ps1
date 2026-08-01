param(
  [Parameter(Mandatory = $true)][string]$FunctionName,
  [string]$Token = $env:SUPABASE_ACCESS_TOKEN
)

if (-not $Token) {
  Write-Error "SUPABASE_ACCESS_TOKEN not set"
  exit 2
}

$payloadPath = Join-Path $PSScriptRoot "deploy-payloads\_runtime-deploy-$FunctionName.json"
if (-not (Test-Path $payloadPath)) {
  Write-Error "Missing payload: $payloadPath"
  exit 3
}

$payload = Get-Content -Raw $payloadPath | ConvertFrom-Json
$projectId = $payload.project_id
$slug = $payload.name

$boundary = [Guid]::NewGuid().ToString()
$LF = "`r`n"
$bodyStream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.StreamWriter($bodyStream, [System.Text.Encoding]::UTF8)

function Write-Field([string]$name, [string]$value, [string]$filename = $null) {
  $script:writer.Write("--$boundary$LF")
  if ($filename) {
    $script:writer.Write("Content-Disposition: form-data; name=`"$name`"; filename=`"$filename`"$LF")
    $script:writer.Write("Content-Type: application/typescript$LF$LF")
  } else {
    $script:writer.Write("Content-Disposition: form-data; name=`"$name`"$LF")
    $script:writer.Write("Content-Type: application/json$LF$LF")
  }
  $script:writer.Write($value)
  $script:writer.Write($LF)
}

$metadata = @{
  name = $payload.name
  entrypoint_path = $payload.entrypoint_path
  import_map_path = $payload.import_map_path
  verify_jwt = $payload.verify_jwt
} | ConvertTo-Json -Compress

Write-Field "metadata" $metadata
foreach ($f in $payload.files) {
  Write-Field "file" $f.content $f.name
}
$writer.Write("--$boundary--$LF")
$writer.Flush()
$bodyBytes = $bodyStream.ToArray()

$url = "https://api.supabase.com/v1/projects/$projectId/functions/deploy?slug=$([uri]::EscapeDataString($slug))"
try {
  $response = Invoke-RestMethod -Uri $url -Method Post -Headers @{
    Authorization = "Bearer $Token"
  } -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyBytes
  $response | ConvertTo-Json -Depth 10
} catch {
  Write-Error $_
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Error ($reader.ReadToEnd())
  }
  exit 1
}
