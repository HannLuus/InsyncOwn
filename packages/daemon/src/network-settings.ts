import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { NetworkSettings } from "@insyncown/shared";
import { configDir } from "./paths.js";

const FILE = "network.json";

const DEFAULTS: NetworkSettings = {
  proxyUrl: null,
  noProxy: "127.0.0.1,localhost",
};

function settingsPath(): string {
  return `${configDir()}/${FILE}`;
}

export function loadNetworkSettings(): NetworkSettings {
  const envProxy = process.env.INSYNCOWN_PROXY?.trim();
  if (envProxy) {
    return {
      proxyUrl: envProxy,
      noProxy:
        process.env.INSYNCOWN_NO_PROXY?.trim() ?? DEFAULTS.noProxy ?? null,
    };
  }

  const path = settingsPath();
  if (!existsSync(path)) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<NetworkSettings>;
    return {
      proxyUrl:
        typeof raw.proxyUrl === "string" && raw.proxyUrl.trim()
          ? raw.proxyUrl.trim()
          : null,
      noProxy:
        typeof raw.noProxy === "string" && raw.noProxy.trim()
          ? raw.noProxy.trim()
          : DEFAULTS.noProxy,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveNetworkSettings(settings: NetworkSettings): NetworkSettings {
  const next: NetworkSettings = {
    proxyUrl:
      settings.proxyUrl?.trim() ? settings.proxyUrl.trim() : null,
    noProxy:
      settings.noProxy?.trim() ? settings.noProxy.trim() : DEFAULTS.noProxy,
  };
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
  return next;
}

/** Mask credentials in proxy URLs for UI display. */
export function maskProxyUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.password) u.password = "****";
    if (u.username) u.username = "****";
    return u.toString();
  } catch {
    return url.replace(/:[^:@/]+@/, ":****@");
  }
}
