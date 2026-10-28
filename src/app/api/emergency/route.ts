import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** National emergency contacts — static for MVP (no DB). */
const NATIONAL = [
  {
    number: "112",
    label_kiny: "Polisi y'u Rwanda",
    label_eng: "Rwanda National Police",
    category: "police",
  },
  {
    number: "113",
    label_kiny: "Abazimya umuriro",
    label_eng: "Fire Brigade",
    category: "fire",
  },
  {
    number: "912",
    label_kiny: "Ambulance / SAMU",
    label_eng: "Ambulance / SAMU",
    category: "medical",
  },
];

export async function GET() {
  return NextResponse.json(
    { status: "success", items: NATIONAL },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}
