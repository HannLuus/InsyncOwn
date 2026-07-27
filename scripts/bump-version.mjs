#!/usr/bin/env node
/**
 * Bump semver in root package.json, then sync all workspaces.
 * Usage: node scripts/bump-version.mjs patch|minor|major
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const level = process.argv[2];
if (!level || !["patch", "minor", "major"].includes(level)) {
  console.error("Usage: node scripts/bump-version.mjs patch|minor|major");
  process.exit(1);
}

function bump(version, kind) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const next = bump(pkg.version, level);
pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

const sync = spawnSync("node", ["scripts/sync-version.mjs"], {
  cwd: root,
  stdio: "inherit",
});
if (sync.status !== 0) process.exit(sync.status ?? 1);

const install = spawnSync("npm", ["install", "--package-lock-only"], {
  cwd: root,
  stdio: "inherit",
});
if (install.status !== 0) process.exit(install.status ?? 1);

console.log(`Bumped to ${next}. Update CHANGELOG.md, then tag: git tag v${next}`);
