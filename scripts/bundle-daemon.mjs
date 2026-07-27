#!/usr/bin/env node
/**
 * Bundle the sync daemon into a single ESM file for Windows packaging.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "packaging", "bundle", "daemon-bundle");
const outFile = join(outDir, "cli.mjs");

mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "packages", "daemon", "dist", "cli.js")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: outFile,
  logLevel: "info",
});

console.log(`Bundled daemon → ${outFile}`);
