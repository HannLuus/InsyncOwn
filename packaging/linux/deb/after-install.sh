#!/bin/bash
# electron-builder deb afterInstall — replaces the default template, so we
# must keep the chrome-sandbox SUID fix here.
set -e

# Electron requires SUID on chrome-sandbox when unprivileged user namespaces
# are restricted (Ubuntu 24.04+).
if [ -f '/opt/InsyncOwn/chrome-sandbox' ]; then
  chmod 4755 '/opt/InsyncOwn/chrome-sandbox' || true
fi

# Ship the per-user daemon unit system-wide; users enable it with:
#   systemctl --user enable --now insyncown-daemon
if [ -f '/opt/InsyncOwn/resources/systemd/insyncown-daemon.service' ]; then
  install -Dm644 '/opt/InsyncOwn/resources/systemd/insyncown-daemon.service' \
    '/usr/lib/systemd/user/insyncown-daemon.service'
fi

# Refresh desktop database / icon caches so the menu entry and icon appear.
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q /usr/share/icons/hicolor || true
fi

exit 0
