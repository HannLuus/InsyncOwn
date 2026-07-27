# Smoke test for InsyncOwn on Windows (manual / CI helper)
# Verifies daemon IPC is reachable after install or dev setup.
param(
  [string]$DaemonUrl = "http://127.0.0.1:5775/rpc"
)

$ErrorActionPreference = "Stop"

function Invoke-DaemonRpc($method, $params = @{}) {
  $body = @{ method = $method } + $params | ConvertTo-Json -Compress
  $response = Invoke-RestMethod -Uri $DaemonUrl -Method Post -Body $body -ContentType "application/json"
  if (-not $response.ok) {
    throw "RPC $method failed: $($response.error)"
  }
  return $response.data
}

Write-Host "InsyncOwn Windows smoke test"
Write-Host "Daemon URL: $DaemonUrl"

$deadline = (Get-Date).AddMinutes(3)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    Invoke-DaemonRpc "ping" | Out-Null
    $ready = $true
    break
  } catch {
    Start-Sleep -Seconds 2
  }
}

if (-not $ready) {
  throw "Daemon did not respond to ping within 3 minutes"
}
Write-Host "OK: daemon ping"

$status = Invoke-DaemonRpc "getStatus"
Write-Host "OK: daemon version $($status.version), runState=$($status.runState)"
Write-Host "OK: rclone path $($status.rclonePath)"
Write-Host "OK: config dir $($status.configDir)"
Write-Host "Pairs: $($status.pairs.Count)"

$auth = Invoke-DaemonRpc "authStatus"
Write-Host "Auth configured: $($auth.configured) — $($auth.message)"

Write-Host ""
Write-Host "Smoke test passed."
Write-Host "Next manual steps:"
Write-Host "  1. Connect Google Drive in the UI"
Write-Host "  2. Add a small test folder pair with an empty local directory"
Write-Host "  3. Wait until pair status is 'ok'"
