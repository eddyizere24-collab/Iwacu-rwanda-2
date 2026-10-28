import type { LeaderPublic, LeaderRole, AdminDossier, LeaderSocialMedia, InactiveNumberReport } from "@/types/leader";
import { maskPhone } from "@/lib/security/mask";

export interface MockLeaderRecord {
  id: string;
  scope_code: string;
  first_name: string;
  last_name: string;
  role: LeaderRole;
  phone_number: string | null;
  whatsapp_number?: string | null;
  email: string | null;
  photo_url: string | null;
  valid_from: string;
  valid_to: string | null;
  version: number;
  boundary_name_kiny: string;
  boundary_name_eng: string | null;
  level: string;
  is_verified?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  vision_priorities?: string | null;
  office_hours?: string | null;
  availability_status?: "available" | "busy" | "out_of_office";
  social_media?: LeaderSocialMedia | null;
  admin_dossier?: AdminDossier | null;
}

export const initialMockLeaders: MockLeaderRecord[] = [
  // Village Leader (Umudugudu w'Ubumwe, Kamatamu, Kacyiru)
  {
    id: "11111111-1111-4111-a111-111111111111",
    scope_code: "RW-01-01-01-01-01",
    first_name: "Jean",
    last_name: "Uwimana",
    role: "Village Leader",
    phone_number: "+250788123456",
    whatsapp_number: "+250788123456",
    email: "jean.uwimana@gasabo.gov.rw",
    photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    valid_from: "2024-01-01T00:00:00Z",
    valid_to: null,
    version: 1,
    boundary_name_kiny: "Umudugudu w'Ubumwe (Kamatamu)",
    boundary_name_eng: "Ubumwe Village (Kamatamu)",
    level: "village",
    is_verified: true,
    verified_by: "Akarere ka Gasabo",
    verified_at: "2024-01-15",
    vision_priorities: "Gukomeza gushimangira umutekano w'umudugudu, isuku irambye, no kugeza ubwisungane mu kwivuza (Mutuelle de Santé) ku 100%.",
    office_hours: "Kuwa Mbere – Kuwa Gatanu: 08:00 – 17:00",
    availability_status: "available",
    social_media: {
      twitter_x: "https://x.com/uwimana_jean_rw",
    },
    admin_dossier: {
      education_level: "Impamyabumenyi y'Amashuri Yisumbuye (A2)",
      field_of_study: "Imiyoborere n'Ubukungu (Economics & Administration)",
      institution: "GS Sainte Famille",
      work_history: [
        {
          title: "Mutwarasibo w'Itsinda ry'Abahesha",
          organization: "Akagari ka Kamatamu",
          period: "2019 - 2023",
        },
        {
          title: "Umuhuzabikorwa w'Umuganda",
          organization: "Umudugudu w'Ubumwe",
          period: "2016 - 2019",
        },
      ],
      appointment_letter_ref: "MINALOC/GAS/KAC/2024/0012",
      start_date: "2024-01-01",
      special_certifications: [
        "Amahugurwa y'Imiyoborere y'Inzego z'Ibanze (RGB / MINALOC)",
        "Gukemura Amakimbirane n'Ubuhuza mu Muryango",
      ],
      notes: "Umuyobozi w'umunyamurava, ukurikirana ibibazo by'abaturage ku gihe.",
    },
  },

  // Cell Executive Secretary (Akagari ka Kamatamu, Kacyiru)
  {
    id: "22222222-2222-4222-a222-222222222222",
    scope_code: "RW-01-01-01-01",
    first_name: "Marie",
    last_name: "Mukamana",
    role: "Cell Executive Secretary",
    phone_number: "+250788234567",
    whatsapp_number: "+250788234567",
    email: "marie.mukamana@gasabo.gov.rw",
    photo_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
    valid_from: "2023-08-01T00:00:00Z",
    valid_to: null,
    version: 1,
    boundary_name_kiny: "Akagari ka Kamatamu",
    boundary_name_eng: "Kamatamu Cell",
    level: "cell",
    is_verified: true,
    verified_by: "Akarere ka Gasabo",
    verified_at: "2023-08-10",
    vision_priorities: "Kunoza imitangire ya serivisi ku baturage, guhuza amakuru y'umutekano n'iterambere ry'ubuhinzi n'inganda nto.",
    office_hours: "Kuwa Mbere – Kuwa Gatanu: 08:00 – 17:00",
    availability_status: "available",
    social_media: {
      twitter_x: "https://x.com/mukamana_m",
      linkedin: "https://linkedin.com/in/marie-mukamana-gov",
    },
    admin_dossier: {
      education_level: "Impamyabumenyi ya Kaminuza (A0 / Bachelor's Degree)",
      field_of_study: "Imiyoborere y'Abaturage (Public Administration)",
      institution: "Kaminuza y'u Rwanda (University of Rwanda - Huye)",
      work_history: [
        {
          title: "Ushinzwe Imibereho Myiza (Social Affairs)",
          organization: "Akagari ka Kamukina",
          period: "2020 - 2023",
        },
        {
          title: "Umwarimu w'Amateka n'Ubumenyi",
          organization: "GS Kacyiru II",
          period: "2017 - 2020",
        },
      ],
      appointment_letter_ref: "GAS/HR/CELL/2023/0488",
      start_date: "2023-08-01",
      special_certifications: [
        "Amahugurwa yo gutanga serivisi z'ikoranabuhanga (IremboGov Certification)",
        "Imicungire y'Ubwisungane no Kwishyura Ejo Heza",
      ],
      notes: "Azi neza gukoresha imiyoboro y'ikoranabuhanga no kwakira abaturage.",
    },
  },

  // Sector Executive Secretary (Umurenge wa Kacyiru)
  {
    id: "33333333-3333-4333-a333-333333333333",
    scope_code: "RW-01-01-01",
    first_name: "Patrick",
    last_name: "Habimana",
    role: "Sector Executive Secretary",
    phone_number: "+250788345678",
    whatsapp_number: "+250788345678",
    email: "patrick.habimana@gasabo.gov.rw",
    photo_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
    valid_from: "2023-03-01T00:00:00Z",
    valid_to: null,
    version: 2,
    boundary_name_kiny: "Umurenge wa Kacyiru",
    boundary_name_eng: "Kacyiru Sector",
    level: "sector",
    is_verified: true,
    verified_by: "MINALOC",
    verified_at: "2023-03-15",
    vision_priorities: "Guteza imbere imiyoborere ishingiye ku baturage, guca akarengane, no kwihutisha ishoramari n'imiturire iboneye.",
    office_hours: "Kuwa Mbere – Kuwa Gatanu: 07:30 – 17:30",
    availability_status: "available",
    social_media: {
      twitter_x: "https://x.com/habimana_pat",
      linkedin: "https://linkedin.com/in/patrick-habimana-rw",
    },
    admin_dossier: {
      education_level: "Impamyabumenyi y'Icyiciro cya Gatatu cya Kaminuza (Master's Degree)",
      field_of_study: "Development Studies & Local Governance",
      institution: "Mount Kenya University Rwanda",
      work_history: [
        {
          title: "Umunyamabanga Nshingwabikorwa w'Umurenge",
          organization: "Umurenge wa Nduba (Gasabo)",
          period: "2019 - 2023",
        },
        {
          title: "Ushinzwe Ubutegetsi n'Imari (DAF)",
          organization: "Akarere ka Rulindo",
          period: "2015 - 2019",
        },
      ],
      appointment_letter_ref: "MINALOC/PS/2023/1029",
      start_date: "2023-03-01",
      special_certifications: [
        "Executive Leadership in Public Administration (RMI - Rwanda Management Institute)",
        "Disaster Management and Emergency Response",
      ],
      notes: "Uburambe bw'imyaka irenga 10 mu buyobozi bw'inzego z'ibanze.",
    },
  },

  // Mayor (Akarere ka Gasabo)
  {
    id: "44444444-4444-4444-a444-444444444444",
    scope_code: "RW-01-01",
    first_name: "Chantal",
    last_name: "Ingabire",
    role: "Mayor",
    phone_number: "+250788456789",
    whatsapp_number: "+250788456789",
    email: "mayor@gasabo.gov.rw",
    photo_url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80",
    valid_from: "2022-01-01T00:00:00Z",
    valid_to: null,
    version: 3,
    boundary_name_kiny: "Akarere ka Gasabo",
    boundary_name_eng: "Gasabo District",
    level: "district",
    is_verified: true,
    verified_by: "MINALOC & Umujyi wa Kigali",
    verified_at: "2022-01-10",
    vision_priorities: "Kugira Gasabo akarere k'icyitegererezo mu bukungu, imiturire igezweho, ibidukikije, n'umutekano w'abaturage n'abashoramari.",
    office_hours: "Kuwa Mbere – Kuwa Gatanu: 08:00 – 18:00",
    availability_status: "available",
    social_media: {
      twitter_x: "https://x.com/ingabire_chantal_rw",
      linkedin: "https://linkedin.com/in/chantal-ingabire-mayor",
    },
    admin_dossier: {
      education_level: "Master's Degree in Strategic Governance & Policy",
      field_of_study: "Imiyoborere n'Ingamba za Leta",
      institution: "Kaminuza y'u Rwanda",
      work_history: [
        {
          title: "Visi-Meya Ushinzwe Ubukungu",
          organization: "Akarere ka Gasabo",
          period: "2018 - 2021",
        },
        {
          title: "Umusesenguzi w'Igenamigambi",
          organization: "MINECOFIN",
          period: "2013 - 2018",
        },
      ],
      appointment_letter_ref: "MINALOC/RGB/ELECTIONS/2021/992",
      start_date: "2022-01-01",
      special_certifications: [
        "Senior Civil Service Leadership (Kigali Institute of Management)",
        "Urban Planning and Economic Resilience",
      ],
      notes: "Yatorewe kuyobora Inama Njyanama n'Akarere ka Gasabo.",
    },
  },

  // Sector Executive Secretary (Kimironko)
  {
    id: "55555555-5555-4555-a555-555555555555",
    scope_code: "RW-01-01-02",
    first_name: "Eric",
    last_name: "Bizimana",
    role: "Sector Executive Secretary",
    phone_number: "+250788567890",
    whatsapp_number: "+250788567890",
    email: "eric.bizimana@gasabo.gov.rw",
    photo_url: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80",
    valid_from: "2023-05-01T00:00:00Z",
    valid_to: null,
    version: 1,
    boundary_name_kiny: "Umurenge wa Kimironko",
    boundary_name_eng: "Kimironko Sector",
    level: "sector",
    is_verified: true,
    verified_by: "Akarere ka Gasabo",
    verified_at: "2023-05-15",
    vision_priorities: "Kunoza isoko rya Kimironko, kubungabunga umutekano ku baturage n'abagenda mu muhanda, no guteza imbere urubyiruko mu mirimo.",
    office_hours: "Kuwa Mbere – Kuwa Gatanu: 08:00 – 17:00",
    availability_status: "available",
    social_media: {
      twitter_x: "https://x.com/bizimana_eric",
    },
    admin_dossier: {
      education_level: "Bachelor's Degree in Law (LLB)",
      field_of_study: "Amategeko (Law)",
      institution: "INES Ruhengeri",
      work_history: [
        {
          title: "Ushinzwe Amategeko n'Uburenganzira",
          organization: "Akarere ka Nyarugenge",
          period: "2019 - 2023",
        },
      ],
      appointment_letter_ref: "GAS/KIM/2023/077",
      start_date: "2023-05-01",
      special_certifications: ["Mediation & ADR Certification"],
    },
  },

  // Cell Executive Secretary (Kibagabaga, Kimironko)
  {
    id: "66666666-6666-4666-a666-666666666666",
    scope_code: "RW-01-01-02-01",
    first_name: "Alice",
    last_name: "Mukashyaka",
    role: "Cell Executive Secretary",
    phone_number: "+250788678901",
    whatsapp_number: "+250788678901",
    email: "alice.mukashyaka@gasabo.gov.rw",
    photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    valid_from: "2024-02-01T00:00:00Z",
    valid_to: null,
    version: 1,
    boundary_name_kiny: "Akagari ka Kibagabaga",
    boundary_name_eng: "Kibagabaga Cell",
    level: "cell",
    is_verified: true,
    verified_by: "Akarere ka Gasabo",
    verified_at: "2024-02-10",
    vision_priorities: "Guhuza ibikorwa by'isuku mu midugudu ya Kibagabaga no gutanga serivisi zihuse kuri Irembo.",
    office_hours: "Kuwa Mbere – Kuwa Gatanu: 08:00 – 17:00",
    availability_status: "available",
    admin_dossier: {
      education_level: "Bachelor's Degree in Social Work",
      field_of_study: "Imibereho Myiza n'Iterambere ry'Umuryango",
      institution: "Kaminuza y'u Rwanda",
      work_history: [
        {
          title: "Social Worker",
          organization: "Ibitaro bya Kibagabaga",
          period: "2021 - 2024",
        },
      ],
      appointment_letter_ref: "GAS/CELL/2024/0192",
      start_date: "2024-02-01",
      special_certifications: ["Community Health and Welfare"],
    },
  },

  // Village Leader (Umudugudu wa Karongi, Kibagabaga)
  {
    id: "77777777-7777-4777-a777-777777777777",
    scope_code: "RW-01-01-02-01-01",
    first_name: "Emmanuel",
    last_name: "Nshimiyimana",
    role: "Village Leader",
    phone_number: "+250788789012",
    whatsapp_number: "+250788789012",
    email: "emmanuel.nshimiyimana@gasabo.gov.rw",
    photo_url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80",
    valid_from: "2024-01-01T00:00:00Z",
    valid_to: null,
    version: 1,
    boundary_name_kiny: "Umudugudu wa Karongi",
    boundary_name_eng: "Karongi Village",
    level: "village",
    is_verified: true,
    verified_by: "Akarere ka Gasabo",
    verified_at: "2024-01-12",
    vision_priorities: "Ubufatanye bw'abaturage, kurwanya ihohoterwa ryo mu ngo, no kwitegura neza umuganda rusange.",
    office_hours: "Kuwa Mbere – Kuwa Gatanu: 08:00 – 17:00",
    availability_status: "available",
    admin_dossier: {
      education_level: "A2 Secondary Certificate",
      field_of_study: "Sciences & Mathematics",
      institution: "ES Kanombe",
      work_history: [
        {
          title: "Ushinzwe Umutekano w'Umudugudu",
          organization: "Karongi Village",
          period: "2018 - 2023",
        },
      ],
      appointment_letter_ref: "GAS/KIM/VIL/2024/082",
      start_date: "2024-01-01",
      special_certifications: ["Community Policing (RNP)"],
    },
  },

  // Mayor (Akarere ka Musanze - Northern Province)
  {
    id: "88888888-8888-4888-a888-888888888888",
    scope_code: "RW-04-01",
    first_name: "Ramadhan",
    last_name: "Nsengimana",
    role: "Mayor",
    phone_number: "+250788890123",
    whatsapp_number: "+250788890123",
    email: "mayor@musanze.gov.rw",
    photo_url: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80",
    valid_from: "2022-01-01T00:00:00Z",
    valid_to: null,
    version: 1,
    boundary_name_kiny: "Akarere ka Musanze",
    boundary_name_eng: "Musanze District",
    level: "district",
    is_verified: true,
    verified_by: "MINALOC",
    verified_at: "2022-01-15",
    vision_priorities: "Guteza imbere ubukerarugendo n'ibirunga, ubuhinzi bw'ibirayi bw'umwimerere, no gutuza neza abaturage mu midugudu y'icyitegererezo.",
    office_hours: "Kuwa Mbere – Kuwa Gatanu: 08:00 – 17:30",
    availability_status: "available",
    social_media: {
      twitter_x: "https://x.com/musanze_mayor",
    },
    admin_dossier: {
      education_level: "Master of Science in Project Management",
      field_of_study: "Project Management & Rural Development",
      institution: "INES Ruhengeri",
      work_history: [
        {
          title: "Visi Meya w'Ubutegetsi n'Imari",
          organization: "Akarere ka Musanze",
          period: "2016 - 2021",
        },
      ],
      appointment_letter_ref: "MINALOC/NORTH/2021/88",
      start_date: "2022-01-01",
      special_certifications: ["Tourism and Community Eco-Governance"],
    },
  },
];

