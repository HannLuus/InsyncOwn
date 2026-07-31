#!/usr/bin/env bash
# Install SSH SOCKS tunnel to VPS for InsyncOwn Google sync (Myanmar / blocked regions).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="${HOME}/.local/bin"
CONF_DIR="${XDG_CONFIG_HOME:-$HOME/.config}"
UNIT_DIR="${CONF_DIR}/systemd/user"

mkdir -p "$BIN_DIR" "$UNIT_DIR" "${CONF_DIR}/insyncown"

install -m755 "$ROOT/packaging/vps-socks-tunnel.sh" "$BIN_DIR/insyncown-vps-socks.sh"

if [[ ! -f "${CONF_DIR}/insyncown-vps-socks.env" ]]; then
  cat >"${CONF_DIR}/insyncown-vps-socks.env" <<EOF
# VPS used for Outline — SOCKS for InsyncOwn sync only (not system VPN)
VPS_USER=root
VPS_HOST=72.61.208.230
SOCKS_PORT=1080
SSH_IDENTITY_FILE=${HOME}/.ssh/id_hermes
EOF
  echo "Created ${CONF_DIR}/insyncown-vps-socks.env"
fi

cat >"${CONF_DIR}/insyncown/network.json" <<EOF
{
  "proxyUrl": "socks5://127.0.0.1:1080",
  "noProxy": "127.0.0.1,localhost"
}
EOF
echo "Configured ${CONF_DIR}/insyncown/network.json"

sed "s|%h|${HOME}|g" "$ROOT/packaging/systemd/insyncown-vps-socks.service" >"${UNIT_DIR}/insyncown-vps-socks.service"

# Daemon should start after SOCKS tunnel when possible
DAEMON_UNIT="${UNIT_DIR}/insyncown-daemon.service"
if [[ -f "$DAEMON_UNIT" ]] && ! grep -q 'insyncown-vps-socks' "$DAEMON_UNIT"; then
  sed -i '/^\[Unit\]/a After=insyncown-vps-socks.service\nWants=insyncown-vps-socks.service' "$DAEMON_UNIT"
fi

systemctl --user daemon-reload
systemctl --user enable --now insyncown-vps-socks.service
systemctl --user restart insyncown-daemon.service 2>/dev/null || true

echo
echo "VPS SOCKS tunnel: systemctl --user status insyncown-vps-socks"
echo "InsyncOwn proxy:  socks5://127.0.0.1:1080 (in network.json)"
echo "Test in UI: Network / proxy → Test Google Drive"
