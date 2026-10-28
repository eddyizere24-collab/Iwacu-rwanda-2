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

---

## 3. Create the first Super Admin

Still in the SQL Editor, run (replace the values):

```sql
-- 1. First create the auth user via Supabase Authentication → Users → Add user
--    (use the email the admin will log in with, set a temporary password or use magic link later)

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

## 6. Ingest Gasabo boundary data

1. Obtain the official Gasabo ADM5 (Village) GeoJSON from REMA / RLMUA.
2. Make sure each feature has at least:
   - `scope_code` (e.g. `RW-01-01-01-001`)
   - `name_kiny`
   - `level` = `"village"` (or ADM5)
3. Run:

```bash
npx tsx scripts/ingest-boundaries.ts ./path/to/gasabo-adm5.geojson
```

4. Check the console summary (Inserted / Skipped / Errors).
5. Optionally copy a simplified version of the same GeoJSON to:

```
public/offline/gasabo-boundaries.geojson
```

so the Service Worker can cache it for offline use.

---

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
- [ ] Admin can log in with magic link
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
| Magic link does not arrive | Check Supabase Auth → Email templates and spam folder |
| Groq 401 | Verify `GROQ_API_KEY` is correct and has credits |

---

**You are done.** The MVP is live.
