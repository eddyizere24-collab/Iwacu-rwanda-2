import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { requireAdminWrite } from "@/lib/security/admin-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReportSchema = z.object({
  leader_id: z.string().trim().min(1).max(100),
  leader_name: z.string().trim().min(1).max(160),
  reported_phone: z.string().trim().min(1).max(32),
  boundary_name: z.string().trim().min(1).max(200),
  citizen_comment: z.string().trim().max(300).optional(),
});

const ResolveSchema = z.object({
  report_id: z.string().uuid(),
  status: z.enum(["resolved", "dismissed"]).optional().default("resolved"),
});

const REPORT_FIELDS =
  "id, leader_id, leader_name, reported_phone, boundary_name, citizen_comment, status, created_at, resolved_at, resolved_by";

function databaseUnavailable() {
  return NextResponse.json(
    {
      status: "error",
      message_kiny:
        "Ububiko bw'amakuru ntibuhuza neza. Raporo ntiyabitswe; ongera ugerageze nyuma.",
    },
    { status: 503 }
  );
}

/** Citizens may submit a report. Reports are stored durably in Supabase. */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return databaseUnavailable();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message_kiny: "Imiterere y'amakuru yoherejwe ntabwo yemewe." },
      { status: 400 }
    );
  }

  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", message_kiny: "Amakuru ntiyuzuye neza." },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("inactive_number_reports")
      .insert({
        leader_id: parsed.data.leader_id,
        leader_name: parsed.data.leader_name,
        reported_phone: parsed.data.reported_phone,
        boundary_name: parsed.data.boundary_name,
        citizen_comment: parsed.data.citizen_comment || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error(
        "[report-number POST] database insert failed:",
        error?.message ?? "No report row returned"
      );
      return NextResponse.json(
        {
          status: "error",
          message_kiny:
            "Raporo ntiyabitswe. Ongera ugerageze nyuma.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        status: "success",
        message_kiny:
          "Murakoze! Raporo yabitswe kandi ishobora gusuzumwa n'umuyobozi ubifitiye uburenganzira.",
        report_id: data.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[report-number POST] unexpected database error:", error);
    return databaseUnavailable();
  }
}

/** Only a verified super-admin may read reports because they contain phone data. */
export async function GET(req: NextRequest) {
  const gate = await requireAdminWrite(req);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  if (!gate.admin.isSuperAdmin) {
    return NextResponse.json(
      {
        status: "error",
        message_kiny: "Raporo zishobora kurebwa n'umuyobozi mukuru wemewe gusa.",
      },
      { status: 403 }
    );
  }
  if (!isSupabaseConfigured()) return databaseUnavailable();

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("inactive_number_reports")
      .select(REPORT_FIELDS)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[report-number GET] database query failed:", error.message);
      return NextResponse.json(
        { status: "error", message_kiny: "Raporo ntizashoboye kuboneka." },
        { status: 502 }
      );
    }

    return NextResponse.json({ status: "success", reports: data ?? [] });
  } catch (error) {
    console.error("[report-number GET] unexpected database error:", error);
    return databaseUnavailable();
  }
}

/** Only a verified super-admin may resolve or dismiss a report. */
export async function PATCH(req: NextRequest) {
  const gate = await requireAdminWrite(req);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  if (!gate.admin.isSuperAdmin) {
    return NextResponse.json(
      {
        status: "error",
        message_kiny: "Raporo zishobora gukemurwa n'umuyobozi mukuru wemewe gusa.",
      },
      { status: 403 }
    );
  }
  if (!isSupabaseConfigured()) return databaseUnavailable();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message_kiny: "Imiterere y'amakuru yoherejwe ntabwo yemewe." },
      { status: 400 }
    );
  }

  const parsed = ResolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", message_kiny: "Shyiramo kode ya raporo yemewe." },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("inactive_number_reports")
      .update({
        status: parsed.data.status,
        resolved_at: new Date().toISOString(),
        resolved_by: gate.admin.userId,
      })
      .eq("id", parsed.data.report_id)
      .eq("status", "pending")
      .select("id, status, resolved_at")
      .maybeSingle();

    if (error) {
      console.error("[report-number PATCH] database update failed:", error.message);
      return NextResponse.json(
        { status: "error", message_kiny: "Raporo ntiyashoboye gukemurwa." },
        { status: 502 }
      );
    }

    if (!data) {
      const { data: existing, error: lookupError } = await supabase
        .from("inactive_number_reports")
        .select("id, status")
        .eq("id", parsed.data.report_id)
        .maybeSingle();

      if (lookupError) {
        console.error("[report-number PATCH] report lookup failed:", lookupError.message);
        return NextResponse.json(
          { status: "error", message_kiny: "Raporo ntiyashoboye kuboneka." },
          { status: 502 }
        );
      }
      if (!existing) {
        return NextResponse.json(
          { status: "error", message_kiny: "Raporo ntibonetse." },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          status: "error",
          message_kiny: "Iyi raporo yamaze gukemurwa cyangwa guhindurwa.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      status: "success",
      message_kiny:
        parsed.data.status === "dismissed"
          ? "Raporo yanzwe nyuma yo gusuzumwa."
          : "Raporo yakemuwe neza.",
      report_id: data.id,
      report_status: data.status,
    });
  } catch (error) {
    console.error("[report-number PATCH] unexpected database error:", error);
    return databaseUnavailable();
  }
}
