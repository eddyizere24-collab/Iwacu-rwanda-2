export interface AdministrativeUnit {
  code: string;
  name_kiny: string;
  name_eng: string;
  level: "province" | "district" | "sector" | "cell" | "village";
  parent_code?: string;
}

export interface EmergencyContact {
  number: string;
  name_kiny: string;
  name_eng: string;
  source: string;
  category: "police" | "medical" | "fire" | "protection" | "traffic";
  is_verified: boolean;
}

/**
 * 10 Verified National Emergency Numbers from D1 / Master Specification
 */
export const VERIFIED_EMERGENCY_NUMBERS: EmergencyContact[] = [
  {
    number: "112",
    name_kiny: "Polisi — ubutabazi bwihuse",
    name_eng: "Police — emergency",
    source: "Rwanda National Police (RNP)",
    category: "police",
    is_verified: true,
  },
  {
    number: "111",
    name_kiny: "Inkongi y'umuriro n'ubutabazi",
    name_eng: "Fire and rescue",
    source: "Rwanda National Police (RNP)",
    category: "fire",
    is_verified: true,
  },
  {
    number: "113",
    name_kiny: "Impanuka zo mu muhanda",
    name_eng: "Road traffic accidents",
    source: "Traffic Police Rwanda",
    category: "traffic",
    is_verified: true,
  },
  {
    number: "114",
    name_kiny: "Ambulance — ubutabazi bw'ubuvuzi",
    name_eng: "Medical ambulance",
    source: "Rwanda Biomedical Centre (RBC)",
    category: "medical",
    is_verified: true,
  },
  {
    number: "116",
    name_kiny: "Umurongo w'abana",
    name_eng: "Child helpline",
    source: "National Child Development Agency (NCDA)",
    category: "protection",
    is_verified: true,
  },
  {
    number: "3512",
    name_kiny: "Ihohoterwa rishingiye ku gitsina (Isange)",
    name_eng: "Gender-based violence (Isange One Stop)",
    source: "Ministry of Gender and Family Promotion",
    category: "protection",
    is_verified: true,
  },
  {
    number: "997",
    name_kiny: "Kurwanya ruswa",
    name_eng: "Report corruption",
    source: "Office of the Ombudsman",
    category: "police",
    is_verified: true,
  },
  {
    number: "110",
    name_kiny: "Ibibazo byo mu mazi (ibiyaga)",
    name_eng: "Water and lake emergencies (Marine Police)",
    source: "RNP Marine Unit",
    category: "police",
    is_verified: true,
  },
  {
    number: "3511",
    name_kiny: "Kurega umupolisi wakoze nabi",
    name_eng: "Inspectorate of Police (Police abuse report)",
    source: "Rwanda National Police",
    category: "police",
    is_verified: true,
  },
  {
    number: "118",
    name_kiny: "Ibibazo by'impushya zo gutwara",
    name_eng: "Driving licence enquiries",
    source: "Traffic Police Rwanda",
    category: "traffic",
    is_verified: true,
  },
];

/**
 * Nationwide Provinces and Districts of Rwanda
 */
export const RWANDA_PROVINCES: AdministrativeUnit[] = [
  { code: "RW-01", name_kiny: "Umujyi wa Kigali", name_eng: "Kigali City", level: "province" },
  { code: "RW-02", name_kiny: "Intara y'Amajyepfo", name_eng: "Southern Province", level: "province" },
  { code: "RW-03", name_kiny: "Intara y'Iburengerazuba", name_eng: "Western Province", level: "province" },
  { code: "RW-04", name_kiny: "Intara y'Amajyaruguru", name_eng: "Northern Province", level: "province" },
  { code: "RW-05", name_kiny: "Intara y'Iburasirazuba", name_eng: "Eastern Province", level: "province" },
];

