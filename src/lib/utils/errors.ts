import type { LocationErrorCode, LocateError } from "@/types/location";

export interface D1ErrorInfo {
  title: string;
  message: string;
  buttonText?: string;
  isOwnFault: boolean; // false = "ikibazo cyacu" / not blaming user
}

export const D1_ERRORS: Record<string, D1ErrorInfo> = {
  GPS_DENIED: {
    title: "GPS irafunze",
    message:
      "Ntidushobora kumenya aho uri kuko telefone itatwemereye. Fungura: Settings › Location (Igenamiterere › Aho uri), wemerere iyi porogaramu.",
    buttonText: "Ongera ugerageze",
    isOwnFault: false,
  },
  GPS_UNAVAILABLE: {
    title: "Telefone ntiyabonye aho uri",
    message: "Ntitwashoboye kubona aho uri. Hitamo umudugudu wawe ku rutonde ruri hasi.",
    buttonText: "Ongera ugerageze",
    isOwnFault: false,
  },
  GPS_TIMEOUT: {
    title: "Birimo gutinda",
    message:
      "GPS yafashe igihe kirekire. Ushobora gukomeza uhitamo umudugudu ku rutonde ruri hasi.",
    buttonText: "Ongera ugerageze",
    isOwnFault: false,
  },
  BROWSER_NOT_SUPPORTED: {
    title: "Iyi porogaramu ntishobora kumenya aho uri",
    message: "Gerageza indi porogaramu yo kureba imbuga (nka Chrome).",
    isOwnFault: false,
  },
  INVALID_COORDINATES: {
    title: "Aho uri ntihasomye neza",
    message: "Ongera ugerageze.",
    buttonText: "Ongera ugerageze",
    isOwnFault: false,
  },
  OUTSIDE_RWANDA: {
    title: "Uri hanze y'u Rwanda",
    message:
      "Iyi porogaramu ikora mu Rwanda gusa. Nimero z'ubutabazi z'u Rwanda ziracyaboneka.",
    isOwnFault: false,
  },
  POINT_IN_GAP: {
    title: "Ntitwabonye umudugudu wawe",
    message:
      "Aho uri ntihaboneka mu mipaka dufite. Egera ahandi, wongere ugerageze.",
    buttonText: "Ongera ugerageze",
    isOwnFault: false,
  },
  POINT_IN_OVERLAP: {
    title: "Uri ku mupaka",
    message:
      "Uri hagati y'imidugudu ibiri. Turakwereka abayobozi b'iyo yombi.",
    isOwnFault: false,
  },
  CONFIDENCE_TOO_LOW: {
    title: "Ntituzi neza aho uri",
    message:
      "Ntidushobora kwemeza umudugudu wawe. Ongera ugerageze uri ahafunguye.",
    buttonText: "Ongera ugerageze",
    isOwnFault: false,
  },
  DATA_NOT_AVAILABLE: {
    title: "Aka gace ntikaraboneka",
    message:
      "Imipaka y'aka gace ntiratugeraho. Si ikibazo cya telefone yawe. Mwihangane, turakomeza kongeramo amakuru.",
    isOwnFault: false,
  },
  DATABASE_ERROR: {
    title: "Hari ikibazo cyacu",
    message:
      "Ntitubashije kubona amakuru ubu. Si ikibazo cyawe. Mwihangane, ongera ugerageze nyuma y'akanya gato.",
    buttonText: "Ongera ugerageze",
    isOwnFault: false,
  },
  NETWORK_ERROR: {
    title: "Interineti ntirimo gukora",
    message:
      "Ntitwabashije kugera ku rubuga. Reba interineti yawe, hanyuma wongere ugerageze.",
    buttonText: "Ongera ugerageze",
    isOwnFault: false,
  },
  SLOW_NETWORK: {
    title: "Interineti iratinda",
    message: "Tegereza gato…",
    isOwnFault: false,
  },
  OFFLINE_CACHE: {
    title: "Nta interineti",
    message:
      "Dukoresha amakuru abitswe kuri telefone yawe. Abayobozi ntibagaragara, ariko nimero z'ubutabazi zirakora.",
    isOwnFault: false,
  },
  RATE_LIMIT: {
    title: "Mwihangane, tegereza gato",
    message:
      "Wakanze inshuro nyinshi. Tegereza umunota umwe, hanyuma wongere ugerageze.",
    isOwnFault: false,
  },
  NOT_FOUND: {
    title: "Ntibyabonetse",
    message: "Ibyo ushaka ntibihari.",
    isOwnFault: false,
  },
  LEADER_MISSING: {
    title: "Nta muyobozi uremezwa",
    message:
      "Nta muyobozi uremezwa aha. Reba ab'akagari cyangwa ab'umurenge.",
    isOwnFault: false,
  },
  MISSING_LEADER_CONTACT: {
    title: "Nta buryo bwo kuvugana",
    message:
      "Uyu muyobozi ntaragira uburyo bwo kuvugana bwanditswe. Reba abayobozi b'urwego rukurikira.",
    isOwnFault: false,
  },
};

export function createLocateError(
  code: LocationErrorCode,
  details?: Record<string, unknown>
): LocateError {
  const info = D1_ERRORS[code] || {
    title: "Ikibazo cyabaye",
    message: "Ongera ugerageze.",
    isOwnFault: false,
  };
  return {
    status: "error",
    code,
    message_kiny: info.message,
    message_eng: info.title,
    details,
  };
}
