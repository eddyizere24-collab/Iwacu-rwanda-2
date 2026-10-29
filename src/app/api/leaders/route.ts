import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, createSupabaseServiceClient } from "@/lib/supabase/server";
import { maskPhone } from "@/lib/security/mask";
import { adminCanManageScope, requireAdminWrite } from "@/lib/security/admin-gate";
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

    if (!/^RW(?:-[0-9A-Z]{2,})*$/.test(scopeCode)) {
      return NextResponse.json(
        { status: "error", message_kiny: "Kode y'aho ushaka ntabwo yemewe.", leaders: [] },
        { status: 400 }
      );
    }

    if (reveal) {
      const gate = await requireAdminWrite(req);
      if (!gate.ok) {
        return NextResponse.json(gate.body, { status: gate.status });
      }
      if (!adminCanManageScope(gate.admin, scopeCode)) {
        return NextResponse.json(
          { status: "error", message_kiny: "Nta burenganzira ufite bwo kubona nimero z'aho hantu." },
          { status: 403 }
        );
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
      query = query.or(`scope_code.eq.${scopeCode},scope_code.like.${scopeCode}-%`);
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
  const gate = await requireAdminWrite(req);
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
      return NextResponse.json(
        { status: "error", message_kiny: "Ububiko nyabwo ntibushyizweho. Guhindura amakuru byahagaritswe." },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServiceClient();

    // Read only the fields needed for authorization and optimistic locking.
    // In particular, never fetch or return the raw phone number in a conflict response.
    const { data: current, error: fetchErr } = await supabase
      .from("leaders")
      .select("id, scope_code, first_name, last_name, role, email, photo_url, valid_to, version")
      .eq("id", id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json(
        { status: "error", message_kiny: "Umuyobozi ntabwo abonetse" },
        { status: 404 }
      );
    }

    if (!adminCanManageScope(gate.admin, current.scope_code)) {
      return NextResponse.json(
        { status: "error", message_kiny: "Nta burenganzira ufite bwo guhindura amakuru y'uyu muyobozi." },
        { status: 403 }
      );
    }

    if (current.version !== version) {
      return NextResponse.json(
        {
          status: "conflict",
          conflict: {
            server_version: current.version,
            your_version: version,
            server_data: {
              first_name: current.first_name,
              last_name: current.last_name,
              role: current.role,
              email: current.email,
              photo_url: current.photo_url,
              version: current.version,
            },
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
      updated_by: gate.admin.userId,
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

    if (updateErr?.code === "PGRST116") {
      return NextResponse.json(
        {
          status: "conflict",
          message_kiny: "Amakuru yahindutse ahandi. Ongera ufungure uyu muyobozi mbere yo gukomeza.",
        },
        { status: 409 }
      );
    }

    if (updateErr || !updated) {
      console.error("[leaders PATCH] database update failed:", updateErr?.message);
      return NextResponse.json(
        { status: "error", message_kiny: "Guhindura byanze. Ongera ugerageze." },
        { status: 502 }
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
  const gate = await requireAdminWrite(req);
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

    if (!adminCanManageScope(gate.admin, parsed.data.scope_code)) {
      return NextResponse.json(
        { status: "error", message_kiny: "Nta burenganzira ufite bwo gushyiraho umuyobozi muri aka gace." },
        { status: 403 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { status: "error", message_kiny: "Ububiko nyabwo ntibushyizweho. Gushyiraho umuyobozi byahagaritswe." },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServiceClient();
    const { data: created, error: createError } = await supabase
      .from("leaders")
      .insert({
        scope_code: parsed.data.scope_code,
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        role: parsed.data.role,
        phone_number: parsed.data.phone_number,
        email: parsed.data.email || null,
        photo_url: parsed.data.photo_url || null,
        created_by: gate.admin.userId,
        updated_by: gate.admin.userId,
      })
      .select(`
        id, scope_code, first_name, last_name, role, email, photo_url,
        phone_number, valid_from, valid_to, version,
        boundaries!inner ( name_kiny, name_eng, level )
      `)
      .single();

    if (createError || !created) {
      console.error("[leaders POST] database insert failed:", createError?.message);
      return NextResponse.json(
        { status: "error", message_kiny: "Ntibyashobotse kubika umuyobozi. Reba ko aho hantu kari muri ububiko." },
        { status: 502 }
      );
    }

    const rawBoundary = created.boundaries;
    const boundary = (Array.isArray(rawBoundary) ? rawBoundary[0] : rawBoundary) as {
      name_kiny: string; name_eng: string | null; level: string;
    } | null;

    const leader: LeaderPublic = {
      id: created.id,
      scope_code: created.scope_code,
      first_name: created.first_name,
      last_name: created.last_name,
      role: created.role,
      email: created.email,
      photo_url: created.photo_url,
      valid_from: created.valid_from,
      valid_to: created.valid_to,
      version: created.version,
      boundary_name_kiny: boundary?.name_kiny ?? "",
      boundary_name_eng: boundary?.name_eng ?? null,
      level: boundary?.level ?? "",
      phone_masked: maskPhone(created.phone_number),
    };

    return NextResponse.json({ status: "success", leader }, { status: 201 });
  } catch (err) {
    console.error("[leaders POST] error:", err);
    return NextResponse.json(
      { status: "error", message_kiny: "Ikibazo cy'urukurikirane mu kubika." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdminWrite(req);
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

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { status: "error", message_kiny: "Ububiko nyabwo ntibushyizweho. Gukuraho umuyobozi byahagaritswe." },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServiceClient();
    const { data: current, error: fetchError } = await supabase
      .from("leaders")
      .select("id, scope_code, valid_to, version")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !current) {
      return NextResponse.json(
        { status: "error", message_kiny: "Umuyobozi ntabonetse." },
        { status: 404 }
      );
    }

    if (!adminCanManageScope(gate.admin, current.scope_code)) {
      return NextResponse.json(
        { status: "error", message_kiny: "Nta burenganzira ufite bwo gukuraho uyu muyobozi." },
        { status: 403 }
      );
    }

    if (current.valid_to) {
      return NextResponse.json(
        { status: "error", message_kiny: "Uyu muyobozi yamaze guhagarikwa." },
        { status: 409 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("leaders")
      .update({
        valid_to: new Date().toISOString(),
        updated_by: gate.admin.userId,
        version: current.version + 1,
      })
      .eq("id", id)
      .eq("version", current.version)
      .is("valid_to", null)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("[leaders DELETE] database update failed:", updateError.message);
      return NextResponse.json(
        { status: "error", message_kiny: "Ntibyashobotse guhagarika umuyobozi." },
        { status: 502 }
      );
    }
    if (!updated) {
      return NextResponse.json(
        { status: "error", message_kiny: "Amakuru yahindutse ahandi. Ongera ufungure uyu muyobozi mbere yo gukomeza." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      status: "success",
      message_kiny: "Umuyobozi yahagaritswe neza.",
    });
  } catch (err) {
    console.error("[leaders DELETE] error:", err);
    return NextResponse.json(
      { status: "error", message_kiny: "Ikibazo mu gukura umuyobozi." },
      { status: 500 }
    );
  }
}
