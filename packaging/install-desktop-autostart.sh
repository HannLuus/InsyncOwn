#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
AUTO_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
mkdir -p "$APP_DIR" "$AUTO_DIR"

NODE_BIN="$(command -v node)"
# Prefer starting via npm script so workspace electron resolves
cat >"$APP_DIR/insyncown.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=InsyncOwn
Comment=Google Drive selective two-way sync
Exec=/bin/bash -lc 'cd "$ROOT" && INSYNCOWN_EXTERNAL_DAEMON=1 ELECTRON_DISABLE_GPU=1 npm run start:desktop'
Icon=$ROOT/apps/desktop/build/icon.png
Terminal=false
Categories=Network;FileTransfer;
StartupWMClass=InsyncOwn
EOF

cp "$APP_DIR/insyncown.desktop" "$AUTO_DIR/insyncown.desktop"
# Ensure autostart enabled
if ! grep -q 'X-GNOME-Autostart-enabled=' "$AUTO_DIR/insyncown.desktop"; then
  printf '\nX-GNOME-Autostart-enabled=true\nX-GNOME-Autostart-Delay=8\n' >>"$AUTO_DIR/insyncown.desktop"
fi

echo "Installed desktop entry: $APP_DIR/insyncown.desktop"
echo "Autostart: $AUTO_DIR/insyncown.desktop"
echo "(Daemon should already be enabled via npm run install:systemd)"
