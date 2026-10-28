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

const MAX_ACCURACY_M = 150;
const GPS_TIMEOUT_MS = 15_000;

export function useLocation() {
  const [state, setState] = useState<UseLocationState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

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
      const position = await getCurrentPosition(GPS_TIMEOUT_MS);
      if (controller.signal.aborted) return;

      const { latitude, longitude, accuracy } = position.coords;

      if (accuracy > MAX_ACCURACY_M) {
        setState({
          ...INITIAL,
          status: "error",
          errorCode: "GPS_ACCURACY_TOO_LOW",
          errorMessageKiny:
            "GPS ntabwo iri ku buryo bwiza (accuracy > 150m). Gerageza hanze cyangwa shakisha manuelle.",
          errorMessageEng:
            "GPS accuracy is too low (> 150 m). Try outdoors or use manual search.",
        });
        return;
      }

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

  return { ...state, locate, reset };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentPosition(timeoutMs: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 0,
    });
  });
}

async function runOfflineConfidence(
  latitude: number,
  longitude: number,
  accuracy: number
): Promise<LocateResponse> {
  try {
    const cache = await caches.open("iwacu-boundaries-v1");
    const response = await cache.match("/offline/gasabo-boundaries.geojson");
    if (!response) {
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
