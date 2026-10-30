# IWACU RWANDA 2 — STATUS

Date: 2026-10-30. PR #2 remains open, draft and unmerged. No Production deployment or Vercel/Supabase Production environment change was made by this work.

## 1. OVERALL: 46%

Tracking index only, **not a measure of nationwide location accuracy**. Score T1–T9 plus 3 owner steps = 12 items; DONE-VERIFIED=1, DONE-UNVERIFIED=0.5, IN PROGRESS=0.25, BLOCKED/NOT STARTED=0. T1=1; T2=.25; T3=1; T4=1; T5=.25; T6=.25; T7=.25; T8=1; T9=.5; owner steps=0. Total 5.5/12 = 45.83%, rounded to 46%.

## 2. TASK TABLE

| ID | status | evidence |
|---|---|---|
| T1 | DONE-VERIFIED | PR migration `supabase/migrations/20261030000000_location_confidence_backward_compatible.sql`; live signature/output checked against the original contract; `SECURITY INVOKER`. |
| T2 | IN PROGRESS | 600 POST tests through `/api/locate` and 450 additional near-border POST tests completed on Preview commit `1cd3f2ea8ece5a9edafba15a5e310a8119c00a0c`. Kivu gap still returns 422 `POINT_IN_GAP`; the ~21 NISR-missing villages are not individually tested. |
| T3 | DONE-VERIFIED | Commit `29159954d590912919338f999bd61d20389105a5` removes the score-based “bihuye cyane” map label; auto GPS/map results use cautious wording. |
| T4 | DONE-VERIFIED | Current code commit `29159954d590912919338f999bd61d20389105a5` passed Actions run #140: https://github.com/eddyizere24-collab/Iwacu-rwanda-2/actions/runs/40980659330. |
| T5 | IN PROGRESS | API returns a gap error for one offshore Kivu test; the UI code displays `VillagePicker` in the error state, but the failure scenarios are not handset-tested. |
| T6 | IN PROGRESS | Service worker pre-caches the 1,593,361-byte (1.59 MB / 1.52 MiB) names/hierarchy index. It lacks representative coordinates; `/offline/rwanda-village-boundaries.geojson` is absent from this branch. Airplane-mode use is UNVERIFIED. |
| T7 | IN PROGRESS | The integration-managed Supabase URL is masked by Vercel, so exact current project refs cannot be verified. Deployment snapshots are listed in section 4. |
| T8 | DONE-VERIFIED | Six-point tap-only checklist updated: [PRODUCTION-VERIFICATION.md](./PRODUCTION-VERIFICATION.md). Six sample coordinates returned the expected top-1 village on the earlier Preview deployment. |
| T9 | DONE-UNVERIFIED | Backup-table RLS/permissions and Auth advisor warning checked. The admin passcode field is present but ignored; app-wide password use was not exhaustively audited. |

## 3. TEST RESULTS — 2026-10-30

### 600-point synthetic test through `/api/locate`
Preview deployment commit `1cd3f2ea8ece5a9edafba15a5e310a8119c00a0c` (older than current PR head). Five villages per each of 30 districts; each point was offset by the stated distance and submitted with the same reported accuracy. Every request returned HTTP 200 / `status=success`, source `gps`; there were no empty candidate results in this sampled set.

| Offset / accuracy | Samples | HTTP success | Top-1 correct | True village in top 3 | No answer |
|---:|---:|---:|---:|---:|---:|
| 20 m | 150 | 150 | 100.00% | 100.00% | 0 |
| 100 m | 150 | 150 | 98.67% | 100.00% | 0 |
| 300 m | 150 | 150 | 83.33% | 98.00% | 0 |
| 1,000 m | 150 | 150 | 12.67% | 54.67% | 0 |

### Harder near-border set through `/api/locate`
Separate deterministic set of 150 sampled villages (5 per district), with points about 10 m inside a real polygon boundary. This set is different from the earlier 139-point SQL-only diagnostic, so do not compare the percentages as if the sample points were identical.

| Reported accuracy | Samples | HTTP success | Top-1 correct | True village in top 3 | No answer |
|---:|---:|---:|---:|---:|---:|
| 20 m | 150 | 150 | 100.00% | 100.00% | 0 |
| 100 m | 150 | 150 | 100.00% | 100.00% | 0 |
| 300 m | 150 | 150 | 95.33% | 100.00% | 0 |

### Confidence wording threshold
Strongest wording is not shown for auto GPS/map results: the raw geometric score is not a calibrated probability and is not equivalent to the reported-accuracy radius.

| Reported accuracy | Interior top-1 | Near-border top-1 | At least ~97% in both samples? | UI decision |
|---:|---:|---:|---|---|
| 20 m | 100.00% | 100.00% | Yes, synthetic samples only | No strongest label; keep manual confirmation available |
| 100 m | 98.67% | 100.00% | Yes, synthetic samples only | No strongest label; keep manual confirmation available |
| 300 m | 83.33% | 95.33% | No | Cautious wording and confirmation |
| 1,000 m | 12.67% | Not tested | No | Estimate/check manually |

