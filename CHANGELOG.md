# Changelog

All notable InsyncOwn releases are listed here. Version numbers use [Semantic Versioning](https://semver.org/).

## How to read versions

- **0.1.x** — early dogfood builds; expect changes
- **Patch** (0.1.0 → 0.1.1) — bug fixes, reliability
- **Minor** (0.1.x → 0.2.0) — new features, still pre-1.0
- **Major** (1.0.0) — first stable “customer ready” release

Install the **highest version number** from [GitHub Releases](https://github.com/HannLuus/InsyncOwn/releases). Delete older `InsyncOwn-*-amd64.deb` files from Downloads after installing.

---

## [Unreleased]

### Fixed

- Windows-only `extraResources` no longer break Linux `.deb` CI builds
- Packaged Windows UI waits for Task Scheduler daemon instead of spawning a duplicate
- NSIS installer aborts when service/autostart registration fails
- Daemon install script validates bundled `rclone.exe` and uses reliable log append
- Release workflow title no longer doubles the `v` prefix (`InsyncOwn v0.1.1`)
- `npm run build` no longer fails when version is already synced
- Desktop entries no longer use the file-manager `folder-remote` icon

### Added

- App identity: real InsyncOwn icon (sync-loop + folder) for launcher, window, tray, and installers
- Self-contained Linux `.deb`: bundled daemon, systemd user unit installed to `/usr/lib/systemd/user/`, `rclone` as Recommends, chrome-sandbox SUID fix in postinst
- Windows port: NSIS installer (`InsyncOwn-<version>-win64.exe`), bundled daemon + rclone.exe, Task Scheduler daemon, CI build workflow
- OS-specific config paths (`%APPDATA%` / `%LOCALAPPDATA%` on Windows)
- [docs/WINDOWS.md](docs/WINDOWS.md) install guide and smoke test script

---

## [0.1.1] - 2026-07-27

### Fixed

- OAuth / Google login flow (browser auth, own OAuth client support)
- Bisync stale lock recovery and dangling Google Drive shortcut handling
- Electron UI resilience (daemon reconnect, clear stale errors, GPU disable)

---

## [0.1.0] - 2026-07-26

### Added

- Initial InsyncOwn: Electron tray UI, sync daemon, rclone bisync pairs
- systemd user service and `.deb` packaging
- Dogfood docs and import from existing rclone auth

[0.1.1]: https://github.com/HannLuus/InsyncOwn/releases/tag/v0.1.1
[0.1.0]: https://github.com/HannLuus/InsyncOwn/releases/tag/v0.1.0
