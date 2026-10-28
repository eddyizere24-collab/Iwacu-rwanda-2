import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { maskPhone } from "@/lib/security/mask";
import type { LeaderPublic, LeaderRole } from "@/types/leader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SearchSchema = z.object({
  query: z.string().trim().min(1).max(500),
});

const NISR_QUERY_URL =
  "https://gis-server.statistics.gov.rw/server/rest/services/Hosted/Village_Boundary_2022/FeatureServer/3/query";

type UnitLevel = "province" | "district" | "sector" | "cell" | "village";
type Attrs = Record<string, string | number | null | undefined>;
type NISRPayload = {
  features?: Array<{ attributes?: Attrs }>;
  error?: { message?: string; details?: string[] };
};

type OfficialUnit = {
  code: string;
  level: UnitLevel;
  name_kiny: string;
  name_eng: string;
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  provinceCode?: string;
  districtCode?: string;
  sectorCode?: string;
  cellCode?: string;
};

function value(attrs: Attrs, key: string): string {
  const actualKey = Object.keys(attrs).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  const raw = actualKey ? attrs[actualKey] : undefined;
  return raw === null || raw === undefined ? "" : String(raw).trim();
}

function provinceKiny(name: string): string {
  const normalized = name.toLowerCase().replace(/\s+/g, " ").trim();
  const names: Record<string, string> = {
    "kigali city": "Umujyi wa Kigali",
    "city of kigali": "Umujyi wa Kigali",
    "southern province": "Intara y'Amajyepfo",
    "western province": "Intara y'Iburengerazuba",
    "northern province": "Intara y'Amajyaruguru",
    "eastern province": "Intara y'Iburasirazuba",
  };
  return names[normalized] ?? name;
}

function codes(attrs: Attrs, level: UnitLevel) {
  const provinceId = value(attrs, "province_id");
  const districtId = value(attrs, "district_id");
  const sectorId = value(attrs, "sector_id");
  const cellId = value(attrs, "cell_id");
  const villageId = value(attrs, "village_id");

  if (!/^[1-5]$/.test(provinceId)) return null;
  if (level !== "province" && !/^\d{2}$/.test(districtId)) return null;
  if (["sector", "cell", "village"].includes(level) && !/^\d{4}$/.test(sectorId)) return null;
  if (["cell", "village"].includes(level) && !/^\d{6}$/.test(cellId)) return null;
  if (level === "village" && !/^\d{8}$/.test(villageId)) return null;

  const province = `RW-P${provinceId}`;
  const district = districtId ? `${province}-D${districtId}` : undefined;
  const sector = district && sectorId ? `${district}-S${sectorId}` : undefined;
  const cell = sector && cellId ? `${sector}-C${cellId}` : undefined;
  const village = cell && villageId ? `${cell}-V${villageId}` : undefined;
  return { province, district, sector, cell, village };
}

function searchTokens(query: string): string[] {
  const stopWords = new Set([
    "ninde", "nde", "ni", "muri", "kuri", "ku", "mu", "wa", "wo", "w", "ya", "ye",
    "ba", "aba", "iki", "ikiya", "iki", "uyu", "uyu", "bande", "ese", "ingahe",
    "umuyobozi", "abayobozi", "nkeneye", "amakuru", "telefone", "nomero", "wange",
    "wacu", "yacu", "yabo", "yawo", "nshaka", "menya", "mbwira", "ndifuza",
    "akarere", "umurenge", "akagari", "umudugudu", "meya", "gitifu", "uyobora",
    "uyoboye", "amakarita", "aho", "ndi", "ari", "ko", "reka", "kuvuga"
  ]);
  const normalized = query
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = normalized.split(" ").filter((token) =>
    token.length >= 3 && !stopWords.has(token) && !/^\d+$/.test(token)
  );
  return [...new Set(tokens.reverse())].slice(0, 3);
}

function preferredLevels(query: string): UnitLevel[] {
  const q = query.toLowerCase();
  if (q.includes("umudugudu") || q.includes("village")) return ["village", "cell", "sector", "district", "province"];
  if (q.includes("akagari") || q.includes("cell")) return ["cell", "village", "sector", "district", "province"];
  if (q.includes("umurenge") || q.includes("sector")) return ["sector", "cell", "village", "district", "province"];
  if (q.includes("akarere") || q.includes("district") || q.includes("meya")) return ["district", "sector", "cell", "village", "province"];
  if (q.includes("intara") || q.includes("province")) return ["province", "district", "sector", "cell", "village"];
  return ["village", "cell", "sector", "district", "province"];
}

