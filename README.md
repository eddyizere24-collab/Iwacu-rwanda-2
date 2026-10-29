# IWACU RWANDA

Civic technology platform that lets Rwandan citizens discover their exact administrative location and local leaders using GPS, IP, or manual search — with confidence-ranked geospatial matching and security controls designed for review against applicable Rwanda data-protection requirements. This project has not yet received a legal compliance certification.

**MVP Scope**: Gasabo District only.

## Stack

- **Frontend**: Next.js 15 (App Router) · React 19 · Tailwind CSS · shadcn/ui · Lucide · Inter
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL + PostGIS)
- **AI**: Groq (Function Calling only — Zero PII)
- **Offline**: Service Worker + Turf.js
- **Maps**: MapLibre GL

## Quick Start

```bash
cp .env.example .env.local
# Fill Supabase + Groq keys

npm install
npm run dev
```

## Database

1. Create a Supabase project with PostGIS enabled.
2. Run `sql/schema.sql` in the SQL Editor.
3. Ingest Gasabo boundaries: `npm run ingest:boundaries`
4. Seed leaders: `npm run seed:leaders`

## Security Controls (subject to security and legal review)

- Citizens are 100 % anonymous.
- Groq receives only natural-language queries and returns function-call intents. Zero personal or leader data ever reaches the LLM.
- Phone numbers are masked at the API layer and only become `tel:` links after explicit user action.
- Admin writes use optimistic locking (`version` column). Concurrent edits return HTTP 409 + diff.
- RLS enforces scope-prefix authorization for admins.

## Geospatial Confidence Algorithm

1. Create a circular polygon from `(lat, lng, accuracy_m)` using `ST_Buffer` (geography).
2. Intersect with active ADM5 (village) polygons.
3. Compute intersection area / circle area → confidence percentage.
4. If multiple villages intersect → return ranked list (e.g. “60 % Village A, 40 % Village B”).
5. Propagate the same confidence ratios up the hierarchy (never force 100 %).
6. If max confidence < 5 % → `CONFIDENCE_TOO_LOW`.

Offline mode performs the identical calculation with Turf.js against the cached Gasabo GeoJSON.

## Error States Implemented

GPS Denied · GPS Accuracy > 150 m · Outside Rwanda · Point in Gap · Point in Overlap · Confidence < 5 % · Missing Leader Contact · Network / 502 · 404 · Slow Network (skeleton) · Offline Cache · Browser Not Supported · Rate Limit · Concurrent Edit Conflict (409) · Leader Missing.

## Project Structure

See `FOLDER_STRUCTURE.md`.

## License

Proprietary — IWACU RWANDA project.
