import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabasePublicClient, isSupabasePublicConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  level: z.enum(["province", "district", "sector", "cell", "village"]),
  parent_id: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
});

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    level: req.nextUrl.searchParams.get("level"),
    parent_id: req.nextUrl.searchParams.get("parent_id") || undefined,
    q: req.nextUrl.searchParams.get("q") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({
      status: "error",
      message_kiny: "Urwego cyangwa aho utangirira gushaka ntibyemewe.",
    }, { status: 400 });
  }

  const { level, parent_id: parentId, q } = parsed.data;
  if (level !== "province" && !parentId) {
    return NextResponse.json({
      status: "error",
      message_kiny: "Hitamo urwego rubanziriza mbere yo gufungura urutonde.",
    }, { status: 400 });
  }
  if (!isSupabasePublicConfigured()) {
    return NextResponse.json({
      status: "unavailable",
      message_kiny: "Urutonde rw'ubuyobozi ntirubashije gufunguka. Reba ibyo telefone yari yarabitse.",
      units: [],
    }, { status: 503 });
  }

  let query = createSupabasePublicClient()
    .from("boundaries")
    .select("id, scope_code, name_kiny, name_eng, level, parent_id")
    .eq("level", level)
    .is("valid_to", null)
    .order("name_kiny", { ascending: true })
    .limit(2_000);

  // Filtering by level excludes the country row; root always starts with the
  // five province records from the database, never a hand-maintained list.
  if (level !== "province" && parentId) query = query.eq("parent_id", parentId);
  if (q) query = query.ilike("name_kiny", "%" + q + "%");

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({
      status: "unavailable",
      message_kiny: "Urutonde ntirwashoboye gusomwa muri database.",
      units: [],
    }, { status: 503 });
  }

  const units = (data ?? []).map((row) => ({
    id: row.id,
    code: row.scope_code,
    scope_code: row.scope_code,
    name_kiny: row.name_kiny,
    name_eng: row.name_eng,
    level: row.level,
    parent_id: row.parent_id,
  }));

  return NextResponse.json({
    status: "success",
    source: "Supabase boundaries",
    units,
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
