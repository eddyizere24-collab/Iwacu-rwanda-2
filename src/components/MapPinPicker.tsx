"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";

type Point = { latitude: number; longitude: number };
type LeafletMap = any;
type LeafletMarker = any;

declare global {
  interface Window {
    L?: any;
  }
}

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

function loadLeaflet(): Promise<any> {
  if (typeof window !== "undefined" && window.L) return Promise.resolve(window.L);

  return new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-iwacu-leaflet="css"]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = LEAFLET_CSS;
      css.dataset.iwacuLeaflet = "css";
      css.crossOrigin = "anonymous";
      css.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      css.onerror = () => css.remove();
      document.head.appendChild(css);
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-iwacu-leaflet="js"]');
    if (existing) {
      existing.addEventListener("load", () => window.L ? resolve(window.L) : reject(new Error("Leaflet did not initialise.")), { once: true });
      existing.addEventListener("error", () => reject(new Error("Map library could not load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.dataset.iwacuLeaflet = "js";
    script.crossOrigin = "anonymous";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Leaflet did not initialise."));
    script.onerror = () => {
      script.remove();
      reject(new Error("Map library could not load."));
    };
    document.body.appendChild(script);
  });
}

export function MapPinPicker({
  onSelect,
  initialPoint = null,
}: {
  onSelect: (latitude: number, longitude: number, accuracyMeters: number) => void;
  initialPoint?: Point | null;
}) {
  const [open, setOpen] = useState(false);
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [overlayMessage, setOverlayMessage] = useState("Kwegera ku ikarita kugira ngo ubone imbibi z'imidugudu.");
  const [selected, setSelected] = useState<Point | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const overlayRef = useRef<any>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    setMapStatus("loading");

    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      let lastKnown: { latitude: number; longitude: number } | null = null;
      try {
        const raw = localStorage.getItem("iwacu-last-location-fix");
        if (raw) {
          const saved = JSON.parse(raw) as {
            latitude?: number;
            longitude?: number;
            recordedAt?: number;
          };
          const age = Number.isFinite(saved.recordedAt) ? Date.now() - (saved.recordedAt as number) : Infinity;
          if (
            Number.isFinite(saved.latitude) &&
            Number.isFinite(saved.longitude) &&
            age >= 0 &&
            age <= 24 * 60 * 60 * 1000
          ) {
            lastKnown = {
              latitude: saved.latitude as number,
              longitude: saved.longitude as number,
            };
          }
        }
      } catch {
        // The map can still open at the Rwanda overview without browser storage.
      }

      const estimatedPoint = initialPoint &&
        Number.isFinite(initialPoint.latitude) &&
        Number.isFinite(initialPoint.longitude)
        ? initialPoint
        : null;
      const mapStart = estimatedPoint ?? lastKnown;
      const initialCenter = mapStart
        ? [mapStart.latitude, mapStart.longitude] as [number, number]
        : [-1.94, 29.87] as [number, number];
      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        minZoom: 7,
        maxZoom: 18,
      }).setView(initialCenter, mapStart ? 14 : 8);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);

      const updateMarker = (latitude: number, longitude: number) => {
        setSelected({ latitude, longitude });
        if (!markerRef.current) {
          markerRef.current = L.marker([latitude, longitude], { draggable: true }).addTo(map);
          markerRef.current.on("dragend", (event: any) => {
            const point = event.target.getLatLng();
            setSelected({ latitude: point.lat, longitude: point.lng });
          });
        } else {
          markerRef.current.setLatLng([latitude, longitude]);
        }
      };

      if (mapStart) updateMarker(mapStart.latitude, mapStart.longitude);
      map.on("click", (event: any) => updateMarker(event.latlng.lat, event.latlng.lng));

      const refreshOverlay = async () => {
        if (cancelled) return;
        const currentMap = mapRef.current;
        if (!currentMap) return;
        if (currentMap.getZoom() < 9) {
          if (overlayRef.current) {
            currentMap.removeLayer(overlayRef.current);
            overlayRef.current = null;
          }
          setOverlayMessage("Kwegera ku ikarita (zoom) kugira ngo ubone imbibi z'imidugudu.");
          return;
        }

        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        const bounds = currentMap.getBounds();
        const params = new URLSearchParams({
          west: String(bounds.getWest()),
          south: String(bounds.getSouth()),
          east: String(bounds.getEast()),
          north: String(bounds.getNorth()),
        });

        try {
          setOverlayMessage("Turimo gushaka imbibi z'imidugudu...");
          const response = await fetch("/api/location-map?" + params.toString(), {
            signal: controller.signal,
            cache: "force-cache",
          });
          if (!response.ok) throw new Error("boundary_overlay_unavailable");
          const geojson = await response.json();
          if (cancelled || controller.signal.aborted || !mapRef.current) return;
          if (overlayRef.current) currentMap.removeLayer(overlayRef.current);
          overlayRef.current = L.geoJSON(geojson, {
            style: () => ({ color: "#20603D", weight: 1, opacity: 0.8, fillColor: "#48A868", fillOpacity: 0.06 }),
            onEachFeature: (feature: any, layer: any) => {
              const name = feature?.properties?.name_kiny ?? feature?.properties?.village;
              if (typeof name === "string" && name.trim()) {
                layer.bindTooltip(name, { sticky: true, direction: "top" });
              }
            },
          }).addTo(currentMap);
          const count = Array.isArray(geojson.features) ? geojson.features.length : 0;
          setOverlayMessage(count > 0
            ? `Imbibi z'imidugudu zagaragajwe: ${count}. Amakuru y'imbibi yakuwe muri database.`
            : "Nta mbibi z'imidugudu zabonetse muri aka gace; gerageza kwegera cyangwa uhitemo ahandi.");
        } catch (error) {
          if (!controller.signal.aborted && !cancelled) {
            setOverlayMessage("Imbibi ntizibashije gufunguka. Ushobora gukomeza guhitamo aho uri ku ikarita.");
          }
        }
      };

      const scheduleOverlayRefresh = () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => void refreshOverlay(), 450);
      };
      map.on("moveend", scheduleOverlayRefresh);
      setMapStatus("ready");
      map.invalidateSize();
      scheduleOverlayRefresh();
    }).catch(() => {
      if (!cancelled) setMapStatus("error");
    });

    return () => {
      cancelled = true;
      requestRef.current?.abort();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
      overlayRef.current = null;
    };
  }, [open, initialPoint?.latitude, initialPoint?.longitude]);

  function closeMap() {
    setOpen(false);
    setMapStatus("idle");
    setOverlayMessage("Kwegera ku ikarita kugira ngo ubone imbibi z'imidugudu.");
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <MapPin className="h-4 w-4 text-[#20603D]" aria-hidden />
            Hitamo aho uri ku ikarita
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Kanda aho uri cyangwa ukurure akamenyetso. Imbibi zigaragara aho amakuru aboneka.
          </p>
        </div>
        <button
          type="button"
          onClick={() => open ? closeMap() : setOpen(true)}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
        >
          {open ? <X className="h-4 w-4" aria-hidden /> : <MapPin className="h-4 w-4" aria-hidden />}
          {open ? "Funga ikarita" : "Fungura ikarita"}
        </button>
      </div>

      {open && (
        <div className="mt-4">
          <div
            ref={containerRef}
            className="h-[320px] w-full overflow-hidden rounded-xl border border-border bg-muted sm:h-[400px]"
            aria-label="Ikarita yo guhitamo aho uri"
          />
          {mapStatus === "loading" && <p role="status" className="mt-2 text-xs text-muted-foreground">Turimo gufungura ikarita...</p>}
          {mapStatus === "error" && (
            <p role="status" className="mt-2 text-xs text-amber-700">
              Ikarita ntiyafungutse. Reba interineti cyangwa ukoreshe urutonde rw'imidugudu.
            </p>
          )}
          <p aria-live="polite" className="mt-2 text-xs text-muted-foreground">{overlayMessage}</p>
          {selected && (
            <div className="mt-3 rounded-xl bg-emerald-500/10 p-3">
              <p className="text-xs font-semibold">Ahantu wahisemo</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
              </p>
              <button
                type="button"
                onClick={() => onSelect(selected.latitude, selected.longitude, 200)}
                className="mt-3 min-h-[44px] w-full rounded-xl bg-[#20603D] px-4 py-2 text-sm font-bold text-white hover:bg-[#17492D]"
              >
                Koresha aha hantu
              </button>
            </div>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">
            Amakarita: &copy; OpenStreetMap; imbibi z'imidugudu zivanwa muri database. IP cyangwa GPS ishobora kwibeshya; genzura umudugudu mbere yo kuwemeza.
          </p>
        </div>
      )}
    </section>
  );
}