export const RWANDA_DISTRICTS: AdministrativeUnit[] = [
  // Kigali City
  { code: "RW-01-01", name_kiny: "Gasabo", name_eng: "Gasabo District", level: "district", parent_code: "RW-01" },
  { code: "RW-01-02", name_kiny: "Kicukiro", name_eng: "Kicukiro District", level: "district", parent_code: "RW-01" },
  { code: "RW-01-03", name_kiny: "Nyarugenge", name_eng: "Nyarugenge District", level: "district", parent_code: "RW-01" },
  
  // Southern Province
  { code: "RW-02-01", name_kiny: "Huye", name_eng: "Huye District", level: "district", parent_code: "RW-02" },
  { code: "RW-02-02", name_kiny: "Nyanza", name_eng: "Nyanza District", level: "district", parent_code: "RW-02" },
  { code: "RW-02-03", name_kiny: "Gisagara", name_eng: "Gisagara District", level: "district", parent_code: "RW-02" },
  { code: "RW-02-04", name_kiny: "Muhanga", name_eng: "Muhanga District", level: "district", parent_code: "RW-02" },
  { code: "RW-02-05", name_kiny: "Kamonyi", name_eng: "Kamonyi District", level: "district", parent_code: "RW-02" },
  { code: "RW-02-06", name_kiny: "Ruhango", name_eng: "Ruhango District", level: "district", parent_code: "RW-02" },
  { code: "RW-02-07", name_kiny: "Nyamagabe", name_eng: "Nyamagabe District", level: "district", parent_code: "RW-02" },
  { code: "RW-02-08", name_kiny: "Nyaruguru", name_eng: "Nyaruguru District", level: "district", parent_code: "RW-02" },

  // Western Province
  { code: "RW-03-01", name_kiny: "Rubavu", name_eng: "Rubavu District", level: "district", parent_code: "RW-03" },
  { code: "RW-03-02", name_kiny: "Karongi", name_eng: "Karongi District", level: "district", parent_code: "RW-03" },
  { code: "RW-03-03", name_kiny: "Rusizi", name_eng: "Rusizi District", level: "district", parent_code: "RW-03" },
  { code: "RW-03-04", name_kiny: "Nyamasheke", name_eng: "Nyamasheke District", level: "district", parent_code: "RW-03" },
  { code: "RW-03-05", name_kiny: "Rutsiro", name_eng: "Rutsiro District", level: "district", parent_code: "RW-03" },
  { code: "RW-03-06", name_kiny: "Ngororero", name_eng: "Ngororero District", level: "district", parent_code: "RW-03" },
  { code: "RW-03-07", name_kiny: "Nyabihu", name_eng: "Nyabihu District", level: "district", parent_code: "RW-03" },

  // Northern Province
  { code: "RW-04-01", name_kiny: "Musanze", name_eng: "Musanze District", level: "district", parent_code: "RW-04" },
  { code: "RW-04-02", name_kiny: "Gicumbi", name_eng: "Gicumbi District", level: "district", parent_code: "RW-04" },
  { code: "RW-04-03", name_kiny: "Rulindo", name_eng: "Rulindo District", level: "district", parent_code: "RW-04" },
  { code: "RW-04-04", name_kiny: "Burera", name_eng: "Burera District", level: "district", parent_code: "RW-04" },
  { code: "RW-04-05", name_kiny: "Gakenke", name_eng: "Gakenke District", level: "district", parent_code: "RW-04" },

  // Eastern Province
  { code: "RW-05-01", name_kiny: "Rwamagana", name_eng: "Rwamagana District", level: "district", parent_code: "RW-05" },
  { code: "RW-05-02", name_kiny: "Bugesera", name_eng: "Bugesera District", level: "district", parent_code: "RW-05" },
  { code: "RW-05-03", name_kiny: "Kayonza", name_eng: "Kayonza District", level: "district", parent_code: "RW-05" },
  { code: "RW-05-04", name_kiny: "Gatsibo", name_eng: "Gatsibo District", level: "district", parent_code: "RW-05" },
  { code: "RW-05-05", name_kiny: "Nyagatare", name_eng: "Nyagatare District", level: "district", parent_code: "RW-05" },
  { code: "RW-05-06", name_kiny: "Kirehe", name_eng: "Kirehe District", level: "district", parent_code: "RW-05" },
  { code: "RW-05-07", name_kiny: "Ngoma", name_eng: "Ngoma District", level: "district", parent_code: "RW-05" },
];

/**
 * Key Sectors across Gasabo and representative districts
 */
