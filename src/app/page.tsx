"use client";

import { useState } from "react";
import { useLocation } from "@/hooks/useLocation";
import { LocationButton } from "@/components/LocationButton";
import { LeaderCard } from "@/components/LeaderCard";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { RwandanSun } from "@/components/RwandanSun";
import { AiSearchAssistant } from "@/components/AiSearchAssistant";
import { VillagePicker } from "@/components/VillagePicker";
import { MapPinPicker } from "@/components/MapPinPicker";
import {
  MapPin,
  RotateCcw,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
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

  // Calculate confidence wording per D1 F3
  function getConfidenceWording(score: number): { text: string; colorClass: string } {
    if (score >= 80) {
      return {
        text: "GPS n'imbibi bihuye cyane",
        colorClass: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300",
      };
    }
    if (score >= 50) {
      return {
        text: "Biracyasaba kugenzurwa",
        colorClass: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
      };
    }
    return {
      text: "Ahantu ntiharamenyekana neza",
      colorClass: "text-muted-foreground bg-muted",
    };
  }

  const topScore = data?.matches[0]?.confidence ?? 0;
  const lowConfidence = Boolean(data && (
    data.source === "nearest" ||
    ((data.source === "gps" || data.source === "map" || data.source === "offline") && topScore < 50)
  ));
  const confidenceInfo = data
    ? getConfidenceWording(topScore)
    : { text: "Ahantu ntiharamenyekana neza", colorClass: "text-muted-foreground bg-muted" };

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
            <VillagePicker onSelect={chooseVillage} />
            <MapPinPicker onSelect={(latitude, longitude, accuracy) => {
              void locateAtCoordinate(latitude, longitude, accuracy);
            }} />
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
              ? "Turimo gusaba uburenganzira bwa GPS…"
              : "Turimo gushaka aho uri…"}
          </h2>

          <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            {status === "requesting_gps"
              ? "Kanda «Emera» kuri telefone yawe kugira ngo tumenye umudugudu wawe."
              : "Turimo gushaka abayobozi bawe mu nzego z&apos;ibanze…"}
          </p>

          <div className="mt-4 inline-block rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">
            Bishobora gutinda mu nzu. Egera idirishya cyangwa usohoke.
          </div>

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

      {(status === "requesting_gps" || status === "locating") && (
        <div className="mx-auto mt-6 max-w-2xl">
          <VillagePicker onSelect={chooseVillage} />
        </div>
      )}

      {/* 3. ERROR DISPLAY (D1 section H) */}
      {status === "error" && (
        <div className="my-6">
          <ErrorDisplay
            code={errorCode || "NETWORK_ERROR"}
            messageKiny={errorMessageKiny || undefined}
            messageEng={errorMessageEng}
            onRetry={locate}
          />
          <div className="mx-auto mt-6 max-w-2xl">
            <VillagePicker onSelect={chooseVillage} />
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
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

          {!lowConfidence && (
            <div className="mx-auto max-w-2xl space-y-4">
              <VillagePicker onSelect={chooseVillage} />
              <MapPinPicker onSelect={(latitude, longitude, accuracy) => {
                void locateAtCoordinate(latitude, longitude, accuracy);
              }} />
            </div>
          )}

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
                Uyu ni umudugudu wegereye aho GPS yerekanye. Ibi ni amanota yo kugereranya, si amahirwe apimwe; genzura cyangwa uhitemo undi.
              </p>
            )}
            {(data.source === "gps" || data.source === "offline") && (
              <p className="mb-4 text-[11px] text-muted-foreground">
                Iki ni igipimo cy'ihurirana ry'uruziga rwa GPS n'imbibi, si amahirwe apimwe yo kuba umudugudu ari wo.
              </p>
            )}

            {/* Low-score route: show reliable hierarchy first, then let the citizen pick. */}
            {lowConfidence ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/80 bg-muted/40 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Umurenge</span>
                    <span className="mt-1 block truncate text-sm font-bold">{data.hierarchy?.sector?.name_kiny || "Ntibyemejwe neza"}</span>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-muted/40 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Akagari</span>
                    <span className="mt-1 block truncate text-sm font-bold">{data.hierarchy?.cell?.name_kiny || "Ntibyemejwe neza"}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Umudugudu nturamenyekana neza. Hitamo uwo uzi ku rutonde cyangwa ukoreshe ikarita iri hasi.
                </p>
                <div className="space-y-4">
                  <VillagePicker onSelect={chooseVillage} />
                  <MapPinPicker onSelect={(latitude, longitude, accuracy) => {
                    void locateAtCoordinate(latitude, longitude, accuracy);
                  }} />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-border/80 bg-muted/40 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Intara / Umujyi</span>
                    <span className="mt-1 block truncate text-xs font-bold">{data.hierarchy?.province?.name_kiny || "Ntibyemejwe"}</span>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-muted/40 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Akarere</span>
                    <span className="mt-1 block truncate text-xs font-bold">{data.hierarchy?.district?.name_kiny || "Ntibyemejwe"}</span>
                  </div>
                  <div className="col-span-2 rounded-xl border border-dashed border-border bg-muted/20 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Umudugudu</span>
                    <span className="mt-1 block text-sm font-bold">Ugomba kuwemeza cyangwa kuwuhitamo</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-xl border border-border/80 bg-muted/40 p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Intara / Umujyi</span>
                  <span className="mt-1 block truncate text-xs font-bold">{data.hierarchy?.province?.name_kiny || "Ntibyemejwe"}</span>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/40 p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Akarere</span>
                  <span className="mt-1 block truncate text-xs font-bold">{data.hierarchy?.district?.name_kiny || "Ntibyemejwe"}</span>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/40 p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Umurenge</span>
                  <span className="mt-1 block truncate text-xs font-bold">{data.hierarchy?.sector?.name_kiny || "Ntibyemejwe"}</span>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/40 p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Akagari</span>
                  <span className="mt-1 block truncate text-xs font-bold">{data.hierarchy?.cell?.name_kiny || "Ntibyemejwe"}</span>
                </div>
                <div className="rounded-xl border border-blue-600/30 bg-blue-50/50 p-3 dark:bg-blue-950/20">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Umudugudu</span>
                  <span className="mt-1 block truncate text-xs font-bold text-blue-700 dark:text-blue-300">{data.hierarchy?.village?.name_kiny || data.matches[0]?.name_kiny || "Ntibyemejwe"}</span>
                </div>
              </div>
            )}

            {/* D1 F4: candidates can be explicitly confirmed without exposing raw scores. */}
            {data.matches.length > 1 && data.source !== "manual" && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Layers className="h-3.5 w-3.5 text-blue-600" />
                  Imidugudu ishoboka. Kanda uwo uzi ko ari wo:
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {data.matches.map((match) => (
                    <button
                      key={match.scope_code}
                      type="button"
                      onClick={() => chooseVillage(
                        match.scope_code,
                        data.source === "map" ? "map" :
                          data.source === "offline" ? "offline" :
                          data.source === "nearest" ? "nearest" : "gps"
                      )}
                      className="flex min-h-[48px] items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-left text-sm hover:border-[#20603D] hover:bg-[#20603D]/5"
                    >
                      <span className="font-semibold">{match.name_kiny}</span>
                      <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                        {match.confidence >= 80 ? "Ihura cyane" : match.confidence >= 50 ? "Ishobora kuba hafi" : "Irasaba kugenzurwa"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* D1 F5 Leader Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                  Abayobozi bawe
                </h3>
                <p className="text-xs text-muted-foreground">
                  Kanda kuri buto yo guhamagara cyangwa WhatsApp kugira ngo uvugane nabo.
                </p>
              </div>

              <span className="text-xs font-semibold text-muted-foreground">
                {data.leaders.length} {data.leaders.length === 1 ? "umuyobozi" : "abayobozi"}
              </span>
            </div>

            {data.leaders.length === 0 ? (
              /* D1 F6: When no leader verified yet */
              <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 p-8 text-center space-y-3">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
                <h4 className="font-bold text-foreground text-sm">
                  Nta muyobozi uremezwa muri uyu mudugudu.
                </h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Reba ab&apos;akagari n&apos;ab&apos;umurenge bari hejuru yabo kugira ngo ubone ubufasha.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.leaders.map((leader) => (
                  <LeaderCard key={leader.id} leader={leader} />
                ))}
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
              Telefone yawe iri bukubaze niba wemera. Nukanda «Emera», tuzamenya
              umudugudu wawe tukubwire abayobozi bawo. Nta konti ukeneye.
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
