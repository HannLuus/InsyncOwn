!macro customInstall
  DetailPrint "Registering InsyncOwn sync daemon..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\install-windows-service.ps1" -InstallDir "$INSTDIR"'
  Pop $0
  IntCmp $0 0 daemonOk
    MessageBox MB_OK|MB_ICONSTOP "InsyncOwn could not register the sync daemon (exit code $0). Check Task Scheduler permissions and try again."
    Abort
  daemonOk:
  DetailPrint "Registering InsyncOwn tray autostart..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\install-windows-autostart.ps1" -InstallDir "$INSTDIR"'
  Pop $1
  IntCmp $1 0 autostartOk
    MessageBox MB_OK|MB_ICONSTOP "InsyncOwn could not add tray autostart (exit code $1)."
    Abort
  autostartOk:
!macroend

!macro customUnInstall
  DetailPrint "Removing InsyncOwn scheduled tasks..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\uninstall-windows.ps1"'
  Pop $0
!macroend
