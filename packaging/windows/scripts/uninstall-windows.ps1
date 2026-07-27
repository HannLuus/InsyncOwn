# Full Windows uninstall helpers (daemon task + startup shortcut).
param(
  [string]$InstallDir = ""
)

$ErrorActionPreference = "Stop"

$serviceScript = Join-Path $PSScriptRoot "uninstall-windows-service.ps1"
& $serviceScript

$startup = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startup "InsyncOwn.lnk"
if (Test-Path $shortcutPath) {
  Remove-Item $shortcutPath -Force
  Write-Host "Removed startup shortcut"
}

Write-Host "InsyncOwn Windows helpers removed"
