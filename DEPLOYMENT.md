# IWACU RWANDA — Deployment Guide (MVP)

This guide is written for a non-technical operator. Follow every step in order.

---

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in (or create an account).
2. Click **New Project**.
3. Choose an organisation, give the project a name (e.g. `iwacu-rwanda`), set a strong database password, and pick a region close to Rwanda (e.g. Frankfurt or Cape Town if available).
4. Wait until the project status is **Active**.
5. In the left sidebar open **Project Settings → API**.
   - Copy the **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`.
   - Copy the **anon public** key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Copy the **service_role** key (keep it secret) → this is `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Enable required extensions & run the schema

1. In the Supabase dashboard open **SQL Editor**.
2. Click **New query**.
3. Open the file `sql/schema.sql` from this repository.
4. Copy **the entire contents** and paste them into the SQL Editor.
5. Click **Run** (or press Ctrl/Cmd + Enter).
6. Confirm there are no red error messages. You should see “Success”.

The script creates:
- PostGIS, uuid-ossp, pgcrypto, ltree extensions
- Tables: `boundaries`, `leaders`, `admin_profiles`, `audit_logs`
- GiST indexes, RLS policies, views, and helper functions

For an **existing** database, run `sql/security-hardening-migration.sql` after confirming the base schema is present. Do not rerun the entire base schema over an existing database.

---

## 3. Create the first Super Admin

Still in the SQL Editor, run (replace the values):

```sql
-- 1. First create the auth user via Supabase Authentication → Users → Add user
--    (use the email and password the admin will use for Supabase Auth)

-- 2. Then link the profile (replace USER_UUID and names)
INSERT INTO admin_profiles (user_id, full_name, scope_code, is_super_admin)
VALUES (
  'USER_UUID_FROM_AUTH_USERS',  -- copy from Authentication → Users
  'Admin Name',
  'RW-01',                      -- Gasabo district prefix for MVP
  true
);
```

---

## 4. Configure environment variables locally

1. In the project root copy the example file:

```bash
cp .env.example .env.local
```

2. Open `.env.local` and fill in the values you copied from Supabase, plus a Groq key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # NEVER commit this
GROQ_API_KEY=gsk_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_DISTRICT_SCOPE=RW-01
```

3. Get a free Groq API key at [https://console.groq.com](https://console.groq.com).

---

## 5. Install dependencies & run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).  
You should see the hero page with the button **Menya aho ndi**.

---

## 6. Download and ingest nationwide official village boundaries

The project uses the NISR Village Boundary 2022 public layer. Downloading the source is automated; do not create approximate polygons by hand.

1. Apply the updated `sql/schema.sql` in Supabase SQL Editor before importing. It defines the batch ingest RPC used for nationwide data.
2. Ensure `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
3. Run:

```bash
npm run ingest:national-boundaries
```

This downloads the available village polygon dataset to `public/offline/rwanda-village-boundaries.geojson`, validates the download, then imports the village polygons in batches. PostGIS also aggregates parent cell, sector and district polygons from the official village shapes. The import can be rerun safely.

**Important source limitation:** NISR describes 14,816 mapped villages out of 14,837 gazetted villages and states that some Lake Kivu area is excluded from geographic coverage. The app must not claim 100% completeness or invent a village when no official polygon matches. The source is from 2022, so recent administrative changes still need official verification.

The full GeoJSON is generated locally, not automatically committed to GitHub by the script. To include offline map lookup in an offline deployment, include the generated file in that deployment's public assets; online lookup uses the NISR service directly when PostGIS has no matching record.

## 7. Seed a few leaders (optional for testing)

You can insert test leaders directly in the SQL Editor:

```sql
INSERT INTO leaders (scope_code, first_name, last_name, role, phone_number, email)
VALUES
  ('RW-01-01-01-001', 'Jean', 'Uwimana', 'Village Leader', '+250788123456', 'jean@example.rw');
```

---

## 8. Deploy to Vercel via GitHub

1. Create a new GitHub repository (private recommended).
2. Push this project:

```bash
git init
git add .
git commit -m "IWACU RWANDA MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/iwacu-rwanda.git
git push -u origin main
```

3. Go to [https://vercel.com](https://vercel.com) → **Add New Project** → Import the GitHub repo.
4. In the Vercel project settings → **Environment Variables**, add the same keys you used in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GROQ_API_KEY`
   - `NEXT_PUBLIC_APP_URL` = `https://your-project.vercel.app`
   - `NEXT_PUBLIC_DEFAULT_DISTRICT_SCOPE` = `RW-01`
5. Click **Deploy**.
6. After the first deploy succeeds, open the site and test:
   - GPS locate
   - Admin login (magic link)
   - Offline mode (Chrome DevTools → Network → Offline)

---

## 9. Post-deploy checklist

- [ ] Public page loads and “Menya aho ndi” works
- [ ] GPS permission prompt appears
- [ ] Confidence percentages are shown
- [ ] Leader cards show masked phone numbers
- [ ] Admin can log in with Supabase email + password after Auth is configured
- [ ] Admin can edit a leader and sees version numbers
- [ ] Concurrent edit returns 409 with diff (test with two browsers)
- [ ] Service Worker registers (Application tab → Service Workers)
- [ ] Offline mode shows cached Gasabo data or a clear offline message

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| “Missing SUPABASE_SERVICE_ROLE_KEY” | Add the variable in Vercel + redeploy |
| RLS blocks admin | Confirm the user exists in `admin_profiles` with correct `scope_code` |
| Geometry errors on ingest | Ensure source GeoJSON is WGS84; the RPC runs `ST_MakeValid` |
| Admin login says Auth is not configured | Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy |
| Groq 401 | Verify `GROQ_API_KEY` is correct and has credits |

---

**Deployment is not complete until the checklist above passes against the configured live database.**
