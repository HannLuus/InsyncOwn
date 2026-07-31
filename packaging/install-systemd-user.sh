#!/usr/bin/env bash
# Install InsyncOwn daemon as a systemd --user service (dev / dogfood path).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_SRC="$ROOT/packaging/systemd/insyncown-daemon.service"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_DST="$UNIT_DIR/insyncown-daemon.service"

if [[ ! -f "$ROOT/packages/daemon/dist/cli.js" ]]; then
  echo "Building daemon first…"
  (cd "$ROOT" && npm run build:daemon)
fi

mkdir -p "$UNIT_DIR"
# Rewrite ExecStart to absolute node + absolute cli path for this machine
NODE_BIN="$(command -v node)"
CLI="$ROOT/packages/daemon/dist/cli.js"
cat >"$UNIT_DST" <<EOF
[Unit]
Description=InsyncOwn Google Drive sync daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${NODE_BIN} ${CLI}
Restart=on-failure
RestartSec=5
Environment=PATH=${HOME}/bin:/usr/local/bin:/usr/bin:/bin
Environment=INSYNCOWN_EXTERNAL_DAEMON=1
Environment=INSYNCOWN_RCLONE=${HOME}/bin/rclone
# Optional: route only InsyncOwn sync through a local proxy (see docs/NETWORK-PROXY.md)
# Environment=INSYNCOWN_PROXY=socks5://127.0.0.1:1080
# Environment=INSYNCOWN_NO_PROXY=127.0.0.1,localhost

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now insyncown-daemon.service
systemctl --user status insyncown-daemon.service --no-pager || true
echo
echo "Installed: $UNIT_DST"
echo "Logs: journalctl --user -u insyncown-daemon -f"
echo "Desktop UI: cd $ROOT && npm run start:desktop"
