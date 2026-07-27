# Register InsyncOwn sync daemon as a per-user scheduled task (no admin required).
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$ErrorActionPreference = "Stop"

$taskName = "InsyncOwnDaemon"
$electronExe = Join-Path $InstallDir "InsyncOwn.exe"
$resources = Join-Path $InstallDir "resources"
$daemonCli = Join-Path $resources "daemon-bundle\cli.mjs"
$rcloneExe = Join-Path $resources "rclone\rclone.exe"
$runScript = Join-Path $resources "scripts\run-daemon.ps1"
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$dataDir = Join-Path $localAppData "InsyncOwn"
$logDir = Join-Path $dataDir "logs"

if (-not (Test-Path $electronExe)) {
  throw "InsyncOwn.exe not found at $electronExe"
}
if (-not (Test-Path $daemonCli)) {
  throw "Daemon bundle not found at $daemonCli"
}

New-Item -ItemType Directory -Force -Path $dataDir, $logDir | Out-Null

$runScriptContent = @"
`$ErrorActionPreference = 'Stop'
`$env:ELECTRON_RUN_AS_NODE = '1'
`$env:INSYNCOWN_EXTERNAL_DAEMON = '1'
`$env:INSYNCOWN_RESOURCES = '$resources'
`$env:INSYNCOWN_RCLONE = '$rcloneExe'
`$log = Join-Path '$logDir' 'daemon.log'
Start-Transcript -Path `$log -Append | Out-Null
try {
  & '$electronExe' '$daemonCli'
} finally {
  Stop-Transcript | Out-Null
}
"@

$scriptsDir = Join-Path $resources "scripts"
New-Item -ItemType Directory -Force -Path $scriptsDir | Out-Null
Set-Content -Path $runScript -Value $runScriptContent -Encoding UTF8

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runScript`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "InsyncOwn Google Drive sync daemon" `
  -RunLevel Limited | Out-Null

Start-ScheduledTask -TaskName $taskName

Write-Host "Registered scheduled task: $taskName"
Write-Host "Daemon log: $logDir\daemon.log"