// Persistent global store for mock state in Node dev environment
declare global {
  // eslint-disable-next-line no-var
  var __IWACU_MOCK_LEADERS__: MockLeaderRecord[] | undefined;
  // eslint-disable-next-line no-var
  var __IWACU_INACTIVE_REPORTS__: InactiveNumberReport[] | undefined;
}

export function getMockLeaders(): MockLeaderRecord[] {
  if (!globalThis.__IWACU_MOCK_LEADERS__) {
    globalThis.__IWACU_MOCK_LEADERS__ = [...initialMockLeaders];
  }
  return globalThis.__IWACU_MOCK_LEADERS__!;
}

export function addMockLeader(newLeader: Omit<MockLeaderRecord, "id" | "version" | "valid_from" | "valid_to">): MockLeaderRecord {
  const record: MockLeaderRecord = {
    ...newLeader,
    id: crypto.randomUUID(),
    version: 1,
    valid_from: new Date().toISOString(),
    valid_to: null,
    is_verified: newLeader.is_verified ?? true,
    verified_by: newLeader.verified_by || "Urwego rw'Ubuyobozi",
    verified_at: new Date().toISOString().split("T")[0],
    availability_status: newLeader.availability_status || "available",
    office_hours: newLeader.office_hours || "Kuwa Mbere – Kuwa Gatanu: 08:00 – 17:00",
  };
  getMockLeaders().unshift(record);
  return record;
}

