import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NISR_QUERY_URL =
  "https://gis-server.statistics.gov.rw/server/rest/services/Hosted/Village_Boundary_2022/FeatureServer/3/query";

const QuerySchema = z.object({
  level: z.enum(["province", "district", "sector", "cell", "village"]),
  parent_code: z.string().max(100).optional(),
});

type NISRAttributes = Record<string, string | number | null | undefined>;
type NISRFeature = { attributes?: NISRAttributes };
type NISRResponse = {
  features?: NISRFeature[];
  error?: { message?: string; details?: string[] };
};

export interface AdministrativeUnitOption {
  code: string;
  name_kiny: string;
  name_eng: string;
  level: "province" | "district" | "sector" | "cell" | "village";
  parent_code?: string;
}

const PROVINCE_KINY: Record<string, string> = {
  "1": "Umujyi wa Kigali",
  "2": "Intara y'Amajyepfo",
  "3": "Intara y'Iburengerazuba",
  "4": "Intara y'Amajyaruguru",
  "5": "Intara y'Iburasirazuba",
};

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function parentFilter(
  level: string,
  parentCode: string
): { where: string; parentCode: string } | null {
  if (level === "district") {
    if (!parentCode) return { where: "1=1", parentCode: "" };
    const match = /^RW-P([1-5])$/.exec(parentCode);
    if (!match) return null;
    return { where: "province_id = '" + match[1] + "'", parentCode };
  }
  if (level === "sector") {
    const match = /^(RW-P[1-5]-D(\d{2}))$/.exec(parentCode);
    if (!match) return null;
    return { where: "district_id = '" + match[2] + "'", parentCode };
  }
  if (level === "cell") {
    const match = /^(RW-P[1-5]-D\d{2}-S(\d{4}))$/.exec(parentCode);
    if (!match) return null;
    return { where: "sector_id = '" + match[2] + "'", parentCode };
  }
  if (level === "village") {
    const match = /^(RW-P[1-5]-D\d{2}-S\d{4}-C(\d{6}))$/.exec(parentCode);
    if (!match) return null;
    return { where: "cell_id = '" + match[2] + "'", parentCode };
  }
  return { where: "1=1", parentCode: "" };
}

function codeForRecord(
  level: string,
  attrs: NISRAttributes,
  parentCode: string
): string | null {
  if (level === "province") {
    const id = text(attrs.province_id);
    return /^[1-5]$/.test(id) ? "RW-P" + id : null;
  }

  const idField: Record<string, string> = {
    district: "district_id",
    sector: "sector_id",
    cell: "cell_id",
    village: "village_id",
  };
  const expectedLength: Record<string, number> = {
    district: 2,
    sector: 4,
    cell: 6,
    village: 8,
  };

  const id = text(attrs[idField[level]]);
  const len = expectedLength[level];
  if (!id || id.length !== len || !/^\d+$/.test(id)) return null;

  if (level === "district" && !parentCode) {
    const provinceId = text(attrs.province_id);
    return /^[1-5]$/.test(provinceId) ? "RW-P" + provinceId + "-D" + id : null;
  }

  const prefix =
    level === "district"
      ? "D"
      : level === "sector"
        ? "S"
        : level === "cell"
          ? "C"
          : "V";
  return parentCode + "-" + prefix + id;
}

function nameFields(level: string): { field: string; idField: string } {
  const values: Record<string, { field: string; idField: string }> = {
    province: { field: "province", idField: "province_id" },
    district: { field: "district", idField: "district_id" },
    sector: { field: "sector", idField: "sector_id" },
    cell: { field: "cell", idField: "cell_id" },
    village: { field: "village", idField: "village_id" },
  };
  return values[level];
}

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    level: req.nextUrl.searchParams.get("level"),
    parent_code: req.nextUrl.searchParams.get("parent_code") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        message_kiny:
          "Urwego rw'ubuyobozi cyangwa kode y'urwego rubanziriza ntiyemewe.",
      },
      { status: 400 }
    );
  }

  const { level, parent_code: requestedParent = "" } = parsed.data;

  if (level === "province") {
    const units: AdministrativeUnitOption[] = Object.entries(PROVINCE_KINY).map(
      ([id, name]) => ({
        code: "RW-P" + id,
        name_kiny: name,
        name_eng: id === "1" ? "Kigali City" : name,
        level: "province" as const,
      })
    );
    return NextResponse.json({
      status: "success",
      source: "NISR Village Boundary 2022",
      source_year: 2022,
      units,
    });
  }

  const filter = parentFilter(level, requestedParent);
  if (!filter) {
    return NextResponse.json(
      {
        status: "error",
        message_kiny: "Kode y'aho uhera ushaka urutonde ntiyemewe.",
      },
      { status: 400 }
    );
  }

  const fields = nameFields(level);
  const params = new URLSearchParams({
    f: "json",
    where: filter.where,
    outFields:
      fields.idField +
      "," +
      fields.field +
      ",province_id,province,district_id,district,sector_id,sector,cell_id,cell,village_id,village",
    returnGeometry: "false",
    returnDistinctValues: "true",
    orderByFields: fields.idField + " ASC",
    resultRecordCount: "2000",
  });

  let response: Response;
  try {
    response = await fetch(NISR_QUERY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: params.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        message_kiny:
          "Serivisi y'amakarita ya NISR ntiyabonetse. Ongera ugerageze nyuma.",
      },
      { status: 502 }
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        status: "error",
        message_kiny: "Serivisi y'amakarita yanze gusubiza ibisabwa.",
      },
      { status: 502 }
    );
  }

  let payload: NISRResponse;
  try {
    payload = (await response.json()) as NISRResponse;
  } catch {
    return NextResponse.json(
      {
        status: "error",
        message_kiny: "Amakuru y'amakarita yagarutse adasomeka.",
      },
      { status: 502 }
    );
  }

  if (payload.error || !Array.isArray(payload.features)) {
    return NextResponse.json(
      {
        status: "error",
        message_kiny: payload.error?.message ?? "Amakuru y'ubuyobozi ntabonetse.",
      },
      { status: 502 }
    );
  }

  const units: AdministrativeUnitOption[] = [];
  const seen = new Set<string>();

  for (const feature of payload.features) {
    const attrs = feature.attributes ?? {};
    const name = text(attrs[fields.field]);
    const code = codeForRecord(level, attrs, filter.parentCode);
    if (!name || !code || seen.has(code)) continue;
    seen.add(code);

    const provinceName = text(attrs.province);
    const mappedKiny =
      level === "province"
        ? PROVINCE_KINY[text(attrs.province_id)] ?? provinceName
        : name;

    const unitParent =
      level === "district" && !filter.parentCode
        ? "RW-P" + text(attrs.province_id)
        : filter.parentCode;

    units.push({
      code,
      name_kiny: mappedKiny,
      name_eng: name,
      level,
      parent_code: unitParent || undefined,
    });
  }

  return NextResponse.json({
    status: "success",
    source: "NISR Village Boundary 2022",
    source_year: 2022,
    units,
  });
}
