# Packaging

## Dev / dogfood (recommended now)

```bash
cd ~/projects/InsyncOwn
npm install && npm run build
bash packaging/import-existing-rclone-auth.sh   # once
npm run install:systemd                        # daemon on login
npm run install:desktop                        # Electron tray autostart
npm run start:desktop                          # open UI now
```

Daemon unit: `~/.config/systemd/user/insyncown-daemon.service`  
Desktop/autostart: `~/.local/share/applications/insyncown.desktop`

## Debian / Ubuntu installer (primary)

Target for dogfood: **Ubuntu 26.04** via `.deb`.

The `.deb` is self-contained: Electron UI, bundled sync daemon, app icon, and a
systemd user unit. `rclone` is a Recommends dependency (apt installs it by default).

```bash
npm run pack:deb
# → release/InsyncOwn-<version>-amd64.deb

sudo apt install ./release/InsyncOwn-0.1.1-amd64.deb

# Recommended: run sync in the background even when the UI is closed
systemctl --user enable --now insyncown-daemon
```

Without the systemd unit, the UI starts its own daemon child (sync stops when the UI quits).

**Install from [GitHub Releases](https://github.com/HannLuus/InsyncOwn/releases)** — not CI artifacts. See [docs/RELEASES.md](../docs/RELEASES.md).

### Windows

```powershell
npm run pack:nsis
# → release\InsyncOwn-<version>-win64.exe
```

See [docs/WINDOWS.md](../docs/WINDOWS.md).

The `.deb` ships the Electron UI. Keep the sync daemon managed by systemd (`npm run install:systemd`) so sync continues when the UI is closed.