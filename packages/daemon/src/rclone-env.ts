import { loadNetworkSettings } from "./network-settings.js";

/**
 * Environment for rclone child processes.
 * Applies InsyncOwn proxy settings only — does not force a system-wide VPN.
 */
export function rcloneSpawnEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const settings = loadNetworkSettings();
  const env = { ...baseEnv };

  // InsyncOwn proxy replaces inherited proxy vars so sync traffic is isolated.
  for (const key of [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "NO_PROXY",
    "no_proxy",
  ]) {
    delete env[key];
  }

  const proxy = settings.proxyUrl?.trim();
  if (proxy) {
    env.HTTP_PROXY = proxy;
    env.HTTPS_PROXY = proxy;
    env.ALL_PROXY = proxy;
    env.http_proxy = proxy;
    env.https_proxy = proxy;
    env.all_proxy = proxy;
  }

  const noProxy = settings.noProxy?.trim();
  if (noProxy) {
    env.NO_PROXY = noProxy;
    env.no_proxy = noProxy;
  }

  return env;
}
