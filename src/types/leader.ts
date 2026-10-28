export type LeaderRole =
  | "Village Leader"
  | "Cell Executive Secretary"
  | "Sector Executive Secretary"
  | "Mayor"
  | "Vice Mayor"
  | "District Executive Secretary"
  | "Other";

export interface Leader {
  id: string;
  scope_code: string;
  first_name: string;
  last_name: string;
  role: LeaderRole;
  email: string | null;
  photo_url: string | null;
  valid_from: string;
  valid_to: string | null;
  version: number;
  // phone_number is NEVER included in public responses
}

export interface LeaderPublic extends Leader {
  boundary_name_kiny: string;
  boundary_name_eng: string | null;
  level: string;
  /** Masked phone, e.g. "+250 7XX XXX XXX". Never the real number. */
  phone_masked: string | null;
}

export interface LeaderUpdatePayload {
  first_name?: string;
  last_name?: string;
  role?: LeaderRole;
  phone_number?: string;
  email?: string | null;
  photo_url?: string | null;
  version: number; // required for optimistic locking
}
