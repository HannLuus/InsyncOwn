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

```bash
npm run pack:deb
# → release/insyncown_*_amd64.deb

sudo apt install ./release/insyncown_*_amd64.deb
```

GitHub Actions (`Build Debian`) uploads that same `.deb` as an artifact.

The `.deb` ships the Electron UI. Keep the sync daemon managed by systemd (`npm run install:systemd`) so sync continues when the UI is closed.