### Kivu, shore and outside-Rwanda API probes
All were POST requests to the same earlier Preview `/api/locate` deployment, accuracy 100 m:

| Point | Result |
|---|---|
| Gisenyi shore A (-1.68, 29.25) | HTTP 200, GPS result, top-1 Amajyambere |
| Gisenyi shore B (-1.70, 29.28) | HTTP 200, GPS result, top-1 Byima |
| Rubavu shore C (-1.72, 29.30) | HTTP 200, GPS result, top-1 Karambi |
| Kivu lake sample (-1.75, 29.20) | **HTTP 422, `POINT_IN_GAP`** — API dead-end; UI picker fallback is only code-inspected, not device-verified |
| Kivu south shore (-2.10, 29.35) | HTTP 200, GPS result, top-1 Karongi |
| Kigali control (-1.9441, 30.0619) | HTTP 200, GPS result, top-1 Ishema |
| Outside east (-1.95, 31.00) | HTTP 200, `source=nearest`, top-1 Busasamana I, `NEAREST_VILLAGE_ESTIMATE` |
| Outside west (-1.95, 28.70) | HTTP 200, `source=nearest`, top-1 Rutagara |
| Outside south (-3.00, 29.90) | HTTP 200, `source=nearest`, top-1 Nyarutovu |

These are synthetic/selected samples, not field GPS measurements and not nationwide validation. The ~21 villages missing from the NISR layer still need authoritative coordinates/source data and individual tests.

## 4. BLOCKED / ENVIRONMENT SNAPSHOT

Vercel stores the current integration URL in an encrypted/masked value; the current URL host/project ref is **UNVERIFIED** in each environment. Last recorded host before this report was `agwfnpwootwsgsdeohcd.supabase.co`; do not assume it is still current. A branch-specific override pointing to `buexgewxypvkqmphvfec` was seen for the separate `security/part-2-auth-hardening` branch, not this PR branch.

| Environment | Supabase hostname/ref | Deployment commit / status |
|---|---|---|
| Production | UNVERIFIED; last recorded host `agwfnpwootwsgsdeohcd.supabase.co` | `c6c01cbd3a24fea53df7f0fe1b0600dca58e137b`, READY |
| Preview, this PR | UNVERIFIED; current shared value is masked | Earlier tested deployment `1cd3f2ea8ece5a9edafba15a5e310a8119c00a0c`, READY; new current-head Preview build `iwacu-rwanda-2-o6pz51pir-ahabona.vercel.app` for `29159954d590912919338f999bd61d20389105a5` was BUILDING at last check |
| Development | UNVERIFIED; environment variable target exists, value masked | No hosted Development deployment found |

Owner action needed later: in Vercel Settings, ensure `NEXT_PUBLIC_SUPABASE_URL`, the public anon/publishable key and server-only service-role key all belong to `buexgewxypvkqmphvfec`; check duplicate integration variables and target settings. Never send key values in chat. The Production values were not changed by this work.

## 5. UNVERIFIED / RISKS

- GPS denied, GPS timeout, no internet, Supabase outage and no-signal flows were not end-to-end tested on a phone. `VillagePicker` is rendered after locate errors by code inspection, not a field test.
- The offline index does not contain representative points, and the offline polygon file requested by `useLocation.ts` is absent. Actual Airplane-mode picker/GPS behavior after one online load remains UNVERIFIED.
- `public._bak_boundaries_geom` (estimated 17,423 rows) and `public._bak_boundaries_meta` (row count estimate unavailable): RLS enabled; `anon` and `authenticated` SELECT privileges are false. **Keep both** until release verification and a separate backup export are confirmed; consider dropping only after the rollback window.
- Supabase Advisor: `auth_leaked_password_protection` is disabled. The admin login UI contains a password/passcode input, but its handler ignores the value, stores session-like data in localStorage and navigates without Supabase Auth verification. Treat admin authentication as HIGH RISK; this is not real password authentication. Whole-app authentication was not exhaustively audited.
- Preview `/api/health` returned HTTP 200 but `status=degraded` because `ADMIN_WRITE_TOKEN` was missing.

## 6. OWNER STEPS (NOT DONE)

1. After the Preview issues are reviewed, switch all three Supabase environment values to the same populated project in Vercel UI and redeploy Production. Do not paste keys.
2. Use the six-point tap-only checklist after the Production redeploy; also test “Menya aho ndi” in 3–4 real districts and report only the village/sector/cell, source label and any error.
3. Open the app online once, then enable Airplane mode and test searching/selecting a village. Report whether the picker opens, selection is saved locally and any message shown.

## 7. NEXT 3 ACTIONS

1. Confirm the current-head Preview build is READY; recheck the new wording and repeat the API smoke suite against that exact commit.
2. Resolve or safely contain `POINT_IN_GAP` for the Kivu test and validate locations near the NISR-missing villages; then exercise the six required error scenarios.
3. Verify the three Vercel environment targets from their settings UI (owner action), then run the six-point Production and Airplane-mode checklist. No merge or Production deployment has occurred.
