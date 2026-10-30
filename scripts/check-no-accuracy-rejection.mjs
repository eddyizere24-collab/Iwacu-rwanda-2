import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const forbidden = /MAX_ACCURACY|accuracy\s*(?:>|>=)\s*\d+(?:\.\d+)?/i;
const allowList = new Set([
  "src/hooks/useLocation.ts:96",
  "src/hooks/useLocation.ts:188",
]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

const failures: string[] = [];
for (const file of walk(sourceRoot)) {
  const rel = relative(root, file).replaceAll("\\", "/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!forbidden.test(line)) return;
    const key = `${rel}:${index + 1}`;
    if (allowList.has(key) && /bestAccuracy/.test(line)) return;
    failures.push(`${key}: ${line.trim()}`);
  });
}
if (failures.length) {
  console.error("Forbidden accuracy rejection guard(s):");
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log("Accuracy rejection guard check passed.");
