import {
  DAEMON_DEFAULT_HOST,
  DAEMON_DEFAULT_PORT,
  type AuthStatusResult,
  type DaemonStatus,
  type IpcRequest,
  type IpcResponse,
  type RemoteFolder,
  type StartAuthResult,
  type SyncPair,
} from "@insyncown/shared";

const host = process.env.INSYNCOWN_DAEMON_HOST ?? DAEMON_DEFAULT_HOST;
const port = Number(process.env.INSYNCOWN_DAEMON_PORT ?? DAEMON_DEFAULT_PORT);

async function rpcOnce<T>(request: IpcRequest, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://${host}:${port}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: ctrl.signal,
    });
    const body = (await res.json()) as IpcResponse<T>;
    if (!body.ok) throw new Error(body.error);
    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

async function rpc<T>(request: IpcRequest): Promise<T> {
  const timeoutMs = request.method === "getStatus" || request.method === "ping" ? 8_000 : 60_000;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await rpcOnce<T>(request, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 250 * attempt));
      }
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    msg.includes("abort") || msg.includes("fetch")
      ? `Daemon not reachable at http://${host}:${port} (${msg})`
      : msg,
  );
}

export async function pingDaemon(): Promise<boolean> {
  try {
    await rpc<{ pong: boolean }>({ method: "ping" });
    return true;
  } catch {
    return false;
  }
}

export function getStatus(): Promise<DaemonStatus> {
  return rpc({ method: "getStatus" });
}

export function pause(): Promise<DaemonStatus> {
  return rpc({ method: "pause" });
}

export function resume(): Promise<DaemonStatus> {
  return rpc({ method: "resume" });
}

export function authStatus(): Promise<AuthStatusResult> {
  return rpc({ method: "authStatus" });
}

export function startAuth(): Promise<StartAuthResult> {
  return rpc({ method: "startAuth" });
}

export function importExistingRcloneAuth(
  sourceConfigPath?: string,
): Promise<{ configured: boolean; message: string }> {
  return rpc({ method: "importExistingRcloneAuth", sourceConfigPath });
}

export function configureAuth(
  clientId?: string,
  clientSecret?: string,
): Promise<{ configured: boolean; message: string }> {
  return rpc({ method: "configureAuth", clientId, clientSecret });
}

export function listRemoteFolders(path = ""): Promise<RemoteFolder[]> {
  return rpc({ method: "listRemoteFolders", path });
}

export function addPair(input: {
  name: string;
  localPath: string;
  remotePath: string;
  runResync?: boolean;
}): Promise<SyncPair> {
  return rpc({ method: "addPair", ...input });
}

export function removePair(id: string): Promise<{ removed: boolean }> {
  return rpc({ method: "removePair", id });
}

export function setPairEnabled(id: string, enabled: boolean): Promise<SyncPair> {
  return rpc({ method: "setPairEnabled", id, enabled });
}

export function syncNow(id?: string): Promise<unknown> {
  return rpc({ method: "syncNow", id });
}

export function resyncPair(id: string): Promise<unknown> {
  return rpc({ method: "resyncPair", id });
}

export function daemonBaseUrl(): string {
  return `http://${host}:${port}`;
}
