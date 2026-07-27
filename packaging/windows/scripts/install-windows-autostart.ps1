# Add InsyncOwn tray app to the current user's Startup folder.
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$ErrorActionPreference = "Stop"

$electronExe = Join-Path $InstallDir "InsyncOwn.exe"
if (-not (Test-Path $electronExe)) {
  throw "InsyncOwn.exe not found at $electronExe"
}

$startup = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startup "InsyncOwn.lnk"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $electronExe
$shortcut.Arguments = "--disable-gpu"
$shortcut.WorkingDirectory = $InstallDir
$shortcut.Description = "InsyncOwn Google Drive sync"
$shortcut.Save()

Write-Host "Startup shortcut: $shortcutPath"
