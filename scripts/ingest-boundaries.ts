/**
 * IWACU RWANDA — Boundary Ingest Script
 *
 * Ingests a GeoJSON (or Shapefile converted to GeoJSON) of Gasabo ADM5
 * villages into Supabase/PostGIS.
 *
 * Usage:
 *   npx tsx scripts/ingest-boundaries.ts ./path/to/gasabo-adm5.geojson
 *
 * Requirements:
 *   - SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env
 *   - GeoJSON must be WGS84 (EPSG:4326) or will be transformed
 *   - Features must carry properties: scope_code, name_kiny, name_eng?, level, path?
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GeoJSONFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: unknown;
  };
}

interface GeoJSONCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildPath(scopeCode: string): string {
  // RW-01-01-01-001 → RW.01.01.01.001
  return scopeCode.replace(/-/g, ".");
}

function normaliseLevel(raw: unknown): string {
  const v = String(raw ?? "village").toLowerCase();
  const map: Record<string, string> = {
    adm5: "village",
    village: "village",
    umudugudu: "village",
    adm4: "cell",
    cell: "cell",
    akagari: "cell",
    adm3: "sector",
    sector: "sector",
    umurenge: "sector",
    adm2: "district",
    district: "district",
    akarere: "district",
  };
  return map[v] ?? "village";
}

/**
 * Convert a GeoJSON geometry object into a WKT string for PostGIS.
 * We send WKT over the wire and let PostGIS parse + validate it.
 */
function geometryToWkt(geom: GeoJSONFeature["geometry"]): string {
  if (geom.type === "Polygon") {
    const rings = geom.coordinates as number[][][];
    const ringStrs = rings.map(
      (ring) =>
        "(" +
        ring.map((c) => `${c[0]} ${c[1]}`).join(", ") +
        ")"
    );
    return `POLYGON(${ringStrs.join(", ")})`;
  }

  if (geom.type === "MultiPolygon") {
    const polys = geom.coordinates as number[][][][];
    const polyStrs = polys.map((poly) => {
      const ringStrs = poly.map(
        (ring) =>
          "(" +
          ring.map((c) => `${c[0]} ${c[1]}`).join(", ") +
          ")"
      );
      return "(" + ringStrs.join(", ") + ")";
    });
    return `MULTIPOLYGON(${polyStrs.join(", ")})`;
  }

  throw new Error(`Unsupported geometry type: ${(geom as { type: string }).type}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(
      "Usage: npx tsx scripts/ingest-boundaries.ts <path-to-geojson>"
    );
    process.exit(1);
  }

  const abs = resolve(filePath);
  console.log(`Reading ${abs}...`);

  let collection: GeoJSONCollection;
  try {
    const raw = readFileSync(abs, "utf-8");
    collection = JSON.parse(raw) as GeoJSONCollection;
  } catch (err) {
    console.error("Failed to read/parse GeoJSON:", err);
    process.exit(1);
  }

  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    console.error("Invalid GeoJSON: expected FeatureCollection");
    process.exit(1);
  }

  console.log(`Found ${collection.features.length} features`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < collection.features.length; i += BATCH_SIZE) {
    const batch = collection.features.slice(i, i + BATCH_SIZE);

    for (const feature of batch) {
      const props = feature.properties ?? {};

      const scopeCode = String(
        props.scope_code ?? props.SCOPE_CODE ?? props.code ?? ""
      ).trim();

      if (!scopeCode || !scopeCode.startsWith("RW")) {
        console.warn(
          `  [skip] Missing/invalid scope_code on feature ${i}: ${JSON.stringify(props).slice(0, 80)}`
        );
        skipped++;
        continue;
      }

      const nameKiny = String(
        props.name_kiny ?? props.NAME_KINY ?? props.name ?? props.NAME ?? scopeCode
      ).trim();

      const nameEng = props.name_eng
        ? String(props.name_eng)
        : props.NAME_ENG
          ? String(props.NAME_ENG)
          : null;

      const level = normaliseLevel(props.level ?? props.LEVEL ?? props.ADM_LEVEL);
      const path = props.path
        ? String(props.path)
        : buildPath(scopeCode);

      let wkt: string;
      try {
        wkt = geometryToWkt(feature.geometry);
      } catch (err) {
        console.warn(`  [skip] Bad geometry for ${scopeCode}:`, err);
        skipped++;
        continue;
      }

      // Use a raw RPC / SQL via the service client to apply ST_MakeValid + ST_Transform
      // We insert via a helper SQL expression so PostGIS cleans the geometry.
      const { error } = await supabase.rpc("ingest_boundary_feature", {
        p_scope_code: scopeCode,
        p_path: path,
        p_name_kiny: nameKiny,
        p_name_eng: nameEng,
        p_level: level,
        p_wkt: wkt,
      }).maybeSingle();

      // Fallback if the RPC does not exist yet: direct insert with ST_GeomFromText
      if (error && error.message.includes("function") && error.message.includes("does not exist")) {
        const { error: insertErr } = await supabase
          .from("boundaries")
          .upsert(
            {
              scope_code: scopeCode,
              path,
              name_kiny: nameKiny,
              name_eng: nameEng,
              level,
              // PostgREST cannot call ST_MakeValid directly on a column value easily,
              // so we store the WKT and rely on a DB trigger / manual fix.
              // For production, create the RPC below.
              geom: wkt as unknown, // will fail type-check; use RPC in real deploy
            },
            { onConflict: "scope_code" }
          );

        if (insertErr) {
          console.error(`  [error] ${scopeCode}:`, insertErr.message);
          errors++;
          continue;
        }
      } else if (error) {
        console.error(`  [error] ${scopeCode}:`, error.message);
        errors++;
        continue;
      }

      inserted++;
      if (inserted % 25 === 0) {
        console.log(`  … ${inserted} inserted`);
      }
    }
  }

  console.log("\n── Summary ──");
  console.log(`  Inserted / upserted : ${inserted}`);
  console.log(`  Skipped             : ${skipped}`);
  console.log(`  Errors              : ${errors}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
