"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Landmark, MapPin, RefreshCw, Waves } from "lucide-react";

type NearbyFeature = {
  id: string;
  name: string | null;
  category: "school" | "clinic" | "market" | "church" | "wetland" | "water" | "lake" | "road" | "other";
  latitude: number;
  longitude: number;
  distance_m: number;
};

type ContextResponse = {
  status: "ok" | "unavailable";
  features?: NearbyFeature[];
  source?: string;
  queried_radius_m?: number;
};

const CATEGORY_LABEL: Record<NearbyFeature["category"], string> = {
  school: "Ishuri",
  clinic: "Ivuriro",
  market: "Isoko",
  church: "Itorero",
  wetland: "Igishanga",
  water: "Umugezi / amazi",
  lake: "Ikiyaga",
  road: "Umuhanda munini",
  other: "Ahantu",
};

export function NearbyLandmarks({
  latitude,
  longitude,
  onSelect,
}: {
  latitude: number;
  longitude: number;
  onSelect: (latitude: number, longitude: number, accuracyMeters: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContextResponse | null>(null);
  const [message, setMessage] = useState("");

  async function loadNearby() {
    if (loading) return;
    setOpen(true);
    if (result) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/location-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude }),
      });
      const json = await response.json() as ContextResponse;
      if (!response.ok || json.status === "unavailable") {
        setMessage("Amakuru y'ahantu hafi ntaraboneka ubu. Ikarita na GPS biracyakora ukwabyo.");
      } else {
        setResult(json);
      }
    } catch {
      setMessage("Ntabwo twabashije gufungura amakuru y'ahantu hafi. Ikarita iracyagufasha.");
    } finally {
      setLoading(false);
    }
  }

  const features = result?.features ?? [];
  const waterFeatures = features.filter((item) =>
    item.category === "wetland" || item.category === "water" || item.category === "lake"
  );
  const landmarks = features.filter((item) =>
    item.category !== "wetland" && item.category !== "water" && item.category !== "lake"
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-left">
      <button
        type="button"
        onClick={() => open ? setOpen(false) : void loadNearby()}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-[#20603D]" aria-hidden />
          <span>
            <span className="block text-sm font-bold">Reba ahantu ushobora kuba uri hafi</span>
            <span className="block text-[11px] text-muted-foreground">Ishuri, ivuriro, isoko, itorero, igishanga cyangwa umugezi</span>
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
      </button>

      {open && (
        <div className="mt-3 border-t border-border pt-3">
          {loading && (
            <p role="status" className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Turimo kureba ahantu handitse muri OpenStreetMap...
            </p>
          )}
          {message && <p role="status" className="py-3 text-xs text-amber-700">{message}</p>}

          {!loading && !message && result && features.length === 0 && (
            <p className="py-3 text-xs text-muted-foreground">
              Nta hantu handitse habonetse muri OpenStreetMap mu birometero 3. Ibi ntibivuga ko nta shuri, isoko cyangwa amazi bihari; bishobora kuba bitarashyizwe muri iyi data.
            </p>
          )}

          {!loading && !message && landmarks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Reba niba uri hafi y'aha hantu:</p>
              {landmarks.slice(0, 12).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onSelect(item.latitude, item.longitude, 1_000)}
                  className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left hover:border-[#20603D] hover:bg-[#20603D]/5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-[#20603D]" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{item.name}</span>
                      <span className="block text-[11px] text-muted-foreground">{CATEGORY_LABEL[item.category]}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{item.distance_m} m</span>
                </button>
              ))}
            </div>
          )}

          {!loading && !message && waterFeatures.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Waves className="h-3.5 w-3.5" aria-hidden /> Amazi / ibishanga byagaragaye muri data:
              </p>
              {waterFeatures.slice(0, 8).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onSelect(item.latitude, item.longitude, 1_500)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left hover:border-[#20603D] hover:bg-[#20603D]/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {item.name ?? CATEGORY_LABEL[item.category] + " (nta zina ryanditse)"}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{CATEGORY_LABEL[item.category]}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{item.distance_m} m</span>
                </button>
              ))}
            </div>
          )}

          {result && (
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              Inkomoko: OpenStreetMap. Kanda ahantu ubona ko uri hafi; ikoreshwa nk'ikimenyetso cy'igereranya kiri mu ntera ya hafi 1–1.5 km, si coordinate yawe nyayo.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
