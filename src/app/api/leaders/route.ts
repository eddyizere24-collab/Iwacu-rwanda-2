import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMockLeaders, toPublicLeader } from "@/lib/mock-data";
import { maskPhone } from "@/lib/security/mask";
import type { LeaderPublic } from "@/types/leader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchLeaderSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: z.enum([
    "Village Leader",
    "Cell Executive Secretary",
    "Sector Executive Secretary",
    "Mayor",
    "Vice Mayor",
    "District Executive Secretary",
    "Other",
  ]),
  phone_number: z.string().optional(),
  email: z.string().email().nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scopeCode = searchParams.get("scope_code") || "RW-01";
    const reveal = searchParams.get("reveal") === "true";

    if (!isSupabaseConfigured()) {
      const records = getMockLeaders().filter((l) =>
        l.scope_code.startsWith(scopeCode)
      );

      const leaders: LeaderPublic[] = records.map((l) => {
        const pub = toPublicLeader(l);
        if (reveal && l.phone_number) {
          // If admin requested reveal, provide full phone
          (pub as LeaderPublic & { phone_number?: string }).phone_number = l.phone_number;
        }
        return pub;
      });

      return NextResponse.json({ status: "success", leaders });
    }

    const supabase = createSupabaseServiceClient();
    const query = supabase
      .from("leaders")
      .select(
        `
        id,
        scope_code,
        first_name,
        last_name,
        role,
        email,
        photo_url,
        phone_number,
        valid_from,
        valid_to,
        version,
        boundaries!inner ( name_kiny, name_eng, level )
      `
      )
      .like("scope_code", `${scopeCode}%`)
      .is("valid_to", null);

    const { data, error } = await query;
    if (error) {
      console.warn("[leaders GET] DB error — falling back to mock data:", error.message);
      const records = getMockLeaders().filter((l) =>
        l.scope_code.startsWith(scopeCode)
      );
      const fallbackLeaders: LeaderPublic[] = records.map((l) => {
        const pub = toPublicLeader(l);
        if (reveal && l.phone_number) {
          (pub as LeaderPublic & { phone_number?: string }).phone_number = l.phone_number;
        }
        return pub;
      });
      return NextResponse.json({ status: "success", leaders: fallbackLeaders });
    }

    const leaders: LeaderPublic[] = (data || []).map((row: Record<string, unknown>) => {
      const rawB = row.boundaries;
      const b = (Array.isArray(rawB) ? rawB[0] : rawB) as { name_kiny: string; name_eng: string | null; level: string } | null;
      return {
        id: row.id as string,
        scope_code: row.scope_code as string,
        first_name: row.first_name as string,
        last_name: row.last_name as string,
        role: row.role as LeaderPublic["role"],
        email: (row.email as string) ?? null,
        photo_url: (row.photo_url as string) ?? null,
        valid_from: row.valid_from as string,
        valid_to: (row.valid_to as string) ?? null,
        version: row.version as number,
        boundary_name_kiny: b?.name_kiny ?? "",
        boundary_name_eng: b?.name_eng ?? null,
        level: b?.level ?? "",
        phone_masked: maskPhone(row.phone_number as string | null),
      };
    });

    return NextResponse.json({ status: "success", leaders });
  } catch (err) {
    console.warn("[leaders GET] Exception caught — falling back to mock data:", err);
    const records = getMockLeaders();
    return NextResponse.json({
      status: "success",
      leaders: records.map(toPublicLeader),
    });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { status: "error", message_kiny: "Imiterere ya JSON ntabwo yemewe" },
        { status: 400 }
      );
    }

    const parsed = PatchLeaderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message_kiny: "Amakuru watanze ntabwo yuzuye neza",
          errors: parsed.error.flatten(),
        },
        { status: 422 }
      );
    }

    const { id, version, first_name, last_name, role, phone_number, email, photo_url } =
      parsed.data;

    if (!isSupabaseConfigured()) {
      const mockList = getMockLeaders();
      const existing = mockList.find((l) => l.id === id);

      if (!existing) {
        return NextResponse.json(
          { status: "error", message_kiny: "Umuyobozi ntabwo abonetse" },
          { status: 404 }
        );
      }

      // Optimistic Locking Check: 409 Conflict if versions do not match
      if (existing.version !== version) {
        return NextResponse.json(
          {
            status: "conflict",
            conflict: {
              server_version: existing.version,
              your_version: version,
              server_data: {
                first_name: existing.first_name,
                last_name: existing.last_name,
                role: existing.role,
                email: existing.email,
                photo_url: existing.photo_url,
              },
              your_data: {
                first_name,
                last_name,
                role,
                email,
                photo_url,
              },
            },
          },
          { status: 409 }
        );
      }

      // Update record and increment version
      existing.first_name = first_name;
      existing.last_name = last_name;
      existing.role = role;
      if (phone_number !== undefined) existing.phone_number = phone_number;
      if (email !== undefined) existing.email = email;
      if (photo_url !== undefined) existing.photo_url = photo_url;
      existing.version += 1;

      return NextResponse.json({
        status: "success",
        leader: toPublicLeader(existing),
      });
    }

    // Supabase DB path
    const supabase = createSupabaseServiceClient();

    // 1. Fetch current version to test optimistic lock
    const { data: current, error: fetchErr } = await supabase
      .from("leaders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json(
        { status: "error", message_kiny: "Umuyobozi ntabwo abonetse" },
        { status: 404 }
      );
    }

    if (current.version !== version) {
      return NextResponse.json(
        {
          status: "conflict",
          conflict: {
            server_version: current.version,
            your_version: version,
            server_data: current,
            your_data: parsed.data,
          },
        },
        { status: 409 }
      );
    }

    // 2. Perform update with incremented version
    const updatePayload: Record<string, unknown> = {
      first_name,
      last_name,
      role,
      version: current.version + 1,
      updated_at: new Date().toISOString(),
    };
    if (phone_number !== undefined) updatePayload.phone_number = phone_number;
    if (email !== undefined) updatePayload.email = email;
    if (photo_url !== undefined) updatePayload.photo_url = photo_url;

    const { data: updated, error: updateErr } = await supabase
      .from("leaders")
      .update(updatePayload)
      .eq("id", id)
      .eq("version", version)
      .select(
        `
        id,
        scope_code,
        first_name,
        last_name,
        role,
        email,
        photo_url,
        phone_number,
        valid_from,
        valid_to,
        version,
        boundaries!inner ( name_kiny, name_eng, level )
      `
      )
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { status: "error", message_kiny: "Guhindura byanze. Ongera ugerageze." },
        { status: 500 }
      );
    }

    const rawUpdatedB = (updated as Record<string, unknown>).boundaries;
    const b = (Array.isArray(rawUpdatedB) ? rawUpdatedB[0] : rawUpdatedB) as { name_kiny: string; name_eng: string | null; level: string } | null;
    const leaderPublic: LeaderPublic = {
      id: updated.id,
      scope_code: updated.scope_code,
      first_name: updated.first_name,
      last_name: updated.last_name,
      role: updated.role,
      email: updated.email,
      photo_url: updated.photo_url,
      valid_from: updated.valid_from,
      valid_to: updated.valid_to,
      version: updated.version,
      boundary_name_kiny: b?.name_kiny ?? "",
      boundary_name_eng: b?.name_eng ?? null,
      level: b?.level ?? "",
      phone_masked: maskPhone(updated.phone_number),
    };

    return NextResponse.json({ status: "success", leader: leaderPublic });
  } catch (err) {
    console.error("[leaders PATCH] error:", err);
    return NextResponse.json(
      { status: "error", message_kiny: "Ikibazo cy'urukurikirane" },
      { status: 500 }
    );
  }
}
