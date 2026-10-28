"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  Building,
  Landmark,
  MapPin,
  Users,
  Home,
  Check,
  ChevronRight,
  Lock,
} from "lucide-react";
import { RwandanSun } from "@/components/RwandanSun";
import {
  RWANDA_PROVINCES,
  getDistrictsByProvince,
  getSectorsByDistrict,
  getCellsBySector,
} from "@/lib/rwanda-geo";

export type AdminTier = "national" | "province" | "district" | "sector" | "cell";

interface TierOption {
  id: AdminTier;
  titleKiny: string;
  descKiny: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultScope: string;
}

const TIERS: TierOption[] = [
  {
    id: "national",
    titleKiny: "Urwego rw'Igihugu / Minisiteri (MINALOC)",
    descKiny: "Ububasha busesuye bwo kugenzura no gushyiraho abayobozi mu Gihugu cyose",
    icon: Landmark,
    defaultScope: "RW",
  },
  {
    id: "province",
    titleKiny: "Urwego rw'Intara / Umujyi wa Kigali",
    descKiny: "Ububasha bwo kugenzura uturere n'imirenge bigize iyo Ntara",
    icon: Building,
    defaultScope: "RW-01",
  },
  {
    id: "district",
    titleKiny: "Urwego rw'Akarere (District Admin)",
    descKiny: "Ububasha bwo kugenzura imirenge, utugari, n'imidugudu yo muri ako Karere",
    icon: MapPin,
    defaultScope: "RW-01-01",
  },
  {
    id: "sector",
    titleKiny: "Urwego rw'Umurenge (Sector Admin)",
    descKiny: "Ububasha bwo kugenzura utugari n'imidugudu yo muri uwo murenge",
    icon: Users,
    defaultScope: "RW-01-01-01",
  },
  {
    id: "cell",
    titleKiny: "Urwego rw'Akagari (Cell Admin)",
    descKiny: "Ububasha bwo gushyiraho no kugenzura abakuru b'imidugudu yo muri ako kagari",
    icon: Home,
    defaultScope: "RW-01-01-01-01",
  },
];

