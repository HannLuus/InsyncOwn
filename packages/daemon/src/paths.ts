import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

export function configDir(): string {
  const override = process.env.INSYNCOWN_CONFIG_DIR;
  if (override) return override;
  return join(homedir(), ".config", "insyncown");
}

export function dataDir(): string {
  const override = process.env.INSYNCOWN_DATA_DIR;
  if (override) return override;
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

/** Prefer bundled rclone, then ~/bin/rclone, then PATH. */
export function resolveRclonePath(): string {
  if (process.env.INSYNCOWN_RCLONE) return process.env.INSYNCOWN_RCLONE;
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
