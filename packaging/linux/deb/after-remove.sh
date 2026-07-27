#!/bin/bash
set -e

rm -f '/usr/lib/systemd/user/insyncown-daemon.service' || true

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications || true
fi

exit 0
