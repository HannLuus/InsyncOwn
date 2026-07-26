# InsyncOwn

Sellable **Google Drive selective two-way sync** for Linux — true local copies, background daemon, Electron tray UI. Built to compete with Insync at a fairer price.

> Not a FUSE mount. For the personal mount prototype see `~/gdrive-bridge`. This repo is the product.

## Architecture

- `@insyncown/desktop` — Electron settings + tray
- `@insyncown/daemon` — sync daemon (chokidar + rclone bisync + HTTP IPC)
- `@insyncown/shared` — IPC types

Daemon listens on `http://127.0.0.1:5775`.

## Quick start (dev)

```bash
cd ~/projects/InsyncOwn
npm install
npm run build

# Optional: reuse existing rclone Google auth
bash packaging/import-existing-rclone-auth.sh

# Terminal 1 — daemon
npm run start:daemon

# Terminal 2 — UI
npm run start:desktop
```

Or install the daemon as a user systemd service:

```bash
npm run install:systemd
npm run start:desktop
```

## Dogfood / cutover

See [docs/DOGFOOD.md](docs/DOGFOOD.md) and [docs/PRODUCT.md](docs/PRODUCT.md).

## Packaging

```bash
npm run pack:linux
# outputs under ./release (AppImage + deb)
```

## Safety

First sync of a pair uses `rclone bisync --resync`. Prefer an empty local folder or a known-good mirror. Ongoing sync uses `--max-delete 25`, conflict losers renamed with `insyncown-conflict-` suffix.
