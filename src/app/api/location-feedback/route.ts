import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FeedbackSchema = z.object({
  consent: z.literal(true),
  scope_code: z.string().min(8).max(96).regex(/^RW(?:-[0-9A-Z]+)*$/),
  method: z.enum(["gps", "map", "manual", "nearest", "offline"]),
  accuracy_m: z.number().min(1).max(50_000).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
}).refine(
  (value) => (value.latitude == null && value.longitude == null) ||
    (value.latitude != null && value.longitude != null),
  { message: "Coordinates must both be supplied or both be omitted." }
);

function roundCoarse(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value * 100) / 100;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = FeedbackSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid or incomplete consented feedback." }, { status: 400 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ status: "error", message: "Feedback storage is unavailable." }, { status: 503 });
  }

  try {
    const input = parsed.data;
    const supabase = createSupabaseServiceClient();
    const { data: village, error: villageError } = await supabase
      .from("boundaries")
      .select("id")
      .eq("scope_code", input.scope_code)
      .eq("level", "village")
      .is("valid_to", null)
      .maybeSingle();

    if (villageError || !village) {
      return NextResponse.json({ status: "error", message: "Village not found." }, { status: 404 });
    }

    const { error: insertError } = await supabase
      .from("location_confirmation_feedback")
      .insert({
        village_id: village.id,
        method: input.method,
        accuracy_m: input.accuracy_m ?? null,
        latitude_coarse: roundCoarse(input.latitude),
        longitude_coarse: roundCoarse(input.longitude),
      });

    if (insertError) {
      console.error("[location-feedback] insert failed:", insertError.message);
      return NextResponse.json({ status: "error", message: "Feedback could not be saved." }, { status: 503 });
    }

    return NextResponse.json({ status: "ok" }, { status: 201 });
  } catch (error) {
    console.error("[location-feedback] request failed:", error);
    return NextResponse.json({ status: "error", message: "Feedback could not be saved." }, { status: 503 });
  }
}
