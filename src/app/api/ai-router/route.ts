import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { getMockLeaders, toPublicLeader } from "@/lib/mock-data";
import {
  RWANDA_PROVINCES,
  RWANDA_DISTRICTS,
  REPRESENTATIVE_SECTORS,
  REPRESENTATIVE_CELLS,
  REPRESENTATIVE_VILLAGES,
} from "@/lib/rwanda-geo";
import type { LeaderPublic } from "@/types/leader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SearchSchema = z.object({
  query: z.string().min(1).max(500),
});

export interface AiSearchSuccessResponse {
  status: "success";
  answer_kiny: string;
  matched_leaders: LeaderPublic[];
  jurisdiction_info?: {
    province?: string;
    district?: string;
    sector?: string;
    cell?: string;
    village?: string;
  };
  suggestions: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: "error", message_kiny: "Andika ikibazo cyangwa agace ushaka kumenya." },
        { status: 400 }
      );
    }

    const { query } = parsed.data;
    const lower = query.toLowerCase();

    // Gather available leaders knowledge for AI context
    const allLeaders = getMockLeaders().map((l) => toPublicLeader(l, false));

    // Try Gemini 3.8 Flash if GEMINI_API_KEY is available
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const systemPrompt = `
You are the official civic AI assistant for IWACU RWANDA (Inzego z'Ibanze).
Your job is to answer citizen questions about Rwandan local governance in natural, warm, and highly respectful Kinyarwanda.
You have access to current leaders and administrative divisions in Rwanda:

KNOWN LEADERS IN SYSTEM:
${JSON.stringify(
  allLeaders.map((l) => ({
    id: l.id,
    name: `${l.first_name} ${l.last_name}`,
    role: l.role,
    boundary: l.boundary_name_kiny,
    level: l.level,
    scope_code: l.scope_code,
    phone_masked: l.phone_masked,
    vision: l.vision_priorities,
    office_hours: l.office_hours,
  })),
  null,
  2
)}

ADMINISTRATIVE CONTEXT OF RWANDA:
- 5 Provinces (Umujyi wa Kigali, Amajyepfo, Iburengerazuba, Amajyaruguru, Iburasirazuba)
- 30 Districts (Gasabo, Kicukiro, Nyarugenge, Musanze, Huye, Rubavu, Rwamagana, etc.)
- 416 Sectors (Imirenge: Kacyiru, Kimironko, Remera, Gisozi, Niboye, etc.)
- 2,148 Cells (Utugari: Kamatamu, Kibagabaga, Kibaza, Nyabisindu, etc.)
- 14,837 Villages (Imidugudu: Ubumwe, Amahoro, Karongi, Gisiza, etc.)

TASK:
1. Understand the user's question or search query in Kinyarwanda.
2. If the user searches an Umudugudu, Akagari, Umurenge, Akarere, or a specific leader's name:
   - Identify which leader(s) correspond to this search. Return their leader IDs in "matched_leader_ids".
   - Provide a natural, concise, polite answer in Kinyarwanda in "answer_kiny" explaining who leads this area, their role, and their office hours.
3. If the user asks a general question (e.g. "Muri Kacyiru harimo imidugudu ingahe?", "Ninde meya wa Gasabo?"):
   - Provide a factual, helpful answer in Kinyarwanda in "answer_kiny".
   - Return relevant leader IDs in "matched_leader_ids" if applicable.
4. Output strictly a JSON object with:
   - "answer_kiny": string
   - "matched_leader_ids": string[]
   - "suggestions": string[] (3 short related question suggestions in Kinyarwanda)
   - "jurisdiction_info": { "province"?: string, "district"?: string, "sector"?: string, "cell"?: string, "village"?: string }
`;

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\nUSER QUESTION / QUERY: "${query}"` }],
            },
          ],
          config: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        });

        const textOutput = response.text;
        if (textOutput) {
          const aiJson = JSON.parse(textOutput);
          const matchedIds: string[] = aiJson.matched_leader_ids || [];
          const matchedLeaders = allLeaders.filter((l) => matchedIds.includes(l.id));

          return NextResponse.json({
            status: "success",
            answer_kiny: aiJson.answer_kiny || `Dore amakuru y'abayobozi ajyanye na «${query}»:`,
            matched_leaders: matchedLeaders.length > 0 ? matchedLeaders : findFallbackLeaders(lower, allLeaders),
            jurisdiction_info: aiJson.jurisdiction_info,
            suggestions: aiJson.suggestions || [
              "Ninde uyobora umurenge wa Kacyiru?",
              "Nkeneye kumenya Meya wa Gasabo",
              "Abayobozi b'akagari ka Kamatamu ni ba nde?",
            ],
          });
        }
      } catch (geminiError) {
        console.warn("[ai-router] Gemini API call skipped or errored, falling back:", geminiError);
      }
    }

    // High-performance intelligent heuristic fallback in pure Kinyarwanda
    const { answerKiny, matchedLeaders, jurisdictionInfo, suggestions } = intelligentKinyarwandaSearch(
      lower,
      allLeaders
    );

    return NextResponse.json({
      status: "success",
      answer_kiny: answerKiny,
      matched_leaders: matchedLeaders,
      jurisdiction_info: jurisdictionInfo,
      suggestions,
    });
  } catch (err) {
    console.error("[ai-router] error:", err);
    return NextResponse.json(
      {
        status: "error",
        message_kiny: "Ikibazo cy'urukurikirane mu gushakisha. Ongera ugerageze.",
      },
      { status: 500 }
    );
  }
}

