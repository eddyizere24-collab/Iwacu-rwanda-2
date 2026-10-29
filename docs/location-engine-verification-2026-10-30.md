# IWACU RWANDA 2 — Location Engine Verification Report

**Date:** 2026-10-30  
**Repository branch:** `fix/never-fail-location-engine`  
**Pull request:** https://github.com/eddyizere24-collab/Iwacu-rwanda-2/pull/2

## 1. Release status

The work is on a separate branch and PR #2 remains **draft and unmerged**. I have not changed the Production Vercel environment, deployed this branch to Production, or promoted a release. The user will make the Production environment-variable change and redeploy personally.

Production was last verified as using a Supabase Vercel integration for `NEXT_PUBLIC_SUPABASE_URL` pointing to the empty project `agwfnpwootwsgsdeohcd`. The populated boundary database is `buexgewxypvkqmphvfec`. The URL, public key, and service-role key must all belong to the populated project before release. Vercel's project environment management requests were blocked, and its deployment check reported a build-rate-limit failure. No working Preview URL or live Preview API result was available at report time.

## 2. Database RPC backward compatibility

The live `public.calculate_location_confidence` function in `buexgewxypvkqmphvfec` was inspected after the change. Its input names/types and output column names/types remain the same as the original function used by `main`:

- Inputs: `p_lng double precision`, `p_lat double precision`, `p_accuracy_m double precision`.
- Output: `scope_code text`, `name_kiny text`, `name_eng text`, `level boundary_level`, `confidence numeric`, `intersection_area_m2 double precision`, `path ltree`.

The new SQL uses `SECURITY INVOKER` rather than `SECURITY DEFINER`, keeps a fixed search path, bounds the accuracy radius to 1–50,000 m and returns **only actual village polygons that intersect the accuracy circle**. It does not synthesize nearest-village rows in the SQL RPC. The existing `main` route continues to receive the same columns; its no-result/RPC-error path already calls the official NISR fallback. This avoids legacy `main` labelling a nearest estimate as an exact GPS hit.

The SQL migration is stored in `supabase/migrations/20261030000000_location_confidence_backward_compatible.sql` and was applied to the populated project. A read-only call executed as PostgreSQL role `anon` successfully queried a representative Kigali coordinate. The original function definition is saved at `sql/backup-location-confidence-before-2026-10-30.sql`. No boundary rows were modified.

## 3. What is implemented on the PR branch

- Removed the fixed 150-metre GPS accuracy rejection. The browser watches several readings, keeps the best, and tries coarse browser/network/Wi-Fi location if the result remains poor.
- Added a Kinyarwanda hierarchy picker and name search: Intara/Umujyi → Akarere → Umurenge → Akagari → Umudugudu.
- Manual confirmation also validates against the bundled national index if Supabase is unconfigured, points at an empty project, or lacks that village row. This prevents a database-mismatch dead end for names in the shipped index; a manually selected village is labelled as user-confirmed, not GPS-confirmed.
- Added `public/offline/location-index.json`: a compact index from active boundary records, containing 17,422 non-country rows: 5 provinces, 30 districts, 416 sectors, 2,148 cells and 14,823 villages. Parent links were checked; no parent reference was missing.
- The service worker pre-caches the static location index on installation. Once the app/service worker has installed the index while online, a citizen can browse and choose a village offline. The first-ever installation while entirely offline is not possible.
- Added a tap/drag map pin with an official NISR 2022 village polygon overlay for the visible map area. Choosing a point submits it as a map-derived coordinate and uses the same location API. The map/tiles require network access and have not been tested end-to-end on Preview.
- Added a weak IP-based **district-only** prior. It can re-order only candidates already found by the GPS overlap query; it cannot create or independently confirm a village. GPS is weighted more heavily than IP. IP-derived information is not returned or persisted.
- Added a consent-based confirmation feedback endpoint and table. The server stores the confirmed village ID, method, optional accuracy and coordinates rounded to two decimal places (roughly kilometre-level), without user ID, account, phone number, full IP or precise coordinates. It is optional and disclosed in the UI. Browser roles have no table grants, a deny-all RLS policy, and only `service_role` has INSERT permission.
- The results UI no longer shows raw numeric percentages as statistical probabilities. It shows wording such as “GPS n'imbibi bihuye cyane”, “Biracyasaba kugenzurwa”, or “Ahantu ntiharamenyekana neza”. A nearest-village result is explicitly shown as an estimate, not a certainty.
- When the match is weak or is a nearest estimate, the UI shows the sector and cell first, then gives the citizen the picker and map to confirm a village.
- Public boundary queries use a public client with RLS; this route no longer reads the protected leader phone column. A server-side check also rejects mismatched legacy service-role JWT/project references without logging a key.

