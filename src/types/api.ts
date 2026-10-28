import type { LocateRequest, LocateResponse } from "./location";
import type { LeaderPublic, LeaderUpdatePayload } from "./leader";

export interface AiRouterRequest {
  /** Natural language query only. Never send coordinates, names, or phones. */
  query: string;
  /** Optional context the backend already resolved (scope_code only). */
  context_scope_code?: string;
}

export interface AiRouterSuccess {
  status: "success";
  intent: "locate" | "get_leader" | "unknown";
  /** Structured data ready for frontend templates. Never raw AI text for leaders. */
  data: LocateResponse | { leaders: LeaderPublic[] } | null;
  /** Optional short Kinyarwanda confirmation from the router. */
  message_kiny?: string;
}

export interface AiRouterError {
  status: "error";
  code: string;
  message_kiny: string;
}

export type AiRouterResponse = AiRouterSuccess | AiRouterError;

export type { LocateRequest, LocateResponse, LeaderPublic, LeaderUpdatePayload };
