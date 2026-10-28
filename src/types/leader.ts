export type LeaderRole =
  | "Village Leader"
  | "Cell Executive Secretary"
  | "Sector Executive Secretary"
  | "Mayor"
  | "Vice Mayor"
  | "District Executive Secretary"
  | "Other";

export interface LeaderSocialMedia {
  twitter_x?: string;
  linkedin?: string;
  facebook?: string;
}

export interface WorkHistoryItem {
  title: string;
  organization: string;
  period: string;
}

export interface AdminDossier {
  education_level: string; // e.g. "Impamyabumenyi ya Kaminuza (A0 / Bachelor's)"
  field_of_study: string; // e.g. "Imiyoborere (Public Administration) n'Amategeko"
  institution: string; // e.g. "Kaminuza y'u Rwanda (UR)"
  work_history: WorkHistoryItem[];
  appointment_letter_ref: string; // e.g. "MINALOC/GAS/2023/118"
  start_date: string; // e.g. "2023-01-15"
  special_certifications: string[];
  notes?: string;
}

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
  // Enhanced public attributes
  whatsapp_number?: string | null;
  social_media?: LeaderSocialMedia | null;
  vision_priorities?: string | null; // e.g. "Guteza imbere isuku, umutekano, na Mutuelle 100%"
  office_hours?: string | null; // e.g. "Kuwa Mbere - Kuwa Gatanu: 08:00 - 17:00"
  availability_status?: "available" | "busy" | "out_of_office";
  is_verified?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  // Confidential Admin HR Dossier (never sent to public citizen responses)
  admin_dossier?: AdminDossier | null;
}

export interface LeaderPublic extends Leader {
  boundary_name_kiny: string;
  boundary_name_eng: string | null;
  level: string;
  /** Masked phone, e.g. "+250 788 ••• 456". Never the raw number on public requests. */
  phone_masked: string | null;
  phone_raw?: string | null;
}

export interface InactiveNumberReport {
  id: string;
  leader_id: string;
  leader_name: string;
  reported_phone: string;
  boundary_name: string;
  citizen_comment?: string;
  created_at: string;
  status: "pending" | "resolved" | "dismissed";
}

export interface LeaderUpdatePayload {
  first_name?: string;
  last_name?: string;
  role?: LeaderRole;
  phone_number?: string;
  whatsapp_number?: string | null;
  email?: string | null;
  photo_url?: string | null;
  vision_priorities?: string | null;
  office_hours?: string | null;
  social_media?: LeaderSocialMedia | null;
  admin_dossier?: AdminDossier | null;
  version: number; // required for optimistic locking
}