/**
 * Intelligent Kinyarwanda linguistic pattern matcher
 */
function intelligentKinyarwandaSearch(
  q: string,
  leaders: LeaderPublic[]
): {
  answerKiny: string;
  matchedLeaders: LeaderPublic[];
  jurisdictionInfo?: Record<string, string>;
  suggestions: string[];
} {
  // 1. Leader by Name Matching
  const byName = leaders.filter(
    (l) =>
      q.includes(l.first_name.toLowerCase()) ||
      q.includes(l.last_name.toLowerCase()) ||
      `${l.first_name} ${l.last_name}`.toLowerCase().includes(q)
  );

  if (byName.length > 0) {
    const leader = byName[0];
    return {
      answerKiny: `Twabonye umuyobozi: ${leader.first_name} ${leader.last_name}, akaba ari ${leader.role} muri ${leader.boundary_name_kiny}. Amasaha ye yo kuboneka ni ${leader.office_hours || "08:00 – 17:00"}.`,
      matchedLeaders: byName,
      suggestions: [
        `Nkeneye nomero ya ${leader.first_name} ${leader.last_name}`,
        `Abayobozi b'umurenge wa ${leader.boundary_name_kiny}`,
        `Intego z'umuyobozi ${leader.first_name}`,
      ],
    };
  }

  // 2. Specific Sector / Umurenge query
  const matchedSector = REPRESENTATIVE_SECTORS.find(
    (s) => q.includes(s.name_kiny.toLowerCase()) || q.includes(s.name_eng.toLowerCase())
  );
  if (matchedSector) {
    const sectorLeaders = leaders.filter((l) =>
      l.boundary_name_kiny.toLowerCase().includes(matchedSector.name_kiny.toLowerCase())
    );
    const gitifu = sectorLeaders.find((l) => l.role === "Sector Executive Secretary") || sectorLeaders[0];
    const answer = gitifu
      ? `Umurenge wa ${matchedSector.name_kiny} uyoborwa na ${gitifu.first_name} ${gitifu.last_name} (${gitifu.role}). Wagera kuri serivisi ze ukoresheje telefone cyangwa WhatsApp hano hasi.`
      : `Twakiriye ikibazo cyawe ku Murenge wa ${matchedSector.name_kiny}. Dore abayobozi babonetse muri ako gace:`;

    return {
      answerKiny: answer,
      matchedLeaders: sectorLeaders.length > 0 ? sectorLeaders : leaders.slice(0, 2),
      jurisdictionInfo: { sector: matchedSector.name_kiny, district: "Gasabo" },
      suggestions: [
        `Utugari tugize Umurenge wa ${matchedSector.name_kiny}`,
        `Umukuru w'umudugudu muri ${matchedSector.name_kiny}`,
        `Meya w'Akarere ka Gasabo`,
      ],
    };
  }

  // 3. Cell / Akagari query
  const matchedCell = REPRESENTATIVE_CELLS.find(
    (c) => q.includes(c.name_kiny.toLowerCase()) || q.includes(c.name_eng.toLowerCase())
  );
  if (matchedCell) {
    const cellLeaders = leaders.filter((l) =>
      l.boundary_name_kiny.toLowerCase().includes(matchedCell.name_kiny.toLowerCase())
    );
    return {
      answerKiny: `Muri ${matchedCell.name_kiny}, twabonye abayobozi bahari barimo ab'akagari n'ab'imidugudu ihabarizwa.`,
      matchedLeaders: cellLeaders.length > 0 ? cellLeaders : leaders.slice(0, 2),
      jurisdictionInfo: { cell: matchedCell.name_kiny },
      suggestions: [
        `Imidugudu iri muri ${matchedCell.name_kiny}`,
        `Gitifu w'Umurenge wa Kacyiru`,
      ],
    };
  }

  // 4. Village / Umudugudu query
  const matchedVillage = REPRESENTATIVE_VILLAGES.find(
    (v) => q.includes(v.name_kiny.toLowerCase()) || q.includes(v.name_eng.toLowerCase())
  );
  if (matchedVillage) {
    const villageLeaders = leaders.filter((l) =>
      l.boundary_name_kiny.toLowerCase().includes(matchedVillage.name_kiny.toLowerCase())
    );
    return {
      answerKiny: `${matchedVillage.name_kiny}: Dore umukuru w'umudugudu wemejwe muri aka gace n'amakuru yo kumugeraho.`,
      matchedLeaders: villageLeaders.length > 0 ? villageLeaders : leaders.slice(0, 1),
      jurisdictionInfo: { village: matchedVillage.name_kiny },
      suggestions: [
        `Gitifu w'Akagari k'uyu mudugudu`,
        `Amakuru y'umutekano n'isuku muri uyu mudugudu`,
      ],
    };
  }

  // 5. Mayor or District query
  if (q.includes("meya") || q.includes("mayor") || q.includes("akarere")) {
    const mayor = leaders.find((l) => l.role === "Mayor") || leaders[0];
    return {
      answerKiny: `Umuyobozi w'Akarere ka Gasabo (Meya) ni ${mayor.first_name} ${mayor.last_name}. Ibiro by'akarere bifungura guhera saa mbiri za mugitondo (08:00 – 17:00).`,
      matchedLeaders: [mayor],
      jurisdictionInfo: { district: "Gasabo" },
      suggestions: [
        "Visi Meya wungirije muri Gasabo ni nde?",
        "Imirenge igize Akarere ka Gasabo",
        "Uburyo bwo guhura n'ubuyobozi bw'Akarere",
      ],
    };
  }

  // General fallback
  const fallbackMatched = findFallbackLeaders(q, leaders);
  return {
    answerKiny: `Twashakishije muri sisitemu y'ubuyobozi bw'u Rwanda ku bibazo byawe: «${q}». Dore amakuru y'abayobozi ahuye n'ibyo mwabajije:`,
    matchedLeaders: fallbackMatched.length > 0 ? fallbackMatched : leaders.slice(0, 2),
    suggestions: [
      "Ninde uyobora umurenge wa Kacyiru?",
      "Ninde uyobora akagari ka Kamatamu?",
      "Umukuru w'umudugudu w'ubumwe",
    ],
  };
}

function findFallbackLeaders(q: string, leaders: LeaderPublic[]): LeaderPublic[] {
  return leaders.filter(
    (l) =>
      q.includes(l.first_name.toLowerCase()) ||
      q.includes(l.last_name.toLowerCase()) ||
      q.includes(l.role.toLowerCase()) ||
      q.includes(l.boundary_name_kiny.toLowerCase())
  );
}