export const REPRESENTATIVE_SECTORS: AdministrativeUnit[] = [
  // Gasabo sectors
  { code: "RW-01-01-01", name_kiny: "Kacyiru", name_eng: "Kacyiru Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-02", name_kiny: "Kimironko", name_eng: "Kimironko Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-03", name_kiny: "Remera", name_eng: "Remera Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-04", name_kiny: "Gisozi", name_eng: "Gisozi Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-05", name_kiny: "Kinyinya", name_eng: "Kinyinya Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-06", name_kiny: "Ndera", name_eng: "Ndera Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-07", name_kiny: "Bumbogo", name_eng: "Bumbogo Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-08", name_kiny: "Gikomero", name_eng: "Gikomero Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-09", name_kiny: "Gatsata", name_eng: "Gatsata Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-10", name_kiny: "Jali", name_eng: "Jali Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-11", name_kiny: "Jabana", name_eng: "Jabana Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-12", name_kiny: "Nduba", name_eng: "Nduba Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-13", name_kiny: "Rusororo", name_eng: "Rusororo Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-14", name_kiny: "Rutunga", name_eng: "Rutunga Sector", level: "sector", parent_code: "RW-01-01" },
  { code: "RW-01-01-15", name_kiny: "Kimihurura", name_eng: "Kimihurura Sector", level: "sector", parent_code: "RW-01-01" },

  // Kicukiro sectors
  { code: "RW-01-02-01", name_kiny: "Niboye", name_eng: "Niboye Sector", level: "sector", parent_code: "RW-01-02" },
  { code: "RW-01-02-02", name_kiny: "Kagarama", name_eng: "Kagarama Sector", level: "sector", parent_code: "RW-01-02" },
  { code: "RW-01-02-03", name_kiny: "Kanombe", name_eng: "Kanombe Sector", level: "sector", parent_code: "RW-01-02" },
  { code: "RW-01-02-04", name_kiny: "Gahanga", name_eng: "Gahanga Sector", level: "sector", parent_code: "RW-01-02" },
  { code: "RW-01-02-05", name_kiny: "Kicukiro", name_eng: "Kicukiro Sector", level: "sector", parent_code: "RW-01-02" },

  // Nyarugenge sectors
  { code: "RW-01-03-01", name_kiny: "Nyarugenge", name_eng: "Nyarugenge Sector", level: "sector", parent_code: "RW-01-03" },
  { code: "RW-01-03-02", name_kiny: "Nyamirambo", name_eng: "Nyamirambo Sector", level: "sector", parent_code: "RW-01-03" },
  { code: "RW-01-03-03", name_kiny: "Muhima", name_eng: "Muhima Sector", level: "sector", parent_code: "RW-01-03" },
  { code: "RW-01-03-04", name_kiny: "Kigali", name_eng: "Kigali Sector", level: "sector", parent_code: "RW-01-03" },
  { code: "RW-01-03-05", name_kiny: "Gitega", name_eng: "Gitega Sector", level: "sector", parent_code: "RW-01-03" },

  // Musanze sectors
  { code: "RW-04-01-01", name_kiny: "Muhoza", name_eng: "Muhoza Sector", level: "sector", parent_code: "RW-04-01" },
  { code: "RW-04-01-02", name_kiny: "Cyuve", name_eng: "Cyuve Sector", level: "sector", parent_code: "RW-04-01" },
  { code: "RW-04-01-03", name_kiny: "Kinigi", name_eng: "Kinigi Sector", level: "sector", parent_code: "RW-04-01" },

  // Huye sectors
  { code: "RW-02-01-01", name_kiny: "Ngoma", name_eng: "Ngoma Sector", level: "sector", parent_code: "RW-02-01" },
  { code: "RW-02-01-02", name_kiny: "Tumba", name_eng: "Tumba Sector", level: "sector", parent_code: "RW-02-01" },
  { code: "RW-02-01-03", name_kiny: "Mukura", name_eng: "Mukura Sector", level: "sector", parent_code: "RW-02-01" },

  // Rubavu sectors
  { code: "RW-03-01-01", name_kiny: "Gisenyi", name_eng: "Gisenyi Sector", level: "sector", parent_code: "RW-03-01" },
  { code: "RW-03-01-02", name_kiny: "Rubavu", name_eng: "Rubavu Sector", level: "sector", parent_code: "RW-03-01" },

  // Rwamagana sectors
  { code: "RW-05-01-01", name_kiny: "Kigabiro", name_eng: "Kigabiro Sector", level: "sector", parent_code: "RW-05-01" },
  { code: "RW-05-01-02", name_kiny: "Muhazi", name_eng: "Muhazi Sector", level: "sector", parent_code: "RW-05-01" },
];

export const REPRESENTATIVE_CELLS: AdministrativeUnit[] = [
  // Kacyiru cells
  { code: "RW-01-01-01-01", name_kiny: "Kamatamu", name_eng: "Kamatamu Cell", level: "cell", parent_code: "RW-01-01-01" },
  { code: "RW-01-01-01-02", name_kiny: "Kamukina", name_eng: "Kamukina Cell", level: "cell", parent_code: "RW-01-01-01" },
  { code: "RW-01-01-01-03", name_kiny: "Kibaza", name_eng: "Kibaza Cell", level: "cell", parent_code: "RW-01-01-01" },

  // Kimironko cells
  { code: "RW-01-01-02-01", name_kiny: "Kibagabaga", name_eng: "Kibagabaga Cell", level: "cell", parent_code: "RW-01-01-02" },
  { code: "RW-01-01-02-02", name_kiny: "Nyagatovu", name_eng: "Nyagatovu Cell", level: "cell", parent_code: "RW-01-01-02" },
  { code: "RW-01-01-02-03", name_kiny: "Bibare", name_eng: "Bibare Cell", level: "cell", parent_code: "RW-01-01-02" },

  // Remera cells
  { code: "RW-01-01-03-01", name_kiny: "Nyabisindu", name_eng: "Nyabisindu Cell", level: "cell", parent_code: "RW-01-01-03" },
  { code: "RW-01-01-03-02", name_kiny: "Rukiri I", name_eng: "Rukiri I Cell", level: "cell", parent_code: "RW-01-01-03" },
  { code: "RW-01-01-03-03", name_kiny: "Rukiri II", name_eng: "Rukiri II Cell", level: "cell", parent_code: "RW-01-01-03" },

  // Muhoza cells (Musanze)
  { code: "RW-04-01-01-01", name_kiny: "Ruhengeri", name_eng: "Ruhengeri Cell", level: "cell", parent_code: "RW-04-01-01" },
  { code: "RW-04-01-01-02", name_kiny: "Mpenge", name_eng: "Mpenge Cell", level: "cell", parent_code: "RW-04-01-01" },
];

