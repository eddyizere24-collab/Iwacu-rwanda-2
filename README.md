# IWACU RWANDA

Civic technology platform that helps Rwandan citizens identify their likely administrative location and discover local leaders using GPS or manual place search, with confidence-ranked geospatial matching. Security controls are designed for review against applicable Rwanda data-protection requirements; this project has not received a legal compliance certification.

**Data readiness (2026-10-29)**: The live database contains 17,423 Rwanda-wide administrative boundary records, but the live leaders table is empty. Do not present the leader directory as complete or current until leader records have been imported from a trusted, verified source and checked. The repository's offline GeoJSON currently covers Gasabo only; nationwide offline support is not yet verified.

## Stack

- **Frontend**: Next.js 15 (App Router) · React 19 · Tailwind CSS · shadcn/ui · Lucide · Inter
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL + PostGIS)
- **Assistant/search route (current implementation)**: deterministic lookup against the official NISR administrative-boundary service; no Groq/LLM call is wired into `/api/ai-router` yet.
- **Offline**: Service Worker + Turf.js
- **Maps**: MapLibre GL

## Quick Start

```bash
cp .env.example .env.local
# Fill the Supabase variables described in DEPLOYMENT.md; Groq is not used by the current search route.

npm install
npm run dev
```

## Database

1. Create a Supabase project with PostGIS enabled.
2. Run `sql/schema.sql` in the SQL Editor.
3. For a fresh development database, ingest the boundary dataset supported by the current import tool. The live project already contains the verified national boundary dataset; do not rerun bulk ingestion there without a backup and a reviewed migration plan.
4. Seed/import leaders only from a trusted, verified source. Do not use fabricated names, roles, or phone numbers.

## Security Controls (subject to security and legal review)

- No citizen account is required for basic public lookups. This is not a guarantee of complete anonymity: review hosting/request logs, browser storage, geolocation handling, and the privacy notice before public launch.
- The current place-search route uses deterministic NISR lookup and does not send queries or citizen data to an LLM. Any future LLM integration requires a separate privacy review.
- Phone numbers are masked at the API layer and only become `tel:` links after explicit user action.
- Admin writes use optimistic locking (`version` column). Concurrent edits return HTTP 409 + diff.
- Server-side routes and RLS enforce scope-aware authorization; national scope is reserved for a verified super-admin.

## Geospatial Confidence Algorithm

1. Create a circular polygon from `(lat, lng, accuracy_m)` using `ST_Buffer` (geography).
2. Intersect with active ADM5 (village) polygons.
3. Compute intersection area / circle area → confidence percentage.
4. If multiple villages intersect → return ranked list (e.g. “60 % Village A, 40 % Village B”).
5. Propagate the same confidence ratios up the hierarchy (never force 100 %).
6. If max confidence < 5 % → `CONFIDENCE_TOO_LOW`.

Offline mode runs the location calculation with Turf.js against cached Gasabo GeoJSON. Nationwide offline behavior must not be claimed until the national assets are packaged and tested on real devices.

## Error States Implemented

GPS Denied · GPS Accuracy > 150 m · Outside Rwanda · Point in Gap · Point in Overlap · Confidence < 5 % · Missing Leader Contact · Network / 502 · 404 · Slow Network (skeleton) · Offline Cache · Browser Not Supported · Rate Limit · Concurrent Edit Conflict (409) · Leader Missing.

## Project Structure

See `FOLDER_STRUCTURE.md`.

## License

Proprietary — IWACU RWANDA project.
