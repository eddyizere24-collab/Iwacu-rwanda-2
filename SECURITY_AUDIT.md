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
- [x] `SUPABASE_SERVICE_ROLE_KEY` is present in that preview target according to the Vercel environment-variable screen; its runtime/database connectivity is not yet verified.
- [ ] Remove `SUPABASE_SERVICE_ROLE_KEY` from Production and the two unrelated Preview branches so it is restricted to the security preview until release approval.
- [ ] Create the first real Supabase Auth administrator and link the user to `admin_profiles` (the database currently has zero Auth users and zero admin profiles).
- [ ] Test login, logout, wrong password, non-admin user, cross-scope access, and raw-phone reveal against the configured preview deployment. The connected Vercel integration currently denies deployment access, so the preview health endpoint could not be checked from here.
- [ ] Request Supabase Support to move existing PostGIS (and, if possible, ltree) to the non-exposed `extensions` schema; verify spatial operations and rerun Security Advisor before declaring this database review clean.

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
- [ ] Existing database: PostGIS is installed in `public` (non-relocatable) and owns `public.spatial_ref_sys`; RLS is disabled and browser-role write grants remain. The connected SQL role is not the owner and cannot fix these directly. Do not attempt to force RLS or drop PostGIS with `CASCADE`. Supported remediation for a database with PostGIS columns: request that Supabase Support move PostGIS to the non-exposed `extensions` schema, then test spatial queries and rerun Security Advisor.
- [ ] Security Advisor's `st_estimatedextent` SECURITY DEFINER warnings are extension-managed PostGIS functions in `public`. A `REVOKE EXECUTE` attempt did not change their ACLs because the objects are owned by `supabase_admin`; the application does not call these RPCs. Moving PostGIS into `extensions` is the supported remediation for this existing project.
- [ ] The existing `ltree` extension is also in `public`. Fresh installs now place PostGIS and ltree in `extensions`, and app-owned spatial RPCs include `extensions` in their search path. Existing extension movement remains a managed-owner/support task.

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

**Status (2026-10-29):** The application hardening branch and database migrations are in place. Vercel reports the Preview build as Ready and the check for commit `cd2cf4e51826525c36519a010f5a5dc5ea35276e` is successful. Part 2 is not complete: the connected Vercel integration still cannot inspect this project's settings or protected runtime, the service-role secret's environment targets could not be restricted, no Auth administrator exists, and Security Advisor still reports the extension-owned `spatial_ref_sys` finding and PostGIS/ltree in `public`. The prepared Supabase Support request has not been submitted.
