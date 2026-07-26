import { mkdirSync } from "node:fs";
import { join } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import type { DaemonStatus, SyncPair } from "@insyncown/shared";
import { APP_VERSION, RCLONE_REMOTE_NAME } from "@insyncown/shared";
import { RcloneClient } from "./rclone.js";
import { StateStore } from "./state.js";
import { bisyncWorkDir, configDir, resolveRclonePath } from "./paths.js";

const POLL_MS = 2 * 60 * 1000;
const DEBOUNCE_MS = 8_000;

export class SyncEngine {
  readonly store: StateStore;
  readonly rclone: RcloneClient;
  private watchers = new Map<string, FSWatcher>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private syncing = new Set<string>();
  private pollTimer: NodeJS.Timeout | null = null;
  private started = false;

  constructor(store = new StateStore(), rclone = new RcloneClient()) {
    this.store = store;
    this.rclone = rclone;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.rclone.ensureConfigStub();
    for (const pair of this.store.listPairs()) {
      if (pair.enabled) this.watchPair(pair);
    }
    this.pollTimer = setInterval(() => {
      void this.tickAll("poll");
    }, POLL_MS);
    // Initial pass shortly after start
    setTimeout(() => void this.tickAll("startup"), 2_000);
  }

  stop(): void {
    this.started = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    for (const t of this.debounceTimers.values()) clearTimeout(t);
    this.debounceTimers.clear();
    for (const w of this.watchers.values()) void w.close();
    this.watchers.clear();
  }

  getStatus(): DaemonStatus {
    return {
      version: APP_VERSION,
      runState: this.store.getRunState(),
      rclonePath: resolveRclonePath(),
      configDir: configDir(),
      account: {
        configured: this.rclone.isRemoteConfigured(),
        remoteName: RCLONE_REMOTE_NAME,
        about: null,
      },
      pairs: this.store.listPairs(),
      lastGlobalError: this.store.getLastGlobalError(),
    };
  }

  async enrichStatus(): Promise<DaemonStatus> {
    const status = this.getStatus();
    try {
      status.account.about = await this.rclone.about();
    } catch (err) {
      status.lastGlobalError =
        err instanceof Error ? err.message : String(err);
    }
    return status;
  }

  pause(): void {
    this.store.setRunState("paused");
    for (const pair of this.store.listPairs()) {
      if (pair.status !== "error" && pair.status !== "conflict") {
        this.store.setPairStatus(pair.id, "paused");
      }
    }
  }

  resume(): void {
    this.store.setRunState("running");
    for (const pair of this.store.listPairs()) {
      if (pair.enabled) {
        this.store.setPairStatus(pair.id, pair.resynced ? "idle" : "pending_resync");
        this.watchPair(pair);
      }
    }
    void this.tickAll("resume");
  }

  addPair(input: {
    name: string;
    localPath: string;
    remotePath: string;
    runResync?: boolean;
  }): SyncPair {
    mkdirSync(input.localPath, { recursive: true });
    const pair = this.store.addPair(input);
    this.watchPair(pair);
    if (input.runResync) {
      void this.syncPair(pair.id, { resync: true });
    }
    return pair;
  }

  removePair(id: string): boolean {
    this.unwatchPair(id);
    return this.store.removePair(id);
  }

  setPairEnabled(id: string, enabled: boolean): SyncPair | undefined {
    const pair = this.store.updatePair(id, {
      enabled,
      status: enabled
        ? this.store.getPair(id)?.resynced
          ? "idle"
          : "pending_resync"
        : "paused",
    });
    if (!pair) return undefined;
    if (enabled) {
      this.watchPair(pair);
      void this.syncPair(id, { resync: !pair.resynced });
    } else {
      this.unwatchPair(id);
    }
    return pair;
  }

  private watchPair(pair: SyncPair): void {
    this.unwatchPair(pair.id);
    mkdirSync(pair.localPath, { recursive: true });
    const watcher = chokidar.watch(pair.localPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 200 },
      ignored: [
        /(^|[/\\])\../,
        /\.insyncown-conflict-/,
        /\.tmp$/i,
        /~$/,
      ],
    });
    const schedule = () => this.scheduleSync(pair.id);
    watcher.on("add", schedule);
    watcher.on("change", schedule);
    watcher.on("unlink", schedule);
    watcher.on("addDir", schedule);
    watcher.on("unlinkDir", schedule);
    this.watchers.set(pair.id, watcher);
  }

  private unwatchPair(id: string): void {
    const w = this.watchers.get(id);
    if (w) {
      void w.close();
      this.watchers.delete(id);
    }
    const t = this.debounceTimers.get(id);
    if (t) {
      clearTimeout(t);
      this.debounceTimers.delete(id);
    }
  }

  private scheduleSync(id: string): void {
    if (this.store.getRunState() !== "running") return;
    const existing = this.debounceTimers.get(id);
    if (existing) clearTimeout(existing);
    this.debounceTimers.set(
      id,
      setTimeout(() => {
        this.debounceTimers.delete(id);
        void this.syncPair(id, { resync: false });
      }, DEBOUNCE_MS),
    );
  }

  async tickAll(_reason: string): Promise<void> {
    if (this.store.getRunState() !== "running") return;
    for (const pair of this.store.listPairs()) {
      if (!pair.enabled) continue;
      await this.syncPair(pair.id, { resync: !pair.resynced });
    }
  }

  async syncPair(
    id: string,
    opts: { resync: boolean },
  ): Promise<{ ok: boolean; error?: string }> {
    if (this.syncing.has(id)) {
      return { ok: false, error: "Sync already in progress for this pair" };
    }
    if (this.store.getRunState() !== "running" && !opts.resync) {
      return { ok: false, error: "Daemon is paused" };
    }
    const pair = this.store.getPair(id);
    if (!pair || !pair.enabled) {
      return { ok: false, error: "Pair not found or disabled" };
    }
    if (!this.rclone.isRemoteConfigured()) {
      const msg = "Google Drive not authenticated";
      this.store.setPairStatus(id, "error", msg);
      this.store.setLastGlobalError(msg);
      return { ok: false, error: msg };
    }

    this.syncing.add(id);
    this.store.setPairStatus(id, "syncing");
    const workdir = join(bisyncWorkDir(), id);
    mkdirSync(workdir, { recursive: true });
    mkdirSync(pair.localPath, { recursive: true });

    try {
      const needResync = opts.resync || !pair.resynced;
      const result = await this.rclone.bisync({
        localPath: pair.localPath,
        remotePath: pair.remotePath,
        resync: needResync,
        workdir,
      });
      const combined = `${result.stdout}\n${result.stderr}`;
      if (result.code !== 0) {
        const conflict = /conflict/i.test(combined);
        const msg =
          result.stderr.trim() ||
          result.stdout.trim() ||
          `rclone bisync exited with code ${result.code}`;
        this.store.setPairStatus(id, conflict ? "conflict" : "error", msg.slice(0, 2000));
        this.store.setLastGlobalError(msg.slice(0, 500));
        return { ok: false, error: msg };
      }
      this.store.updatePair(id, {
        status: "ok",
        lastError: null,
        lastSyncAt: new Date().toISOString(),
        resynced: true,
      });
      this.store.setLastGlobalError(null);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.store.setPairStatus(id, "error", msg);
      this.store.setLastGlobalError(msg);
      return { ok: false, error: msg };
    } finally {
      this.syncing.delete(id);
    }
  }
}
