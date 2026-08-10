import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envExamplePath = path.join(root, ".env.example");
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);
const sourceExtensions = new Set([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".cts",
  ".ts",
  ".tsx",
]);
const contractName = /^(?:HALO_|OLLAMA_)[A-Z0-9_]+$/;

async function collectSourceFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await collectSourceFiles(fullPath)));
      }
      continue;
    }

    if (
      entry.isFile() &&
      entry.name !== "package-lock.json" &&
      fullPath !== fileURLToPath(import.meta.url) &&
      sourceExtensions.has(path.extname(entry.name))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

const envExample = await readFile(envExamplePath, "utf8");
const documented = new Set(
  envExample
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
    .filter((name) => name && contractName.test(name)),
);

const used = new Set();
const sourceFiles = await collectSourceFiles(root);

for (const sourceFile of sourceFiles) {
  const source = await readFile(sourceFile, "utf8");

  for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
    if (contractName.test(match[1])) used.add(match[1]);
  }

  for (const match of source.matchAll(/["']((?:HALO_|OLLAMA_)[A-Z0-9_]+)["']/g)) {
    used.add(match[1]);
  }
}

const undocumented = [...used].filter((name) => !documented.has(name)).sort();
const unused = [...documented].filter((name) => !used.has(name)).sort();

if (undocumented.length || unused.length) {
  console.error("Environment contract check failed.");
  if (undocumented.length) {
    console.error(`Used but missing from .env.example: ${undocumented.join(", ")}`);
  }
  if (unused.length) {
    console.error(`Documented but unused: ${unused.join(", ")}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Environment contract is in sync (${used.size} variables).`);
}
