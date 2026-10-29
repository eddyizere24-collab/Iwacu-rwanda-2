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
- [x] Created and verified the first real Supabase Auth administrator on 2026-10-29: one Auth user is linked to one `admin_profiles` row with national scope `RW` and `is_super_admin=true`; the Auth email is confirmed. No credentials were read or exposed.
- [ ] With the owner's account, test successful/failed login and logout, non-admin rejection, cross-scope access, and authorized raw-phone reveal. CI verifies that unauthenticated requests are rejected, but does not replace a real interactive login test.
- [ ] Password-breach checking cannot be enabled on this project's current Free plan; Supabase documents it as available on Pro and above. The warning does not mean a password has leaked. To harden the Free setup, set a 12-character minimum and require lowercase, uppercase, digits, and symbols under Authentication → Sign In / Providers → Email. Revisit the paid breach-check feature before production if budget permits. [Supabase password security docs](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- [x] Revoked all direct table privileges from `PUBLIC`, `anon`, and `authenticated` on the two retained `_bak_boundaries_*` backup tables without deleting their 17,424 rows. RLS remains enabled with no policies, so the Security Advisor continues to show informational no-policy/no-primary-key notices for these backups.
- [x] Added an index for `inactive_number_reports.resolved_by`; the live Performance Advisor no longer reports an unindexed foreign key.

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
- [x] App-owned PostGIS routines use a fixed search path that includes `extensions`; the location-confidence function was verified against the imported national boundary dataset.
- [x] PostGIS and ltree are installed in the non-exposed `extensions` schema. Live checks confirmed `extensions.spatial_ref_sys` exists and PostGIS coordinate transforms and location-confidence checks still work.
- [ ] The three extension-owned `extensions.st_estimatedextent` overloads still inherit `PUBLIC EXECUTE` in their ACLs; attempts to revoke this from the project SQL role did not alter the ACL because the functions are owned by `supabase_admin`. The application does not call these functions, and the Security Advisor no longer reports them in `public`. Confirm the extension schema is not exposed through the REST API; seek Supabase Support guidance before modifying extension-owned privileges.
- [x] `postgis_topology` is not installed in the current project and is intentionally omitted from the fresh-install schema because application code uses core PostGIS only.

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

**Status (2026-10-29):** The NISR 2022 boundary dataset is imported (17,423 boundary rows); live PostGIS and ltree are in `extensions`, and coordinate-transform/location-confidence smoke tests pass. One linked, email-confirmed national Super Admin profile exists. The latest code changes correct the fresh-install migration order and remove an unused PostGIS topology extension. GitHub Actions passed on the current reviewed branch head `3ff6b299e696d17c02206c978fd7063880512df2`: TypeScript typecheck, security authorization tests, production build, and Preview API smoke tests all succeeded. Unauthenticated raw-phone reveal/admin writes have returned HTTP 401 in Preview smoke tests; the health endpoint returned HTTP 200. Remaining release blockers: real interactive admin login/logout and scope testing, setting the strongest available password requirements on Free or upgrading for leaked-password checks, importing verified leader records, verifying Production environment variables, and reviewing extension-owned function ACLs. Backup data is preserved and browser-role privileges have been revoked. Production was not promoted; the pull request remains open.