function queryForLevel(level: UnitLevel, token: string): { where: string; fields: string } {
  const safe = token.replace(/'/g, "''");
  const like = `UPPER(${level}) LIKE UPPER('%${safe}%')`;
  const fields: Record<UnitLevel, string> = {
    province: "province_id,province",
    district: "province_id,province,district_id,district",
    sector: "province_id,province,district_id,district,sector_id,sector",
    cell: "province_id,province,district_id,district,sector_id,sector,cell_id,cell",
    village: "province_id,province,district_id,district,sector_id,sector,cell_id,cell,village_id,village",
  };
  return { where: like, fields: fields[level] };
}

async function findOfficialUnit(query: string): Promise<OfficialUnit | null> {
  const tokens = searchTokens(query);
  const levels = preferredLevels(query);
  if (!tokens.length) return null;

  for (const token of tokens) {
    for (const level of levels) {
      const q = queryForLevel(level, token);
      const params = new URLSearchParams({
        f: "json",
        where: q.where,
        outFields: q.fields,
        returnGeometry: "false",
        returnDistinctValues: "true",
        orderByFields: level === "province" ? "province_id ASC" :
          level === "district" ? "district_id ASC" :
          level === "sector" ? "sector_id ASC" :
          level === "cell" ? "cell_id ASC" : "village_id ASC",
        resultRecordCount: "10",
      });

      let response: Response;
      try {
        response = await fetch(NISR_QUERY_URL, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: params.toString(),
          cache: "no-store",
          signal: AbortSignal.timeout(7_000),
        });
      } catch {
        return null;
      }
      if (!response.ok) return null;

      let payload: NISRPayload;
      try {
        payload = (await response.json()) as NISRPayload;
      } catch {
        return null;
      }
      if (payload.error || !Array.isArray(payload.features) || payload.features.length === 0) continue;

      const attrs = payload.features[0]?.attributes;
      if (!attrs) continue;
      const adminCodes = codes(attrs, level);
      if (!adminCodes) continue;
      const nameField = level === "province" ? "province" :
        level === "district" ? "district" :
        level === "sector" ? "sector" :
        level === "cell" ? "cell" : "village";
      const name = value(attrs, nameField);
      if (!name) continue;

      const names = {
        province: provinceKiny(value(attrs, "province")),
        district: value(attrs, "district"),
        sector: value(attrs, "sector"),
        cell: value(attrs, "cell"),
        village: value(attrs, "village"),
      };
      const code = adminCodes[level];
      if (!code) continue;

      return {
        code,
        level,
        name_kiny: level === "province" ? provinceKiny(name) : name,
        name_eng: name,
        province: names.province,
        district: names.district,
        sector: names.sector,
        cell: names.cell,
        village: names.village,
        provinceCode: adminCodes.province,
        districtCode: adminCodes.district,
        sectorCode: adminCodes.sector,
        cellCode: adminCodes.cell,
      };
    }
  }
  return null;
}

async function fetchLeadersForUnit(unit: OfficialUnit): Promise<LeaderPublic[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServiceClient();
  const scopeCodes = [
    unit.code,
    unit.cellCode,
    unit.sectorCode,
    unit.districtCode,
    unit.provinceCode,
  ].filter((code): code is string => Boolean(code));

  const { data, error } = await supabase
    .from("leaders")
    .select(`
      id, scope_code, first_name, last_name, role, email, photo_url,
      phone_number, valid_from, valid_to, version,
      boundaries!inner ( name_kiny, name_eng, level )
    `)
    .in("scope_code", scopeCodes)
    .is("valid_to", null);

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => {
    const rawBoundary = row.boundaries;
    const boundary = (Array.isArray(rawBoundary) ? rawBoundary[0] : rawBoundary) as
      { name_kiny?: string; name_eng?: string | null; level?: string } | null;
    const phone = row.phone_number ? String(row.phone_number) : null;
    return {
      id: String(row.id),
      scope_code: String(row.scope_code),
      first_name: String(row.first_name),
      last_name: String(row.last_name),
      role: row.role as LeaderRole,
      email: row.email ? String(row.email) : null,
      photo_url: row.photo_url ? String(row.photo_url) : null,
      valid_from: String(row.valid_from),
      valid_to: row.valid_to ? String(row.valid_to) : null,
      version: Number(row.version ?? 1),
      boundary_name_kiny: boundary?.name_kiny ?? "",
      boundary_name_eng: boundary?.name_eng ?? null,
      level: boundary?.level ?? "",
      phone_masked: maskPhone(phone),
      phone_raw: undefined,
    } as LeaderPublic;
  });
}

