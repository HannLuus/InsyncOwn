# InsyncOwn releases — install without confusion

## Where to download

**Always use GitHub Releases (not random CI artifacts):**

https://github.com/HannLuus/InsyncOwn/releases

The **Latest** release at the top is the one you want.

## File naming

Every release ships platform installers:

```text
InsyncOwn-<version>-amd64.deb      # Linux (Ubuntu/Debian)
InsyncOwn-<version>-win64.exe      # Windows (unsigned NSIS installer)
```

Examples:

| File | Meaning |
|------|---------|
| `InsyncOwn-0.1.1-amd64.deb` | Linux 0.1.1 — **install this** if it’s the newest Linux build |
| `InsyncOwn-0.1.1-win64.exe` | Windows 0.1.1 — **install this** if it’s the newest Windows build |
| `InsyncOwn-0.1.0-amd64.deb` | Older Linux — **delete after** upgrading |

**Rule:** highest version number wins. Remove older installers from Downloads.

## Install (Linux)

```bash
cd ~/Downloads
sudo apt install ./InsyncOwn-0.1.1-amd64.deb
```

## Install (Windows)

Download `InsyncOwn-0.1.1-win64.exe` from Releases. See [docs/WINDOWS.md](WINDOWS.md) for SmartScreen/unsigned notes.

Replace `0.1.1` with whatever version you downloaded.

Check what’s installed:

```bash
dpkg -l | grep insyncown
```

The tray app and daemon log also show `InsyncOwn 0.1.1`.

## Upgrade

Install the newer `.deb` on top of the old one — same command. Then delete the old download file.

## For developers — cut a new release

1. Finish and commit your changes on `main`.
2. Bump version:
   ```bash
   npm run version:patch   # bug fixes → 0.1.2
   # npm run version:minor  # new feature → 0.2.0
   ```
3. Add a section to `CHANGELOG.md` for the new version.
4. Commit:
   ```bash
   git add -A
   git commit -m "Release v0.1.2"
   git tag v0.1.2
   git push origin main --tags
   ```
5. GitHub Actions builds and attaches `InsyncOwn-0.1.2-amd64.deb` and `InsyncOwn-0.1.2-win64.exe` to the release automatically.

**Never reuse a version number.** If `v0.1.2` is already tagged, bump to `0.1.3`.

## CI vs Releases

| Build | When | Use for |
|-------|------|---------|
| **GitHub Release** (tag `v*`) | You tag a version | Installing on your machine or sharing with others |
| **CI artifact on `main`** | Every push to main | Developer sanity check only — skip for installs |
