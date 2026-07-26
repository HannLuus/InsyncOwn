import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DAEMON_DEFAULT_HOST,
  DAEMON_DEFAULT_PORT,
  type AuthStatusResult,
  type IpcRequest,
  type IpcResponse,
} from "@insyncown/shared";
import type { SyncEngine } from "./sync-engine.js";

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

export class IpcServer {
  private server: Server | null = null;

  constructor(
    private readonly engine: SyncEngine,
    private readonly host = DAEMON_DEFAULT_HOST,
    private readonly port = Number(process.env.INSYNCOWN_DAEMON_PORT ?? DAEMON_DEFAULT_PORT),
  ) {}

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
          message: "Config updated. Use startAuth to complete browser login.",
        };
      }
      case "startAuth": {
        // Spawn helper in a new terminal-friendly process with inherited stdio when possible.
        // For GUI: run rclone config reconnect detached and return instructions.
        const result = await this.runAuthHelper();
        return result;
      }
      default: {
        const _exhaustive: never = request;
        throw new Error(`Unknown method: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  private async runAuthHelper(): Promise<{ started: boolean; message: string }> {
    this.engine.rclone.ensureConfigStub();
    const here = dirname(fileURLToPath(import.meta.url));
    const helper = join(here, "auth-helper.js");
    // Run rclone authorize/reconnect in background; user completes in browser.
    const child = spawn(
      process.execPath,
      [helper],
      {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          INSYNCOWN_RCLONE: this.engine.rclone.bin,
          RCLONE_CONFIG: this.engine.rclone.configPath,
          INSYNCOWN_REMOTE: this.engine.rclone.remoteName,
        },
      },
    );
    child.unref();
    return {
      started: true,
      message:
        "Browser authorization started. Complete the Google login window, then refresh status.",
    };
  }
}
