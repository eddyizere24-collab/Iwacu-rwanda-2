import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabasePublicClient, isSupabasePublicConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEVELS = ["province", "district", "sector", "cell", "village"] as const;
type UnitLevel = (typeof LEVELS)[number];
const PARENT_LEVEL: Record<Exclude<UnitLevel, "province">, UnitLevel> = {
  district: "province",
  sector: "district",
  cell: "sector",
  village: "cell",
};

const QuerySchema = z.object({
  level: z.enum(LEVELS),
  parent_id: z.string().max(100).optional(),
});

type UnitRow = {
  scope_code: string;
  name_kiny: string;
  name_eng: string | null;
  level: UnitLevel;
};

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    level: req.nextUrl.searchParams.get("level"),
    parent_id: req.nextUrl.searchParams.get("parent_id") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", message_kiny: "Urwego cyangwa parent_id si byo." },
      { status: 400 }
    );
  }

  const { level, parent_id: parentId } = parsed.data;
  if (level === "province" && parentId) {
    return NextResponse.json(
      { status: "error", message_kiny: "Intara ntigira urwego ruyibanziriza." },
      { status: 400 }
    );
  }
  if (level !== "province") {
    if (!parentId || !/^RW(?:-[0-9A-Z]+)+$/.test(parentId)) {
      return NextResponse.json(
        { status: "error", message_kiny: "Hitamo urwego rubanziriza kugira ngo ukomeze." },
        { status: 400 }
      );
    }
    const expectedParent = PARENT_LEVEL[level];
    const parentParts = parentId.split("-");
    const parentLevel = parentParts.length === 2 ? "province"
      : parentParts.length === 3 ? "district"
      : parentParts.length === 4 ? "sector"
      : parentParts.length === 5 ? "cell"
      : "unknown";
    if (parentLevel !== expectedParent) {
      return NextResponse.json(
        { status: "error", message_kiny: "Parent_id ntabwo ihuye n'urwego wahisemo." },
        { status: 400 }
      );
    }
  }

  if (!isSupabasePublicConfigured()) {
    return NextResponse.json(
      { status: "error", message_kiny: "Urutonde rw'ubuyobozi ntirubonetse ubu." },
      { status: 503 }
    );
  }

  const supabase = createSupabasePublicClient();
  let query = supabase.from("boundaries")
    .select("scope_code, name_kiny, name_eng, level")
    .eq("level", level)
    .is("valid_to", null)
    .order("scope_code", { ascending: true })
    .limit(level === "village" ? 3000 : 1000);

  if (parentId) query = query.like("scope_code", parentId + "-%");

  const { data, error } = await query;
  if (error) {
    console.error("[administrative-units] database query failed:", error.message);
    return NextResponse.json(
      { status: "error", message_kiny: "Ntitwashoboye kubona urutonde rw'ahantu." },
      { status: 503 }
    );
  }

  // The Country row is intentionally never part of the citizen's picker.
  const units = (data ?? [])
    .filter((row) => row.level !== "country")
    .map((row) => ({
      code: row.scope_code,
      name_kiny: row.name_kiny,
      name_eng: row.name_eng,
      level: row.level,
      parent_id: parentId ?? null,
    }));

  let breadcrumbs: UnitRow[] = [];
  if (parentId) {
    const parts = parentId.split("-");
    const ancestorIds = parts.slice(1).map((_, index) => parts.slice(0, index + 2).join("-"));
    if (ancestorIds.length > 0) {
      const breadcrumbResult = await supabase.from("boundaries")
        .select("scope_code, name_kiny, name_eng, level")
        .in("scope_code", ancestorIds)
        .is("valid_to", null)
        .order("scope_code", { ascending: true });
      if (!breadcrumbResult.error) {
        breadcrumbs = (breadcrumbResult.data ?? []).filter((row) => row.level !== "country") as UnitRow[];
      }
    }
  }

  return NextResponse.json({
    status: "success",
    source: "supabase-boundaries",
    level,
    parent_id: parentId ?? null,
    breadcrumbs,
    units,
  }, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=1800" },
  });
}
