# InsyncOwn product notes

## Positioning

**InsyncOwn** is a Linux-first Google Drive client with *true selective two-way sync* — local folder copies on disk, offline edits, background daemon — sold cheaper than Insync.

Not a FUSE mount wrapper. Mount tools (including the personal `gdrive-bridge`) are convenience; this product sells reliability and Insync-like behavior.

## MVP scope

- Google Drive only
- Selective folder pairs (remote path ↔ local path)
- rclone `bisync` engine with safety flags
- Electron tray + settings UI
- systemd user daemon on login
- `.deb` + AppImage packaging

## Pricing sketch (not implemented yet)

- Personal: one-time or cheap yearly, multi-machine soft limit
- Undercut Insync; avoid per-cloud-account sticker shock
- License gate in Phase 2; sync continues offline once entitled

## Wedge vs free tools

- Polished daemon + tray that “just works” on Ubuntu/Debian/KDE/GNOME
- Clear first-sync / conflict UX (where rclone GUIs scare people)
- Opinionated Google Drive defaults, not a generic 70-provider console

## Risks

- Google OAuth app verification before public installers
- `bisync --resync` can hurt data if misused — UI must warn
- Keep personal mount (`gdrive-bridge`) until dogfood sync is trusted
