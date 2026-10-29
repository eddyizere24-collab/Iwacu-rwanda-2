# IWACU RWANDA — Security Audit Checklist (MVP)

Date: 2026-10-29  
Standard: Internal security review; Rwanda legal compliance requires separate legal verification.

## 1. Security implementation status

- [x] Server-side admin routes require a real Supabase Auth session and a matching admin_profiles record.
- [x] Old header-token authentication is not accepted as proof of administrator identity.
- [x] Admin permissions are checked server-side against stored scope and is_super_admin.
- [x] Database schema and security migrations have been applied to the newly created Supabase project; RLS on boundaries, leaders, admin_profiles, and audit_logs was verified.
- [x] Follow-up migration makes v_active_leaders a security-invoker view and relocates RBAC helper functions to a non-exposed private schema.
- [x] Browser roles cannot read the leaders.phone_number column; only explicit, non-sensitive leader and boundary columns are granted.
- [x] Supabase URL, publishable key, preview URL, and default scope are configured for the `security/part-2-auth-hardening` preview branch.
- [x] The real `SUPABASE_SERVICE_ROLE_KEY` value is retained only on `security/part-2-auth-hardening`. The two unrelated Preview branch variables were changed to `placeholder-disabled`; the Vercel environment list shows no Production-target variable for this key.
- [x] Live Preview smoke tests passed via GitHub Actions: `GET /api/health` returned HTTP 200, unauthenticated `GET /api/leaders?scope_code=RW&reveal=true` returned HTTP 401, and unauthenticated `PATCH /api/leaders` returned HTTP 401.
- [x] Inactive-number reports now use a durable `inactive_number_reports` table. Browser roles have no table grants and an explicit deny-all RLS policy; list/resolve routes require a verified Supabase Auth super-admin.
- [ ] Create the first real Supabase Auth administrator and link the user to `admin_profiles` (verified count remains zero; no Auth identity was fabricated).
- [ ] With a real admin account available, test valid/invalid login, logout, non-admin rejection, cross-scope access, and authorized raw-phone reveal.
- [ ] Ask Supabase Support to move existing PostGIS into the non-exposed `extensions` schema using the approved in-place procedure in `SUPABASE_SUPPORT_REQUEST.md`. This project SQL role lacks permission to update `pg_extension`; verify spatial operations and rerun Security Advisor after Support completes the move.

## 2. AI and personal-data handling (current code)

- [x] The current `/api/ai-router` implementation performs deterministic lookups against the official NISR administrative-boundary service; it does not call Groq or another LLM.
- [x] The search query is used to look up administrative-place names; citizen GPS coordinates are not sent by this route.
- [x] Leader records are fetched server-side and phone numbers are masked before being returned.
- [ ] Groq/LLM privacy controls are not verified as an active feature because no LLM call exists in the current route. If an LLM is introduced later, test the prompt/tool implementation and data minimization before enabling it.

## 3. Phone Number Protection

- [x] maskPhone() is used on public API responses.
- [x] v_active_leaders excludes raw phone numbers and uses invoker permissions/RLS.
- [x] Public/authenticated browser roles do not have SELECT permission on leaders.phone_number.
- [x] Concurrent-edit (409) responses return only safe leader fields and never include the raw phone number.
- [x] The frontend shows masked numbers; the real tel: action follows explicit user interaction.
- [x] ?reveal=true requires a verified administrator and an allowed scope.

## 4. Row Level Security and database permissions

