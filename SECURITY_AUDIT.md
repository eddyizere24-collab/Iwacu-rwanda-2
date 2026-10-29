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
- [x] Vercel environment variables for Supabase URL, publishable key, preview URL, and default scope are configured for the security/part-2-auth-hardening preview branch only.
- [ ] Add the server-only SUPABASE_SERVICE_ROLE_KEY to that Vercel preview environment. Never commit it or place it in a NEXT_PUBLIC_* variable.
- [ ] Create the first real Supabase Auth administrator and link the user to admin_profiles.
- [ ] Test login, logout, wrong password, non-admin user, cross-scope access, and raw-phone reveal against the configured preview deployment.
- [ ] Resolve the remaining Supabase Security Advisor finding for public.spatial_ref_sys using an explicit RLS policy decision before declaring the database security review clean.

## 2. Zero PII to LLM (Groq)

- [x] /api/ai-router sends only the natural-language query string and optional context_scope_code.
- [x] The system prompt forbids personal data.
- [x] Groq is limited to function calling; leader records and phone numbers are fetched by the backend.
- [x] Citizen GPS coordinates, names, and phone numbers are not included in prompts.

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
- [x] audit_logs is readable only by super-admins and direct inserts are denied.
- [ ] public.spatial_ref_sys still has RLS disabled. Supabase Security Advisor marks this as a critical issue. Do not enable RLS without first selecting an explicit policy; the proposed read-only public policy is documented in the deployment notes.
- [ ] Supabase Security Advisor still reports extension-managed PostGIS st_estimatedextent SECURITY DEFINER overloads in public; this application does not call those RPCs. The current database role cannot revoke the extension owner's grants, so these remain a separate platform-level hardening item.
- [ ] Supabase Security Advisor reports that PostGIS and ltree extensions live in public; moving extension schemas needs a separate compatibility review.

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
- Add the server-only key and a real admin user before testing authenticated admin routes.
- Add rate limiting on public geospatial/AI routes before public launch.
- Replace any placeholder offline village data with authoritative data before production use.

**Status:** The code hardening and database migrations are in place, but Part 2 is not fully verified against the running preview until the server-only key and admin account are configured and the remaining spatial_ref_sys policy decision is resolved.
