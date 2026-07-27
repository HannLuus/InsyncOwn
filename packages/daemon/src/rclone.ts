import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  RCLONE_REMOTE_NAME,
  type AccountInfo,
  type RemoteFolder,
} from "@insyncown/shared";
import { rcloneConfigPath, resolveRclonePath, bisyncWorkDir } from "./paths.js";

export interface RcloneRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export class RcloneClient {
  readonly bin: string;
  readonly configPath: string;
  readonly remoteName: string;

  constructor(opts?: { bin?: string; configPath?: string; remoteName?: string }) {
    this.bin = opts?.bin ?? resolveRclonePath();
    this.configPath = opts?.configPath ?? rcloneConfigPath();
    this.remoteName = opts?.remoteName ?? RCLONE_REMOTE_NAME;
    mkdirSync(dirname(this.configPath), { recursive: true });
    mkdirSync(bisyncWorkDir(), { recursive: true });
  }

  remoteRoot(): string {
    return `${this.remoteName}:`;
  }

  private baseArgs(): string[] {
    return ["--config", this.configPath];
  }

  async run(args: string[], opts?: { timeoutMs?: number }): Promise<RcloneRunResult> {
    const timeoutMs = opts?.timeoutMs ?? 30 * 60 * 1000;
    return new Promise((resolve, reject) => {
      const child = spawn(this.bin, [...this.baseArgs(), ...args], {
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`rclone timed out after ${timeoutMs}ms: ${args.join(" ")}`));
      }, timeoutMs);
      child.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 1, stdout, stderr });
      });
    });
  }

  ensureConfigStub(): void {
    if (existsSync(this.configPath)) return;
    writeFileSync(
      this.configPath,
      `[${this.remoteName}]\ntype = drive\nscope = drive\n`,
      "utf8",
    );
  }

  isRemoteConfigured(): boolean {
    if (!existsSync(this.configPath)) return false;
    const text = readFileSync(this.configPath, "utf8");
    return text.includes(`[${this.remoteName}]`) && /token\s*=/.test(text);
  }

  async configureClientId(clientId: string, clientSecret: string): Promise<void> {
    // Non-interactive: edit config file. Never run `rclone config create`
    // with ignored stdio (that hangs and can wipe tokens).
    mkdirSync(dirname(this.configPath), { recursive: true });
    let text = existsSync(this.configPath)
      ? readFileSync(this.configPath, "utf8")
      : "";
    if (!text.includes(`[${this.remoteName}]`)) {
      text = `${text.trimEnd()}\n\n[${this.remoteName}]\ntype = drive\nscope = drive\n`;
    }
    const setKey = (body: string, key: string, value: string): string => {
      const re = new RegExp(`^${key}\\s*=.*$`, "m");
      if (re.test(body)) return body.replace(re, `${key} = ${value}`);
      return body.replace(
        `[${this.remoteName}]`,
        `[${this.remoteName}]\n${key} = ${value}`,
      );
    };
    text = setKey(text, "type", "drive");
    text = setKey(text, "scope", "drive");
    text = setKey(text, "client_id", clientId);
    text = setKey(text, "client_secret", clientSecret);
    writeFileSync(this.configPath, text.trimEnd() + "\n", "utf8");
  }

  /**
   * Interactive reconnect — opens browser. Caller should run in a terminal
   * or spawn with inherited stdio for first-time auth from CLI helper.
   */
  async authorizeInteractive(): Promise<RcloneRunResult> {
    this.ensureConfigStub();
    if (!this.isRemoteConfigured() && !existsSync(this.configPath)) {
      this.ensureConfigStub();
    }
    // Prefer config reconnect; if no token yet use config create flow via authorize
    return this.run(["config", "reconnect", this.remoteName, "--auto-confirm"], {
      timeoutMs: 10 * 60 * 1000,
    });
  }

  async about(): Promise<AccountInfo["about"]> {
    if (!this.isRemoteConfigured()) return null;
    const r = await this.run(["about", this.remoteRoot()]);
    if (r.code !== 0) return null;
    const about: NonNullable<AccountInfo["about"]> = {};
    for (const line of r.stdout.split("\n")) {
      const [k, ...rest] = line.split(":");
      const v = rest.join(":").trim();
      if (!k || !v) continue;
      const key = k.trim().toLowerCase();
      if (key === "total") about.total = v;
      if (key === "used") about.used = v;
      if (key === "free") about.free = v;
    }
    return about;
  }

  async listFolders(path = ""): Promise<RemoteFolder[]> {
    if (!this.isRemoteConfigured()) {
      throw new Error("Google Drive is not connected. Run authentication first.");
    }
    const remote = path
      ? `${this.remoteName}:${path.replace(/^\/+/, "")}`
      : this.remoteRoot();
    const r = await this.run(["lsf", remote, "--dirs-only", "-R=false"]);
    if (r.code !== 0) {
      throw new Error(r.stderr || r.stdout || "Failed to list remote folders");
    }
    const folders: RemoteFolder[] = [];
    for (const line of r.stdout.split("\n")) {
      const name = line.replace(/\/$/, "").trim();
      if (!name) continue;
      const folderPath = path ? `${path.replace(/\/$/, "")}/${name}` : name;
      folders.push({ name, path: folderPath, isDir: true });
    }
    return folders;
  }

  async bisync(opts: {
    localPath: string;
    remotePath: string;
    resync?: boolean;
    workdir: string;
  }): Promise<RcloneRunResult> {
    const remote = opts.remotePath.includes(":")
      ? opts.remotePath
      : `${this.remoteName}:${opts.remotePath.replace(/^\/+/, "")}`;

    const args = [
      "bisync",
      opts.localPath,
      remote,
      "--create-empty-src-dirs",
      "--compare",
      "size,modtime,checksum",
      "--slow-hash-sync-only",
      "--resilient",
      "--recover",
      "--max-delete",
      "25",
      "--conflict-resolve",
      "newer",
      "--conflict-loser",
      "pathname",
      "--conflict-suffix",
      "insyncown-conflict-{DateOnly}-",
      "--workdir",
      opts.workdir,
      // Prevent eternal locks after crashes (Media bug: expiry year 2226)
      "--max-lock",
      "10m",
      // Google Drive shortcuts to deleted targets abort bisync otherwise
      "--drive-skip-dangling-shortcuts",
      "-v",
    ];
    if (opts.resync) {
      args.push("--resync");
    }
    // Large first syncs (e.g. media libraries) can exceed 1h
    return this.run(args, { timeoutMs: opts.resync ? 12 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000 });
  }
}
