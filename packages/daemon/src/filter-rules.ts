import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

export const DEFAULT_EXCLUDE_PATTERNS: string[] = [
  // Version control
  ".git/**",
  ".git",
  ".svn/**",
  ".hg/**",

  // Node.js / JavaScript / TypeScript / Web
  "node_modules/**",
  "node_modules",
  ".next/**",
  ".nuxt/**",
  ".turbo/**",
  ".svelte-kit/**",
  ".astro/**",
  ".cache/**",
  ".npm/**",
  ".pnpm-store/**",
  ".yarn/**",

  // Python
  "__pycache__/**",
  "*.pyc",
  "*.pyo",
  "*.pyd",
  ".venv/**",
  "venv/**",
  "ENV/**",
  ".pytest_cache/**",
  ".mypy_cache/**",
  ".ruff_cache/**",
  ".coverage",
  "htmlcov/**",

  // Rust / Java / C / C++ / .NET
  "target/**",
  "bin/**",
  "obj/**",
  "build/**",
  "dist/**",
  "out/**",
  ".gradle/**",

  // IDE / Editor temp files & metadata
  ".idea/**",
  ".vscode/**",
  "*.swp",
  "*.swo",

  // Operating system & office temp files
  ".DS_Store",
  "Thumbs.db",
  "ehthumbs.db",
  "Desktop.ini",
  "~$*",
  "*.tmp",
  "*.insyncown-conflict-*",
  ".insyncown-conflict-*",
];

/**
 * Reads custom exclude rules from `.insyncignore` in the pair's local root if it exists,
 * combining them with `DEFAULT_EXCLUDE_PATTERNS`.
 */
export function getExcludePatternsForPair(localPath: string): string[] {
  const patterns = [...DEFAULT_EXCLUDE_PATTERNS];
  const ignoreFile = join(localPath, ".insyncignore");
  if (existsSync(ignoreFile)) {
    try {
      const content = readFileSync(ignoreFile, "utf8");
      const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
      patterns.push(...lines);
    } catch {
      /* ignore read errors */
    }
  }
  return patterns;
}

/**
 * Writes an rclone `--exclude-from` formatted file into the given bisync workdir.
 */
export function writeExcludeFileForWorkdir(workdir: string, patterns: string[]): string {
  mkdirSync(workdir, { recursive: true });
  const excludeFilePath = join(workdir, "exclude.txt");
  writeFileSync(excludeFilePath, patterns.join("\n") + "\n", "utf8");
  return excludeFilePath;
}

/**
 * Creates a matcher function for Chokidar watcher based on default excludes & .insyncignore.
 */
export function createChokidarIgnoredFilter(localPath: string): (filePath: string) => boolean {
  const customPatterns = getExcludePatternsForPair(localPath);
  
  // Set of folder names that should be ignored anywhere in tree
  const ignoredDirNames = new Set([
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    ".venv",
    "venv",
    "ENV",
    "__pycache__",
    ".next",
    ".nuxt",
    ".turbo",
    ".svelte-kit",
    ".astro",
    ".cache",
    ".npm",
    ".pnpm-store",
    ".yarn",
    "target",
    "build",
    "dist",
    "out",
    ".gradle",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "htmlcov",
    ".idea",
    ".vscode",
    "bin",
    "obj",
  ]);

  return (filePath: string): boolean => {
    const rel = relative(localPath, filePath);
    if (!rel) return false;
    
    const parts = rel.split(/[/\\]/);
    
    // Check directory name matches
    for (const part of parts) {
      if (ignoredDirNames.has(part)) {
        return true;
      }
    }

    const filename = parts[parts.length - 1];
    
    // Office temp files, swap files, DS_Store, etc.
    if (
      filename.startsWith("~$") ||
      filename === ".DS_Store" ||
      filename === "Thumbs.db" ||
      filename === "ehthumbs.db" ||
      filename === "Desktop.ini" ||
      filename.endsWith(".tmp") ||
      filename.endsWith(".swp") ||
      filename.endsWith(".swo") ||
      filename.endsWith(".pyc") ||
      filename.includes(".insyncown-conflict-") ||
      filename === ".insyncignore"
    ) {
      return true;
    }

    // Custom pattern simple matches (e.g. *.log, etc.)
    for (const pattern of customPatterns) {
      if (pattern.startsWith("*.") && filename.endsWith(pattern.slice(1))) {
        return true;
      }
    }

    return false;
  };
}
