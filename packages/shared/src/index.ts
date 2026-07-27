/** Shared types and IPC contract for InsyncOwn daemon ↔ Electron UI. */

export const DAEMON_DEFAULT_HOST = "127.0.0.1";
export const DAEMON_DEFAULT_PORT = 5775;
export const DAEMON_SOCKET_PATH_ENV = "INSYNCOWN_DAEMON_PORT";

export type PairStatus =
  | "idle"
  | "pending_resync"
  | "syncing"
  | "ok"
  | "paused"
  | "error"
  | "conflict";

export type DaemonRunState = "running" | "paused" | "stopping";

export interface SyncPair {
  id: string;
  name: string;
  localPath: string;
  /** rclone remote path, e.g. gdrive:01_Projects/Notes */
  remotePath: string;
  enabled: boolean;
  status: PairStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Whether initial --resync has completed successfully. */
  resynced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountInfo {
  configured: boolean;
  remoteName: string;
  /** From `rclone about` when available. */
  about: {
    total?: string;
    used?: string;
    free?: string;
  } | null;
}

export interface DaemonStatus {
  version: string;
  runState: DaemonRunState;
  rclonePath: string;
  configDir: string;
  account: AccountInfo;
  pairs: SyncPair[];
  lastGlobalError: string | null;
}

export interface RemoteFolder {
  name: string;
  path: string;
  isDir: boolean;
}

export type IpcRequest =
  | { method: "ping" }
  | { method: "getStatus" }
  | { method: "pause" }
  | { method: "resume" }
  | { method: "listRemoteFolders"; path?: string }
  | {
      method: "addPair";
      name: string;
      localPath: string;
      remotePath: string;
      /** If true, run --resync immediately after create. */
      runResync?: boolean;
    }
  | { method: "removePair"; id: string }
  | { method: "setPairEnabled"; id: string; enabled: boolean }
  | { method: "syncNow"; id?: string }
  | { method: "resyncPair"; id: string }
  | { method: "authStatus" }
  | {
      method: "configureAuth";
      /** Optional own OAuth client; empty uses rclone defaults until set. */
      clientId?: string;
      clientSecret?: string;
    }
  | { method: "startAuth" }
  | { method: "importExistingRcloneAuth"; sourceConfigPath?: string };

export type IpcResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface AuthStatusResult {
  configured: boolean;
  needsReconnect: boolean;
  remoteName: string;
  message: string;
}

export interface StartAuthResult {
  started: boolean;
  /** Local rclone OAuth URL for Electron to open. */
  authUrl: string | null;
  message: string;
}

export const APP_NAME = "InsyncOwn";
export const APP_VERSION = "0.1.0";
export const RCLONE_REMOTE_NAME = "gdrive";
