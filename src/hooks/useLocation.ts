"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocateResponse, LocateSuccess, LocationErrorCode } from "@/types/location";
import type { ConfidenceMatch } from "@/types/boundary";
import type { LeaderPublic } from "@/types/leader";
import { calculateConfidenceOffline } from "@/lib/turf-logic";
import type { OfflineBoundaryCollection } from "@/lib/turf-logic";
import { nearestVillageEstimateFromIndex } from "@/lib/representative-location";
import { createRwandaProvincePrior } from "@/lib/location-prior";

export type LocationStatus =
  | "idle"
  | "requesting_gps"
  | "locating"
  | "success"
  | "error"
  | "offline";

type FeedbackMethod = "gps" | "map" | "manual" | "nearest" | "offline";

export interface UseLocationState {
  status: LocationStatus;
  data: LocateSuccess | null;
  errorCode: LocationErrorCode | null;
  errorMessageKiny: string | null;
  errorMessageEng: string | null;
  isOffline: boolean;
  noticeKiny: string | null;
}

const INITIAL: UseLocationState = {
  status: "idle",
  data: null,
  errorCode: null,
  errorMessageKiny: null,
  errorMessageEng: null,
  isOffline: false,
  noticeKiny: null,
};

const GPS_TIMEOUT_MS = 15_000;
const LAST_FIX_KEY = "iwacu-last-location-fix";