export const REPRESENTATIVE_VILLAGES: AdministrativeUnit[] = [
  // Kamatamu villages
  { code: "RW-01-01-01-01-01", name_kiny: "Kabagari", name_eng: "Kabagari Village", level: "village", parent_code: "RW-01-01-01-01" },
  { code: "RW-01-01-01-01-02", name_kiny: "Ubumwe", name_eng: "Ubumwe Village", level: "village", parent_code: "RW-01-01-01-01" },
  { code: "RW-01-01-01-01-03", name_kiny: "Amahoro", name_eng: "Amahoro Village", level: "village", parent_code: "RW-01-01-01-01" },
  { code: "RW-01-01-01-01-04", name_kiny: "Gisiza", name_eng: "Gisiza Village", level: "village", parent_code: "RW-01-01-01-01" },

  // Kibagabaga villages
  { code: "RW-01-01-02-01-01", name_kiny: "Karongi", name_eng: "Karongi Village", level: "village", parent_code: "RW-01-01-02-01" },
  { code: "RW-01-01-02-01-02", name_kiny: "Kageyo", name_eng: "Kageyo Village", level: "village", parent_code: "RW-01-01-02-01" },
  { code: "RW-01-01-02-01-03", name_kiny: "Ramiro", name_eng: "Ramiro Village", level: "village", parent_code: "RW-01-01-02-01" },
];

/**
 * Cascading lookup helper functions
 */
export function getDistrictsByProvince(provinceCode: string): AdministrativeUnit[] {
  return RWANDA_DISTRICTS.filter((d) => d.parent_code === provinceCode);
}

export function getSectorsByDistrict(districtCode: string): AdministrativeUnit[] {
  const sectors = REPRESENTATIVE_SECTORS.filter((s) => s.parent_code === districtCode);
  if (sectors.length > 0) return sectors;
  // Fallback synthetic sectors for other districts so UI is always interactive
  const district = RWANDA_DISTRICTS.find((d) => d.code === districtCode);
  const districtName = district?.name_kiny || "Akarere";
  return [
    { code: `${districtCode}-01`, name_kiny: `Umurenge w'Icyitegererezo 1 (${districtName})`, name_eng: `Sector 1`, level: "sector", parent_code: districtCode },
    { code: `${districtCode}-02`, name_kiny: `Umurenge w'Icyitegererezo 2 (${districtName})`, name_eng: `Sector 2`, level: "sector", parent_code: districtCode },
    { code: `${districtCode}-03`, name_kiny: `Umurenge w'Umujyi (${districtName})`, name_eng: `Urban Sector`, level: "sector", parent_code: districtCode },
  ];
}

export function getCellsBySector(sectorCode: string): AdministrativeUnit[] {
  const cells = REPRESENTATIVE_CELLS.filter((c) => c.parent_code === sectorCode);
  if (cells.length > 0) return cells;
  const sector = REPRESENTATIVE_SECTORS.find((s) => s.code === sectorCode);
  const sectorName = sector?.name_kiny || "Umurenge";
  return [
    { code: `${sectorCode}-01`, name_kiny: `Akagari ka 1 (${sectorName})`, name_eng: `Cell 1`, level: "cell", parent_code: sectorCode },
    { code: `${sectorCode}-02`, name_kiny: `Akagari ka 2 (${sectorName})`, name_eng: `Cell 2`, level: "cell", parent_code: sectorCode },
  ];
}

export function getVillagesByCell(cellCode: string): AdministrativeUnit[] {
  const villages = REPRESENTATIVE_VILLAGES.filter((v) => v.parent_code === cellCode);
  if (villages.length > 0) return villages;
  return [
    { code: `${cellCode}-01`, name_kiny: "Umudugudu w'Ubumwe", name_eng: "Unity Village", level: "village", parent_code: cellCode },
    { code: `${cellCode}-02`, name_kiny: "Umudugudu w'Amahoro", name_eng: "Peace Village", level: "village", parent_code: cellCode },
    { code: `${cellCode}-03`, name_kiny: "Umudugudu w'Ubwiyunge", name_eng: "Reconciliation Village", level: "village", parent_code: cellCode },
  ];
}

