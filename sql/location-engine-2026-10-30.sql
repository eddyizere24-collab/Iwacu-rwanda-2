-- IWACU RWANDA location engine hardening (2026-10-30)
-- This migration changes one public-boundary lookup function only.
-- No boundary rows are modified. Existing _bak_boundaries_geom and
-- _bak_boundaries_meta remain untouched.
--
-- Safety: run against buexgewxypvkqmphvfec only after reviewing this file.
-- The function runs as INVOKER and reads only publicly readable boundary
-- names/geometry; it returns no user, leader, phone, or admin data.

CREATE OR REPLACE FUNCTION public.calculate_location_confidence(
  p_lng double precision,
  p_lat double precision,
  p_accuracy_m double precision
)
RETURNS TABLE(
  scope_code text,
  name_kiny text,
  name_eng text,
  level public.boundary_level,
  confidence numeric,
  intersection_area_m2 double precision,
  path extensions.ltree
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
  WITH settings AS (
    SELECT LEAST(GREATEST(COALESCE(p_accuracy_m, 100), 1), 50000) AS accuracy_m
  ),
  point AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326) AS geom
  ),
  circle AS (
    SELECT
      ST_Buffer(point.geom::geography, settings.accuracy_m)::geometry AS geom,
      ST_Area(ST_Buffer(point.geom::geography, settings.accuracy_m)) AS area_m2,
      point.geom AS point_geom
    FROM point
    CROSS JOIN settings
  ),
  intersections AS (
    SELECT
      b.scope_code,
      b.name_kiny,
      b.name_eng,
      b.level,
      b.path,
      ST_Area(ST_Intersection(b.geom::geography, c.geom::geography)) AS inter_area_m2,
      c.area_m2 AS circle_area_m2
    FROM public.boundaries AS b
    CROSS JOIN circle AS c
    WHERE b.valid_to IS NULL
      AND b.level = 'village'
      AND b.geom IS NOT NULL
      AND ST_Intersects(b.geom, c.geom)
  ),
  ranked_intersections AS (
    SELECT
      i.*,
      ROW_NUMBER() OVER (ORDER BY i.inter_area_m2 DESC, i.scope_code) AS rn
    FROM intersections AS i
    WHERE i.inter_area_m2 > 0
  ),
  nearest AS (
    SELECT
      b.scope_code,
      b.name_kiny,
      b.name_eng,
      b.level,
      b.path,
      ST_Distance(b.geom::geography, c.point_geom::geography) AS distance_m
    FROM public.boundaries AS b
    CROSS JOIN circle AS c
    WHERE b.valid_to IS NULL
      AND b.level = 'village'
      AND b.geom IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ranked_intersections)
    ORDER BY b.geom <-> c.point_geom
    LIMIT 3
  ),
  nearest_scored AS (
    SELECT
      n.*,
      EXP(
        -n.distance_m / GREATEST(250.0, LEAST(GREATEST(COALESCE(p_accuracy_m, 100), 1), 50000))
      ) AS weight,
      SUM(
        EXP(-n.distance_m / GREATEST(250.0, LEAST(GREATEST(COALESCE(p_accuracy_m, 100), 1), 50000)))
      ) OVER () AS total_weight
    FROM nearest AS n
    WHERE n.distance_m <= LEAST(GREATEST(COALESCE(p_accuracy_m, 100) * 2, 1000.0), 50000.0)
  )
  SELECT
    ri.scope_code,
    ri.name_kiny,
    ri.name_eng,
    ri.level,
    ROUND(
      (
        LEAST(
          ri.inter_area_m2 / NULLIF(ri.circle_area_m2, 0),
          1.0
        ) * 100
      )::numeric,
      2
    ) AS confidence,
    ri.inter_area_m2 AS intersection_area_m2,
    ri.path
  FROM ranked_intersections AS ri
  WHERE ri.rn <= 5

  UNION ALL

  SELECT
    ns.scope_code,
    ns.name_kiny,
    ns.name_eng,
    ns.level,
    ROUND((100.0 * ns.weight / NULLIF(ns.total_weight, 0))::numeric, 2) AS confidence,
    0::double precision AS intersection_area_m2,
    ns.path
  FROM nearest_scored AS ns
  WHERE NOT EXISTS (SELECT 1 FROM ranked_intersections)
  ORDER BY confidence DESC;
$function$;

-- Public callers may read only official boundary geometry/path columns;
-- RLS still limits these reads to active public boundary rows.
GRANT SELECT (geom, path) ON TABLE public.boundaries TO anon, authenticated;

REVOKE ALL ON FUNCTION public.calculate_location_confidence(double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_location_confidence(double precision, double precision, double precision) TO anon, authenticated, service_role;
