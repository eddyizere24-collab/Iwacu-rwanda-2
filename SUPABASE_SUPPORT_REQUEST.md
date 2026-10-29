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
- the installed `postgis_topology` extension in the `topology` schema, which depends on PostGIS

The extension-owned table `public.spatial_ref_sys` is owned by `supabase_admin`. The project SQL role cannot change its grants or enable RLS. Supabase Security Advisor currently flags the table and PostGIS SECURITY DEFINER functions in `public`.

**Please do not drop/recreate PostGIS with CASCADE.** We need the existing dependent objects preserved and working. The app-owned spatial functions have been prepared to include `extensions` in their search path. `ltree` has already been moved into `extensions` by the project SQL role, and the schema placement and location-confidence routine were verified afterward. Please move PostGIS safely while preserving its dependent `postgis_topology` extension, spatial types/columns, indexes, views, and application-owned functions.

After the change, we will verify the extension schema, run spatial-function smoke tests, and rerun Security Advisor.

### Requested operator procedure (official Supabase-supported in-place move)

The installed version is `3.3.7` and the available transition version `3.3.7next` is present. Our project role is `postgres`, not a superuser/member of `supabase_admin`; trying this procedure from the project role fails with permission denied on `pg_extension`. Please run the supported procedure as the appropriate managed operator:

```sql
BEGIN;
UPDATE pg_extension
   SET extrelocatable = true
 WHERE extname = 'postgis';

ALTER EXTENSION postgis SET SCHEMA extensions;
ALTER EXTENSION postgis UPDATE TO "3.3.7next";
ALTER EXTENSION postgis UPDATE;

UPDATE pg_extension
   SET extrelocatable = false
 WHERE extname = 'postgis';
COMMIT;
```

Please preserve the `postgis_topology` extension and all dependent objects. Once complete, we will verify the extension schema and rerun the location-confidence smoke test and Security Advisor.

Thank you.
