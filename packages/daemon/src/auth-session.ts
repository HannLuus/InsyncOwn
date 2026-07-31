import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { RCLONE_REMOTE_NAME } from "@insyncown/shared";
import { rcloneConfigPath, resolveRclonePath } from "./paths.js";
import { rcloneSpawnEnv } from "./rclone-env.js";

export interface StartAuthResult {
  started: boolean;
  authUrl: string | null;
  message: string;
}

/**
 * Runs rclone OAuth without wiping an existing token, captures the local
 * auth URL, and lets the Electron UI open it with shell.openExternal.
 */
export class AuthSession {
  private child: ChildProcess | null = null;
  private lastUrl: string | null = null;

  constructor(
    private readonly bin = resolveRclonePath(),
    private readonly configPath = rcloneConfigPath(),
    private readonly remoteName = RCLONE_REMOTE_NAME,
  ) {}

  ensureRemoteStubPreserveToken(): void {
    mkdirSync(dirname(this.configPath), { recursive: true });
    if (!existsSync(this.configPath)) {
      writeFileSync(
        this.configPath,
        `[${this.remoteName}]\ntype = drive\nscope = drive\n`,
        "utf8",
      );
      return;
    }
    const text = readFileSync(this.configPath, "utf8");
    if (!text.includes(`[${this.remoteName}]`)) {
      writeFileSync(
        this.configPath,
        `${text.trimEnd()}\n\n[${this.remoteName}]\ntype = drive\nscope = drive\n`,
        "utf8",
      );
    }
  }

  cancel(): void {
    if (this.child && !this.child.killed) {
      this.child.kill("SIGTERM");
    }
    this.child = null;
  }

  async start(): Promise<StartAuthResult> {
    this.cancel();
    this.lastUrl = null;
    this.ensureRemoteStubPreserveToken();

    return new Promise((resolve) => {
      const args = [
        "--config",
        this.configPath,
        "config",
        "reconnect",
        `${this.remoteName}:`,
        "--auto-confirm",
      ];
      const child = spawn(this.bin, args, {
        env: rcloneSpawnEnv(),
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;

      let settled = false;
      const settle = (result: StartAuthResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const onChunk = (buf: Buffer) => {
        const text = buf.toString();
        const match = text.match(/https?:\/\/127\.0\.0\.1:\d+\/auth\S*/);
        if (match && !this.lastUrl) {
          this.lastUrl = match[0].replace(/[.,;]+$/, "");
          settle({
            started: true,
            authUrl: this.lastUrl,
            message:
              "Open the Google login page in your browser, then return here and click Refresh.",
          });
        }
      };

      child.stdout?.on("data", onChunk);
      child.stderr?.on("data", onChunk);

      child.on("error", (err) => {
        settle({
          started: false,
          authUrl: null,
          message: `Failed to start rclone auth: ${err.message}`,
        });
      });

      child.on("close", (code) => {
        this.child = null;
        if (!settled) {
          settle({
            started: code === 0,
            authUrl: this.lastUrl,
            message:
              code === 0
                ? "Authorization finished. Click Refresh."
                : "Authorization did not start a browser URL. Try again, or import an existing rclone login.",
          });
        }
      });

      // If rclone never prints a URL (already authorized / no browser flow), don't hang the UI.
      setTimeout(() => {
        if (!settled) {
          settle({
            started: true,
            authUrl: this.lastUrl,
            message: this.lastUrl
              ? "Open the Google login page in your browser, then click Refresh."
              : "Waiting for Google login… If no browser opens, click Connect again or import existing rclone auth.",
          });
        }
      }, 8_000);
    });
  }
}
