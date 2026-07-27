import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
  DAEMON_DEFAULT_HOST,
  DAEMON_DEFAULT_PORT,
  type AuthStatusResult,
  type IpcRequest,
  type IpcResponse,
  type StartAuthResult,
} from "@insyncown/shared";
import type { SyncEngine } from "./sync-engine.js";
import { AuthSession } from "./auth-session.js";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: IpcResponse): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function importRemoteSection(
  sourcePath: string,
  destPath: string,
  remoteName: string,
): void {
  if (!existsSync(sourcePath)) {
    throw new Error(`rclone config not found: ${sourcePath}`);
  }
  const text = readFileSync(sourcePath, "utf8");
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inSection = false;
  let found = false;
  for (const line of lines) {
    if (line.startsWith("[") && line.endsWith("]")) {
      const name = line.slice(1, -1).trim();
      inSection = name === remoteName;
      if (inSection) {
        found = true;
        out.push(`[${remoteName}]`);
      }
      continue;
    }
    if (inSection) out.push(line);
  }
  if (!found) throw new Error(`Remote [${remoteName}] not found in ${sourcePath}`);
  let body = `${out.join("\n").trim()}\n`;
  if (!/type\s*=\s*drive/.test(body)) {
    body = body.replace(`[${remoteName}]`, `[${remoteName}]\ntype = drive`);
  }
  if (!/token\s*=/.test(body)) {
    throw new Error(`Remote [${remoteName}] has no token in ${sourcePath}`);
  }
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, body, "utf8");
}

export class IpcServer {
  private server: Server | null = null;
  private readonly authSession: AuthSession;

  constructor(
    private readonly engine: SyncEngine,
    private readonly host = DAEMON_DEFAULT_HOST,
    private readonly port = Number(process.env.INSYNCOWN_DAEMON_PORT ?? DAEMON_DEFAULT_PORT),
  ) {
    this.authSession = new AuthSession(
      engine.rclone.bin,
      engine.rclone.configPath,
      engine.rclone.remoteName,
    );
  }

  async start(): Promise<{ host: string; port: number }> {
    this.server = createServer((req, res) => {
      void this.handle(req, res);
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(this.port, this.host, () => resolve());
    });
    return { host: this.host, port: this.port };
  }

  async stop(): Promise<void> {
    this.authSession.cancel();
    if (!this.server) return;
    await new Promise<void>((resolve) => {
      this.server!.close(() => resolve());
    });
    this.server = null;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true, data: { alive: true } });
      return;
    }
    if (req.method !== "POST" || req.url !== "/rpc") {
      sendJson(res, 404, { ok: false, error: "Not found" });
      return;
    }
    try {
      const raw = await readBody(req);
      const request = JSON.parse(raw) as IpcRequest;
      const data = await this.dispatch(request);
      sendJson(res, 200, { ok: true, data });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 200, { ok: false, error: message });
    }
  }

  private async dispatch(request: IpcRequest): Promise<unknown> {
    switch (request.method) {
      case "ping":
        return { pong: true };
      case "getStatus":
        return this.engine.enrichStatus();
      case "pause":
        this.engine.pause();
        return this.engine.getStatus();
      case "resume":
        this.engine.resume();
        return this.engine.getStatus();
      case "listRemoteFolders":
        return this.engine.rclone.listFolders(request.path ?? "");
      case "addPair": {
        const pair = this.engine.addPair({
          name: request.name,
          localPath: request.localPath,
          remotePath: request.remotePath,
          runResync: request.runResync ?? true,
        });
        return pair;
      }
      case "removePair": {
        const ok = this.engine.removePair(request.id);
        if (!ok) throw new Error("Pair not found");
        return { removed: true };
      }
      case "setPairEnabled": {
        const pair = this.engine.setPairEnabled(request.id, request.enabled);
        if (!pair) throw new Error("Pair not found");
        return pair;
      }
      case "syncNow": {
        if (request.id) {
          return this.engine.syncPair(request.id, { resync: false });
        }
        await this.engine.tickAll("manual");
        return { ok: true };
      }
      case "resyncPair":
        return this.engine.syncPair(request.id, { resync: true });
      case "authStatus": {
        const configured = this.engine.rclone.isRemoteConfigured();
        const result: AuthStatusResult = {
          configured,
          needsReconnect: !configured,
          remoteName: this.engine.rclone.remoteName,
          message: configured
            ? "Google Drive is connected"
            : "Google Drive is not connected. Click Connect to authorize.",
        };
        return result;
      }
      case "configureAuth": {
        if (request.clientId && request.clientSecret) {
          await this.engine.rclone.configureClientId(
            request.clientId,
            request.clientSecret,
          );
        } else {
          this.engine.rclone.ensureConfigStub();
        }
        return {
          configured: this.engine.rclone.isRemoteConfigured(),
          message: "Config updated. Use Connect Google Drive to complete browser login.",
        };
      }
      case "startAuth": {
        const result: StartAuthResult = await this.authSession.start();
        return result;
      }
      case "importExistingRcloneAuth": {
        const source =
          request.sourceConfigPath ??
          join(homedir(), ".config", "rclone", "rclone.conf");
        importRemoteSection(
          source,
          this.engine.rclone.configPath,
          this.engine.rclone.remoteName,
        );
        return {
          configured: this.engine.rclone.isRemoteConfigured(),
          message: "Imported existing rclone Google Drive login.",
        };
      }
      default: {
        const _exhaustive: never = request;
        throw new Error(`Unknown method: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}
