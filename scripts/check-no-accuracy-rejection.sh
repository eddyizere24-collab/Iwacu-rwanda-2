#!/usr/bin/env bash
set -euo pipefail

# Work Order 03 static gate. Search app TypeScript only; reports, SQL history,
# test fixtures, and documentation are not runtime acceptance code.
allowlist="scripts/accuracy-rejection-allowlist.txt"
matches_file="$(mktemp)"
trap 'rm -f "$matches_file"' EXIT

grep -rniE "MAX_ACCURACY|accuracy *(>|>=) *[0-9]" src \
  --include='*.ts' --include='*.tsx' > "$matches_file" || true

failed=0
while IFS= read -r match; do
  file="${match%%:*}"
  if grep -Fxq "$file" "$allowlist"; then
    continue
  fi
  printf '%s\n' "$match"
  failed=1
done < "$matches_file"

if [[ "$failed" -ne 0 ]]; then
  echo "ERROR: accuracy-based rejection pattern found. Do not reject a location because the device-reported radius is large."
  exit 1
fi

echo "OK: no unallowlisted accuracy-based rejection patterns found."
