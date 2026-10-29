# IWACU RWANDA — Security Audit Checklist (MVP)

Date: 2026-10-23  
Standard: NCSA Law No. 058/2021 + internal zero-PII policy

## 1. Zero PII to LLM (Groq)

- [x] `/api/ai-router` sends **only** the natural-language query string (+ optional `context_scope_code`).
- [x] System prompt explicitly forbids personal data.
- [x] Groq is limited to Function Calling (`get_leader_by_scope`, `get_location_hint`).
- [x] Leader data and phone numbers are fetched **after** the function call, by the backend, and never returned as free-form AI text.
- [x] No citizen GPS coordinates, names, or phones are included in any prompt.

## 2. Phone Number Protection

- [x] `maskPhone()` applied on every public API response (`/api/locate`, `/api/leaders`, `/api/ai-router`).
- [x] Raw `phone_number` column is never selected into public views (`v_active_leaders` excludes it).
- [x] Frontend `LeaderCard` shows masked value only.
- [x] Real `tel:` link is generated only after an **explicit user gesture** (“Hamagara”).
- [x] Admin `?reveal=true` is gated by authenticated admin + matching `scope_code` prefix.

## 3. Row Level Security (RLS)

- [x] RLS enabled on `boundaries`, `leaders`, `admin_profiles`, `audit_logs`.
- [x] Browser roles cannot directly read base tables; public leader data is available through server APIs and the phone-free `v_active_leaders` view.
- [x] Admin writes restricted by server-side auth/profile checks and hierarchical scope match (or `is_super_admin`).
- [x] `audit_logs` readable only by super-admins; direct INSERT blocked.
- [x] Service-role client used only on the server for geospatial RPCs and elevated admin operations.

## 4. Optimistic Locking

- [x] `version` column on `leaders` and `boundaries`.
- [x] PATCH requires matching `version`; mismatch → HTTP 409 + server/client diff.
- [x] UI surfaces the conflict and lets the admin choose resolution path.

## 5. Service Worker (Offline)

- [x] Caches only static shell + Gasabo boundary GeoJSON.
- [x] API routes (`/api/*`) are **network-only** — never cached.
- [x] Offline mode is **read-only** (confidence via Turf.js; no writes).
- [x] No personal or leader data is stored in the Cache API.

## 6. Authentication & Session

- [x] Public citizen features do not require a citizen login.
- [x] Admin login calls Supabase Auth `signInWithPassword`; the typed email/password is not accepted as proof by itself.
- [x] The dashboard checks the signed-in Supabase user and reads the matching `admin_profiles` row before showing admin data.
- [x] Server-side admin APIs independently validate the Supabase cookie session and database admin profile.
- [x] Local storage is used only for the selected dashboard view; it is not used as server-side proof of identity.
- [x] Leader writes and raw-phone reveal check the admin's stored scope on the server.
- [x] Report listing/resolution is restricted to super-admins until reports store a canonical scope code.
- [ ] Configure Supabase Auth + database environment variables in Vercel and provision real admin users.
- [ ] Apply `sql/security-hardening-migration.sql` to the existing Supabase database.
- [ ] Test login, logout, wrong password, non-admin user, cross-scope access, and raw-phone reveal against the configured live database.

**Important:** The live health endpoint was checked during the security review and returned `degraded`; Supabase Auth and database environment variables were missing. Admin operations therefore fail closed until deployment configuration is completed. Code passing a local build does not prove the live database policies have been applied.

## 7. Additional Hardening

- [x] No exact Rwanda flag hex codes (brand uses Tailwind blue-600 / green-600).
- [x] Environment secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`) never exposed to the browser.
- [x] `.env.example` documents required variables without real secrets.
- [x] Admin routes set `robots: noindex`.

## Residual Risks / Future Work

- Rate limiting on `/api/locate` and `/api/ai-router` should be added at the edge (Vercel / Cloudflare) before public launch.
- PWA icons (`public/icons/icon-192.png`, `icon-512.png`) must be supplied before store submission.
- Real Gasabo ADM5 GeoJSON must replace the placeholder before production use.
- Consider column-level encryption for `leaders.phone_number` at rest (Supabase pgsodium / Vault) for higher assurance.
