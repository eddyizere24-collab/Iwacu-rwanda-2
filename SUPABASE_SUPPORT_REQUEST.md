# Supabase Support Request — Move PostGIS out of public

**Project ref:** `buexgewxypvkqmphvfec`  
**Region:** `eu-central-1` (Frankfurt)  
**PostGIS version:** `3.3.7`

Hello Supabase Support,

Please help move the existing PostGIS extension from the exposed `public` schema to the non-exposed `extensions` schema for this project, using your supported procedure for an existing database with PostGIS-dependent objects.

The project has PostGIS-dependent schema objects, including:
- `public.boundaries.geom` with type `geometry(MultiPolygon, 4326)`
- a generated area column that calls `ST_Area(...::geography)`
- spatial indexes and application-owned functions that use PostGIS

The extension-owned table `public.spatial_ref_sys` is owned by `supabase_admin`. The project SQL role cannot change its grants or enable RLS. Supabase Security Advisor currently flags the table and PostGIS SECURITY DEFINER functions in `public`.

**Please do not drop/recreate PostGIS with CASCADE.** We need the existing dependent objects preserved and working. The app-owned spatial functions have been prepared to include `extensions` in their search path. Please let us know when the move is complete and whether `ltree` can safely be moved to `extensions` as well.

After the change, we will verify the extension schema, run spatial-function smoke tests, and rerun Security Advisor.

Thank you.