export default function AdminLoginPage() {
  const router = useRouter();

  // Multi-step authentication flow
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTier, setSelectedTier] = useState<AdminTier>("district");

  // Cascading selections
  const [selectedProvince, setSelectedProvince] = useState("RW-01"); // Kigali
  const availableDistricts = useMemo(() => getDistrictsByProvince(selectedProvince), [selectedProvince]);
  
  const [selectedDistrict, setSelectedDistrict] = useState("RW-01-01"); // Gasabo
  const availableSectors = useMemo(() => getSectorsByDistrict(selectedDistrict), [selectedDistrict]);

  const [selectedSector, setSelectedSector] = useState("RW-01-01-01"); // Kacyiru
  const availableCells = useMemo(() => getCellsBySector(selectedSector), [selectedSector]);

  const [selectedCell, setSelectedCell] = useState("RW-01-01-01-01"); // Kamatamu

  // Handle province change -> cascade down
  function handleProvinceChange(code: string) {
    setSelectedProvince(code);
    const dists = getDistrictsByProvince(code);
    if (dists.length > 0) {
      setSelectedDistrict(dists[0].code);
      const secs = getSectorsByDistrict(dists[0].code);
      if (secs.length > 0) {
        setSelectedSector(secs[0].code);
        const cls = getCellsBySector(secs[0].code);
        if (cls.length > 0) setSelectedCell(cls[0].code);
      }
    }
  }

  // Handle district change -> cascade down
  function handleDistrictChange(code: string) {
    setSelectedDistrict(code);
    const secs = getSectorsByDistrict(code);
    if (secs.length > 0) {
      setSelectedSector(secs[0].code);
      const cls = getCellsBySector(secs[0].code);
      if (cls.length > 0) setSelectedCell(cls[0].code);
    }
  }

  // Handle sector change -> cascade down
  function handleSectorChange(code: string) {
    setSelectedSector(code);
    const cls = getCellsBySector(code);
    if (cls.length > 0) setSelectedCell(cls[0].code);
  }

  // Credentials
  const [email, setEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function getScopeDetails(): { code: string; name: string } {
    switch (selectedTier) {
      case "national":
        return { code: "RW", name: "U Rwanda Rwose (MINALOC)" };
      case "province": {
        const p = RWANDA_PROVINCES.find((x) => x.code === selectedProvince);
        return { code: p?.code || "RW-01", name: p?.name_kiny || "Umujyi wa Kigali" };
      }
      case "district": {
        const d = availableDistricts.find((x) => x.code === selectedDistrict);
        return { code: d?.code || "RW-01-01", name: `Akarere ka ${d?.name_kiny || "Gasabo"}` };
      }
      case "sector": {
        const s = availableSectors.find((x) => x.code === selectedSector);
        const d = availableDistricts.find((x) => x.code === selectedDistrict);
        return {
          code: s?.code || "RW-01-01-01",
          name: `Umurenge wa ${s?.name_kiny || "Kacyiru"} (${d?.name_kiny || "Gasabo"})`,
        };
      }
      case "cell": {
        const c = availableCells.find((x) => x.code === selectedCell);
        const s = availableSectors.find((x) => x.code === selectedSector);
        return {
          code: c?.code || `${selectedSector}-01`,
          name: `Akagari ka ${c?.name_kiny || "Kamatamu"} (${s?.name_kiny || "Kacyiru"})`,
        };
      }
    }
  }

  function handleProceedToCredentials(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setStep(2);
  }

  async function handleFinalLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { code, name } = getScopeDetails();

    // Store verified session state in localStorage for scoped dashboard enforcement
    const adminSession = {
      tier: selectedTier,
      scope_code: code,
      scope_name: name,
      email: email.trim() || `admin@${selectedTier}.gov.rw`,
      loginTime: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("iwacu_admin_session", JSON.stringify(adminSession));
    }

    setTimeout(() => {
      setLoading(false);
      router.push("/admin/dashboard");
    }, 600);
  }

  const scopeInfo = getScopeDetails();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-rwandan-gradient">
      <div className="w-full max-w-xl">
        {/* Back Link */}
        <Link
          href="/"
          className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span>Subira ku rubuga rw&apos;abaturage</span>
        </Link>

        <div className="rounded-3xl border border-sky-100 bg-card p-6 sm:p-10 shadow-2xl dark:border-sky-900">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-3">
              <RwandanSun size={52} glow={true} />
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#00A3E0]/15 px-3 py-1 text-[11px] font-bold text-[#00A3E0] mb-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Inzego z&apos;Ubuyobozi (Governance Access)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              Injira mu Rwego rw&apos;Ubuyobozi
            </h1>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              Buri muyobozi yinjira ku rwego rwe akagenzura inzego ziri munsi ye gusa.
            </p>
          </div>

          {step === 1 ? (
            /* STEP 1: SELECT TIER & CASCADING JURISDICTION DRILLDOWN */
            <form onSubmit={handleProceedToCredentials} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-foreground mb-2">
                  1. Hitamo Urwego rw&apos;Ubuyobozi urimo:
                </label>
                <div className="space-y-2">
                  {TIERS.map((tier) => {
                    const Icon = tier.icon;
                    const isSelected = selectedTier === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedTier(tier.id)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                          isSelected
                            ? "border-[#00A3E0] bg-sky-50/70 dark:bg-sky-950/40 shadow-sm"
                            : "border-border bg-background hover:bg-muted/40"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            isSelected
                              ? "bg-[#00A3E0] text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground">
                            {tier.titleKiny}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {tier.descKiny}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-[#00A3E0] shrink-0 mt-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. CASCADING JURISDICTION SELECTION */}
              {selectedTier !== "national" && (
                <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3 animate-in fade-in">
                  <p className="text-xs font-bold text-foreground">
                    2. Hitamo aho ubarizwa (Urutonde rw&apos;uruhererekane):
                  </p>

                  {/* Province Selector (Needed for province, district, sector, cell) */}
                  <div>
                    <label htmlFor="prov-sel" className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Intara / Umujyi wa Kigali:
                    </label>
                    <select
                      id="prov-sel"
                      value={selectedProvince}
                      onChange={(e) => handleProvinceChange(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                    >
                      {RWANDA_PROVINCES.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name_kiny} ({p.name_eng})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* District Selector (Needed for district, sector, cell) */}
                  {(selectedTier === "district" || selectedTier === "sector" || selectedTier === "cell") && (
                    <div>
                      <label htmlFor="dist-sel" className="block text-[11px] font-semibold text-muted-foreground mb-1">
                        Akarere:
                      </label>
                      <select
                        id="dist-sel"
                        value={selectedDistrict}
                        onChange={(e) => handleDistrictChange(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                      >
                        {availableDistricts.map((d) => (
                          <option key={d.code} value={d.code}>
                            Akarere ka {d.name_kiny}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Sector Selector (Needed for sector, cell) */}
                  {(selectedTier === "sector" || selectedTier === "cell") && (
                    <div>
                      <label htmlFor="sec-sel" className="block text-[11px] font-semibold text-muted-foreground mb-1">
                        Umurenge:
                      </label>
                      <select
                        id="sec-sel"
                        value={selectedSector}
                        onChange={(e) => handleSectorChange(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                      >
                        {availableSectors.map((s) => (
                          <option key={s.code} value={s.code}>
                            Umurenge wa {s.name_kiny}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Cell Selector (Needed for cell) */}
                  {selectedTier === "cell" && (
                    <div>
                      <label htmlFor="cell-sel" className="block text-[11px] font-semibold text-muted-foreground mb-1">
                        Akagari:
                      </label>
                      <select
                        id="cell-sel"
                        value={selectedCell}
                        onChange={(e) => setSelectedCell(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                      >
                        {availableCells.map((c) => (
                          <option key={c.code} value={c.code}>
                            Akagari ka {c.name_kiny}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Scope Summary Preview */}
              <div className="rounded-2xl border border-sky-200/80 bg-sky-50/60 dark:bg-sky-950/20 p-3.5 text-xs flex items-center justify-between">
                <span className="text-muted-foreground">Urwego wemerewe gucunga:</span>
                <span className="font-bold text-[#00A3E0]">
                  {scopeInfo.name}
                </span>
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-[#00A3E0] px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-[#0090c6] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>Komeza ku mwirondoro w&apos;umuyobozi</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            /* STEP 2: VERIFICATION CREDENTIALS */
            <form onSubmit={handleFinalLogin} className="space-y-4 animate-in fade-in">
              <div className="rounded-2xl border border-border bg-muted/40 p-3.5 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground">Urwego n&apos;Agace:</span>
                  <span className="font-bold text-foreground">{scopeInfo.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Icyiciro:</span>
                  <span className="font-semibold text-[#00A3E0] uppercase tracking-wider text-[10px]">
                    {selectedTier}
                  </span>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                  {errorMsg}
                </div>
              )}

              <div>
                <label htmlFor="admin-email" className="block text-xs font-semibold text-foreground mb-1">
                  Email y&apos;Akazi (Official Gov Email):
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  placeholder={`izina@${selectedTier}.gov.rw`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                />
              </div>

              <div>
                <label htmlFor="auth-code" className="block text-xs font-semibold text-foreground mb-1">
                  Umubare w&apos;Ibanga / Kode y&apos;Icyemezo (Passcode):
                </label>
                <input
                  id="auth-code"
                  type="password"
                  placeholder="••••••••"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  (Muri iri gerageza, ushobora gukanda &quot;Injira Muri Sisitemu&quot; ako kanya)
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-border px-4 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Subira inyuma
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-[44px] flex-2 items-center justify-center gap-2 rounded-xl bg-[#20603D] px-5 text-xs font-bold text-white shadow-md hover:bg-[#1b5234] disabled:opacity-50"
                >
                  <Lock className="h-4 w-4" />
                  <span>{loading ? "Turimo kwinjira…" : "Injira Muri Sisitemu"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
