import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  ipcMain,
  dialog,
  shell,
} from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_NAME, APP_VERSION } from "@insyncown/shared";
import * as daemon from "./daemon-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let daemonProc: ChildProcess | null = null;
let quitting = false;

function staticPath(...parts: string[]): string {
  return join(__dirname, "static", ...parts);
}

function daemonEntry(): string {
  const candidates = [
    join(process.resourcesPath, "daemon-bundle", "cli.mjs"),
    join(app.getAppPath(), "..", "..", "packages", "daemon", "dist", "cli.js"),
    join(process.resourcesPath, "daemon", "cli.js"),
    join(__dirname, "..", "..", "..", "packages", "daemon", "dist", "cli.js"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

function insyncOwnDataDir(): string {
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA;
    if (local) return join(local, "InsyncOwn");
    return join(app.getPath("home"), "AppData", "Local", "InsyncOwn");
  }
  return join(app.getPath("home"), ".local", "share", "insyncown");
}

function daemonEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
  };
  if (process.resourcesPath) {
    env.INSYNCOWN_RESOURCES = process.resourcesPath;
    const bundledRclone = join(process.resourcesPath, "rclone", "rclone.exe");
    if (existsSync(bundledRclone)) {
      env.INSYNCOWN_RCLONE = bundledRclone;
    }
  }
  return env;
}

function usesExternalDaemon(): boolean {
  if (process.env.INSYNCOWN_EXTERNAL_DAEMON === "1") return true;
  // Packaged Windows installs register the daemon via Task Scheduler.
  return process.platform === "win32" && app.isPackaged;
}

async function ensureDaemon(): Promise<void> {
  const external = usesExternalDaemon();
  const maxAttempts = external ? 120 : 40;

  for (let i = 0; i < maxAttempts; i++) {
    if (await daemon.pingDaemon()) return;
    if (external) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    break;
  }

  if (await daemon.pingDaemon()) return;

  if (external) {
    const hint =
      process.platform === "win32"
        ? "Daemon not reachable. Check Task Scheduler task InsyncOwnDaemon and %LOCALAPPDATA%\\InsyncOwn\\logs\\daemon.log"
        : "Daemon not reachable. Start: systemctl --user start insyncown-daemon";
    console.error(hint);
    return;
  }
  const entry = daemonEntry();
  if (!existsSync(entry)) {
    console.error("Daemon entry not found:", entry);
    return;
  }
  mkdirSync(insyncOwnDataDir(), { recursive: true });
  daemonProc = spawn(process.execPath, [entry], {
    env: daemonEnv(),
    stdio: "ignore",
    detached: false,
  });
  daemonProc.on("exit", (code) => {
    console.log("Daemon exited", code);
    daemonProc = null;
  });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await daemon.pingDaemon()) return;
  }
  console.error("Daemon failed to become ready");
}