function answerForUnit(unit: OfficialUnit, leaders: LeaderPublic[]) {
  const hierarchy = [
    unit.province && `Intara/Umujyi: ${unit.province}`,
    unit.district && `Akarere: ${unit.district}`,
    unit.sector && `Umurenge: ${unit.sector}`,
    unit.cell && `Akagari: ${unit.cell}`,
    unit.village && `Umudugudu: ${unit.village}`,
  ].filter(Boolean);

  if (leaders.length) {
    const names = leaders.slice(0, 5).map((leader) =>
      `${leader.first_name} ${leader.last_name} (${leader.role}) — ${leader.boundary_name_kiny}`
    );
    return `Twabonye amakuru y'ahantu washakaga. ${hierarchy.join("; ")}. Abayobozi bari muri sisitemu: ${names.join("; ")}.`;
  }
  return `Twabonye aho ushaka muri dosiye y'imbibi za NISR: ${hierarchy.join("; ")}. Ariko nta makuru y'umuyobozi yemejwe yabonetse muri sisitemu kuri ubu, bityo ntituzatanga amazina cyangwa nimero zitagenzuwe.`;
}

export async function POST(req: NextRequest) {
  let query = "";
  try {
    const parsed = SearchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({
        status: "error",
        message_kiny: "Andika izina ry'ahantu cyangwa ikibazo ushaka kubaza.",
      }, { status: 400 });
    }
    query = parsed.data.query;

    const unit = await findOfficialUnit(query);
    if (unit) {
      const leaders = await fetchLeadersForUnit(unit);
      const suggestions = unit.level === "province"
        ? [`Uturere tugize ${unit.name_kiny}`, `Abayobozi bo muri ${unit.name_kiny}`, "Menya aho ndi ukoresheje GPS"]
        : unit.level === "district"
          ? [`Imirenge igize Akarere ka ${unit.name_kiny}`, `Abayobozi bo muri ${unit.name_kiny}`, "Menya aho ndi ukoresheje GPS"]
          : unit.level === "sector"
            ? [`Utugari tugize Umurenge wa ${unit.name_kiny}`, `Abayobozi bo muri ${unit.name_kiny}`, "Menya aho ndi ukoresheje GPS"]
            : unit.level === "cell"
              ? [`Imidugudu iri muri ${unit.name_kiny}`, `Abayobozi bo muri ${unit.name_kiny}`, "Menya aho ndi ukoresheje GPS"]
              : [`Akagari ${unit.cell} ibarizwamo`, `Umurenge wa ${unit.sector}`, "Menya aho ndi ukoresheje GPS"];

      return NextResponse.json({
        status: "success",
        answer_kiny: answerForUnit(unit, leaders),
        matched_leaders: leaders,
        jurisdiction_info: {
          province: unit.province,
          district: unit.district,
          sector: unit.sector,
          cell: unit.cell,
          village: unit.village,
        },
        suggestions,
        source: "NISR Village Boundary 2022",
      });
    }

    // No official boundary name was matched. Avoid inventing leaders or places.
    return NextResponse.json({
      status: "success",
      answer_kiny: "Ntabwo twabonye izina ry'ahantu rihuye n'ibyo wanditse muri dosiye y'imbibi za NISR. Gerageza izina ry'umudugudu, akagari, umurenge, akarere cyangwa intara uko ryanditswe.",
      matched_leaders: [],
      suggestions: ["Menya aho ndi ukoresheje GPS", "Shakisha Akarere ka Gasabo", "Shakisha Umujyi wa Kigali"],
    });
  } catch (error) {
    console.error("[ai-router] error:", error);
    return NextResponse.json({
      status: "error",
      message_kiny: "Serivisi y'amakarita ntiyabonetse. Ongera ugerageze nyuma.",
    }, { status: 502 });
  }
}
