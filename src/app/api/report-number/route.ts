import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMockInactiveReports, addMockInactiveReport, resolveMockInactiveReport } from "@/lib/mock-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReportSchema = z.object({
  leader_id: z.string().min(1),
  leader_name: z.string().min(1),
  reported_phone: z.string().min(1),
  boundary_name: z.string().min(1),
  citizen_comment: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: "error", message_kiny: "Amakuru ntiyuzuye neza" },
        { status: 400 }
      );
    }

    const report = addMockInactiveReport({
      leader_id: parsed.data.leader_id,
      leader_name: parsed.data.leader_name,
      reported_phone: parsed.data.reported_phone,
      boundary_name: parsed.data.boundary_name,
      citizen_comment: parsed.data.citizen_comment,
    });

    return NextResponse.json({
      status: "success",
      message_kiny: "Murakoze! Raporo yanyu yohererejwe ubuyobozi bw'Akarere n'Umurenge kugira ngo bayisuzume.",
      report,
    });
  } catch (err) {
    console.error("[report-number POST] error:", err);
    return NextResponse.json(
      { status: "error", message_kiny: "Ikibazo mu kohereza raporo." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const reports = getMockInactiveReports();
    return NextResponse.json({
      status: "success",
      reports,
    });
  } catch (err) {
    console.error("[report-number GET] error:", err);
    return NextResponse.json(
      { status: "error", message_kiny: "Ikibazo mu gushaka raporo." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { report_id } = body;
    if (!report_id) {
      return NextResponse.json({ status: "error", message_kiny: "Shyiramo id ya raporo" }, { status: 400 });
    }

    const resolved = resolveMockInactiveReport(report_id);
    if (!resolved) {
      return NextResponse.json({ status: "error", message_kiny: "Raporo ntibonetse" }, { status: 404 });
    }

    return NextResponse.json({
      status: "success",
      message_kiny: "Raporo yakemuwe neza.",
    });
  } catch (err) {
    console.error("[report-number PATCH] error:", err);
    return NextResponse.json(
      { status: "error", message_kiny: "Ikibazo mu gukemura raporo." },
      { status: 500 }
    );
  }
}
