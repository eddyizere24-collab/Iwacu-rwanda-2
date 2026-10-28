"use client";

import { useState } from "react";
import { useLocation } from "@/hooks/useLocation";
import { LocationButton } from "@/components/LocationButton";
import { LeaderCard } from "@/components/LeaderCard";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import {
  MapPin,
  ShieldCheck,
  Search,
  WifiOff,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  CheckCircle2,
} from "lucide-react";
import type { AiRouterResponse } from "@/types/api";

export default function HomePage() {
  const {
    status,
    data,
    errorCode,
    errorMessageKiny,
    errorMessageEng,
    isOffline,
    locate,
    reset,
  } = useLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<AiRouterResponse | null>(null);

  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim() || searchLoading) return;

    setSearchLoading(true);
    setSearchResult(null);

    try {
      const res = await fetch("/api/ai-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      const json = await res.json();
      setSearchResult(json);
    } catch {
      setSearchResult({
        status: "error",
        code: "NETWORK_ERROR",
        message_kiny: "Ikibazo cy'urukurikirane. Ongera ugerageze.",
      });
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Hero Section */}
      <section className="text-center mb-10 sm:mb-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-600/20 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 mb-6">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          <span>NCSA Law No. 058/2021 · Zero PII Guaranteed</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl sm:leading-tight">
          Menya Umurenge, Akagari n’Umudugudu uriho
        </h1>

        <p className="mt-4 max-w-2xl mx-auto text-base text-muted-foreground sm:text-lg">
          Koresha GPS ya telefone cyangwa mudasobwa yawe kugira ngo umenye
          abayobozi b’inzego z’ibanze mu Karere ka Gasabo mu buryo bwizewe kandi
          bwihuse.
        </p>

        {/* Locate CTA Button */}
        <div className="mt-8 flex flex-col items-center justify-center gap-4">
          <LocationButton status={status} onClick={locate} />

          {status !== "idle" && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Ongera utangire bundi bushya
            </button>
          )}
        </div>
      </section>

      {/* Offline Banner */}
      {isOffline && (
        <div
          role="status"
          className="mb-8 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground"
        >
          <WifiOff className="h-5 w-5 text-amber-600 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Uri gukoresha uburyo bwa Offline</p>
            <p className="text-xs text-muted-foreground">
              Dukoresheje amakuru y’amakarita ya Gasabo yabitswe muri cache (Turf.js).
              Abayobozi bazagaragara nuhita ufungura interineti.
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === "error" && errorCode && (
        <div className="mb-10">
          <ErrorDisplay
            code={errorCode}
            messageKiny={errorMessageKiny || "Ikibazo cyabaye."}
            messageEng={errorMessageEng}
            onRetry={locate}
          />
        </div>
      )}

      {/* Success Results */}
      {status === "success" && data && (
        <section className="space-y-8 animate-in fade-in duration-300">
          {/* Overlap Warning */}
          {data.warning === "POINT_IN_OVERLAP" && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground"
            >
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="font-semibold">Aha hantu hagaragara ku mipaka y’imirenge/imidugudu myinshi</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Icyizere cyagabanyijwe mu bice bikurikira hashingiwe ku buso bw’uruziga rwa GPS:
                </p>
              </div>
            </div>
          )}

          {/* Location Confidence Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <MapPin className="h-5 w-5 text-blue-600" aria-hidden />
                <span>Aho uri (Ubuso bwemejwe)</span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-600/10 px-3 py-1 text-xs font-semibold text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Icyizere: {data.matches[0]?.confidence ?? 100}%
              </span>
            </div>

            {/* Hierarchy Path */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Akarere (District)
                </span>
                <p className="text-base font-semibold text-foreground mt-0.5">
                  {data.hierarchy?.district?.name_kiny || "Gasabo"}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {data.hierarchy?.district?.scope_code || "RW-01"}
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Umurenge (Sector)
                </span>
                <p className="text-base font-semibold text-foreground mt-0.5">
                  {data.hierarchy?.sector?.name_kiny || data.matches[0]?.name_kiny || "Kacyiru"}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {data.hierarchy?.sector?.scope_code || "RW-01-01"}
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Umudugudu (Village)
                </span>
                <p className="text-base font-semibold text-blue-600 mt-0.5">
                  {data.hierarchy?.village?.name_kiny || data.matches[0]?.name_kiny}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {data.hierarchy?.village?.scope_code || data.matches[0]?.scope_code}
                </p>
              </div>
            </div>

            {/* Overlap Breakdown if multiple matches */}
            {data.matches.length > 1 && (
              <div className="mt-5 border-t border-border pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2.5">
                  <Layers className="h-3.5 w-3.5" aria-hidden />
                  Imidugudu ikora ku mbibi:
                </h4>
                <div className="space-y-2">
                  {data.matches.map((m) => (
                    <div
                      key={m.scope_code}
                      className="flex items-center justify-between text-xs rounded-lg bg-muted/60 px-3 py-2"
                    >
                      <span className="font-medium text-foreground">
                        {m.name_kiny} ({m.scope_code})
                      </span>
                      <span className="font-semibold text-blue-600">
                        {m.confidence}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Leaders Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Abayobozi b’agace kawe
                </h2>
                <p className="text-xs text-muted-foreground">
                  Numero zabo ziratangirwa uburinzi (NCSA). Kanda &quot;Hamagara&quot; kugira ngo uhamagare.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {data.leaders.length} {data.leaders.length === 1 ? "umuyobozi" : "abayobozi"}
              </span>
            </div>

            {data.leaders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nta makuru y&apos;abayobozi abonetse kuri aka gace kugeza ubu.
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

      {/* Manual Search or AI Router */}
      <section className="mt-16 rounded-2xl border border-border bg-card/60 p-6 sm:p-8 backdrop-blur">
        <div className="flex items-center gap-2 mb-2 text-foreground font-semibold">
          <Sparkles className="h-5 w-5 text-blue-600" aria-hidden />
          <h3>Shakisha mu magambo (Zero-PII AI Router)</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Andika izina ry&apos;umurenge, akagari, cyangwa ikibazo ufite (urugero: &quot;Nshaka umuyobozi w&apos;Umudugudu w&apos;Urugero&quot;).
        </p>

        <form onSubmit={handleManualSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Andika hano agace cyangwa inzego ushaka..."
              className="w-full min-h-[44px] rounded-lg border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            disabled={searchLoading || !searchQuery.trim()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {searchLoading ? "Biracyashakishwa..." : "Shakisha"}
          </button>
        </form>

        {searchResult && (
          <div className="mt-4 rounded-xl border border-border bg-background p-4 text-sm">
            {searchResult.status === "success" ? (
              <div className="space-y-3">
                {searchResult.message_kiny && (
                  <p className="font-medium text-foreground">{searchResult.message_kiny}</p>
                )}
                {searchResult.data && "leaders" in searchResult.data && searchResult.data.leaders && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {searchResult.data.leaders.map((leader) => (
                      <LeaderCard key={leader.id} leader={leader} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-destructive">{searchResult.message_kiny}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