## 4. Synthetic GPS-noise results

The read-only harness in `sql/verify-location-engine-2026-10-30.sql` samples five real village polygons per district across all 30 districts. For each sample it takes an interior point, offsets that point a deterministic distance in one direction, and passes the same distance as the reported GPS accuracy. The API's top-three RPC rows are evaluated for each sample.

| Simulated offset / reported accuracy | Samples | Top-1 candidate correct | True village among top 3 | No candidate for these polygon-covered samples |
|---:|---:|---:|---:|---:|
| 20 m | 150 | 100.00% | 100.00% | 0.00% |
| 100 m | 150 | 98.67% | 100.00% | 0.00% |
| 300 m | 150 | 83.33% | 98.00% | 0.00% |
| 1,000 m | 150 | 12.67% | 54.67% | 0.00% |

The mean absolute gap between the geometric overlap score and observed top-1 accuracy across districts was 0.00, 2.02, 10.21, and 24.36 percentage points respectively. The largest gap in a single district was 0.00, 13.89, 42.87, and 42.56 points respectively.

These are diagnostic synthetic tests, not a statistical calibration, not every village, and not real-device tests. The 1,000-metre result is poor. The geometric overlap score is not a probability, so the interface now uses word labels instead of displayed raw percentages. The zero no-candidate rate applies only to this deliberately sampled set of points whose accuracy circles intersect real village polygons; it does **not** prove a zero no-answer rate for all GPS positions.

## 5. Gap, Kivu and official-source limitations

The backward-compatible PostGIS RPC deliberately returns no village if no real village polygon intersects the accuracy circle. The Next.js API contains an official NISR fallback; when NISR has no intersecting polygon, it queries nearby real polygons and labels the result as `nearest`/an estimate. It ranks by distance to actual polygon edges rather than by village centroid to avoid preferring a centroid inside Lake Kivu.

The SQL-only test confirmed that a representative point over Lake Kivu is not covered by a village polygon, so the RPC by itself returns no match. The new application-level nearest fallback has **not** been verified by a live Preview HTTP call because Vercel Preview deployment has not been available. Therefore the lake fallback is implemented but not yet end-to-end verified. The official NISR 2022 layer may omit some legally gazetted villages; the populated Supabase index remains the preferred source, and national coverage still requires further review.

## 6. Supabase RLS / advisor notes

RLS is enabled on `boundaries`, `leaders`, `admin_profiles`, `audit_logs`, `inactive_number_reports`, both retained `_bak_boundaries_*` tables and the new `location_confirmation_feedback` table. The boundary public-read policy limits ordinary readers to active records. Anonymous/authenticated users cannot directly read leaders' phone numbers or access inactive-number reports. The feedback table denies browser access and only `service_role` has INSERT.

The Supabase Security Advisor still notes:
- Informational: the two retained backup tables have RLS but no policies. They have no browser table grants; they are retained as backups and were not deleted.
- Warning: Auth leaked-password protection is disabled. Enable it if the current plan supports it.

The leaders table is still empty; importing trusted, current leader data is separate work.

## 7. Verification still required

1. Wait for the latest GitHub Actions run to finish. Older run #102 failed TypeScript because the polygon-line distance call had an incompatible type; that code was corrected on a later commit. Do not rely on older checks as proof that the latest head builds.
2. Obtain a Vercel Preview deployment and test the real `/api/locate`, static index, picker, tap/drag map pin, NISR gap fallback, IP-prior ranking and feedback consent flow over HTTP.
3. After the owner changes Production Vercel URL/public/service-role credentials, confirm they all refer to `buexgewxypvkqmphvfec` and redeploy. The Supabase Vercel integration must not overwrite them with the empty project's values.
4. Run field tests on a low-end Android: indoors/outdoors, weak network, permission denied, map selection, and Airplane mode after the app has cached its index.
5. Do not advertise the synthetic scores as probabilities or say the location engine is verified nationwide until the above tests are complete.

## 8. Relevant files
- Migration: `supabase/migrations/20261030000000_location_confidence_backward_compatible.sql`
- Feedback migration: `supabase/migrations/20261030001000_location_confirmation_feedback.sql`
- Offline index: `public/offline/location-index.json`
- SQL verification harness: `sql/verify-location-engine-2026-10-30.sql`
- Ranking unit tests: `src/lib/location-ranking.test.ts`
- Rollback copy of original RPC: `sql/backup-location-confidence-before-2026-10-30.sql`

**Release decision:** keep PR #2 draft and do not merge/promote until the latest CI passes and a working Preview plus real-device validation are available.
