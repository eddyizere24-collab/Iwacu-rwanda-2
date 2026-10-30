# IWACU RWANDA 2 — STATUS

Date: 2026-10-30. PR #2 is open, draft and unmerged. No Production environment values, deployment, or promotion were changed.

## 1. OVERALL: 46%

This is a task-completion index, **not a location-accuracy score**. Score T1–T9 plus three owner actions (12 items): DONE-VERIFIED=1, DONE-UNVERIFIED=0.5, IN PROGRESS=0.25, BLOCKED/NOT STARTED=0. T1=1; T2=.25; T3=1; T4=1; T5=.25; T6=.25; T7=.25; T8=1; T9=.5; owner actions=0. Total 5.5/12=45.83%, rounded to 46%.

## 2. TASK TABLE

| ID | status | evidence |
|---|---|---|
| T1 | DONE-VERIFIED | Migration `supabase/migrations/20261030000000_location_confidence_backward_compatible.sql`; same input/output signature as main checked. |
| T2 | IN PROGRESS | 600-point API suite and 450 near-border API tests below. 600-point run used Preview commit `29159954d590912919338f999bd61d20389105a5`; 450 near-border run used older Preview commit `1cd3f2ea8ece5a9edafba15a5e310a8119c00a0c`. ~21 NISR-missing villages still not individually tested. |
| T3 | DONE-VERIFIED | Commit `29159954d590912919338f999bd61d20389105a5` removes the score-based “bihuye cyane” map label; auto GPS/map outputs use cautious wording. |
| T4 | DONE-VERIFIED | Current code commit `7b07bf1c74544e5483199f71ff3eea9c3d5f81c4` passed Actions run #156: https://github.com/eddyizere24-collab/Iwacu-rwanda-2/actions/runs/40981875853. |
| T5 | IN PROGRESS | Current-branch local API with no Supabase credentials returned village estimates for a Kivu gap and outside-Rwanda coordinates. Browser/GPS failure scenarios and visible picker still need device testing. |
| T6 | IN PROGRESS | Index now contains 17,422 records with representative coordinates; 1,937,955 bytes (1.94 MB / 1.85 MiB). Service Worker cache version bumped to v3. Airplane-mode picker/GPS not tested on a phone. |
| T7 | IN PROGRESS | Vercel masks the shared URL variable, so current Supabase project refs remain UNVERIFIED per environment. Latest Preview deploy of current source could not be created because the Vercel API reached its daily deployment limit. |
| T8 | DONE-VERIFIED | Six-point tap-only checklist: [PRODUCTION-VERIFICATION.md](./PRODUCTION-VERIFICATION.md). Six sample points returned the expected village on current-code local API and the earlier tested Preview. |
| T9 | DONE-UNVERIFIED | Two backup tables and leaked-password warning reviewed; full app-wide authentication audit not complete. |

## 3. TEST RESULTS — 2026-10-30

### 600 synthetic test points through `/api/locate`

**Deployment:** Preview `https://iwacu-rwanda-2-o6pz51pir-ahabona.vercel.app`, source commit `29159954d590912919338f999bd61d20389105a5`. The new SQL function was exercised through the route, not SQL-only. Five villages per district across 30 districts; each interior point was offset by the shown distance and submitted with the same accuracy radius.

| Offset / accuracy | Samples | HTTP success | Top-1 correct | True village in top 3 | No answer |
|---:|---:|---:|---:|---:|---:|
| 20 m | 150 | 150 | 100.00% | 100.00% | 0 |
| 100 m | 150 | 150 | 98.67% | 100.00% | 0 |
| 300 m | 150 | 150 | 83.33% | 98.00% | 0 |
| 1,000 m | 150 | 150 | 12.67% | 54.67% | 0 |

### Harder near-border API tests

**Deployment:** older Preview commit `1cd3f2ea8ece5a9edafba15a5e310a8119c00a0c`. Separate deterministic sample: 150 points about 10 m inside selected village polygons; 20/100/300 m accuracy. It is not the earlier 139-point SQL-only set.

| Accuracy | Samples | HTTP success | Top-1 correct | True village in top 3 | No answer |
|---:|---:|---:|---:|---:|---:|
| 20 m | 150 | 150 | 100.00% | 100.00% | 0 |
| 100 m | 150 | 150 | 100.00% | 100.00% | 0 |
| 300 m | 150 | 150 | 95.33% | 100.00% | 0 |

### T3 wording threshold

Geometric overlap scores are **not calibrated probabilities**; do not infer a confidence label from the raw score alone.

| Accuracy radius | Interior top-1 | Near-border top-1 | ≥97% in both synthetic sets? | Wording |
|---:|---:|---:|---|---|
| 20 m | 100.00% | 100.00% | Yes, synthetic only | Still no “high confidence”; keep confirmation |
| 100 m | 98.67% | 100.00% | Yes, synthetic only | Still cautious; keep confirmation |
| 300 m | 83.33% | 95.33% | No | Uncertain; check/pick manually |
| 1,000 m | 12.67% | Not tested | No | Estimate only; pick manually |

