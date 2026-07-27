# InsyncOwn on Windows

Unsigned production installer for testers. Expect **SmartScreen** and antivirus warnings until the installer is code-signed.

## Download

From [GitHub Releases](https://github.com/HannLuus/InsyncOwn/releases):

```text
InsyncOwn-<version>-win64.exe
```

Install the **highest version number**. Delete older installers from `Downloads` after upgrading.

## Install

1. Download `InsyncOwn-0.1.1-win64.exe` (or latest).
2. If SmartScreen appears: **More info → Run anyway** (unsigned build).
3. Run the installer. Defaults install per-user under:
   ```text
   %LOCALAPPDATA%\Programs\InsyncOwn\
   ```
4. The installer automatically:
   - Registers **InsyncOwnDaemon** (Task Scheduler, runs at logon)
   - Adds a **Startup** shortcut for the tray UI
5. Open InsyncOwn from the Start menu or system tray.
6. Click **Connect Google Drive** and complete browser login.

## Where data lives

| Item | Path |
|------|------|
| Config (OAuth / rclone) | `%APPDATA%\InsyncOwn\rclone.conf` |
| Sync state & bisync workdirs | `%LOCALAPPDATA%\InsyncOwn\` |
| Daemon log | `%LOCALAPPDATA%\InsyncOwn\logs\daemon.log` |
| Bundled rclone | `%LOCALAPPDATA%\Programs\InsyncOwn\resources\rclone\rclone.exe` |

## Upgrade

Run the newer `InsyncOwn-<version>-win64.exe` installer. Your config and sync pairs are preserved in `%APPDATA%` / `%LOCALAPPDATA%`.

## Manual service control

```powershell
# Check daemon task
Get-ScheduledTask -TaskName InsyncOwnDaemon

# Start / stop daemon
Start-ScheduledTask -TaskName InsyncOwnDaemon
Stop-ScheduledTask -TaskName InsyncOwnDaemon

# View log
Get-Content "$env:LOCALAPPDATA\InsyncOwn\logs\daemon.log" -Tail 50 -Wait
```

## Uninstall

1. **Settings → Apps → InsyncOwn → Uninstall** (or run the uninstaller from the install folder).
2. Optionally remove data:
   ```powershell
   Remove-Item -Recurse -Force "$env:APPDATA\InsyncOwn"
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\InsyncOwn"
   ```

## Dev / manual install (from repo)

```powershell
cd InsyncOwn
npm install
npm run build
npm run pack:nsis
# → release\InsyncOwn-<version>-win64.exe

# Or register daemon manually after a local Electron run:
powershell -ExecutionPolicy Bypass -File packaging\windows\scripts\install-windows-service.ps1 -InstallDir "path\to\InsyncOwn"
```

## Import existing rclone auth

If you already use rclone on Windows with Google Drive:

1. Default config: `%APPDATA%\rclone\rclone.conf`
2. In InsyncOwn UI, use **Import existing rclone auth** (if shown) or copy the `[gdrive]` section into `%APPDATA%\InsyncOwn\rclone.conf`.

## Smoke test (after install)

See [scripts/smoke-test-windows.ps1](../scripts/smoke-test-windows.ps1).

## Known limitations (unsigned build)

- Windows SmartScreen warning on first run
- Some antivirus tools may flag unsigned background tasks
- Code signing (EV certificate) is planned for public distribution
- Google OAuth app verification still required before wide public release

## Troubleshooting

| Problem | Fix |
|---------|-----|
| UI says daemon offline | Check Task Scheduler task `InsyncOwnDaemon`; read `daemon.log` |
| Connect opens browser but fails | Allow localhost callback; check firewall |
| Sync errors on first pair | Use an empty local folder; wait for `--resync` to finish |
| Wrong rclone used | Set `INSYNCOWN_RCLONE` to bundled exe path |
