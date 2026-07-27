#!/usr/bin/env node
/**
 * Download rclone for Windows amd64 into packaging/rclone/win/rclone.exe
 */
import { execSync } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "packaging", "rclone", "win");
const outFile = join(outDir, "rclone.exe");

async function resolveLatestVersion() {
  const res = await fetch(
    "https://api.github.com/repos/rclone/rclone/releases/latest",
  );
  if (!res.ok) {
    throw new Error(`Failed to resolve rclone release: ${res.status}`);
  }
  const data = await res.json();
  return data.tag_name.replace(/^v/, "");
}

async function downloadToFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  if (!res.body) throw new Error(`No response body for ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

async function downloadRclone(version) {
  const fileName = `rclone-v${version}-windows-amd64.zip`;
  const url = `https://github.com/rclone/rclone/releases/download/v${version}/${fileName}`;
  console.log(`Downloading ${url}`);

  mkdirSync(outDir, { recursive: true });
  const zipPath = join(outDir, fileName);
  await downloadToFile(url, zipPath);
  console.log(`Extracting ${zipPath}`);

  if (process.platform === "win32") {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir}' -Force"`,
      { stdio: "inherit" },
    );
  } else {
    execSync(`unzip -o -q "${zipPath}" -d "${outDir}"`, { stdio: "inherit" });
  }

  const extracted = join(
    outDir,
    `rclone-v${version}-windows-amd64`,
    "rclone.exe",
  );
  if (!existsSync(extracted)) {
    throw new Error(`Expected rclone.exe at ${extracted}`);
  }
  renameSync(extracted, outFile);
  rmSync(zipPath, { force: true });
  rmSync(join(outDir, `rclone-v${version}-windows-amd64`), {
    recursive: true,
    force: true,
  });
  console.log(`Wrote ${outFile}`);
}

async function main() {
  if (existsSync(outFile) && !process.env.RCLONE_FORCE_FETCH) {
    console.log(`Using existing ${outFile}`);
    return;
  }
  const version = process.env.RCLONE_VERSION ?? (await resolveLatestVersion());
  await downloadRclone(version);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
