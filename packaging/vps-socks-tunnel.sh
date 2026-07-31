#!/usr/bin/env bash
# Local SOCKS5 proxy → VPS (same server as Outline). Used by InsyncOwn only.
set -euo pipefail

VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_HOST:-72.61.208.230}"
SOCKS_PORT="${SOCKS_PORT:-1080}"
SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-/home/hann/.ssh/id_hermes}"

SSH_OPTS=(
  -o BatchMode=yes
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=3
  -o ExitOnForwardFailure=yes
  -o StrictHostKeyChecking=accept-new
  -i "${SSH_IDENTITY_FILE}"
)

REMOTE="${VPS_USER}@${VPS_HOST}"
echo "InsyncOwn VPS SOCKS: ${SOCKS_PORT} → ${REMOTE}" >&2

exec ssh "${SSH_OPTS[@]}" -N -D "127.0.0.1:${SOCKS_PORT}" "${REMOTE}"
