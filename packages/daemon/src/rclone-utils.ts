import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/** Remove rclone bisync .lck files whose owner PID is no longer running. */
export function clearStaleBisyncLocks(workdir: string): string[] {
  const removed: string[] = [];
  if (!existsSync(workdir)) return removed;
  for (const name of readdirSync(workdir)) {
    if (!name.endsWith(".lck")) continue;
    const path = join(workdir, name);
    try {
      const raw = readFileSync(path, "utf8");
      const data = JSON.parse(raw) as { PID?: string | number };
      const pid = Number(data.PID);
      if (!pid || Number.isNaN(pid)) {
        unlinkSync(path);
        removed.push(path);
        continue;
      }
      try {
        process.kill(pid, 0);
        // process exists — keep lock
      } catch {
        unlinkSync(path);
        removed.push(path);
      }
    } catch {
      // unreadable / corrupt lock — remove
      try {
        unlinkSync(path);
        removed.push(path);
      } catch {
        /* ignore */
      }
    }
  }
  return removed;
}

/** Strip ANSI and prefer a real error line for UI display. */
export function summarizeRcloneFailure(stdout: string, stderr: string, code: number): string {
  const strip = (s: string) =>
    s.replace(/\u001b\[[0-9;]*m/g, "").replace(/\r/g, "");
  const text = strip(`${stderr}\n${stdout}`).trim();
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const fatal = lines.filter(
    (l) =>
      /fatal error|critical error|critical:|error :|failed to|valid lock file|bisync aborted|can't read dangling/i.test(
        l,
      ) && !/^info\s*:/i.test(l),
  );
  if (fatal.length) return fatal.slice(-3).join("\n").slice(0, 800);

  const nonNotice = lines.filter(
    (l) => !/^\d{4}\/\d{2}\/\d{2}.*\b(INFO|NOTICE)\b/i.test(l),
  );
  if (nonNotice.length) return nonNotice.slice(-5).join("\n").slice(0, 800);

  return `rclone bisync exited with code ${code}`;
}
