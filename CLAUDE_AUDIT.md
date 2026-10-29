# Claude audit pack — Iwacu-rwanda-2

**Purpose:** Independent verification of what Grok claimed vs what is actually in this repository and on the live site.

**Repo:** https://github.com/eddyizere24-collab/Iwacu-rwanda-2  
**Branch:** `main`  
**Live:** https://iwacu-rwanda-2-ahabona.vercel.app  

If this file is readable without GitHub login, the repo is **public**. If you still get 404, ask the owner to open: **Settings → General → Danger zone → Change visibility → Public**.

---

## A. Live checks (no GitHub needed)

```bash
curl -sL https://iwacu-rwanda-2-ahabona.vercel.app/api/health
curl -sL https://iwacu-rwanda-2-ahabona.vercel.app/api/emergency
curl -sL -X POST https://iwacu-rwanda-2-ahabona.vercel.app/api/leaders \
  -H 'content-type: application/json' -d '{}'
curl -sL https://iwacu-rwanda-2-ahabona.vercel.app/api/report-number
```

**Expected (honest):**
- `/api/health` → `status: "degraded"` until Supabase + `ADMIN_WRITE_TOKEN` are set on Vercel.
- `/api/emergency` → includes 112, 113, 912, **114, 116, 3512** (after latest deploy).
- `POST /api/leaders` without `x-iwacu-admin-token` → **401 or 503**.
- `GET /api/report-number` without token → **401 or 503**.
- `POST /api/report-number` may stay open for citizens (by design).

---

## B. Files Grok claims to have touched (read these)

| Claim | File |
|-------|------|
| Admin write gate | `src/lib/security/admin-gate.ts` |
| Leaders writes require token | `src/app/api/leaders/route.ts` |
| Health endpoint | `src/app/api/health/route.ts` |
| Administrative units (NISR) | `src/app/api/administrative-units/route.ts` |
| Locate (no Sample Village as success) | `src/app/api/locate/route.ts` |
| National boundary helper | `src/lib/national-boundaries.ts` |
| Emergency API + 114/116/3512 | `src/app/api/emergency/route.ts` |
| Emergency UI bar | `src/components/EmergencyBar.tsx` / `EmergencyStrip.tsx` |
| Report-number locked GET/PATCH | `src/app/api/report-number/route.ts` |
| ESLint apostrophe | `.eslintrc.json` |

**Recent commit subjects to list with `git log --oneline -20`:**  
`feat(D2)`, `fix: lock report-number`, `fix: repair corrupted administrative-units`, `feat: add /api/health`, `feat: server-side admin gate`, nationwide NISR commits, etc.

---

## C. What Grok does **not** claim is done

- Full national boundary dataset in Postgres/PostGIS (A1–A9)
- Real per-user Supabase Auth + scoped RLS (E1)
- Tests, CI, rate limits, backups (F1 full)
- Production-ready official leader data
- This repo is not automatically the only product root — also review `Iwacu-rwanda-` if that is the chosen main product

---

## D. Suggested Claude verdict format

1. Repo public? yes/no  
2. Health degraded? yes/no  
3. Each file in table B: present / missing / differs from claim  
4. Remaining gap list you still require  
5. Next implementation you will do on `main` (push complete files)
