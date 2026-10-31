"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, MapPin, Search } from "lucide-react";

type BoundaryLevel = "province" | "district" | "sector" | "cell" | "village";
type Choice = {
  id: string;
  code: string;
  scope_code: string;
  name_kiny: string;
  name_eng: string | null;
  level: BoundaryLevel;
  parent_id: string | null;
};
type SavedVillage = { scope_code: string; name_kiny: string; confirmed_at?: string };
type Crumb = { level: BoundaryLevel; parentId: string; label: string };
type ApiResponse = { status: string; units?: Choice[] };

const NEXT_LEVEL: Record<BoundaryLevel, BoundaryLevel | null> = {
  province: "district",
  district: "sector",
  sector: "cell",
  cell: "village",
  village: null,
};
const LABEL: Record<BoundaryLevel, string> = {
  province: "Intara 5 z'u Rwanda",
  district: "Akarere",
  sector: "Umurenge",
  cell: "Akagari",
  village: "Umudugudu",
};
const CACHE_PREFIX = "iwacu-db-picker-v4:";

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}
function cacheKey(level: BoundaryLevel, parentId: string, query: string): string {
  return CACHE_PREFIX + level + ":" + (parentId || "root") + ":" + normalizeName(query);
}
function readCache(key: string): Choice[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value as Choice[] : null;
  } catch {
    return null;
  }
}
function writeCache(key: string, value: Choice[]) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be disabled */ }
}
async function loadChoices(level: BoundaryLevel, parentId: string, query: string): Promise<Choice[]> {
  const key = cacheKey(level, parentId, query);
  const cached = readCache(key);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return cached ?? [];

  const params = new URLSearchParams({ level });
  if (parentId) params.set("parent_id", parentId);
  if (query.trim()) params.set("q", query.trim());
  try {
    const response = await fetch("/api/administrative-units?" + params.toString(), {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("database_picker_unavailable");
    const payload = await response.json() as ApiResponse;
    if (payload.status !== "success" || !Array.isArray(payload.units)) {
      throw new Error("database_picker_unavailable");
    }
    const valid = payload.units.filter((item) =>
      item && item.id && item.scope_code && item.name_kiny && item.level === level &&
      (level === "province" || item.parent_id === parentId)
    );
    writeCache(key, valid);
    return valid;
  } catch {
    return cached ?? [];
  }
}

export function VillagePicker({ onSelect }: { onSelect: (scopeCode: string) => void }) {
  const [level, setLevel] = useState<BoundaryLevel>("province");
  const [parentId, setParentId] = useState("");
  const [history, setHistory] = useState<Array<{ level: BoundaryLevel; parentId: string; crumbs: Crumb[] }>>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([
    { level: "province", parentId: "", label: "Intara" },
  ]);
  const [query, setQuery] = useState("");
  const [visibleChoices, setVisibleChoices] = useState<Choice[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [lastVillage, setLastVillage] = useState<SavedVillage | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const saved = localStorage.getItem("iwacu-confirmed-village");
      if (saved) setLastVillage(JSON.parse(saved) as SavedVillage);
    } catch { /* storage may be disabled */ }

    const key = cacheKey(level, parentId, query);
    const cached = readCache(key);
    if (cached) {
      setVisibleChoices(cached);
      setBusy(false);
      setMessage("");
    } else {
      setVisibleChoices([]);
      setBusy(true);
    }

    loadChoices(level, parentId, query)
      .then((choices) => {
        if (cancelled) return;
        setVisibleChoices(choices);
        setMessage("");
      })
      .catch(() => {
        if (!cancelled) setMessage("Urutonde ntirubashije gufunguka. Ongera uhuze interineti.");
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [level, parentId, query]);

  function choose(choice: Choice) {
    if (choice.level === "village") {
      onSelect(choice.scope_code);
      return;
    }
    const nextLevel = NEXT_LEVEL[choice.level];
    if (!nextLevel) return;
    setHistory((previous) => [...previous, { level, parentId, crumbs }]);
    setParentId(choice.id);
    setLevel(nextLevel);
    setCrumbs((previous) => [...previous, {
      level: nextLevel,
      parentId: choice.id,
      label: choice.name_kiny,
    }]);
    setQuery("");
  }

  function goBackTo(index: number) {
    const crumb = crumbs[index];
    if (!crumb) return;
    setLevel(crumb.level);
    setParentId(crumb.parentId);
    setCrumbs((previous) => previous.slice(0, index + 1));
    setHistory((previous) => previous.slice(0, index));
    setQuery("");
  }

  const savedVillageIsKnown = useMemo(() => Boolean(
    lastVillage && visibleChoices.some(
      (choice) => choice.level === "village" && choice.scope_code === lastVillage.scope_code
    )
  ), [lastVillage, visibleChoices]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-[#20603D]" aria-hidden />
        <h2 className="text-sm font-bold">Guhindura ahagaragajwe (Si hano?)</h2>
      </div>

      <nav aria-label="Aho uri mu nzego z'ubuyobozi" className="mb-3 flex flex-wrap items-center gap-1 text-xs">
        {crumbs.map((crumb, index) => (
          <span key={crumb.level + ":" + index} className="inline-flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />}
            <button type="button" onClick={() => goBackTo(index)}
              className="min-h-[32px] rounded-md px-1.5 font-semibold text-[#20603D] hover:bg-[#20603D]/5">
              {crumb.label}
            </button>
          </span>
        ))}
      </nav>

      {savedVillageIsKnown && lastVillage && (
        <div className="mb-3 rounded-xl bg-emerald-500/10 p-3">
          <p className="text-xs text-muted-foreground">Umudugudu wari wemeje mbere</p>
          <p className="mt-1 text-sm font-semibold">{lastVillage.name_kiny}</p>
          <button type="button" onClick={() => onSelect(lastVillage.scope_code)}
            className="mt-2 min-h-[40px] rounded-lg border border-emerald-700/30 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Ongera uwemeze
          </button>
        </div>
      )}

      <label className="flex min-h-[46px] items-center gap-2 rounded-xl border border-border bg-background px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder={"Shakisha " + LABEL[level].toLocaleLowerCase() + " (ushatse)…"}
          className="w-full bg-transparent py-2 text-sm outline-none" aria-label="Shakisha ahantu" />
      </label>

      {!busy && visibleChoices.length > 0 && (
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {LABEL[level]} ({visibleChoices.length.toLocaleString("rw-RW")})
        </p>
      )}
      {busy && <p className="py-4 text-sm text-muted-foreground">Turimo gufungura uru rwego…</p>}
      {!busy && message && <p role="status" className="py-3 text-sm text-amber-700">{message}</p>}
      {!busy && !message && visibleChoices.length === 0 && (
        <p className="py-3 text-sm text-muted-foreground">
          Nta mazina abitswe kuri uru rwego. Subira ku rwego rubanziriza cyangwa uhuze interineti.
        </p>
      )}

      {!message && (
        <div className="mt-2 grid max-h-[300px] gap-2 overflow-y-auto sm:grid-cols-2">
          {visibleChoices.map((choice) => (
            <button type="button" key={choice.id} onClick={() => choose(choice)}
              className="flex min-h-[46px] items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-left text-sm hover:border-[#20603D] hover:bg-[#20603D]/5 focus:outline-none focus:ring-2 focus:ring-[#20603D]">
              <span>
                <span className="block font-semibold">{choice.name_kiny}</span>
                {choice.name_eng && choice.name_eng !== choice.name_kiny && (
                  <span className="block text-xs text-muted-foreground">{choice.name_eng}</span>
                )}
              </span>
              {choice.level === "village"
                ? <MapPin className="h-4 w-4 shrink-0 text-[#20603D]" aria-hidden />
                : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Urutonde rukurwa muri database, rukabikwa kuri telefone kugira ngo rushobore kongera gufunguka offline.
      </p>
    </section>
  );
}