function createWindow(): void {
  const windowIcon = staticPath("icons", "icon-256.png");
  mainWindow = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    title: APP_NAME,
    icon: existsSync(windowIcon) ? windowIcon : undefined,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.webContents.on("console-message", (_e, level, message) => {
    console.log(`[renderer:${level}] ${message}`);
  });
  void mainWindow.loadFile(staticPath("index.html"));
  mainWindow.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function trayIcon(): Electron.NativeImage {
  // Prefer hi-DPI tray asset (Plasma/GNOME scale it down cleanly).
  const candidates = [
    staticPath("icons", "tray@2x.png"),
    staticPath("icons", "tray.png"),
    staticPath("icons", "icon-256.png"),
  ];
  for (const iconPath of candidates) {
    if (!existsSync(iconPath)) continue;
    const img = nativeImage.createFromPath(iconPath);
    if (img.isEmpty()) continue;
    // Keep tray compact; Plasma often expects ~22–48 CSS px.
    const size = process.platform === "linux" ? 48 : 32;
    return img.resize({ width: size, height: size, quality: "best" });
  }
  // Fallback: generated 16x16 blue square
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = 30;
    buf[i * 4 + 1] = 120;
    buf[i * 4 + 2] = 200;
    buf[i * 4 + 3] = 255;
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

async function refreshTrayMenu(): Promise<void> {
  if (!tray) return;
  let statusLabel = "Daemon offline";
  let paused = false;
  try {
    const status = await daemon.getStatus();
    paused = status.runState === "paused";
    const ok = status.pairs.filter((p) => p.status === "ok").length;
    const err = status.pairs.filter(
      (p) => p.status === "error" || p.status === "conflict",
    ).length;
    statusLabel = `${status.runState} · ${status.pairs.length} pairs · ${ok} ok` +
      (err ? ` · ${err} issues` : "");
  } catch {
    /* ignore */
  }

  const menu = Menu.buildFromTemplate([
    { label: `${APP_NAME} ${APP_VERSION}`, enabled: false },
    { label: statusLabel, enabled: false },
    { type: "separator" },
    {
      label: "Open InsyncOwn",
      click: () => {
        if (!mainWindow) createWindow();
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: paused ? "Resume sync" : "Pause sync",
      click: () => {
        void (paused ? daemon.resume() : daemon.pause()).then(() =>
          refreshTrayMenu(),
        );
      },
    },
    {
      label: "Sync now",
      click: () => {
        void daemon.syncNow().then(() => refreshTrayMenu());
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`${APP_NAME}: ${statusLabel}`);
}

function createTray(): void {
  tray = new Tray(trayIcon());
  tray.on("click", () => {
    if (!mainWindow) createWindow();
    mainWindow?.show();
    mainWindow?.focus();
  });
  void refreshTrayMenu();
  setInterval(() => void refreshTrayMenu(), 15_000);
}

function registerIpc(): void {
  ipcMain.handle("daemon:getStatus", () => daemon.getStatus());
  ipcMain.handle("daemon:pause", () => daemon.pause());
  ipcMain.handle("daemon:resume", () => daemon.resume());
  ipcMain.handle("daemon:authStatus", () => daemon.authStatus());
  ipcMain.handle("daemon:startAuth", async () => {
    const result = await daemon.startAuth();
    if (result.authUrl) {
      await shell.openExternal(result.authUrl);
    }
    return result;
  });
  ipcMain.handle(
    "daemon:configureAuth",
    (_e, clientId?: string, clientSecret?: string) =>
      daemon.configureAuth(clientId, clientSecret),
  );
  ipcMain.handle(
    "daemon:importExistingRcloneAuth",
    (_e, sourceConfigPath?: string) =>
      daemon.importExistingRcloneAuth(sourceConfigPath),
  );
  ipcMain.handle("daemon:listRemoteFolders", (_e, path?: string) =>
    daemon.listRemoteFolders(path ?? ""),
  );
  ipcMain.handle(
    "daemon:addPair",
    (
      _e,
      input: {
        name: string;
        localPath: string;
        remotePath: string;
        runResync?: boolean;
      },
    ) => daemon.addPair(input),
  );
  ipcMain.handle("daemon:removePair", (_e, id: string) => daemon.removePair(id));
  ipcMain.handle("daemon:setPairEnabled", (_e, id: string, enabled: boolean) =>
    daemon.setPairEnabled(id, enabled),
  );
  ipcMain.handle("daemon:syncNow", (_e, id?: string) => daemon.syncNow(id));
  ipcMain.handle("daemon:resyncPair", (_e, id: string) => daemon.resyncPair(id));
  ipcMain.handle("daemon:getNetworkSettings", () => daemon.getNetworkSettings());
  ipcMain.handle(
    "daemon:setNetworkSettings",
    (_e, input: { proxyUrl?: string | null; noProxy?: string | null }) =>
      daemon.setNetworkSettings(input),
  );
  ipcMain.handle("daemon:testNetwork", () => daemon.testNetwork());
  ipcMain.handle("dialog:pickLocalFolder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });
  ipcMain.handle("shell:openPath", (_e, path: string) => shell.openPath(path));
  ipcMain.handle("app:getInfo", () => ({
    name: APP_NAME,
    version: APP_VERSION,
    daemonUrl: daemon.daemonBaseUrl(),
  }));
}

app.whenReady().then(async () => {
  registerIpc();
  await ensureDaemon();
  createTray();
  createWindow();
});

app.on("window-all-closed", () => {
  // Keep tray / daemon running on Linux
});

app.on("before-quit", () => {
  quitting = true;
  // Leave systemd / Task Scheduler daemon alone; only kill UI-spawned child.
  if (daemonProc && !usesExternalDaemon()) {
    daemonProc.kill("SIGTERM");
  }
});
