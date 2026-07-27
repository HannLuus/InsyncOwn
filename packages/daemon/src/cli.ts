#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APP_NAME, APP_VERSION } from "@insyncown/shared";
import { SyncEngine } from "./sync-engine.js";
import { IpcServer } from "./ipc-server.js";
import { dataDir, logsDir } from "./paths.js";

async function main(): Promise<void> {
  mkdirSync(dataDir(), { recursive: true });
  mkdirSync(logsDir(), { recursive: true });

  const engine = new SyncEngine();
  // Recover if a previous shutdown left runState stuck at "stopping"
  if (engine.store.getRunState() === "stopping") {
    engine.store.setRunState("running");
  }
  const server = new IpcServer(engine);

  const shutdown = async (signal: string) => {
    console.log(`[${APP_NAME}] shutting down (${signal})`);
    // Do not persist "stopping" — that freezes the next boot.
    engine.stop();
    await server.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  engine.start();
  const { host, port } = await server.start();
  const pidPath = join(dataDir(), "daemon.pid");
  writeFileSync(pidPath, String(process.pid), "utf8");

  console.log(
    `[${APP_NAME}] daemon v${APP_VERSION} listening on http://${host}:${port}`,
  );
  console.log(`[${APP_NAME}] rclone: ${engine.rclone.bin}`);
  console.log(`[${APP_NAME}] config: ${engine.rclone.configPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
