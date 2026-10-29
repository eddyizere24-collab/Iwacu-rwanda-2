# Supabase Support Request Template — Existing PostGIS in public

> **Current-project status (checked 2026-10-29): Do not send this request for IWACU RWANDA's current Supabase project.** Live SQL confirms PostGIS 3.3.7, `spatial_ref_sys`, and `ltree` are in the non-exposed `extensions` schema. Spatial smoke tests pass. This template is retained only for a separate project whose PostGIS extension is still installed in `public`.

Replace the placeholders below only after confirming the target project's current extension schema and object dependencies. Do not paste this request unchanged for another project.

---

**Target project ref:** `<PROJECT_REF>`  
**Region:** `<PROJECT_REGION>`  
**PostGIS version:** `<POSTGIS_VERSION>`

Hello Supabase Support,

For the project above, our read-only database checks confirm that PostGIS is still installed in the exposed `public` schema and that `public.spatial_ref_sys` is owned by a managed role that the project SQL role cannot administer.

Please review the project's current extension and dependency state and, if supported, perform the safe in-place relocation of PostGIS to the non-exposed `extensions` schema using Supabase's approved operator procedure.

Please preserve all existing geometry/geography columns, generated columns, indexes, views, triggers, application-owned functions, and any extensions that actually depend on PostGIS. Do not drop/recreate PostGIS with `CASCADE`, and do not instruct us to force RLS on an extension-owned `spatial_ref_sys` table if the project role lacks the required permissions.

Before closing the request, please confirm:
1. The final schema of PostGIS and `spatial_ref_sys`.
2. Whether any dependent extensions or objects required special handling.
3. Whether any extension-owned function privileges remain exposed and the supported way to restrict them.

We will then verify the extension locations, run spatial-function smoke tests, and rerun Security Advisor.

Thank you.
