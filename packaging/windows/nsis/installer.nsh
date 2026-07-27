!macro customInstall
  DetailPrint "Registering InsyncOwn sync daemon..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\install-windows-service.ps1" -InstallDir "$INSTDIR"'
  Pop $0
  DetailPrint "Registering InsyncOwn tray autostart..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\install-windows-autostart.ps1" -InstallDir "$INSTDIR"'
  Pop $1
!macroend

!macro customUnInstall
  DetailPrint "Removing InsyncOwn scheduled tasks..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\uninstall-windows.ps1"'
  Pop $0
!macroend
