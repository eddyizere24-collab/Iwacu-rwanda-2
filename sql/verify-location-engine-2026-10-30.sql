-- Read-only location-engine verification harness.
-- Run only after sql/location-engine-2026-10-30.sql is applied to project
-- buexgewxypvkqmphvfec. This query does not insert/update/delete rows.
-- Five deterministic village samples per district × four simulated GPS offsets.
WITH village_hierarchy AS (
  SELECT
    v.scope_code AS true_village,
    d.scope_code AS district_scope,
    v.geom
  FROM public.boundaries AS v
  JOIN public.boundaries AS c ON c.id = v.parent_id AND c.level = 'cell'
  JOIN public.boundaries AS s ON s.id = c.parent_id AND s.level = 'sector'
  JOIN public.boundaries AS d ON d.id = s.parent_id AND d.level = 'district'
  WHERE v.level = 'village'
    AND v.valid_to IS NULL
    AND c.valid_to IS NULL
    AND s.valid_to IS NULL
    AND d.valid_to IS NULL
    AND v.geom IS NOT NULL
),
sampled AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY district_scope ORDER BY md5(true_village)) AS sample_n
  FROM village_hierarchy
),
test_points AS (
  SELECT
    s.true_village,
    s.district_scope,
    offsets.noise_m,
    ST_Project(
      ST_PointOnSurface(s.geom)::geography,
      offsets.noise_m,
      radians((abs(hashtext(s.true_village || ':' || offsets.noise_m::text)::bigint) % 360)::double precision)
    )::geometry AS point_geom
  FROM sampled AS s
  CROSS JOIN LATERAL unnest(ARRAY[20, 100, 300, 1000]::double precision[]) AS offsets(noise_m)
  WHERE s.sample_n <= 5
),
predictions AS (
  SELECT
    t.*,
    p.top1_scope_code,
    p.candidate_scope_codes,
    p.top1_score
  FROM test_points AS t
  LEFT JOIN LATERAL (
    SELECT
      (array_agg(result.scope_code ORDER BY result.confidence DESC))[1] AS top1_scope_code,
      array_agg(result.scope_code ORDER BY result.confidence DESC) AS candidate_scope_codes,
      (array_agg(result.confidence ORDER BY result.confidence DESC))[1] AS top1_score
    FROM public.calculate_location_confidence(
      ST_X(t.point_geom),
      ST_Y(t.point_geom),
      t.noise_m
    ) AS result
  ) AS p ON TRUE
)
SELECT
  district_scope,
  noise_m,
  COUNT(*) AS samples,
  ROUND(100.0 * COUNT(*) FILTER (WHERE top1_scope_code = true_village) / COUNT(*), 2) AS top1_accuracy_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE true_village = ANY(candidate_scope_codes)) / COUNT(*), 2) AS top3_accuracy_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE candidate_scope_codes IS NULL) / COUNT(*), 2) AS no_answer_pct,
  ROUND(AVG(top1_score), 2) AS mean_top1_score_pct,
  ROUND(ABS(
    AVG(top1_score) -
    100.0 * COUNT(*) FILTER (WHERE top1_scope_code = true_village) / COUNT(*)
  ), 2) AS absolute_score_vs_hit_gap_pp
FROM predictions
GROUP BY district_scope, noise_m
ORDER BY district_scope, noise_m;

-- Gap/border diagnostic:
-- Finds points inside the national country polygon but not covered by any active
-- village polygon. This includes true boundary gaps and may include lake/shore
-- cells if they are represented that way in the official dataset.
WITH country AS (
  SELECT geom
  FROM public.boundaries
  WHERE level = 'country' AND valid_to IS NULL
  LIMIT 1
),
grid AS (
  SELECT
    ST_MakePoint(28.9 + (i % 100) * 0.02, -2.8 + ((i * 37) % 85) * 0.02) AS point_geom,
    i
  FROM generate_series(1, 1000) AS n(i)
),
gaps AS (
  SELECT g.point_geom, g.i
  FROM grid AS g
  CROSS JOIN country AS c
  WHERE ST_Covers(c.geom, g.point_geom)
    AND NOT EXISTS (
      SELECT 1 FROM public.boundaries AS v
      WHERE v.level = 'village'
        AND v.valid_to IS NULL
        AND v.geom IS NOT NULL
        AND ST_Covers(v.geom, g.point_geom)
    )
  ORDER BY g.i
  LIMIT 50
),
gap_predictions AS (
  SELECT
    g.i,
    p.scope_code AS candidate_scope_code,
    p.confidence,
    p.intersection_area_m2
  FROM gaps AS g
  LEFT JOIN LATERAL public.calculate_location_confidence(
    ST_X(g.point_geom), ST_Y(g.point_geom), 100
  ) AS p ON TRUE
)
SELECT
  COUNT(DISTINCT i) AS gap_points_tested,
  COUNT(DISTINCT i) FILTER (WHERE candidate_scope_code IS NOT NULL) AS points_with_candidate,
  COUNT(DISTINCT i) FILTER (WHERE candidate_scope_code IS NULL) AS points_without_candidate,
  COUNT(DISTINCT i) FILTER (WHERE candidate_scope_code IS NOT NULL AND intersection_area_m2 = 0) AS points_using_nearest_fallback
FROM gap_predictions;
