"use client";

import { useCallback, useRef, useState } from "react";
import type { LocateResponse, LocateSuccess, LocationErrorCode } from "@/types/location";
import type { ConfidenceMatch } from "@/types/boundary";
import type { LeaderPublic } from "@/types/leader";
import { calculateConfidenceOffline } from "@/lib/turf-logic";
import type { OfflineBoundaryCollection } from "@/lib/turf-logic";

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
}

const INITIAL: UseLocationState = {
  status: "idle",
  data: null,
  errorCode: null,
  errorMessageKiny: null,
  errorMessageEng: null,
  isOffline: false,
};

const GPS_TIMEOUT_MS = 15_000;

export function useLocation() {
  const [state, setState] = useState<UseLocationState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const lastFixRef = useRef<{ latitude: number; longitude: number; accuracy: number; method: FeedbackMethod } | null>(null);
  const feedbackMethodRef = useRef<FeedbackMethod>("manual");

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL);
  }, []);

  const locate = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({
      ...s,
      status: "requesting_gps",
      errorCode: null,
      errorMessageKiny: null,
      errorMessageEng: null,
      data: null,
    }));

    // --- Browser support check ---
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({
        ...INITIAL,
        status: "error",
        errorCode: "BROWSER_NOT_SUPPORTED",
        errorMessageKiny:
          "Browser yawe ntabwo ishyigikiwe. Koresha Chrome, Firefox cyangwa Safari ya vuba.",
        errorMessageEng:
          "Your browser is not supported. Please use a recent Chrome, Firefox or Safari.",
      });
      return;
    }

    const isOnline = typeof navigator.onLine === "boolean" ? navigator.onLine : true;

    try {
      const position = await getBestPosition(GPS_TIMEOUT_MS);
      if (controller.signal.aborted) return;

      const { latitude, longitude, accuracy } = position.coords;
      const fixMethod: FeedbackMethod = isOnline ? "gps" : "offline";
      lastFixRef.current = { latitude, longitude, accuracy, method: fixMethod };
      feedbackMethodRef.current = fixMethod;

      setState((s) => ({ ...s, status: "locating" }));

      // --- Offline path ---
      if (!isOnline) {
        const offlineResult = await runOfflineConfidence(
          latitude,
          longitude,
          accuracy
        );
        if (controller.signal.aborted) return;

        if (offlineResult.status === "error") {
          setState({
            ...INITIAL,
            status: "error",
            isOffline: true,
            errorCode: offlineResult.code,
            errorMessageKiny: offlineResult.message_kiny,
            errorMessageEng: offlineResult.message_eng,
          });
          return;
        }

        setState({
          status: "success",
          data: offlineResult,
          errorCode: null,
          errorMessageKiny: null,
          errorMessageEng: null,
          isOffline: true,
        });
        return;
      }

      // --- Online path: call /api/locate ---
      const res = await fetch("/api/locate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, accuracy }),
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (res.status === 429) {
        setState({
          ...INITIAL,
          status: "error",
          errorCode: "RATE_LIMIT",
          errorMessageKiny:
            "Wakoze ibisabwa byinshi cyane. Tegereza gato hanyuma ugerageze nanone.",
          errorMessageEng:
            "Too many requests. Please wait a moment and try again.",
        });
        return;
      }

      const json = (await res.json()) as LocateResponse;

      if (json.status === "error") {
        setState({
          ...INITIAL,
          status: "error",
          errorCode: json.code,
          errorMessageKiny: json.message_kiny,
          errorMessageEng: json.message_eng,
        });
        return;
      }

      setState({
        status: "success",
        data: json,
        errorCode: null,
        errorMessageKiny: null,
        errorMessageEng: null,
        isOffline: false,
      });
    } catch (err) {
      if (controller.signal.aborted) return;

      if (err instanceof GeolocationPositionError) {
        if (err.code === err.PERMISSION_DENIED) {
          setState({
            ...INITIAL,
            status: "error",
            errorCode: "GPS_DENIED",
            errorMessageKiny:
              "Wanze ko twakoresha GPS. Fungura amarebe y’uburyo bwo gukoresha ahantu cyangwa shakisha manuelle.",
            errorMessageEng:
              "Location permission denied. Enable location access or use manual search.",
          });
          return;
        }
        setState({
          ...INITIAL,
          status: "error",
          errorCode: "GPS_ACCURACY_TOO_LOW",
          errorMessageKiny:
            "GPS ntabwo iri ku buryo bwiza. Gerageza hanze cyangwa shakisha manuelle.",
          errorMessageEng:
            "Could not obtain a precise location. Try outdoors or use manual search.",
        });
        return;
      }

      // Network / abort / other
      setState({
        ...INITIAL,
        status: "error",
        errorCode: "NETWORK_ERROR",
        errorMessageKiny:
          "Ikibazo cy’urukurikirane. Gerageza nanone cyangwa reba niba ufite interineti.",
        errorMessageEng:
          "Network error. Check your connection and try again.",
      });
    }
  }, []);

  const chooseVillage = useCallback(async (scopeCode: string, selectionMethod: FeedbackMethod = "manual") => {
    feedbackMethodRef.current = selectionMethod;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ ...INITIAL, status: "locating" });
    try {
      let json: LocateResponse;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        // Offline picker mode: use the cached national index, never a guessed name.
        const indexResponse = await fetch("/api/locate?index=1", { signal: controller.signal });
        if (!indexResponse.ok) throw new Error("offline_location_index_unavailable");
        const indexPayload = await indexResponse.json();
        const entries = Array.isArray(indexPayload.choices) ? indexPayload.choices as Array<{
          scope_code: string;
          name_kiny: string;
          name_eng: string | null;
          level: "province" | "district" | "sector" | "cell" | "village";
          parent_scope_code: string | null;
        }> : [];
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
    lastFixRef.current = { latitude, longitude, accuracy, method: "map" };
    feedbackMethodRef.current = "map";
    setState({ ...INITIAL, status: "locating" });

    try {
      const response = await fetch("/api/locate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, accuracy, method: "map" }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (response.status === 429) {
        setState({
          ...INITIAL,
          status: "error",
          errorCode: "RATE_LIMIT",
          errorMessageKiny: "Wakoze ibisabwa byinshi cyane. Tegereza gato hanyuma ugerageze nanone.",
          errorMessageEng: "Too many requests. Please wait a moment and try again.",
        });
        return;
      }
      const json = (await response.json()) as LocateResponse;
      if (json.status === "error") {
        setState({
          ...INITIAL,
          status: "error",
          errorCode: json.code,
          errorMessageKiny: json.message_kiny,
          errorMessageEng: json.message_eng,
        });
        return;
      }
      setState({
        status: "success",
        data: json,
        errorCode: null,
        errorMessageKiny: null,
        errorMessageEng: null,
        isOffline: false,
      });
    } catch {
      if (controller.signal.aborted) return;
      setState({
        ...INITIAL,
        status: "error",
        errorCode: "NETWORK_ERROR",
        errorMessageKiny: "Ikarita ntishoboye kugenzura ahantu. Gerageza interineti cyangwa uhitemo umudugudu ku rutonde.",
        errorMessageEng: "The map location could not be checked. Reconnect or choose a village manually.",
      });
    }
  }, []);

  const submitLocationFeedback = useCallback(async (scopeCode: string): Promise<void> => {
    const method = feedbackMethodRef.current;
    const fix = method !== "manual" && lastFixRef.current?.method === method
      ? lastFixRef.current
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
    if (!response || !response.ok) {
      return {
        status: "error",
        code: "OFFLINE_CACHE",
        message_kiny:
          "Uri offline kandi nta makuru yabitswe. Ongera uhuze interineti.",
        message_eng:
          "You are offline and no cached data is available. Please reconnect.",
      };
    }
    const geojson = (await response.json()) as OfflineBoundaryCollection;
    return calculateConfidenceOffline(
      latitude,
      longitude,
      accuracy,
      geojson
    );
  } catch {
    return {
      status: "error",
      code: "OFFLINE_CACHE",
      message_kiny:
        "Uri offline kandi nta makuru yabitswe. Ongera uhuze interineti.",
      message_eng:
        "You are offline and no cached data is available. Please reconnect.",
    };
  }
}
