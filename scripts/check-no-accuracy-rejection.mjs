#!/usr/bin/env node
/**
 * Static guard against rejecting citizens because a numeric GPS accuracy
 * exceeds a fixed threshold.
 *
 * Documented allow-list:
 * - src/hooks/useLocation.ts, around lines 96 and 188: the best-fix comparisons
 *   effectiveAccuracy > bestAccuracy / effectiveAccuracy >= bestAccuracy are
 *   allowed. They compare two measured fixes to keep the better one; they do
 *   not reject a fix against a hard-coded metre limit.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const forbiddenNumericGuard = /\baccuracy\s*(?:>=|>)\s*\d+(?:\.\d+)?\b/i;
const failures = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const filePath = join(directory, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      walk(filePath);
    } else if (extensions.has(extname(entry))) {
      const file = relative(root, filePath).replaceAll("\\", "/");
      const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/\bMAX_ACCURACY\b/.test(line)) {
          failures.push(file + ":" + (index + 1) + ": MAX_ACCURACY is forbidden");
        }
        if (forbiddenNumericGuard.test(line)) {
          failures.push(file + ":" + (index + 1) + ": fixed numeric accuracy rejection is forbidden");
        }
      });
    }
  }
}

try {
  walk(sourceRoot);
} catch (error) {
  console.error("Could not scan src:", error instanceof Error ? error.message : error);
  process.exit(2);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: src contains no MAX_ACCURACY or fixed numeric accuracy rejection guard.");
