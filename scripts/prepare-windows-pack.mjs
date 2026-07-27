#!/usr/bin/env node
/**
 * Prepare Windows packaging inputs: daemon bundle + rclone.exe
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("node", ["scripts/bundle-daemon.mjs"]);

const rcloneExe = join(root, "packaging", "rclone", "win", "rclone.exe");
if (!existsSync(rcloneExe)) {
  run("node", ["scripts/fetch-rclone-windows.mjs"]);
}

if (!existsSync(rcloneExe)) {
  console.error("Missing packaging/rclone/win/rclone.exe after fetch");
  process.exit(1);
}

console.log("Windows pack inputs ready");