export function deleteMockLeader(id: string): boolean {
  const leaders = getMockLeaders();
  const index = leaders.findIndex((l) => l.id === id);
  if (index !== -1) {
    leaders.splice(index, 1);
    return true;
  }
  return false;
}

export function updateMockLeader(id: string, updates: Partial<MockLeaderRecord>): MockLeaderRecord | null {
  const leaders = getMockLeaders();
  const index = leaders.findIndex((l) => l.id === id);
  if (index === -1) return null;
  const current = leaders[index];
  const updated: MockLeaderRecord = {
    ...current,
    ...updates,
    version: current.version + 1,
    valid_from: new Date().toISOString(),
  };
  leaders[index] = updated;
  return updated;
}

/**
 * Inactive number report storage
 */
export function getMockInactiveReports(): InactiveNumberReport[] {
  if (!globalThis.__IWACU_INACTIVE_REPORTS__) {
    globalThis.__IWACU_INACTIVE_REPORTS__ = [
      {
        id: "rep-001",
        leader_id: "77777777-7777-4777-a777-777777777777",
        leader_name: "Emmanuel Nshimiyimana (Mudugudu wa Karongi)",
        reported_phone: "+250 788 ••• 012",
        boundary_name: "Umudugudu wa Karongi",
        citizen_comment: "Iyo uhamagaye iyi nimero baravuga ngo ntikiriho.",
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        status: "pending",
      },
    ];
  }
  return globalThis.__IWACU_INACTIVE_REPORTS__!;
}

