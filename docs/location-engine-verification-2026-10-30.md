# IWACU RWANDA 2 — Location Engine Verification Report
**Date:** 2026-10-30  
**Branch:** `fix/never-fail-location-engine`  
**Pull request:** https://github.com/eddyizere24-collab/Iwacu-rwanda-2/pull/2

## Status at report time
The new location engine and fallback RPC have been applied to the populated Supabase project `buexgewxypvkqmphvfec`. The Production website has **not** been changed or promoted. Vercel did not provide a Preview deployment: its check returned a build-rate-limit failure, and environment-management calls were denied/not found. Therefore, no Preview URL is available and the live Production mismatch remains a release blocker.

Production is still configured through a Supabase integration pointing `NEXT_PUBLIC_SUPABASE_URL` at the empty project `agwfnpwootwsgsdeohcd`, while the working boundary database is `buexgewxypvkqmphvfec`. All URL/public keys/service-role credentials must be aligned to that same populated project before release, and the integration must not silently overwrite them.

## Changes implemented in this PR
- Removed the fixed 150-metre GPS rejection and the minimum-confidence stop from the public location flow.
- Collects several GPS readings and uses the best reading; when accuracy remains poor, also tries the browser's coarse network/Wi-Fi location.
- Added a Kinyarwanda hierarchy picker (Intara/Umujyi → Akarere → Umurenge → Akagari → Umudugudu), village-name search, and a one-tap option to reuse the citizen's previously confirmed village.
- Adds a nationwide hierarchy index endpoint and service-worker cache. The index is available offline **after the phone has successfully loaded it online at least once**.
- When a GPS accuracy circle overlaps real village polygons, returns up to three ranked candidates based on overlap. If no village polygon intersects, returns nearest real village records with an explicit estimate label. No village name is fabricated.
- Added an official NISR hierarchy-index fallback when Supabase is unavailable, and a nearest-village fallback around uncovered GPS points using the NISR layer.
- Public location lookup now uses a public Supabase client rather than the service-role client and no longer reads protected leader phone numbers.
- Applied the PostGIS RPC migration to `buexgewxypvkqmphvfec`. It is bounded to the existing village boundary table, returns at most three candidates, and falls back to nearest villages for gaps. No boundary rows were changed.
- Saved the original RPC definition for rollback at `sql/backup-location-confidence-before-2026-10-30.sql`.
- Added a read-only test harness at `sql/verify-location-engine-2026-10-30.sql`.

## Database test evidence
Read-only checks confirmed 17,423 rows in the populated boundaries table, including 14,823 active village records; all tested active hierarchy levels had non-null geometry. Post-migration RPC checks succeeded for an ordinary Kigali point, a larger 1,000-metre accuracy value, a real village centroid, and a sample over Lake Kivu. The sample over Lake Kivu had no containing village polygon but the fallback returned three real nearby village names. These are technical smoke tests, not proof that the reported village is the person's actual village.

### Synthetic GPS-noise test
The read-only harness tested five representative village polygons in each of Rwanda's 30 districts. It used each village's interior point, then displaced it by a deterministic direction at the listed distance and passed that same distance as the reported GPS accuracy. There were 150 test points per distance and 600 total. Results are from the populated Supabase RPC after its top-three fallback was applied.

| Simulated position error / reported accuracy | Samples | Top-1 correct | True village among top 3 | No candidate |
|---:|---:|---:|---:|---:|
| 20 m | 150 | 100.00% | 100.00% | 0.00% |
| 100 m | 150 | 98.67% | 100.00% | 0.00% |
| 300 m | 150 | 83.33% | 98.00% | 0.00% |
| 1,000 m | 150 | 12.67% | 54.67% | 0.00% |

These are sampled, synthetic results—not tests of every village, actual phone GPS, indoor conditions, or offline first-time use. The 1,000-metre result is especially weak. The overlap/distance score is **not a calibrated probability**. The UI therefore labels it as an overlap score or an estimate, rather than promising that “92%” is the statistical chance of being correct. Further calibration with consented, privacy-safe confirmed locations is still needed.

### Lake Kivu / shoreline smoke test
Representative coordinates were queried against the active boundary table. The sample positioned over the lake returned three nearest-village estimates even though it was outside the country polygon and outside all village polygons. Several shore samples landed inside one or more existing village polygons. These coordinates are diagnostic points, not surveyed reference points; they do not establish the correct legal village for all shoreline points.

## Security / data notes
- The RPC does not write to user data and does not return user identifiers, phone numbers, or leader contacts.
- The public roles received only the column access needed for the location RPC, and the active boundaries read policy remains in place.
- The two retained `_bak_boundaries_*` tables were not deleted or modified.
- The `leaders` table is still empty; leader/contact data is a separate task.

## Not yet completed or verified
1. **Production remains unfixed at the deployment level.** It still points to the empty Supabase project. Vercel environment changes and a Preview deployment were blocked by connector access/build-rate-limit errors. No Production release has taken place.
2. No low-end Android in-person testing has been done indoors/outdoors, on weak mobile data, or in Airplane mode.
3. The map pin/tap-to-select overlay is not implemented.
4. IP-based district priors and statistical scoring from the previous GPS fix / last confirmed village are not implemented. The last confirmed village is offered as a manual shortcut, not silently treated as GPS evidence.
5. The consent disclosure and privacy-safe, no-personal-identifier feedback loop are not implemented.
6. A fresh phone with no previously cached index cannot browse the hierarchy while fully offline. Offline picker use requires the index to have loaded successfully while online.
7. The official NISR fallback source is known to omit some gazetted villages; the populated Supabase boundary table is the preferred complete source, and real-world national coverage still requires review.
8. The probability score calibration remains inadequate at high simulated error; do not advertise these numbers as probabilities.

## Release gate
Keep this PR in draft and do not merge/promote to Production until:
- the latest CI run finishes successfully;
- a working Vercel Preview is available and endpoint/search/picker tests pass;
- the Production URL and all paired public/service-role credentials are confirmed to belong to `buexgewxypvkqmphvfec`, and Supabase integration auto-sync is addressed;
- offline, low-end-phone, and cross-district real-world tests are completed;
- the final limitations are reviewed and the owner approves release.
