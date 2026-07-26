/**
 * Detached helper: opens rclone OAuth for the InsyncOwn gdrive remote.
 * Prefer `rclone config reconnect` which launches the browser.
 */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { RCLONE_REMOTE_NAME } from "@insyncown/shared";
import { rcloneConfigPath, resolveRclonePath } from "./paths.js";

async function main(): Promise<void> {
  const bin = process.env.INSYNCOWN_RCLONE ?? resolveRclonePath();
  const config = process.env.RCLONE_CONFIG ?? rcloneConfigPath();
  const remote = process.env.INSYNCOWN_REMOTE ?? RCLONE_REMOTE_NAME;

  mkdirSync(dirname(config), { recursive: true });
  if (!existsSync(config)) {
    writeFileSync(config, `[${remote}]\ntype = drive\nscope = drive\n`, "utf8");
  }

  // Ensure remote exists
  await new Promise<void>((resolve) => {
    const create = spawn(
      bin,
      [
        "--config",
        config,
        "config",
        "create",
        remote,
        "drive",
        "scope",
        "drive",
        "config_is_local",
        "true",
      ],
      { stdio: "ignore" },
    );
    create.on("close", () => resolve());
  });

  // Opens system browser for OAuth; stdio ignored so this works when detached from GUI.
  await new Promise<number>((resolve) => {
    const child = spawn(
      bin,
      ["--config", config, "config", "reconnect", remote, "--auto-confirm"],
      { stdio: "ignore" },
    );
    child.on("close", (code) => resolve(code ?? 1));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
