/**
 * CLI helper (optional): non-destructive reconnect.
 * Prefer the daemon AuthSession used by the Electron UI.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { RCLONE_REMOTE_NAME } from "@insyncown/shared";
import { rcloneConfigPath, resolveRclonePath } from "./paths.js";

function ensureStub(config: string, remote: string): void {
  mkdirSync(dirname(config), { recursive: true });
  if (!existsSync(config)) {
    writeFileSync(config, `[${remote}]\ntype = drive\nscope = drive\n`, "utf8");
    return;
  }
  const text = readFileSync(config, "utf8");
  if (!text.includes(`[${remote}]`)) {
    writeFileSync(
      config,
      `${text.trimEnd()}\n\n[${remote}]\ntype = drive\nscope = drive\n`,
      "utf8",
    );
  }
}

async function main(): Promise<void> {
  const bin = process.env.INSYNCOWN_RCLONE ?? resolveRclonePath();
  const config = process.env.RCLONE_CONFIG ?? rcloneConfigPath();
  const remote = process.env.INSYNCOWN_REMOTE ?? RCLONE_REMOTE_NAME;
  ensureStub(config, remote);

  const code = await new Promise<number>((resolve) => {
    const child = spawn(
      bin,
      ["--config", config, "config", "reconnect", `${remote}:`],
      { stdio: "inherit" },
    );
    child.on("close", (c) => resolve(c ?? 1));
  });
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
