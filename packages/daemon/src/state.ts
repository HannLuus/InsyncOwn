import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { DaemonRunState, PairStatus, SyncPair } from "@insyncown/shared";
import { stateDbPath } from "./paths.js";

interface PersistedState {
  version: 1;
  runState: DaemonRunState;
  lastGlobalError: string | null;
  pairs: SyncPair[];
}

function emptyState(): PersistedState {
  return {
    version: 1,
    runState: "running",
    lastGlobalError: null,
    pairs: [],
  };
}

export class StateStore {
  private state: PersistedState;
  private readonly path: string;

  constructor(path = stateDbPath()) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    this.state = this.load();
  }

  private load(): PersistedState {
    if (!existsSync(this.path)) return emptyState();
    try {
      const raw = JSON.parse(readFileSync(this.path, "utf8")) as PersistedState;
      if (raw.version !== 1 || !Array.isArray(raw.pairs)) return emptyState();
      return raw;
    } catch {
      return emptyState();
    }
  }

  private persist(): void {
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), "utf8");
    renameSync(tmp, this.path);
  }

  getRunState(): DaemonRunState {
    return this.state.runState;
  }

  setRunState(runState: DaemonRunState): void {
    this.state.runState = runState;
    this.persist();
  }

  getLastGlobalError(): string | null {
    return this.state.lastGlobalError;
  }

  setLastGlobalError(error: string | null): void {
    this.state.lastGlobalError = error;
    this.persist();
  }

  listPairs(): SyncPair[] {
    return this.state.pairs.map((p) => ({ ...p }));
  }

  getPair(id: string): SyncPair | undefined {
    const p = this.state.pairs.find((x) => x.id === id);
    return p ? { ...p } : undefined;
  }

  addPair(input: {
    name: string;
    localPath: string;
    remotePath: string;
  }): SyncPair {
    const now = new Date().toISOString();
    const pair: SyncPair = {
      id: randomUUID(),
      name: input.name,
      localPath: input.localPath,
      remotePath: input.remotePath,
      enabled: true,
      status: "pending_resync",
      lastSyncAt: null,
      lastError: null,
      resynced: false,
      createdAt: now,
      updatedAt: now,
    };
    this.state.pairs.push(pair);
    this.persist();
    return { ...pair };
  }

  removePair(id: string): boolean {
    const before = this.state.pairs.length;
    this.state.pairs = this.state.pairs.filter((p) => p.id !== id);
    if (this.state.pairs.length === before) return false;
    this.persist();
    return true;
  }

  updatePair(
    id: string,
    patch: Partial<
      Pick<
        SyncPair,
        | "enabled"
        | "status"
        | "lastSyncAt"
        | "lastError"
        | "resynced"
        | "name"
      >
    >,
  ): SyncPair | undefined {
    const idx = this.state.pairs.findIndex((p) => p.id === id);
    if (idx < 0) return undefined;
    const current = this.state.pairs[idx];
    const next: SyncPair = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.state.pairs[idx] = next;
    this.persist();
    return { ...next };
  }

  setPairStatus(id: string, status: PairStatus, lastError: string | null = null): void {
    this.updatePair(id, {
      status,
      lastError,
      ...(status === "ok" ? { lastSyncAt: new Date().toISOString() } : {}),
    });
  }
}
