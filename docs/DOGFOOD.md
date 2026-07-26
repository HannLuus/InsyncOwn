# Dogfood cutover guide

Use this when InsyncOwn selective sync is ready enough to replace Insync / reduce reliance on `gdrive-bridge` mount.

## What you already have on this machine

| Component | Path / note |
|-----------|-------------|
| Insync (disabled autostart) | `/usr/bin/insync` — keep installed until InsyncOwn is trusted |
| Personal mount bridge | `~/gdrive-bridge` → `~/GoogleDrive` (FUSE; not the product) |
| Existing rclone remote | `~/.config/rclone/rclone.conf` `[gdrive]` |
| InsyncOwn repo | `~/projects/InsyncOwn` |

## One-time setup

```bash
cd ~/projects/InsyncOwn
npm install
npm run build

# Import existing Google Drive token into InsyncOwn config (no re-login)
bash packaging/import-existing-rclone-auth.sh

# Background daemon on login
npm run install:systemd

# UI / tray
npm run start:desktop
```

## First real sync pair (safe pattern)

1. Pick a **small** Drive folder (e.g. a test folder you create in Drive).
2. Create an **empty** local directory, e.g. `~/InsyncOwnSync/TestFolder`.
3. In the UI: **Add folder pair** → remote path + local path → enable first resync.
4. Wait until pair status is `ok`.
5. Edit a file locally and remotely; click **Sync now** or wait for watcher/poll.

Avoid pointing the first pair at your entire Drive root.

## Verified on this machine (2026-07-26)

- Daemon enabled: `systemctl --user status insyncown-daemon`
- Auth imported from `~/.config/rclone/rclone.conf` → `~/.config/insyncown/rclone.conf`
- Pair **Dogfood**:
  - Remote: `gdrive:06_Systems/InsyncOwn_Dogfood`
  - Local: `~/InsyncOwnSync/InsyncOwn_Dogfood`
  - First `--resync` → status `ok`
  - Cloud → local: `hello-from-cloud.txt`
  - Local → cloud: `hello-from-local.txt`
- Packages: `release/InsyncOwn-0.1.0.AppImage`, `release/insyncown_0.1.0_amd64.deb`
- Desktop autostart installed (`npm run install:desktop`)

## Cutover criteria (before quitting Insync for good)

- [x] At least one real folder syncs two-way (dogfood pair)
- [ ] Conflicts rename with `insyncown-conflict-` suffix instead of silent loss
- [ ] `systemctl --user status insyncown-daemon` survives reboot
- [ ] Own Google OAuth client_id configured (rclone shared client retirement)
- [ ] You understand that `~/GoogleDrive` mount ≠ InsyncOwn local sync folders
- [ ] Daily-driver work folders migrated to InsyncOwn pairs

## Cutover steps

1. Stop adding new Insync sync roots; use InsyncOwn pairs instead.
2. When confident: `insync quit` (autostart already disabled by gdrive-bridge install).
3. Keep `gdrive-bridge` only if you still want a browsable full-Drive mount; it can coexist with InsyncOwn as long as local sync paths do **not** overlap the FUSE mount point.
4. Do **not** sync the same folder via Insync + InsyncOwn + mount writes at once.

## Rollback

```bash
systemctl --user disable --now insyncown-daemon
# optional: re-enable Insync autostart and `insync start`
systemctl --user start gdrive-bridge   # if you still use the mount
```

## Notes

- InsyncOwn state: `~/.local/share/insyncown/`
- InsyncOwn rclone config: `~/.config/insyncown/rclone.conf`
- Daemon IPC: `http://127.0.0.1:5775/rpc`
