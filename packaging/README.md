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

## Linux installers

```bash
npm run pack:linux
# → release/InsyncOwn-*.AppImage
# → release/insyncown_*.deb
```

The AppImage/deb ship the Electron UI. Keep the sync daemon managed by systemd (`npm run install:systemd`) so sync continues when the UI is closed — matching the product architecture (UI ≠ sync engine).
