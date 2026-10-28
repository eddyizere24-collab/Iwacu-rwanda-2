import type { LeaderPublic } from "@/types/leader";
import { maskPhone } from "@/lib/security/mask";

export interface MockLeaderRecord {
  id: string;
  scope_code: string;
  first_name: string;
  last_name: string;
  role: LeaderPublic["role"];
  phone_number: string | null;
  email: string | null;
  photo_url: string | null;
  valid_from: string;
  valid_to: string | null;
  version: number;
  boundary_name_kiny: string;
  boundary_name_eng: string | null;
  level: string;
}

export const initialMockLeaders: MockLeaderRecord[] = [
  {
    id: "11111111-1111-4111-a111-111111111111",
    scope_code: "RW-01-01-01-001",
    first_name: "Jean",
    last_name: "Uwimana",
    role: "Village Leader",
    phone_number: "+250788123456",
    email: "jean.uwimana@gasabo.gov.rw",
    photo_url: null,
    valid_from: "2024-01-01T00:00:00Z",
    valid_to: null,
    version: 1,
    boundary_name_kiny: "Umudugudu w'Urugero",
    boundary_name_eng: "Sample Village",
    level: "village",
  },
  {
    id: "22222222-2222-4222-a222-222222222222",
    scope_code: "RW-01-01-01",
    first_name: "Marie",
    last_name: "Mukamana",
    role: "Cell Executive Secretary",
    phone_number: "+250788234567",
    email: "marie.mukamana@gasabo.gov.rw",
    photo_url: null,
    valid_from: "2024-01-01T00:00:00Z",
    valid_to: null,
    version: 1,
    boundary_name_kiny: "Akagari k'Urugero",
    boundary_name_eng: "Sample Cell",
    level: "cell",
  },
  {
    id: "33333333-3333-4333-a333-333333333333",
    scope_code: "RW-01-01",
    first_name: "Patrick",
    last_name: "Habimana",
    role: "Sector Executive Secretary",
    phone_number: "+250788345678",
    email: "patrick.habimana@gasabo.gov.rw",
    photo_url: null,
    valid_from: "2023-06-01T00:00:00Z",
    valid_to: null,
    version: 1,
    boundary_name_kiny: "Kacyiru",
    boundary_name_eng: "Kacyiru Sector",
    level: "sector",
  },
  {
    id: "44444444-4444-4444-a444-444444444444",
    scope_code: "RW-01",
    first_name: "Chantal",
    last_name: "Ingabire",
    role: "Mayor",
    phone_number: "+250788456789",
    email: "mayor@gasabo.gov.rw",
    photo_url: null,
    valid_from: "2022-01-01T00:00:00Z",
    valid_to: null,
    version: 2,
    boundary_name_kiny: "Akarere ka Gasabo",
    boundary_name_eng: "Gasabo District",
    level: "district",
  },
];

// Global in-memory cache for dev/mock runtime
declare global {
  // eslint-disable-next-line no-var
  var __IWACU_MOCK_LEADERS__: MockLeaderRecord[] | undefined;
}

if (!globalThis.__IWACU_MOCK_LEADERS__) {
  globalThis.__IWACU_MOCK_LEADERS__ = [...initialMockLeaders];
}

export function getMockLeaders(): MockLeaderRecord[] {
  return globalThis.__IWACU_MOCK_LEADERS__!;
}

export function toPublicLeader(rec: MockLeaderRecord): LeaderPublic {
  return {
    id: rec.id,
    scope_code: rec.scope_code,
    first_name: rec.first_name,
    last_name: rec.last_name,
    role: rec.role,
    email: rec.email,
    photo_url: rec.photo_url,
    valid_from: rec.valid_from,
    valid_to: rec.valid_to,
    version: rec.version,
    boundary_name_kiny: rec.boundary_name_kiny,
    boundary_name_eng: rec.boundary_name_eng,
    level: rec.level,
    phone_masked: maskPhone(rec.phone_number),
  };
}
