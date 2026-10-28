import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Groq from "groq-sdk";
import { getMockLeaders, toPublicLeader } from "@/lib/mock-data";
import type { AiRouterResponse } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AiRouterSchema = z.object({
  query: z.string().min(1).max(500),
  context_scope_code: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse<AiRouterResponse>> {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          status: "error",
          code: "INVALID_JSON",
          message_kiny: "Imiterere ya JSON ntabwo yemewe",
        },
        { status: 400 }
      );
    }

    const parsed = AiRouterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          code: "VALIDATION_ERROR",
          message_kiny: "Andika ikibazo cyangwa agace ushaka kumenya.",
        },
        { status: 422 }
      );
    }

    const { query } = parsed.data;
    const lower = query.toLowerCase();

    // 1. Try Groq SDK if GROQ_API_KEY is available (Zero PII Function Calling)
    if (process.env.GROQ_API_KEY) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "You are an administrative routing classifier for Rwanda local government queries in Gasabo District. " +
                "Classify whether the user wants to locate their area ('locate') or find local leaders ('get_leader'). " +
                "Output strictly a JSON object: {\"intent\": \"locate\" | \"get_leader\" | \"unknown\", \"scope_hint\": \"RW-01\" | \"RW-01-01\" | \"RW-01-01-01-001\"}. Never output personal data or phone numbers.",
            },
            {
              role: "user",
              content: query,
            },
          ],
          model: "llama-3.1-8b-instant",
          response_format: { type: "json_object" },
          temperature: 0,
        });

        const choice = chatCompletion.choices[0]?.message?.content;
        if (choice) {
          const aiJson = JSON.parse(choice);
          const intent = aiJson.intent || "get_leader";
          const scopeHint = aiJson.scope_hint || "RW-01";

          const leaders = getMockLeaders()
            .filter((l) => l.scope_code.startsWith(scopeHint))
            .map(toPublicLeader);

          return NextResponse.json({
            status: "success",
            intent,
            data: { leaders },
            message_kiny: `Twabonye amakuru ajyanye na: "${query}"`,
          });
        }
      } catch (groqErr) {
        console.warn("[ai-router] Groq API call skipped or failed, using heuristic:", groqErr);
      }
    }

    // 2. Keyword / Heuristic Fallback (deterministic, fast, zero-PII)
    let intent: "locate" | "get_leader" = "get_leader";
    if (
      lower.includes("aho ndi") ||
      lower.includes("hano") ||
      lower.includes("locate") ||
      lower.includes("gps") ||
      lower.includes("akarere") ||
      lower.includes("umurenge")
    ) {
      intent = "locate";
    }

    // Filter leaders matching query keywords
    const allLeaders = getMockLeaders().map(toPublicLeader);
    const matched = allLeaders.filter((l) => {
      const q = lower;
      return (
        q.includes(l.first_name.toLowerCase()) ||
        q.includes(l.last_name.toLowerCase()) ||
        q.includes(l.role.toLowerCase()) ||
        q.includes(l.boundary_name_kiny.toLowerCase()) ||
        (l.boundary_name_eng && q.includes(l.boundary_name_eng.toLowerCase()))
      );
    });

    const leadersToReturn = matched.length > 0 ? matched : allLeaders;

    return NextResponse.json({
      status: "success",
      intent,
      data: { leaders: leadersToReturn },
      message_kiny: `Amakuru y'abayobozi b'agace mwashatse (${leadersToReturn.length}):`,
    });
  } catch (err) {
    console.error("[ai-router] error:", err);
    return NextResponse.json(
      {
        status: "error",
        code: "SERVER_ERROR",
        message_kiny: "Ikibazo cy'urukurikirane mu gushakisha.",
      },
      { status: 500 }
    );
  }
}