### Current-code local API checks (commit `7b07bf1c74544e5483199f71ff3eea9c3d5f81c4`)

Local Next.js dev server, no Supabase environment variables. This tests NISR fallback and the current bundled index, **not a new Preview deployment**. Tests were run by POSTing to `/api/locate`.

| Case | Result |
|---|---|
| Six official coordinate samples (Gasabo, Huye, Musanze, Nyagatare, Nyarugenge, Rubavu) | 6/6 HTTP 200 success; expected village top-1 |
| Kivu lake gap (-1.75, 29.20) | HTTP 200 success, `source=nearest`, Butotori; `NEAREST_VILLAGE_ESTIMATE` |
| Outside east (-1.95, 31.00) | HTTP 200, `source=nearest`, Busasamana I; estimate |
| Outside west (-1.95, 28.70) | HTTP 200, `source=nearest`, Rutagara; estimate |

The static representative-point fallback is unit-tested and integrated into the API/offline path. A new Preview deployment of the updated fallback code is **UNVERIFIED** because Vercel rejected another deployment with HTTP 402 `api-deployments-free-per-day` (“try again in 24 hours”). The latest code build/tests passed GitHub Actions; the public Preview still runs the older `291599...` commit.

## 4. BLOCKED

- **Vercel:** new Preview deployment blocked by the daily deployment API limit. Need Vercel deployment quota to reset or the owner to resolve the plan/limit. No setting was changed.
- **Production environment:** URL/keys are masked in Vercel integration results. The current project refs by Production/Preview/Development remain UNVERIFIED. Last recorded host was `agwfnpwootwsgsdeohcd.supabase.co`, but this may be stale; do not rely on it. Owner must visually confirm all three values belong to populated project `buexgewxypvkqmphvfec`, then redeploy Production.
- **Phone-only checks:** owner taps required for GPS denied/timeout, no internet/no signal, and true Airplane mode after one online load.

## 5. UNVERIFIED / RISKS

- UI code renders `VillagePicker` in locate-error state; manual selection code falls back to the bundled verified index. This is code-inspected, not real-device verification.
- Offline hierarchy/index is 1,937,955 bytes, with 14,823 village representative points and complete parent links except the deliberately omitted country root. Service Worker now uses cache version v3 and precaches `/offline/location-index.json`. The separate polygon file `/offline/rwanda-village-boundaries.geojson` is still absent; offline GPS therefore uses the explicit representative-point estimate when the cached index exists. Airplane-mode test remains UNVERIFIED.
- **T5 still not fully proven:** GPS permission denied, GPS timeout, no internet, Supabase unavailable with a real configured browser, and “no signal at all” were not all tested end-to-end in a browser. A Kivu offshore sample previously returned HTTP 422 on old code; latest local code returned an estimate. Current fallback code still needs a fresh Preview deploy/API run.
- Vercel `GET /api/health` on Preview was HTTP 200, `status=degraded`, because `ADMIN_WRITE_TOKEN` is missing; public Supabase env checks were present in that Preview.
- Backup tables: `public._bak_boundaries_geom` (estimated 17,423 rows) and `public._bak_boundaries_meta` (estimated row count unavailable). Both have RLS enabled and no `anon`/`authenticated` SELECT grant. **Keep both** until release verification plus a separately verified export; only consider dropping after rollback window.
- Supabase Advisor warns `auth_leaked_password_protection` is disabled. Admin screen has a password/passcode input, but its handler ignores the value and stores session-like data in localStorage instead of verifying with Supabase Auth. Treat admin authentication as HIGH RISK; the whole app auth flow has not been exhaustively audited.

## 6. OWNER STEPS (NOT DONE)

1. In Vercel, check that `NEXT_PUBLIC_SUPABASE_URL`, the public anon/publishable key, and server-only service-role key all belong to project `buexgewxypvkqmphvfec`. Do not send key values. Check duplicated/integration variables.
2. After Preview verification, redeploy Production with those aligned values; no Production settings were changed by this work.
3. On a phone, complete the six-point list and real GPS taps in 3–4 districts. Then open online once, enable Airplane mode, search/select a village and report what happens.

## 7. NEXT 3 ACTIONS

1. When Vercel permits it, deploy current branch head `7b07bf1c74544e5483199f71ff3eea9c3d5f81c4` to Preview; repeat 600-point, border, Kivu and outside-coordinate tests against that exact deployment.
2. Run browser/device failure checks: GPS denied, GPS timeout, no internet, Supabase down, outside Rwanda and no signal; ensure picker remains usable and estimates are labelled.
3. Owner verifies Vercel Production/Preview/Development env targets and completes Production + Airplane-mode tap checklist. No merge or Production deployment by this work.