export function useLocation() {
  const [state, setState] = useState<UseLocationState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const lastFixRef = useRef<{ latitude: number; longitude: number; accuracy: number; method: FeedbackMethod; recordedAt: number } | null>(null);
  const feedbackMethodRef = useRef<FeedbackMethod>("manual");
  const watchIdRef = useRef<number | null>(null);
  const watchStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopLocationWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (watchStopTimerRef.current) {
      clearTimeout(watchStopTimerRef.current);
      watchStopTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
    stopLocationWatch();
  }, [stopLocationWatch]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    stopLocationWatch();
    setState(INITIAL);
  }, [stopLocationWatch]);

  const locate = useCallback(async () => {
    abortRef.current?.abort();
    stopLocationWatch();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ ...INITIAL, status: "requesting_gps" });

    const online = typeof navigator !== "undefined" && navigator.onLine !== false;
    let bestAccuracy = Number.POSITIVE_INFINITY;
    let bestHasCoordinates = false;
    let firstAnswerResolved = false;
    let resolveFirstAnswer: (() => void) | null = null;
    const firstAnswer = new Promise<void>((resolve) => { resolveFirstAnswer = resolve; });
    const signalFirstAnswer = () => {
      if (firstAnswerResolved) return;
      firstAnswerResolved = true;
      resolveFirstAnswer?.();
    };

    const showSuccess = (json: LocateSuccess, effectiveAccuracy: number, fixAgeMs: number, notice?: string, point?: { latitude: number; longitude: number }) => {
      const hasCoordinates = Boolean(point || (Number.isFinite(json.latitude) && Number.isFinite(json.longitude)));
      if (controller.signal.aborted || effectiveAccuracy > bestAccuracy || (effectiveAccuracy === bestAccuracy && bestHasCoordinates && !hasCoordinates)) return;
      bestAccuracy = effectiveAccuracy;
      bestHasCoordinates = hasCoordinates;
      setState({
        status: "success",
        data: {
          ...json,
          accuracy_m: Number.isFinite(effectiveAccuracy) ? Math.round(effectiveAccuracy) : undefined,
          latitude: point?.latitude ?? json.latitude,
          longitude: point?.longitude ?? json.longitude,
          fix_age_ms: Math.max(0, fixAgeMs),
        },
        errorCode: null,
        errorMessageKiny: null,
        errorMessageEng: null,
        isOffline: !online,
        noticeKiny: notice ?? null,
      });
      signalFirstAnswer();
    };

    const showNotice = (notice: string) => {
      setState((current) => ({ ...current, noticeKiny: notice }));
    };

    const showRwandaPrior = (notice: string) => {
      if (controller.signal.aborted || firstAnswerResolved) return;
      setState({
        status: "success",
        data: createRwandaProvincePrior(false),
        errorCode: null,
        errorMessageKiny: null,
        errorMessageEng: null,
        isOffline: !online,
        noticeKiny: notice,
      });
      signalFirstAnswer();
    };

    const submitFix = async (
      latitude: number,
      longitude: number,
      rawAccuracy: number,
      timestamp: number,
      kind: "network" | "gps" | "last-known"
    ) => {
      if (controller.signal.aborted) return;
      const fixAgeMs = Math.max(0, Date.now() - timestamp);
      const effectiveAccuracy = Math.min(
        50_000,
        Math.max(1, Number.isFinite(rawAccuracy) ? rawAccuracy : 50_000) +
          (fixAgeMs / 1000) * (kind === "last-known" ? 20 : 5)
      );
      if (effectiveAccuracy >= bestAccuracy) return;

      lastFixRef.current = {
        latitude,
        longitude,
        accuracy: effectiveAccuracy,
        method: "gps",
        recordedAt: timestamp,
      };

      if (kind !== "last-known") {
        try {
          localStorage.setItem(LAST_FIX_KEY, JSON.stringify({
            latitude, longitude, accuracy: effectiveAccuracy, method: kind, recordedAt: timestamp,
          }));
        } catch {
          // Location still works if browser storage is disabled.
        }
      }

      if (!online) {
        const offline = await runOfflineConfidence(latitude, longitude, effectiveAccuracy);
        if (offline.status === "success") {
          const result = kind === "last-known"
            ? { ...offline, source: "last-known" as const, warning: "LAST_KNOWN_FIX_WITH_AGE_INFLATED_RADIUS" }
            : offline;
          showSuccess(result, effectiveAccuracy, fixAgeMs, effectiveAccuracy > 2_000 ? "Telefone yatanze ahantu hagereranyijwe (approximate). Turakoresha nubwo radius yaba nini; ushobora gukomeza kureba ibimenyetso byegereye." : undefined, { latitude, longitude });
        } else {
          showNotice("Telefone iri kugerageza amakuru yari yarabonye mbere; ikarita iri hasi na yo iragufasha.");
        }
        return;
      }

      try {
        const response = await fetch("/api/locate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude,
            longitude,
            accuracy: effectiveAccuracy,
            method: kind === "network" ? "network" : "gps",
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          showNotice("Ikimenyetso cy'ahantu kiracyagenzurwa; turimo kugerageza ubundi buryo.");
          return;
        }
        const json = (await response.json()) as LocateResponse;
        if (json.status === "success") {
          const result = kind === "last-known"
            ? { ...json, source: "last-known" as const, warning: "LAST_KNOWN_FIX_WITH_AGE_INFLATED_RADIUS" }
            : json;
          const precisionNotice = effectiveAccuracy > 2_000
            ? "Telefone yatanze ahantu hagereranyijwe (approximate). Niba ushaka kunoza aho uri, fungura Settings → Location → Google Location Accuracy; igisubizo kiracyakora kandi kiravugururwa."
            : undefined;
          showSuccess(result, effectiveAccuracy, fixAgeMs, precisionNotice, { latitude, longitude });
        } else {
          showNotice("Ibiranga aho uri biracyegeranywa; turacyategereje ikimenyetso cyiza kurushaho.");
        }
      } catch {
        if (!controller.signal.aborted) {
          showNotice("Interineti yatinze. Turacyagerageza ibimenyetso bihari kuri telefone.");
        }
      }
    };

    const submitIpEstimate = async () => {
      if (!online || controller.signal.aborted) return;
      try {
        const response = await fetch("/api/locate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "ip" }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const json = (await response.json()) as LocateResponse;
        if (json.status === "success") {
          showSuccess(
            json,
            json.accuracy_m ?? 50_000,
            0,
            "Iri ni igereranya rishingiye ku muyoboro wa interineti, si GPS nyayo."
          );
        }
      } catch {
        // IP geolocation is best-effort; GPS/network signals continue independently.
      }
    };

    // Start a cached last-known fix and Vercel IP lookup at once.
    try {
      const raw = localStorage.getItem(LAST_FIX_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          latitude?: number; longitude?: number; accuracy?: number; recordedAt?: number;
        };
        if (
          Number.isFinite(saved.latitude) &&
          Number.isFinite(saved.longitude) &&
          Number.isFinite(saved.accuracy) &&
          Number.isFinite(saved.recordedAt)
        ) {
          void submitFix(
            saved.latitude as number,
            saved.longitude as number,
            saved.accuracy as number,
            saved.recordedAt as number,
            "last-known"
          );
        }
      }
    } catch {
      // Ignore invalid cached coordinates.
    }
    void submitIpEstimate();

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      await Promise.race([
        firstAnswer,
        new Promise<void>((resolve) => setTimeout(resolve, 4_000)),
      ]);
      if (!firstAnswerResolved && !controller.signal.aborted) {
        showRwandaPrior("Nta coordinates telefone yashoboye gutanga. Izi ntara ni prior ingana gusa, si aho uri hapimwe.");
      }
      return;
    }

    const onPosition = (position: GeolocationPosition, kind: "network" | "gps") => {
      void submitFix(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy,
        position.timestamp,
        kind
      );
    };

    const onGeolocationError = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        showNotice("Uburenganzira bwa Location burafunze. Bufungure muri Settings → Apps → Chrome → Permissions → Location. Turacyagerageza IP cyangwa aho telefone yari iherutse kubona.");
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        showNotice("Reba ko Location ya telefone iri ON: Settings → Location. Kunoza indoor fix, fungura Location Services → Google Location Accuracy na Wi-Fi/Bluetooth scanning. Igisubizo kiriho ntigihagarara.");
      } else if (error.code === error.TIMEOUT) {
        showNotice("GPS iracyashakisha. Ikimenyetso cya network/Wi-Fi cyangwa aho telefone yari iherutse kubona gishobora gutanga igisubizo mbere.");
      }
    };

    // Both requests start at second zero. A quick network/cached fix does not
    // wait for the GPS watch to time out.
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => onPosition(position, "network"),
        onGeolocationError,
        { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 }
      );
    } catch {
      showNotice("Ntabwo twashoboye gutangiza uburyo bwihuse bwo kumenya aho uri.");
    }

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => onPosition(position, "gps"),
        onGeolocationError,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 45_000 }
      );
      // Keep refining after the first answer, then stop to save battery.
      watchStopTimerRef.current = setTimeout(stopLocationWatch, 60_000);
    } catch {
      showNotice("GPS ntishoboye gutangira; uburyo bwihuse n'igereranya rya IP birakomeza.");
    }

    await Promise.race([
      firstAnswer,
      new Promise<void>((resolve) => setTimeout(resolve, 4_000)),
    ]);

    if (!firstAnswerResolved && !controller.signal.aborted) {
      showRwandaPrior("Nta coordinates ziraboneka. Turacyategereje GPS/network; mu gihe gito, intara zigaragara ni amahitamo angana gusa, si amahirwe apimwe.");
    }
  }, [stopLocationWatch]);

  const chooseVillage = useCallback(async (scopeCode: string, selectionMethod: FeedbackMethod = "manual") => {
    feedbackMethodRef.current = typeof navigator !== "undefined" && !navigator.onLine && selectionMethod === "manual" ? "offline" : selectionMethod;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ ...INITIAL, status: "locating" });
    try {
      let json: LocateResponse;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        // Offline picker mode: read the bundled/cached static index first.
        // Its compact tuple rows avoid unnecessary download bytes on mobile.
        let indexPayload: { choices?: unknown[] };
        try {
          const staticResponse = await fetch("/offline/location-index.json", {
            signal: controller.signal,
            cache: "force-cache",
          });
          if (!staticResponse.ok) throw new Error("static_location_index_unavailable");
          indexPayload = await staticResponse.json() as { choices?: unknown[] };
        } catch {
          // Older app shells may only have the cached API index.
          const indexResponse = await fetch("/api/locate?index=1", { signal: controller.signal });
          if (!indexResponse.ok) throw new Error("offline_location_index_unavailable");
          indexPayload = await indexResponse.json() as { choices?: unknown[] };
        }
        const rawEntries = Array.isArray(indexPayload.choices) ? indexPayload.choices : [];
        type CachedChoice = {
          scope_code: string;
          name_kiny: string;
          name_eng: string | null;
          level: "province" | "district" | "sector" | "cell" | "village";
          parent_scope_code: string | null;
        };
        const entries = rawEntries.flatMap((raw): CachedChoice[] => {
          if (Array.isArray(raw) && raw.length >= 5) {
            return [{
              scope_code: String(raw[0]),
              name_kiny: String(raw[1]),
              name_eng: raw[2] == null ? null : String(raw[2]),
              level: String(raw[3]) as CachedChoice["level"],
              parent_scope_code: raw[4] == null ? null : String(raw[4]),
            }];
          }
          if (raw && typeof raw === "object") {
            return [raw as CachedChoice];
          }
          return [];
        });
        const byCode = new Map(entries.map((entry) => [entry.scope_code, entry]));
        let current = byCode.get(scopeCode);
        if (!current || current.level !== "village") throw new Error("village_not_in_cached_index");

        const hierarchy: LocateSuccess["hierarchy"] = {};
        let villageMatch: ConfidenceMatch | null = null;
        for (let depth = 0; current && depth < 6; depth += 1) {
          const match: ConfidenceMatch = {
            scope_code: current.scope_code,
            name_kiny: current.name_kiny,
            name_eng: current.name_eng,
            level: current.level,
            confidence: 100,
            intersection_area_m2: 0,
          };
          if (current.level === "province") hierarchy.province = match;
          if (current.level === "district") hierarchy.district = match;
          if (current.level === "sector") hierarchy.sector = match;
          if (current.level === "cell") hierarchy.cell = match;
          if (current.level === "village") {
            hierarchy.village = match;
            villageMatch = match;
          }
          current = current.parent_scope_code ? byCode.get(current.parent_scope_code) : undefined;
        }
        if (!villageMatch) throw new Error("village_hierarchy_unavailable");
        json = {
          status: "success",
          matches: [villageMatch],
          hierarchy,
          leaders: [],
          source: "manual",
          warning: "USER_CONFIRMED_OFFLINE",
        };
      } else {
        const response = await fetch("/api/locate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "manual", scope_code: scopeCode }),
          signal: controller.signal,
        });
        json = (await response.json()) as LocateResponse;
      }
      if (json.status !== "success") {
        setState({
          ...INITIAL,
          status: "error",
          errorCode: json.code,
          errorMessageKiny: json.message_kiny,
          errorMessageEng: json.message_eng,
        });
        return;
      }
      try {
        localStorage.setItem("iwacu-confirmed-village", JSON.stringify({
          scope_code: scopeCode,
          name_kiny: json.matches[0]?.name_kiny ?? "",
          confirmed_at: new Date().toISOString(),
        }));
      } catch {
        // The location selection still works if storage is disabled.
      }
      setState({
        status: "success",
        data: json,
        errorCode: null,
        errorMessageKiny: null,
        errorMessageEng: null,
        isOffline: typeof navigator !== "undefined" && !navigator.onLine,
        noticeKiny: null,
      });
    } catch {
      if (controller.signal.aborted) return;
      setState({
        ...INITIAL,
        status: "error",
        errorCode: "NETWORK_ERROR",
        errorMessageKiny: "Interineti irimo ikibazo. Gerageza guhitamo umudugudu uri ku rutonde.",
        errorMessageEng: "Network error. Choose a village from the list.",
      });
    }
  }, []);

  const locateAtCoordinate = useCallback(async (
    latitude: number,
    longitude: number,
    accuracy = 200
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastFixRef.current = { latitude, longitude, accuracy, method: "map", recordedAt: Date.now() };
    feedbackMethodRef.current = "map";
    setState({ ...INITIAL, status: "locating" });

    const showCoordinateFallback = async (notice: string) => {
      const fallback = await runOfflineConfidence(latitude, longitude, accuracy);
      if (controller.signal.aborted) return;
      const data = fallback.status === "success"
        ? { ...fallback, source: "nearest" as const }
        : createRwandaProvincePrior(false);
      setState({
        status: "success",
        data,
        errorCode: null,
        errorMessageKiny: null,
        errorMessageEng: null,
        isOffline: typeof navigator !== "undefined" && navigator.onLine === false,
        noticeKiny: notice,
      });
    };

    try {
      const response = await fetch("/api/locate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, accuracy, method: "map" }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        await showCoordinateFallback("Ikarita ntiyabashije kugenzura neza. Turakwereka igereranya rishingiye ku makuru y'ahantu abitswe.");
        return;
      }
      const json = (await response.json()) as LocateResponse;
      if (json.status === "error") {
        await showCoordinateFallback("Serivisi y'imbibi ntibonetse. Igereranya rishingiye ku makuru yemewe riracyagaragara.");
        return;
      }
      setState({
        status: "success",
        data: json,
        errorCode: null,
        errorMessageKiny: null,
        errorMessageEng: null,
        isOffline: false,
        noticeKiny: null,
      });
    } catch {
      if (controller.signal.aborted) return;
      await showCoordinateFallback("Interineti ntibashije kugenzura ikarita. Turakwereka igereranya rishingiye ku makuru yari abitswe.");
    }
  }, []);

  const submitLocationFeedback = useCallback(async (scopeCode: string): Promise<void> => {
    const method = feedbackMethodRef.current;
    const candidateFix = lastFixRef.current;
    const fixIsRecent = candidateFix && Date.now() - candidateFix.recordedAt <= 30 * 60 * 1000;
    const fix = method !== "manual" &&
      fixIsRecent &&
      (method !== "offline" || candidateFix?.method === "offline")
      ? candidateFix
      : null;
    const response = await fetch("/api/location-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consent: true,
        scope_code: scopeCode,
        method,
        accuracy_m: fix?.accuracy ?? null,
        latitude: fix?.latitude ?? null,
        longitude: fix?.longitude ?? null,
      }),
    });
    if (!response.ok) {
      throw new Error("location_feedback_unavailable");
    }
  }, []);

  return { ...state, locate, reset, chooseVillage, locateAtCoordinate, submitLocationFeedback };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBestPosition(timeoutMs: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let best: GeolocationPosition | null = null;
    let lastError: GeolocationPositionError | null = null;
    let settled = false;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);

      // If GPS is already reasonably precise, use it. Otherwise also try the
      // browser's coarse network/Wi-Fi provider and keep whichever fix is better.
      if (best && best.coords.accuracy <= 150) {
        resolve(best);
        return;
      }
      if (lastError && lastError.code === lastError.PERMISSION_DENIED && !best) {
        reject(lastError);
        return;
      }
      const bestSoFar = best;
      navigator.geolocation.getCurrentPosition(
        (coarse) => {
          if (!bestSoFar || coarse.coords.accuracy < bestSoFar.coords.accuracy) {
            resolve(coarse);
          } else {
            resolve(bestSoFar);
          }
        },
        (error) => {
          if (bestSoFar) resolve(bestSoFar);
          else reject(error);
        },
        {
          enableHighAccuracy: false,
          timeout: 5_000,
          maximumAge: 300_000,
        }
      );
    };

    timer = setTimeout(finish, Math.min(timeoutMs, 10_000));
    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!best || position.coords.accuracy < best.coords.accuracy) best = position;
          if (position.coords.accuracy <= 35) finish();
        },
        (error) => {
          lastError = error;
          if (error.code === error.PERMISSION_DENIED) finish();
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 10_000,
        }
      );
    } catch {
      if (timer) clearTimeout(timer);
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 5_000,
        maximumAge: 300_000,
      });
    }
  });
}

