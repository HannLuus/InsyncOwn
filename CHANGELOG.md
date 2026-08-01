# Changelog

All notable InsyncOwn releases are listed here. Version numbers use [Semantic Versioning](https://semver.org/).

## How to read versions

- **0.1.x** — early dogfood builds; expect changes
- **Patch** (0.1.0 → 0.1.1) — bug fixes, reliability
- **Minor** (0.1.x → 0.2.0) — new features, still pre-1.0
- **Major** (1.0.0) — first stable “customer ready” release

Install the **highest version number** from [GitHub Releases](https://github.com/HannLuus/InsyncOwn/releases). Delete older `InsyncOwn-*-amd64.deb` files from Downloads after installing.

---

## [0.1.3] - 2026-08-01

### Fixed

- Project folder sync performance: added default exclude rules (`node_modules`, `.git`, `.venv`, `dist`, `build`, `.next`, `target`, `__pycache__`, temp/lock files) and `.insyncignore` support for `rclone bisync` and `chokidar` file watcher.

### Added

- VPS SOCKS tunnel installer and per-app proxy routing for restricted networks.

---

## [0.1.2] - 2026-07-27

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

[0.1.3]: https://github.com/HannLuus/InsyncOwn/releases/tag/v0.1.3
[0.1.2]: https://github.com/HannLuus/InsyncOwn/releases/tag/v0.1.2
[0.1.1]: https://github.com/HannLuus/InsyncOwn/releases/tag/v0.1.1
[0.1.0]: https://github.com/HannLuus/InsyncOwn/releases/tag/v0.1.0
