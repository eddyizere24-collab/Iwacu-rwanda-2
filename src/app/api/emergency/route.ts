import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** National emergency contacts checked against official Rwanda government and Police sources on 2026-10-29. Review periodically. */
const NATIONAL = [
  {
    number: "112",
    label_kiny: "Ubutabazi rusange / Polisi",
    label_eng: "General emergency / Police",
    category: "emergency",
  },
  {
    number: "111",
    label_kiny: "Abazimya umuriro",
    label_eng: "Fire and Rescue",
    category: "fire",
  },
  {
    number: "912",
    label_kiny: "Ambulance / SAMU",
    label_eng: "Ambulance / SAMU",
    category: "medical",
  },
  {
    number: "113",
    label_kiny: "Impanuka zo mu muhanda",
    label_eng: "Traffic accidents",
    category: "traffic",
  },
  {
    number: "116",
    label_kiny: "Ubufasha bw'abana",
    label_eng: "Child help line",
    category: "child",
  },
  {
    number: "3512",
    label_kiny: "Ubufasha ku ihohoterwa rishingiye ku gitsina",
    label_eng: "Gender-based violence helpline",
    category: "gender_based_violence",
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
