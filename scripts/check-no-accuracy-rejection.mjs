#!/usr/bin/env node
/**
 * Static guard against rejecting citizens because GPS accuracy is large.
 *
 * Allow-list (non-rejection UI only):
 * - src/hooks/useLocation.ts: reportedRadiusMeters > 2_000 is used only
 *   to choose an explanatory "approximate" notice; it does not discard a fix.
 * All other numeric or named-constant accuracy/radius comparisons fail.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const numericAccuracyGuard = /(?:\b[A-Za-z_$][\w$]*(?:accuracy|radius)[\w$]*\s*(?:>=|>|<=|<)\s*\d[\d_]*(?:\.\d+)?\b|\b\d[\d_]*(?:\.\d+)?\s*(?:>=|>|<=|<)\s*[A-Za-z_$][\w$]*(?:accuracy|radius)[\w$]*\b)/i;
const namedConstantAccuracyGuard = /(?:\b[A-Za-z_$][\w$]*(?:accuracy|radius)[\w$]*\s*(?:>=|>|<=|<)\s*[A-Z][A-Z0-9_]*\b|\b[A-Z][A-Z0-9_]*\s*(?:>=|>|<=|<)\s*[A-Za-z_$][\w$]*(?:accuracy|radius)[\w$]*\b)/;
const NAMED_GUARD_ALLOWLIST = [
  {
    file: "src/hooks/useLocation.ts",
    linePattern: /reportedRadiusMeters\s*>\s*2_000/,
    reason: "notice text only; no fix rejection or request suppression",
  },
];
const failures = [];

function isAllowlisted(file, line) {
  return NAMED_GUARD_ALLOWLIST.some((entry) =>
    entry.file === file && entry.linePattern.test(line) && Boolean(entry.reason)
  );
}

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
        const location = file + ":" + (index + 1);
        if (/\bMAX_ACCURACY\b/.test(line)) {
          failures.push(location + ": MAX_ACCURACY is forbidden");
        }
        if (numericAccuracyGuard.test(line) && !isAllowlisted(file, line)) {
          failures.push(location + ": fixed numeric accuracy/radius comparison is forbidden");
        }
        if (namedConstantAccuracyGuard.test(line) && !isAllowlisted(file, line)) {
          failures.push(location + ": named-constant accuracy/radius comparison is forbidden");
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
console.log("PASS: no fixed numeric or named-constant accuracy/radius rejection comparisons found.");
