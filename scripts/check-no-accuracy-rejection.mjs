import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");

// Allow-list: useLocation.ts lines 96 and 188 compare effectiveAccuracy with
// bestAccuracy to select the better available fix. They are not fixed numeric
// rejection thresholds. Keep both the location and bestAccuracy token checks.
const allowList = new Map([
  ["src/hooks/useLocation.ts", new Set([96, 188])],
]);

const forbiddenAccuracyGuard = /\baccuracy\s*(?:>=|>)\s*\d+(?:\.\d+)?\b/i;
const supportedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) return walk(filePath);
    return supportedExtensions.has(extname(entry.name)) ? [filePath] : [];
  });
}

const failures = [];
for (const filePath of walk(sourceRoot)) {
  const relativePath = relative(root, filePath).replaceAll("\\", "/");
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const hasForbiddenConstant = /\bMAX_ACCURACY\b/.test(line);
    const hasNumericGuard = forbiddenAccuracyGuard.test(line);
    if (!hasForbiddenConstant && !hasNumericGuard) return;

    const allowedLines = allowList.get(relativePath);
    const isDocumentedBestFixComparison =
      allowedLines?.has(lineNumber) === true &&
      /effectiveAccuracy\s*(?:>=|>)\s*bestAccuracy/.test(line);

    if (isDocumentedBestFixComparison && !hasForbiddenConstant) return;
    failures.push(`${relativePath}:${lineNumber}: ${line.trim()}`);
  });
}

if (failures.length > 0) {
  console.error("Forbidden accuracy rejection guard(s) found:");
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log("OK: no MAX_ACCURACY constant or numeric accuracy > / >= guard found in src.");