async function runOfflineConfidence(
  latitude: number,
  longitude: number,
  accuracy: number
): Promise<LocateResponse> {
  const representativeFallback = async (): Promise<LocateResponse> => {
    try {
      // The compact hierarchy index includes official representative points
      // and is precached by the Service Worker. It allows an explicitly
      // estimated village even when offline polygon data is not installed.
      const response = await fetch("/offline/location-index.json", {
        cache: "force-cache",
      });
      if (response.ok) {
        const estimate = nearestVillageEstimateFromIndex(
          await response.json(),
          latitude,
          longitude,
          accuracy,
          "OFFLINE_REPRESENTATIVE_POINT_ESTIMATE"
        );
        if (estimate) return estimate;
      }
    } catch {
      // Fall through to the honest OFFLINE_CACHE error if even the index is absent.
    }
    return {
      status: "error",
      code: "OFFLINE_CACHE",
      message_kiny:
        "Uri offline kandi urutonde rw'ahantu ntirwabitswe. Ongera uhuze interineti cyangwa uhitemo aho uzi ku rutonde.",
      message_eng:
        "You are offline and the location index is not cached. Reconnect or use a saved place list.",
    };
  };

  try {
    let response: Response | undefined;
    if (typeof caches !== "undefined") {
      try {
        const cache = await caches.open("iwacu-boundaries-v1");
        response = await cache.match("/offline/rwanda-village-boundaries.geojson");
      } catch {
        // Cache API unavailable
      }
    }
    if (!response) {
      try {
        response = await fetch("/offline/rwanda-village-boundaries.geojson");
      } catch {
        // Fetch failed
      }
    }
    if (!response || !response.ok) return representativeFallback();

    const geojson = (await response.json()) as OfflineBoundaryCollection;
    const polygonResult = calculateConfidenceOffline(
      latitude,
      longitude,
      accuracy,
      geojson
    );
    return polygonResult.status === "success" ? polygonResult : representativeFallback();
  } catch {
    return representativeFallback();
  }
}
