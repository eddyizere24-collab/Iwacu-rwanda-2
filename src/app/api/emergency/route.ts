import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** National emergency contacts — static list (no DB). Includes common Rwanda helplines. */
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
  {
    number: "114",
    label_kiny: "Isuzuma ry'ibiza / traffic",
    label_eng: "Traffic / road emergency",
    category: "traffic",
  },
  {
    number: "116",
    label_kiny: "Ubufasha bw'abana",
    label_eng: "Child helpline",
    category: "child",
  },
  {
    number: "3512",
    label_kiny: "Isuzuma ry'ubuzima (RBC / health info)",
    label_eng: "Health information line",
    category: "health_info",
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
