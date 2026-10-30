# IWACU RWANDA 2 — STATUS

Date: 2026-10-30. PR #2 is open, draft and unmerged. No Production deploy or environment change was made.

## 1. OVERALL: 40%
Scoring T1–T9 plus 3 owner steps = 12 items: DONE-VERIFIED=1, DONE-UNVERIFIED=0.5, IN PROGRESS=0.25, BLOCKED/NOT STARTED=0. T1 1; T2 .25; T3 .25; T4 1; T5 .25; T6 .25; T7 .25; T8 1; T9 .5; owner steps 0. Total 4.75/12 = 39.6%, rounded to 40%.

## 2. TASK TABLE
| ID | status | evidence |
|---|---|---|
| T1 | DONE-VERIFIED | Backward-compatible RPC migration in PR #2; signature/output checked against main in existing report. |
| T2 | IN PROGRESS | Fresh 600-point SQL test and hard border/Kivu SQL diagnostics below; no 600-point run through deployed /api/locate. NISR-missing-village API tests UNVERIFIED. |
| T3 | IN PROGRESS | SQL hit-rate tables below. Current UI still has over-strong labels; safest label correction is not yet committed. |
| T4 | DONE-VERIFIED | Commit 23dd7a1469c689dffbd1a3b3879c0019755a665e passed Actions run #126: https://github.com/eddyizere24-collab/Iwacu-rwanda-2/actions/runs/40979524132. |
| T5 | IN PROGRESS | Error UI shows picker after locate errors; six failure modes are not end-to-end tested. |
| T6 | IN PROGRESS | Service worker pre-caches the 1,593,361-byte (1.59 MB / 1.52 MiB) names/hierarchy index, but it has no representative coordinates. The offline polygon file requested by the GPS fallback is absent from the branch; Airplane-mode picker/GPS use UNVERIFIED. |
| T7 | IN PROGRESS | URL variable is integration-stored/shared across environments; hostname and project ref are masked, UNVERIFIED. |
| T8 | DONE-VERIFIED | Six district sample points and tap-only steps: [PRODUCTION-VERIFICATION.md](./PRODUCTION-VERIFICATION.md). |
| T9 | DONE-UNVERIFIED | Advisor flags two backup tables and leaked-password protection. Admin login page has no password input/password sign-in; app-wide auth usage not exhaustively searched. |

## 3. TEST RESULTS — 2026-10-30
PR branch, **SQL only, NOT /api/locate**. Current calculate_location_confidence in project buexgewxypvkqmphvfec. The 600-point test uses 5 villages per district across all 30 districts; each interior point is offset by the listed distance, and the same value is passed as reported accuracy.

| Offset / accuracy | Samples | Top-1 correct | True village in top 3 | No candidate |
|---:|---:|---:|---:|---:|
| 20 m | 150 | 100.00% | 100.00% | 0.00% |
| 100 m | 150 | 98.67% | 100.00% | 0.00% |
| 300 m | 150 | 83.33% | 98.00% | 0.00% |
| 1,000 m | 150 | 12.67% | 54.67% | 0.00% |

**Hard set — near village borders:** 139 villages produced an eligible boundary-edge point, positioned 10 m inside the polygon; each point tested at 20 m, 100 m and 300 m accuracy (417 rows total).

| Accuracy radius | Samples | Top-1 correct | True village top 3 | No candidate |
|---:|---:|---:|---:|---:|
| 20 m | 139 | 98.56% | 100.00% | 0.00% |
| 100 m | 139 | 84.17% | 100.00% | 0.00% |
| 300 m | 139 | 55.40% | 99.28% | 0.00% |

**Gap probes (SQL-only):** Gisenyi shore A, Gisenyi shore B, Rubavu shore C, Kivu south shore and Kigali control had polygons and candidates. Kivu lake sample (29.20, -1.75), outside west check and outside north check were outside the country polygon and returned zero RPC candidates. Application fallback results for these points remain UNVERIFIED. This confirms the RPC alone does not satisfy a never-dead-end rule for gaps/outside-country locations.

Scores are synthetic diagnostics, not real-device/nationwide validation. Strong wording is only a candidate when measured top-1 rate is about 97% or better (20 m/100 m in the interior set and 20 m only in the border set); keep it off until /api/locate tests confirm identical rates using the intended RPC. At 300 m and beyond require checking/manual confirmation.

## 4. BLOCKED
Current Preview deployment is READY but on older commit 1cd3f2ea8ece5a9edafba15a5e310a8119c00a0c, behind the report/PR head. Direct live API POST tests are not available from this environment. Vercel masks the URL variable; its destination is UNVERIFIED. Owner should not send key values.

## 5. UNVERIFIED / RISKS
- No live API 600-point, border, Kivu or NISR-missing-village results.
- GPS denied, GPS timeout, no internet, Supabase down, outside Rwanda and no signal with cached list remain UNVERIFIED end-to-end.
- Offline index cache is implemented but contains names/hierarchy only, no representative points. useLocation.ts requests /offline/rwanda-village-boundaries.geojson for offline GPS confidence, but that file is absent from this branch and the service worker only pre-caches the index; offline GPS location will return OFFLINE_CACHE unless the file is supplied/cached by another means. Manual picker after one online load is still not device-verified.
- Backups: public._bak_boundaries_geom and public._bak_boundaries_meta. KEEP until release verification plus a verified export, then consider DROP. Security Advisor says RLS/no policies (informational); earlier inspection found no browser grants.
- Supabase Auth leaked-password protection is disabled. Admin login page has no password input or Supabase password sign-in, but stores a session-like object in localStorage after an auth-code field; that is a separate authentication risk. Whole-app password usage was not exhaustively searched.
- Vercel latest Production: c6c01cbd3a24fea53df7f0fe1b0600dca58e137b, READY. Latest Preview: 1cd3f2ea8ece5a9edafba15a5e310a8119c00a0c, READY but behind PR head. Development has no hosted deployment. URL hostname/project ref are UNVERIFIED in Production/Preview/Development.

## 6. OWNER STEPS (NOT DONE)
1. In Vercel, align public Supabase URL, public key and server-only key to project buexgewxypvkqmphvfec, and check conflicting duplicate integration variables. Never paste secrets into chat.
2. Redeploy Production after checking targets.
3. On a phone, tap “Menya aho ndi” in 3–4 districts; compare true village/sector/cell and send observations.

## 7. NEXT 3 ACTIONS
1. Correct the strongest GPS/map wording in src/app/page.tsx; currently no strongest label is justified for the whole flow.
2. Deploy current PR head to Preview only and run the 600-point plus border/Kivu/NISR-gap set through /api/locate.
3. Verify six failure modes and the offline picker after one online load; record evidence here.
