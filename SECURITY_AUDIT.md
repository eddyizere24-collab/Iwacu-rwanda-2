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
- [ ] Create the first real Supabase Auth administrator and link the user to `admin_profiles` (the database currently has zero Auth users and zero admin profiles).
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
- [x] The frontend shows masked numbers; the real tel: action follows explicit user interaction.
- [x] ?reveal=true requires a verified administrator and an allowed scope.

## 4. Row Level Security and database permissions

- [x] RLS enabled on boundaries, leaders, admin_profiles, and audit_logs.
- [x] Table reads and writes are limited by grants and row policies; admin profile reads are limited to self/super-admin.
- [x] Scoped leader write policies compare a full scope code or a hyphen-delimited child scope, not a loose prefix.
- [x] RBAC helper functions are in the non-exposed private schema with a fixed search path.
- [x] set_updated_at() has a fixed search_path.
- [x] `audit_logs` is readable only by super-admins and direct inserts are denied.
- [x] `v_active_leaders` now has SELECT-only privileges for browser roles; the database check confirmed anonymous INSERT/UPDATE/DELETE are false for that view.
- [x] App-owned PostGIS routines were updated to include `extensions` in their fixed search path; the location-confidence function was smoke-tested against the empty database and returned successfully.
- [ ] Existing database: PostGIS remains installed in `public` (non-relocatable) and owns `public.spatial_ref_sys`; Supabase Advisor reports RLS disabled and browser-role write grants. This is the extension-owned SRID reference table (8,500 standard coordinate-system rows), not IWACU user data, but the exposed-schema placement should still be corrected. Enabling RLS or revoking its grants is blocked by the managed owner. We attempted the documented in-place move from the project role, but it failed with `permission denied for table pg_extension`. Do not force RLS or drop PostGIS with `CASCADE`; Supabase Support must run the in-place move to preserve geometry columns, indexes, and `postgis_topology`.
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

- The new database is still empty: nationwide administrative boundaries and real leader records have not yet been imported. Those are later project stages.
- Restrict the server-only key to the security preview, create a real admin user, and test authenticated admin routes.
- Add rate limiting on public geospatial/AI routes before public launch.
- Replace any placeholder offline village data with authoritative data before production use.

**Status (2026-10-29):** TypeScript, security tests, production build, and live Preview smoke tests passed for the security branch. The live endpoint returned HTTP 200, while unauthenticated raw-phone reveal and admin writes both returned HTTP 401. The `ltree` extension was moved to `extensions`, and the location-confidence smoke test still passes. The real service-role value is limited to the security branch; unrelated preview variables were disabled and there is no Production-target variable in the Vercel environment list. Part 2 is not complete: no real Auth super-admin exists, and Supabase Support still needs to move PostGIS safely from `public` to `extensions`; Security Advisor continues to report the extension-owned PostGIS findings. The support request is prepared with the exact supported SQL, but has not been submitted.
