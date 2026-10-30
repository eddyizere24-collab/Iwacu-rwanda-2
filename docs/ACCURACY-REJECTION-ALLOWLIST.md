# Accuracy-rejection static check

CI scans application TypeScript under src/ for:

MAX_ACCURACY|accuracy *(>|>=) *[0-9]

The allow-list is intentionally empty. Do not exempt code that rejects a
location because the device-reported radius is large.

If a genuine false positive is display-only, add only its exact source path to
scripts/accuracy-rejection-allowlist.txt and document the exact line and
reason here in the same change. The location acceptance path must remain
independent of a maximum accuracy threshold.