- [x] RLS enabled on boundaries, leaders, admin_profiles, audit_logs, and inactive_number_reports.
- [x] Table reads and writes are limited by grants and row policies; admin profile reads are limited to self/super-admin.
- [x] Scoped leader write policies compare a full scope code or a hyphen-delimited child scope, not a loose prefix.
- [x] RBAC helper functions are in the non-exposed private schema with a fixed search path.
- [x] set_updated_at() has a fixed search_path.
- [x] `audit_logs` is readable only by super-admins and direct inserts are denied.
- [x] `v_active_leaders` now has SELECT-only privileges for browser roles; the database check confirmed anonymous INSERT/UPDATE/DELETE are false for that view.
- [x] App-owned PostGIS routines were updated to include `extensions` in their fixed search path; the location-confidence function was smoke-tested against the empty database and returned successfully.
- [ ] Existing database: PostGIS remains installed in `public` (non-relocatable) and owns `public.spatial_ref_sys`; Supabase Advisor still reports RLS disabled and browser-role write grants. This is the extension-owned SRID reference table, not IWACU user data, but its exposed-schema placement should still be corrected. Enabling RLS or revoking grants is blocked by the managed owner. The documented in-place move failed with `permission denied for table pg_extension`. Do not force RLS or drop PostGIS with `CASCADE`; Supabase Support must run the approved move to preserve geometry columns, indexes, and `postgis_topology`.
- [ ] Security Advisor's `st_estimatedextent` SECURITY DEFINER warnings are extension-managed PostGIS functions in `public`. A `REVOKE EXECUTE` attempt did not change their ACLs because the objects are owned by `supabase_admin`; the application does not call these RPCs. Moving PostGIS into `extensions` is the supported remediation for this existing project.
- [x] The relocatable `ltree` extension was moved from `public` to `extensions` on 2026-10-29. The extension schema was verified and `calculate_location_confidence(30.06, -1.95, 20)` completed successfully afterward. PostGIS remains in `public` and still requires the supported Supabase Support move.

## 5. Optimistic Locking

- [x] version exists on leaders and boundaries.
- [x] PATCH validates the expected version and returns HTTP 409 on a conflict.
- [x] Leader deactivation is a soft delete with a version check.

## 6. Offline mode

- [x] API routes are network-only and are not written to the service-worker cache.
- [x] Offline mode is read-only.
- [ ] Confirm the final national boundary dataset and offline assets in the later data/GPS project stages.

## 7. Residual Risks / Future Work

- [x] Imported 14,823 official NISR 2022 village polygons into the live Supabase database and materialized 5 provinces, 30 districts, 416 sectors, 2,148 cells, and one Rwanda country boundary (17,423 total boundary rows). All 17,423 scope codes are unique; no geometries are empty; all 17,422 non-country rows have a parent link. A live PostGIS confidence query returned Gihanga/Vugizo with 51.79% / 48.21% for a test point. NISR warns that its source layer does not cover every gazetted village/area, so this must not be described as guaranteed 100% territorial coverage.
- [ ] Real leader records have not been imported; the `leaders` table remains empty. The persistent inactive-number report table exists but has no reports yet.
- Restrict the server-only key to the security preview, create a real admin user, and test authenticated admin routes.
- Add rate limiting on public geospatial/AI routes before public launch.
- Replace any placeholder offline village data with authoritative data before production use.

**Status (2026-10-29):** The inactive-number reports table and deny-all browser RLS policy are applied to Supabase; the security branch now persists citizen reports instead of returning mock-success responses. The NISR 2022 boundary dataset is imported and a location-confidence PostGIS smoke test passed. GitHub Actions passed on the prior report/schema commit; the latest country-root/schema adjustment is being checked. Remaining release blockers: create a genuine Auth super-admin, import verified leader records, ensure the Production-only environment configuration is correct, and have Supabase Support move PostGIS out of `public`. Production was not promoted. The health endpoint returned HTTP 200; unauthenticated raw-phone reveal and admin writes returned HTTP 401. Concurrent-edit responses now return only safe leader fields and exclude raw phone data. The `ltree` extension is in `extensions`, and the location-confidence smoke test still passes. The real service-role value is limited to the security branch; unrelated Preview variables are disabled and no Production-target variable exists in the Vercel environment list. Part 2 remains blocked by two owner/support actions: create and link the first Auth super-admin, and have Supabase Support move PostGIS safely from `public` to `extensions`. Security Advisor continues to report the extension-owned PostGIS findings. The support request is prepared but not submitted.
