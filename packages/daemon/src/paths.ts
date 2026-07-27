import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

function isWindows(): boolean {
  return platform() === "win32";
}

export function configDir(): string {
  const override = process.env.INSYNCOWN_CONFIG_DIR;
  if (override) return override;
  if (isWindows()) {
    const appData =
      process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "InsyncOwn");
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "insyncown");
  return join(homedir(), ".config", "insyncown");
}

export function dataDir(): string {
  const override = process.env.INSYNCOWN_DATA_DIR;
  if (override) return override;
  if (isWindows()) {
    const local =
      process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
    return join(local, "InsyncOwn");
  }
  const xdg = process.env.XDG_DATA_HOME;
  if (xdg) return join(xdg, "insyncown");
  return join(homedir(), ".local", "share", "insyncown");
}

export function rcloneConfigPath(): string {
  return join(configDir(), "rclone.conf");
}

export function stateDbPath(): string {
  return join(dataDir(), "state.json");
}

export function logsDir(): string {
  return join(dataDir(), "logs");
}

export function bisyncWorkDir(): string {
  return join(dataDir(), "bisync");
}

/** Default location for importing an existing rclone Google Drive config. */
export function defaultRcloneImportPath(): string {
  if (isWindows()) {
    const appData =
      process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "rclone", "rclone.conf");
  }
  return join(homedir(), ".config", "rclone", "rclone.conf");
}

function bundledRcloneCandidates(): string[] {
  const name = isWindows() ? "rclone.exe" : "rclone";
  const dirs: string[] = [];
  if (process.env.INSYNCOWN_RESOURCES) {
    dirs.push(join(process.env.INSYNCOWN_RESOURCES, "rclone", name));
  }
  if (process.env.INSYNCOWN_INSTALL_DIR) {
    dirs.push(join(process.env.INSYNCOWN_INSTALL_DIR, "rclone", name));
    dirs.push(join(process.env.INSYNCOWN_INSTALL_DIR, "resources", "rclone", name));
  }
  return dirs;
}

/** Prefer env override, bundled rclone, then common install paths, then PATH. */
export function resolveRclonePath(): string {
  if (process.env.INSYNCOWN_RCLONE) return process.env.INSYNCOWN_RCLONE;

  for (const candidate of bundledRcloneCandidates()) {
    if (existsSync(candidate)) return candidate;
  }

  if (isWindows()) {
    const local =
      process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
    const candidates = [
      join(local, "InsyncOwn", "bin", "rclone.exe"),
      join(homedir(), "bin", "rclone.exe"),
      "rclone.exe",
    ];
    for (const c of candidates) {
      if (c.includes("\\") || c.includes("/")) {
        if (existsSync(c)) return c;
      } else {
        return c;
      }
    }
    return "rclone.exe";
  }

  const candidates = [
    join(homedir(), "bin", "rclone"),
    "/usr/local/bin/rclone",
    "/usr/bin/rclone",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "rclone";
}
