"use client";

import { useState } from "react";
import { useLocation } from "@/hooks/useLocation";
import { LocationButton } from "@/components/LocationButton";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { RwandanSun } from "@/components/RwandanSun";
import { AiSearchAssistant } from "@/components/AiSearchAssistant";
import { VillagePicker } from "@/components/VillagePicker";
import { MapPinPicker } from "@/components/MapPinPicker";
import { NearbyLandmarks } from "@/components/NearbyLandmarks";
import { LocationReportButton } from "@/components/LocationReportButton";
import { isLandmarksFeatureEnabled } from "@/lib/feature-flags";
import {
  MapPin,
  RotateCcw,
  Layers,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export default function HomePage() {
  const {
    status,
    data,
    errorCode,
    errorMessageKiny,
    errorMessageEng,
    locate,
    reset,
    chooseVillage,
    locateAtCoordinate,
    submitLocationFeedback,
    noticeKiny,
  } = useLocation();

  // Pre-permission consent dialog state (D1 section D)
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [feedbackConsent, setFeedbackConsent] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Trigger locate with D1 pre-permission consent explanation
  function handleLocateClick() {
    if (status === "idle" || status === "error") {
      setShowConsentModal(true);
    } else {
      locate();
    }
  }

  function handleConsentConfirm() {
    setShowConsentModal(false);
    locate();
  }

  // Raw geometric overlap scores have not been calibrated to hit rates.
  // Never label a GPS/map match "high confidence" from the score alone.
  function getConfidenceWording(source: string | undefined): { text: string; colorClass: string } {
    if (source === "manual") {
      return {
        text: "Wahisemo uyu mudugudu — ushobora kuwuhindura",
        colorClass: "text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300",
      };
    }
    if (source === "nearest") {
      return {
        text: "Iri ni igereranya gusa — genzura cyangwa uhitemo undi mudugudu",
        colorClass: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
      };
    }
    if (source === "ip" || source === "network") {
      return {
        text: "Igereranya riturutse kuri network — genzura ibisobanuro",
        colorClass: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
      };
    }
    if (source === "prior") {
      return {
        text: "Ibyo twerekanye ni amahitamo rusange, nta coordinates zabonetse",
        colorClass: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
      };
    }
    if (source === "last-known") {
      return {
        text: "Dukoresha ahantu telefone yari iherutse kubona — igenzura rirakenewe",
        colorClass: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
      };
    }
    if (source === "offline") {
      return {
        text: "Ibyabonetse offline — genzura izina ry'umudugudu",
        colorClass: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
      };
    }
    return {
      text: "Ibyabonetse kuri telefone/ikarita — genzura umudugudu mbere yo kuwemeza",
      colorClass: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }


  const confidenceInfo = data
    ? getConfidenceWording(data.source)
    : { text: "Ahantu ntiharamenyekana neza", colorClass: "text-muted-foreground bg-muted" };

  const mapInitialPoint = data &&
    Number.isFinite(data.latitude) &&
    Number.isFinite(data.longitude)
    ? { latitude: data.latitude as number, longitude: data.longitude as number }
    : null;

  async function handleFeedbackSubmit() {
    const scopeCode = data?.hierarchy?.village?.scope_code ?? data?.matches[0]?.scope_code;
    if (!scopeCode || !feedbackConsent) return;
    setFeedbackStatus("sending");
    try {
      await submitLocationFeedback(scopeCode);
      setFeedbackStatus("sent");
      setFeedbackConsent(false);
    } catch {
      setFeedbackStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      {/* 1. HERO PLACE CARD WITH RWANDAN SUN ("Rugo y'Izuba") */}
      {status === "idle" && (
        <section className="relative overflow-hidden rounded-3xl border border-sky-200/60 bg-gradient-to-b from-sky-50/70 via-amber-50/30 to-emerald-50/40 p-6 sm:p-12 text-center shadow-lg dark:from-sky-950/30 dark:via-background dark:to-emerald-950/20 dark:border-sky-800/40 mb-8">
          {/* Subtle National Ribbon Accent */}
          <div className="absolute top-0 inset-x-0 h-1.5 flex">
            <div className="flex-1 bg-[#00A3E0]" />
            <div className="flex-1 bg-[#FAD201]" />
            <div className="flex-1 bg-[#20603D]" />
          </div>

          {/* Luminous Rwandan Sun ("Rugo y'Izuba") */}
          <div className="mx-auto mb-6 flex items-center justify-center">
            <div className="relative p-2 rounded-full sun-pulse">
              <RwandanSun size={76} glow={true} />
            </div>
          </div>

          {/* D1 B1 Headline & Subtitle */}
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground max-w-2xl mx-auto leading-tight">
            Menya abayobozi b&apos;aho uri.
          </h1>

          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Menya umudugudu uherereyemo n&apos;abayobozi bawo, ubahamagare cyangwa ubandikire kuri WhatsApp.
          </p>

          {/* D1 B3 & B4 Big Hero Location Button */}
          <div className="mt-8 flex flex-col items-center justify-center">
            <LocationButton status={status} onClick={handleLocateClick} />
          </div>
          <div className="mx-auto mt-6 max-w-2xl space-y-4">
            <MapPinPicker initialPoint={mapInitialPoint} onSelect={(latitude, longitude, accuracy) => {
              void locateAtCoordinate(latitude, longitude, accuracy);
            }} />
            <details className="rounded-2xl border border-border bg-card p-3 text-left">
              <summary className="cursor-pointer min-h-[42px] py-2 text-sm font-semibold">
                Si hano? Hindura (gukosora aho hantu)
              </summary>
              <div className="mt-3">
                <VillagePicker onSelect={chooseVillage} />
              </div>
            </details>
          </div>

          {/* NCSA Law compliance note */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/90">
            <ShieldCheck className="h-4 w-4 text-[#00A3E0]" aria-hidden />
            <span>
              Uburinzi bw&apos;amakuru bwite bwubahirijwe (NCSA Law No. 058/2021)
            </span>
          </div>
        </section>
      )}

      {/* 2. SEARCHING STATE (D1 section E) */}
      {(status === "requesting_gps" || status === "locating") && (
        <section
          role="status"
          aria-live="polite"
          className="rounded-3xl border border-sky-200/80 bg-card p-8 sm:p-14 text-center shadow-lg my-8 animate-in fade-in"
        >
          <div className="mx-auto mb-6 flex justify-center sun-pulse">
            <RwandanSun size={64} glow={true} />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {status === "requesting_gps"
              ? "Turimo kugerageza network na GPS icyarimwe…"
              : "Turimo kugereranya ibimenyetso by'aho uri…"}
          </h2>

          <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            {status === "requesting_gps"
              ? "Telefone iraduha ikimenyetso cya mbere vuba, hanyuma GPS ikomeze kugenzura niba hari igisubizo kirushijeho kuba cyiza."
              : "Turimo kugereranya ahantu hashobora kuba ari ho uri, tunavugurura igisubizo uko ibimenyetso bishya biboneka…"}
          </p>

          <div className="mt-4 inline-block rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">
            Mu nzu, network/Wi-Fi cyangwa IP bishobora kubanza gutanga igereranya; GPS izakomeza kurinoza.
          </div>
          {noticeKiny && (
            <p role="status" aria-live="polite" className="mx-auto mt-3 max-w-xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              {noticeKiny}
            </p>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-border px-5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Reka
            </button>
          </div>
        </section>
      )}



      {/* 3. ERROR DISPLAY (D1 section H) */}
      {status === "error" && (
        <div className="my-6 space-y-4">
          <ErrorDisplay
            code={errorCode || "NETWORK_ERROR"}
            messageKiny={errorMessageKiny || undefined}
            messageEng={errorMessageEng}
            onRetry={locate}
          />
          <div className="mx-auto max-w-2xl space-y-3">
            <MapPinPicker onSelect={(latitude, longitude, accuracy) => {
              void locateAtCoordinate(latitude, longitude, accuracy);
            }} />
            {isLandmarksFeatureEnabled() && Number.isFinite(data?.latitude) && Number.isFinite(data?.longitude) && (
              <NearbyLandmarks
                latitude={data?.latitude as number}
                longitude={data?.longitude as number}
                onSelect={(latitude, longitude, accuracy) => {
                  void locateAtCoordinate(latitude, longitude, accuracy);
                }}
              />
            )}
            <details className="rounded-2xl border border-border bg-card p-3">
              <summary className="cursor-pointer min-h-[42px] py-2 text-sm font-semibold">Si hano? Hindura umudugudu (uburyo bwa nyuma)</summary>
              <div className="mt-3"><VillagePicker onSelect={chooseVillage} /></div>
            </details>
          </div>
          <div className="mt-4 text-center">
            <button type="button" onClick={reset}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Subira ku ntangiriro</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. RESULTS DISPLAY (D1 section F) */}
      {status === "success" && data && (
        <section className="space-y-6 animate-in fade-in duration-300">
          {/* Top Return / Search Again Action */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Ongera ushake</span>
            </button>
          </div>

          <div className="mx-auto max-w-2xl space-y-3">
            <MapPinPicker onSelect={(latitude, longitude, accuracy) => {
              void locateAtCoordinate(latitude, longitude, accuracy);
            }} />
            <details className="rounded-2xl border border-border bg-card p-3">
              <summary className="cursor-pointer min-h-[42px] py-2 text-sm font-semibold">Si hano? Hindura umudugudu (uburyo bwo gukosora)</summary>
              <div className="mt-3"><VillagePicker onSelect={chooseVillage} /></div>
            </details>
          </div>

          {noticeKiny && (
            <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              {noticeKiny}
            </p>
          )}
          {data.flags?.includes("border_zone") && (
            <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-800 dark:text-amber-300">
              Uri hafi y'imbibi z'u Rwanda cyangwa ku nkengero z'ikiyaga. Turerekana Akarere kari hafi gusa; ntituratangaza umudugudu kuko imbibi z'iki gice zikeneye kugenzurwa.
            </p>
          )}
          <LocationReportButton data={data} />

          {/* D1 F1 & F2 Hierarchy Place Card */}
          <div className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00A3E0]/15 text-[#00A3E0]">
                  <MapPin className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Uri hano (Ahantu hagaragaye)
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Aho uri hagaragazwa hakoreshejwe GPS n&apos;ikarita y&apos;imbibi
                  </p>
                </div>
              </div>

              {/* D1 F3 Confidence Phrasing */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${confidenceInfo.colorClass}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                <span>
                  {data.source === "manual"
                    ? "Wemejwe nawe"
                    : data.source === "nearest"
                      ? "Igereranya ry'umudugudu uri hafi"
                      : confidenceInfo.text}
                </span>
              </span>
            </div>

            {data.source === "manual" && (
              <p className="mb-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
                Wahisemo kandi wemeje uyu mudugudu. Ibi ntibivuga ko GPS yawemeje.
              </p>
            )}
            {data.source === "nearest" && (
              <p className="mb-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                Uyu ni umudugudu uri hafi y'ahantu habonetse. Ijanisha ni igipimo cyo kugereranya intera, si amahirwe apimwe.
              </p>
            )}
            {data.source === "ip" && (
              <p className="mb-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                IP ishobora kugaragaza agace rusange gusa; ntabwo ari GPS ya telefone. GPS cyangwa network ishobora kunoza igisubizo.
              </p>
            )}
            {data.source === "prior" && (
              <p className="mb-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                Nta coordinates zabonetse. Intara zigaragara hano ni amahitamo angana gusa (prior), ntabwo ari amahirwe apimwe y'aho uri.
              </p>
            )}
            {data.source === "last-known" && (
              <p className="mb-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                Ibi bishingiye ku hantu wemeje mbere cyangwa ku makuru ya telefone yari yarabonye. Igihe cyashize gishobora gutuma aho uri harahinduka; si gihamya y'aho uri ubu.
              </p>
            )}
            {(data.source === "gps" || data.source === "network" || data.source === "map" || data.source === "offline") && (
              <p className="mb-4 text-[11px] text-muted-foreground">
                Ijanisha ryerekana igipimo cy'ubuso bw'imbibi buhuye n'uruziga rw'ubudakemwa bw'ikimenyetso. Ntiriracyemezwa nk'amahirwe apimwe (calibrated probability).
                {data.accuracy_m ? ` Uruziga rwakoreshejwe: hafi ${Math.round(data.accuracy_m).toLocaleString("rw-RW")} m.` : ""}
              </p>
            )}

            {/* Present the best candidate at every administrative level. */}
            {data.hierarchy?.country && (
              <div className="mb-3 rounded-xl border border-border bg-muted/30 p-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Igihugu</span>
                <span className="mt-1 block text-sm font-bold">{data.hierarchy.country.name_kiny}</span>
                {data.hierarchy.country.confidence > 0 && <span className="text-xs text-muted-foreground">{Math.round(data.hierarchy.country.confidence)}%</span>}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["province", "district", "sector", "cell", "village"] as const).map((level) => {
                const labels = {
                  province: "Intara / Umujyi",
                  district: "Akarere",
                  sector: "Umurenge",
                  cell: "Akagari",
                  village: "Umudugudu",
                };
                const hierarchyValue = data.hierarchy?.[level];
                const candidates = data.hierarchyCandidates?.[level] ??
                  (hierarchyValue ? [hierarchyValue] : []);
                return (
                  <div key={level} className="rounded-xl border border-border/80 bg-muted/30 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{labels[level]}</span>
                    {candidates.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {candidates.slice(0, 3).map((candidate) => (
                          <div key={candidate.scope_code} className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold">{candidate.name_kiny}</span>
                            <span className="shrink-0 text-xs font-bold text-blue-700 dark:text-blue-300">{Math.round(candidate.confidence)}%</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="mt-1 block text-xs text-muted-foreground">Nta makuru ahagije kuri uru rwego; reba urwego ruri hejuru. Igereranya riravugururwa uko ibimenyetso biboneka.</span>
                    )}
                  </div>
                );
              })}
            </div>

            {(() => {
              const villageCandidates = data.hierarchyCandidates?.village ??
                data.matches.filter((match) => match.level === "village");
              return villageCandidates.length > 0 && data.source !== "manual" ? (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Layers className="h-3.5 w-3.5 text-blue-600" />
                    Imidugudu ishoboka — genzura niba umwe muri yo ari wo:
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {villageCandidates.slice(0, 3).map((match) => (
                      <button key={match.scope_code} type="button"
                        onClick={() => chooseVillage(match.scope_code, data.source === "map" ? "map" : data.source === "offline" ? "offline" : data.source === "nearest" ? "nearest" : "gps")}
                        className="flex min-h-[48px] items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-left text-sm hover:border-[#20603D] hover:bg-[#20603D]/5">
                        <span className="font-semibold">{match.name_kiny}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{Math.round(match.confidence)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {data.hierarchy?.village && (
            <div className="mt-5 rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-sm font-bold">Fasha kunoza igenzura ry'ahantu (ubishatse gusa)</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Niba wemera, tubika gusa umudugudu wemeje, uburyo wakoresheje, ikosa rya GPS niba ryarabonetse, n'aho hafi y'aho telefone yari iri (hafi ya kilometero imwe). Ntidubika izina ryawe, telefone, konti cyangwa IP. Ushobora kutabyemera; nta cyo bizahindura ku ikoreshwa ry'urubuga.
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={feedbackConsent}
                  onChange={(event) => {
                    setFeedbackConsent(event.target.checked);
                    if (!event.target.checked) setFeedbackStatus("idle");
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#20603D]"
                />
                <span>Nemeza ko umudugudu ugaragaye ari wo cyangwa uwo nahisemo, kandi nemeye gutanga aya makuru atarimo umwirondoro.</span>
              </label>
              <button
                type="button"
                disabled={!feedbackConsent || feedbackStatus === "sending"}
                onClick={() => void handleFeedbackSubmit()}
                className="mt-3 min-h-[42px] w-full rounded-xl bg-[#20603D] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {feedbackStatus === "sending" ? "Turimo kohereza..." : "Emeza kandi wohereze"}
              </button>
              {feedbackStatus === "sent" && (
                <p role="status" className="mt-2 text-xs text-emerald-700">Urakoze. Igitekerezo cyawe cyakiriwe.</p>
              )}
              {feedbackStatus === "error" && (
                <p role="status" className="mt-2 text-xs text-amber-700">Ntibyashobotse kubika igitekerezo. Ushobora gukomeza gukoresha urubuga.</p>
              )}
            </div>
            )} 
          </div>

        </section>
      )}

      {/* 5. AI SEARCH & QUESTIONS ASSISTANT */}
      <div className="mt-12">
        <AiSearchAssistant />
      </div>

      {/* D1 SECTION D: PRE-PERMISSION CONSENT DIALOG */}
      {showConsentModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-sky-200 bg-card p-6 sm:p-7 shadow-2xl">
            <div className="mx-auto mb-4 flex justify-center">
              <RwandanSun size={52} glow={true} />
            </div>

            <h3 id="consent-title" className="text-center text-lg font-bold text-foreground">
              Dukeneye kumenya aho uri
            </h3>

            <p className="mt-3 text-center text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Telefone yawe iri bukubaze niba wemera kumenya aho uri. Tuzagerageza network/Wi-Fi na GPS icyarimwe, hanyuma tunoze igisubizo uko ibimenyetso bishya biboneka. Nta konti ukeneye.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleConsentConfirm}
                className="flex-1 min-h-[48px] rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
              >
                Emera
              </button>
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="min-h-[48px] rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Si ubu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
