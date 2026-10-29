import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMockLeaders, toPublicLeader, addMockLeader, deleteMockLeader } from "@/lib/mock-data";
import { maskPhone } from "@/lib/security/mask";
import { requireAdminWrite } from "@/lib/security/admin-gate";
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
  whatsapp_number: z.string().optional(),
  email: z.string().email().nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  vision_priorities: z.string().nullable().optional(),
  office_hours: z.string().nullable().optional(),
  social_media: z.record(z.string()).nullable().optional(),
  admin_dossier: z.any().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scopeCode = searchParams.get("scope_code") || "RW";
    const reveal = searchParams.get("reveal") === "true";

    if (reveal) {
      const gate = requireAdminWrite(req);
      if (!gate.ok) {
        return NextResponse.json(gate.body, { status: gate.status });
      }
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          status: "error",
          message_kiny:
            "Ububiko bw'amakuru nyayo ntiburashyirwaho. Nta makuru y'abayobozi y'icyitegererezo agaragazwa nk'ayemejwe.",
          leaders: [],
        },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServiceClient();
    let query = supabase
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
      .is("valid_to", null);

    if (scopeCode !== "RW") {
      query = query.like("scope_code", `${scopeCode}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[leaders GET] database query failed:", error.message);
      return NextResponse.json(
        {
          status: "error",
          message_kiny: "Ntibyashobotse gusoma amakuru nyayo y'abayobozi. Ongera ugerageze nyuma.",
          leaders: [],
        },
        { status: 502 }
      );
    }

    const leaders: LeaderPublic[] = (data || []).map((row: Record<string, unknown>) => {
      const rawB = row.boundaries;
      const b = (Array.isArray(rawB) ? rawB[0] : rawB) as {
        name_kiny: string;
        name_eng: string | null;
        level: string;
      } | null;
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
        phone_raw: reveal ? (row.phone_number as string) : undefined,
      };
    });

    return NextResponse.json({ status: "success", leaders });
  } catch (err) {
    console.error("[leaders GET] unexpected error:", err);
    return NextResponse.json(
      {
        status: "error",
        message_kiny: "Serivisi y'amakuru y'abayobozi ntiyabonetse.",
        leaders: [],
      },
      { status: 502 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const gate = requireAdminWrite(req);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

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

    const {
      id,
      version,
      first_name,
      last_name,
      role,
      phone_number,
      whatsapp_number,
      email,
      photo_url,
      vision_priorities,
      office_hours,
      social_media,
      admin_dossier,
    } = parsed.data;

    if (!isSupabaseConfigured()) {
      const mockList = getMockLeaders();
      const existing = mockList.find((l) => l.id === id);

      if (!existing) {
        return NextResponse.json(
          { status: "error", message_kiny: "Umuyobozi ntabwo abonetse" },
          { status: 404 }
        );
      }

      if (existing.version !== version) {
        return NextResponse.json(
          {
            status: "conflict",
            conflict: {
              server_version: existing.version,
              your_version: version,
            },
          },
          { status: 409 }
        );
      }

      existing.first_name = first_name;
      existing.last_name = last_name;
      existing.role = role;
      if (phone_number !== undefined) existing.phone_number = phone_number;
      if (whatsapp_number !== undefined) existing.whatsapp_number = whatsapp_number;
      if (email !== undefined) existing.email = email;
      if (photo_url !== undefined) existing.photo_url = photo_url;
      if (vision_priorities !== undefined) existing.vision_priorities = vision_priorities;
      if (office_hours !== undefined) existing.office_hours = office_hours;
      if (social_media !== undefined) existing.social_media = social_media as Record<string, string>;
      if (admin_dossier !== undefined) existing.admin_dossier = admin_dossier;
      existing.version += 1;

      return NextResponse.json({
        status: "success",
        leader: toPublicLeader(existing, true),
      });
    }

    const supabase = createSupabaseServiceClient();

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
          },
        },
        { status: 409 }
      );
    }

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
    const b = (Array.isArray(rawUpdatedB) ? rawUpdatedB[0] : rawUpdatedB) as {
      name_kiny: string;
      name_eng: string | null;
      level: string;
    } | null;
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

const CreateLeaderSchema = z.object({
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
  phone_number: z.string().min(8),
  whatsapp_number: z.string().optional(),
  email: z.string().email().nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  scope_code: z.string().min(2),
  boundary_name_kiny: z.string().min(1),
  boundary_name_eng: z.string().optional(),
  level: z.string().min(1),
  is_verified: z.boolean().optional(),
  verified_by: z.string().optional(),
  vision_priorities: z.string().optional(),
  office_hours: z.string().optional(),
  social_media: z.record(z.string()).optional(),
  admin_dossier: z.any().optional(),
});

export async function POST(req: NextRequest) {
  const gate = requireAdminWrite(req);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

  try {
    const body = await req.json();
    const parsed = CreateLeaderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: "error", message_kiny: "Amakuru ntiyuzuye neza", errors: parsed.error.flatten() },
        { status: 422 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          status: "error",
          message_kiny:
            "Ububiko bw'amakuru ntiburashyirwaho. Ntihashobora gushyirwaho umuyobozi w'ukuri.",
        },
        { status: 503 }
      );
    }

    const created = addMockLeader({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      role: parsed.data.role,
      phone_number: parsed.data.phone_number,
      whatsapp_number: parsed.data.whatsapp_number || parsed.data.phone_number,
      email: parsed.data.email || null,
      photo_url: parsed.data.photo_url || null,
      scope_code: parsed.data.scope_code,
      boundary_name_kiny: parsed.data.boundary_name_kiny,
      boundary_name_eng: parsed.data.boundary_name_eng || parsed.data.boundary_name_kiny,
      level: parsed.data.level,
      is_verified: parsed.data.is_verified ?? true,
      verified_by: parsed.data.verified_by || "Urwego rw'Akarere",
      vision_priorities: parsed.data.vision_priorities || null,
      office_hours: parsed.data.office_hours || "Kuwa Mbere – Kuwa Gatanu: 08:00 – 17:00",
      social_media: parsed.data.social_media as Record<string, string> | undefined,
      admin_dossier: parsed.data.admin_dossier || null,
    });

    return NextResponse.json({
      status: "success",
      leader: toPublicLeader(created, true),
    });
  } catch (err) {
    console.error("[leaders POST] error:", err);
    return NextResponse.json(
      { status: "error", message_kiny: "Ikibazo cy'urukurikirane mu kubika." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const gate = requireAdminWrite(req);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { status: "error", message_kiny: "Shyiramo id y'umuyobozi" },
        { status: 400 }
      );
    }

    const removed = deleteMockLeader(id);
    if (!removed) {
      return NextResponse.json(
        { status: "error", message_kiny: "Umuyobozi ntabonetse" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "success",
      message_kiny: "Umuyobozi yakuwemo neza.",
    });
  } catch (err) {
    console.error("[leaders DELETE] error:", err);
    return NextResponse.json(
      { status: "error", message_kiny: "Ikibazo mu gukura umuyobozi." },
      { status: 500 }
    );
  }
}