export function addMockInactiveReport(report: Omit<InactiveNumberReport, "id" | "created_at" | "status">): InactiveNumberReport {
  const created: InactiveNumberReport = {
    ...report,
    id: `rep-${crypto.randomUUID().slice(0, 8)}`,
    created_at: new Date().toISOString(),
    status: "pending",
  };
  getMockInactiveReports().unshift(created);
  return created;
}

export function resolveMockInactiveReport(reportId: string): boolean {
  const reports = getMockInactiveReports();
  const report = reports.find((r) => r.id === reportId);
  if (report) {
    report.status = "resolved";
    return true;
  }
  return false;
}

/**
 * Strip confidential HR dossier for public citizens
 */
export function toPublicLeader(rec: MockLeaderRecord, includeDossier?: boolean | number): LeaderPublic {
  const allowDossier = typeof includeDossier === "boolean" ? includeDossier : false;
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
    phone_raw: allowDossier ? rec.phone_number : undefined,
    whatsapp_number: rec.whatsapp_number || rec.phone_number,
    is_verified: rec.is_verified ?? true,
    verified_by: rec.verified_by,
    verified_at: rec.verified_at,
    vision_priorities: rec.vision_priorities,
    office_hours: rec.office_hours,
    availability_status: rec.availability_status,
    social_media: rec.social_media,
    // ONLY include admin dossier if explicitly authorized
    admin_dossier: allowDossier ? rec.admin_dossier : undefined,
  };
}
