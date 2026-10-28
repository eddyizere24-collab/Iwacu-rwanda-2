import type { LocationErrorCode, LocateError } from "@/types/location";

const ERROR_MESSAGES: Record<
  LocationErrorCode,
  { kiny: string; eng: string }
> = {
  GPS_DENIED: {
    kiny: "Wanze ko twakoresha GPS. Fungura amarebe y’uburyo bwo gukoresha ahantu cyangwa shakisha manuelle.",
    eng: "Location permission denied. Enable location access or use manual search.",
  },
  GPS_ACCURACY_TOO_LOW: {
    kiny: "GPS ntabwo iri ku buryo bwiza (accuracy > 150m). Gerageza hanze cyangwa shakisha manuelle.",
    eng: "GPS accuracy is too low (> 150 m). Try outdoors or use manual search.",
  },
  OUTSIDE_RWANDA: {
    kiny: "Aha hantu ntabwo hari mu Rwanda. Shakisha manuelle cyangwa gerageza GPS mu gihugu.",
    eng: "This location is outside Rwanda. Use manual search or try GPS inside the country.",
  },
  POINT_IN_GAP: {
    kiny: "Aha hantu ntabwo hagaragara mu mategeko y’ubutegetsi. Gerageza ahantu hafi cyangwa shakisha manuelle.",
    eng: "This point falls in a data gap. Try a nearby location or manual search.",
  },
  POINT_IN_OVERLAP: {
    kiny: "Aha hantu hagaragara mu bice byinshi. Reba ibice byose n’ibipimo by’icyizere.",
    eng: "This point lies in an overlap zone. Review all matching areas and their confidence scores.",
  },
  CONFIDENCE_TOO_LOW: {
    kiny: "Ntabwo dushobora kumenya neza aho uri (icyizere < 5%). Gerageza GPS cyangwa shakisha manuelle.",
    eng: "Confidence is too low (< 5%). Improve GPS signal or use manual search.",
  },
  MISSING_LEADER_CONTACT: {
    kiny: "Umuyobozi aboneka ariko nta numero ya telefone ihari. Gerageza nyuma.",
    eng: "Leader found but contact number is missing. Please try again later.",
  },
  NETWORK_ERROR: {
    kiny: "Ikibazo cy’urukurikirane. Gerageza nanone cyangwa reba niba ufite interineti.",
    eng: "Network error. Check your connection and try again.",
  },
  NOT_FOUND: {
    kiny: "Icyo wasabye nticyabonetse. Gerageza gushakisha ikindi.",
    eng: "The requested resource was not found.",
  },
  SLOW_NETWORK: {
    kiny: "Urukurikirane rurasize. Tegereza gato...",
    eng: "Network is slow. Please wait...",
  },
  OFFLINE_CACHE: {
    kiny: "Uri offline. Dukoresha amakuru yabitswe (Gasabo gusa).",
    eng: "You are offline. Using cached data (Gasabo only).",
  },
  BROWSER_NOT_SUPPORTED: {
    kiny: "Browser yawe ntabwo ishyigikiwe. Koresha Chrome, Firefox cyangwa Safari ya vuba.",
    eng: "Your browser is not supported. Please use a recent Chrome, Firefox or Safari.",
  },
  RATE_LIMIT: {
    kiny: "Wakoze ibisabwa byinshi cyane. Tegereza gato hanyuma ugerageze nanone.",
    eng: "Too many requests. Please wait a moment and try again.",
  },
  CONCURRENT_EDIT_CONFLICT: {
    kiny: "Ubundi mukoresha ahinduye amakuru. Reba itandukaniro hanyuma wemeze.",
    eng: "Another user modified this record. Review the difference and confirm.",
  },
  LEADER_MISSING: {
    kiny: "Nta muyobozi uhari kuri uyu mwanya. Gerageza nyuma.",
    eng: "No leader is currently assigned to this scope.",
  },
};

export function createLocateError(
  code: LocationErrorCode,
  details?: Record<string, unknown>
): LocateError {
  const msg = ERROR_MESSAGES[code];
  return {
    status: "error",
    code,
    message_kiny: msg.kiny,
    message_eng: msg.eng,
    details,
  };
}
