# IWACU RWANDA 2 — STATUS

Date: 2026-10-30. PR #2 remains open, draft and unmerged. No Production deploy or Vercel environment change was made.

## 1. OVERALL: 42%
Scoring T1–T9 plus 3 owner steps = 12 items: DONE-VERIFIED=1, DONE-UNVERIFIED=0.5, IN PROGRESS=0.25, BLOCKED/NOT STARTED=0. Current scores: T1 1; T2 .25; T3 .25; T4 1; T5 .25; T6 .5; T7 .25; T8 1; T9 .5; owner steps 0. Total 5/12 = 41.7%, rounded to 42%.

## 2. TASK TABLE
| ID | status | evidence |
|---|---|---|
| T1 | DONE-VERIFIED | Backward-compatible RPC migration in PR #2; signature/output checked against main in the prior report. |
| T2 | IN PROGRESS | Fresh 600-point SQL test below; no 600-point run through deployed /api/locate. Border, Kivu shore and NISR missing-village API tests UNVERIFIED. |
| T3 | IN PROGRESS | SQL hit rates below; current UI still has overly strong labels and needs correction pending API verification. |
| T4 | DONE-VERIFIED | Commit 3960cb1099241a38bceeeded19c538105d8fb1d0; Actions run #118 success (docs-only update). |
| T5 | IN PROGRESS | Error UI shows picker after locate errors; six failure modes are not end-to-end tested. |
| T6 | DONE-UNVERIFIED | Service worker pre-caches the static index on install; 1,593,361 bytes = 1.59 MB / 1.52 MiB. Airplane-mode use UNVERIFIED. |
| T7 | IN PROGRESS | URL env variable is shared/integration-stored for all three envs; hostname and project ref masked, UNVERIFIED. |
| T8 | DONE-VERIFIED | Six sample points and tap-only instructions: [PRODUCTION-VERIFICATION.md](./PRODUCTION-VERIFICATION.md). |
| T9 | DONE-UNVERIFIED | Advisor flags two backup tables and leaked-password protection. Admin login page has no password input/password sign-in; app-wide authentication use not exhaustively searched. |

## 3. TEST RESULTS
Latest: 2026-10-30, PR branch; **SQL only, NOT /api/locate**. Current calculate_location_confidence function, project buexgewxypvkqmphvfec. 150 samples × 4 tiers = 600.

| Offset / accuracy | Samples | Top-1 correct | True village top-3 | No candidate |
|---:|---:|---:|---:|---:|
| 20 m | 150 | 100.00% | 100.00% | 0.00% |
| 100 m | 150 | 98.67% | 100.00% | 0.00% |
| 300 m | 150 | 83.33% | 98.00% | 0.00% |
| 1,000 m | 150 | 12.67% | 54.67% | 0.00% |

Five villages per district (all 30 districts); each interior point was offset by the listed distance and that distance was passed as GPS accuracy. Synthetic only, not nationwide or real-device validation. Zero no-candidate applies only to these constructed circles. Strong wording is a candidate only at measured top-1 >=~97% (20 m and 100 m); keep it disabled until the same results pass through Preview /api/locate using the intended RPC. At 300 m/1,000 m require checking/manual confirmation.

## 4. BLOCKED
Preview currently READY at commit 1cd3f2ea8ece5a9edafba15a5e310a8119c00a0c, behind PR head. Direct live API POST testing was unavailable here. Vercel masks the URL environment variable, so its project destination is UNVERIFIED. Owner must align environment variables, redeploy, and tap-test Production; do not share key values.

## 5. UNVERIFIED / RISKS
No API 600-point, border/Kivu/NISR-gap, six failure-mode, or Airplane-mode test. Backup tables are public._bak_boundaries_geom and public._bak_boundaries_meta; KEEP until a verified export and release testing, then review for drop. Auth leaked-password protection is disabled. Admin login stores session-like data in localStorage after an auth-code field; this is a separate security risk, not server-verified auth. Latest Production: c6c01cbd3a24fea53df7f0fe1b0600dca58e137b READY. Latest Preview: 1cd3f2ea8ece5a9edafba15a5e310a8119c00a0c READY. Development: no hosted deployment. Supabase URL hostname/ref UNVERIFIED in Production/Preview/Development.

## 6. OWNER STEPS (not done)
1. In Vercel, point URL, public anon key and server-only service key at project buexgewxypvkqmphvfec; check duplicate integration variables. Never share secret values.
2. Redeploy Production.
3. Tap “Menya aho ndi” in 3–4 districts; compare actual village/sector/cell with results and send observations.

## 7. NEXT 3 ACTIONS
1. Remove strongest GPS/map wording from src/app/page.tsx until calibrated API results justify it.
2. Deploy current PR head to Preview only, confirm project destination, run the 600 API points plus border/Kivu/gap points.
3. Test six failures and offline picker after one online load, then update this report.
