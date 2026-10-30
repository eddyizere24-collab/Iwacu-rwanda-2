"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Search } from "lucide-react";

type BoundaryLevel = "province" | "district" | "sector" | "cell" | "village";
type Choice = {
  scope_code: string;
  name_kiny: string;
  name_eng: string | null;
  level: BoundaryLevel;
  parent_scope_code: string | null;
};
type SavedVillage = { scope_code: string; name_kiny: string; confirmed_at?: string };

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
const CACHE_PREFIX = "iwacu-location-choices-v2:";
const ALLOWED = new Set<BoundaryLevel>(["province", "district", "sector", "cell", "village"]);

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}

function decodeChoices(payload: unknown, parentScopeCode: string): Choice[] {
  if (!payload || typeof payload !== "object") throw new Error("index_invalid");
  const raw = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(raw)) throw new Error("index_invalid");
  return raw.flatMap((row): Choice[] => {
    let choice: Choice;
    if (Array.isArray(row) && row.length >= 5) {
      const level = String(row[3]) as BoundaryLevel;
      if (!ALLOWED.has(level)) return [];
      choice = {
        scope_code: String(row[0] ?? ""),
        name_kiny: String(row[1] ?? ""),
        name_eng: row[2] == null ? null : String(row[2]),
        level,
        // Some older bundled indexes attach provinces to a hidden RW root.
        parent_scope_code: level === "province"
          ? null
          : row[4] == null ? parentScopeCode || null : String(row[4]),
      };
    } else if (row && typeof row === "object") {
      const value = row as Record<string, unknown>;
      const level = String(value.level ?? "") as BoundaryLevel;
      if (!ALLOWED.has(level)) return [];
      const scopeCode = String(value.scope_code ?? "");
      choice = {
        scope_code: scopeCode,
        name_kiny: String(value.name_kiny ?? ""),
        name_eng: value.name_eng == null ? null : String(value.name_eng),
        level,
        parent_scope_code: level === "province"
          ? null
          : typeof value.parent_scope_code === "string"
            ? value.parent_scope_code
            : parentScopeCode || scopeCode.split("-").slice(0, -1).join("-"),
      };
    } else {
      return [];
    }
    return choice.scope_code && choice.name_kiny ? [choice] : [];
  });
}

function cacheKey(level: BoundaryLevel, parentScopeCode: string, query: string): string {
  return `${CACHE_PREFIX}${level}:${parentScopeCode || "root"}:${normalizeName(query)}`;
}

function readCache(key: string): Choice[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? data as Choice[] : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, choices: Choice[]) {
  try {
    localStorage.setItem(key, JSON.stringify(choices));
  } catch {
    // Storage quota/private mode must not stop the picker from working online.
  }
}

async function loadStaticChoices(level: BoundaryLevel, parentScopeCode: string, query: string): Promise<Choice[]> {
  const response = await fetch("/offline/location-index.json", { cache: "force-cache" });
  if (!response.ok) throw new Error("offline_index_unavailable");
  const all = decodeChoices(await response.json(), "");
  if (query.trim()) {
    const needle = normalizeName(query.trim());
    return all.filter((choice) => choice.level === "village" &&
      normalizeName(choice.name_kiny).includes(needle)).slice(0, 30);
  }
  return all.filter((choice) => choice.level === level &&
    (level === "province"
      ? !choice.parent_scope_code || choice.parent_scope_code === "RW"
      : choice.parent_scope_code === parentScopeCode));
}

async function loadChoices(level: BoundaryLevel, parentScopeCode: string, query: string): Promise<Choice[]> {
  const key = cacheKey(level, parentScopeCode, query);
  const cached = readCache(key);
  if (cached?.length) return cached;

  if (typeof navigator !== "undefined" && navigator.onLine !== false) {
    try {
      const params = new URLSearchParams({ level });
      if (parentScopeCode) params.set("parent_scope_code", parentScopeCode);
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/locate?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("choices_unavailable");
      const choices = decodeChoices(await response.json(), parentScopeCode);
      writeCache(key, choices);
      return choices;
    } catch {
      // Try the offline index after online lookup failure.
    }
  }

  const choices = await loadStaticChoices(level, parentScopeCode, query);
  writeCache(key, choices);
  return choices;
}

export function VillagePicker({ onSelect }: { onSelect: (scopeCode: string) => void }) {
  const [level, setLevel] = useState<BoundaryLevel>("province");
  const [parentScopeCode, setParentScopeCode] = useState("");
  const [history, setHistory] = useState<Array<{ level: BoundaryLevel; parentScopeCode: string }>>([]);
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
    } catch {
      // Storage may be disabled.
    }

    const key = cacheKey(level, parentScopeCode, query);
    const cached = readCache(key);
    if (cached) {
      setVisibleChoices(cached);
      setBusy(false);
      setMessage("");
    } else {
      setBusy(true);
      setVisibleChoices([]);
    }

    loadChoices(level, parentScopeCode, query)
      .then((choices) => {
        if (!cancelled) {
          setVisibleChoices(choices);
          setMessage("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("Urutonde ntirubashije gufunguka. Ongera uhuze interineti, cyangwa ukoreshe ikarita iri ku rubuga.");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => { cancelled = true; };
  }, [level, parentScopeCode, query]);

  function choose(choice: Choice) {
    if (choice.level === "village") {
      onSelect(choice.scope_code);
      return;
    }
    setHistory((previous) => [...previous, { level, parentScopeCode }]);
    setParentScopeCode(choice.scope_code);
    setLevel(NEXT_LEVEL[choice.level] ?? "village");
    setQuery("");
  }

  function goBack() {
    setHistory((previous) => {
      const last = previous[previous.length - 1];
      if (!last) {
        setLevel("province");
        setParentScopeCode("");
        return [];
      }
      setLevel(last.level);
      setParentScopeCode(last.parentScopeCode);
      setQuery("");
      return previous.slice(0, -1);
    });
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
          placeholder="Shakisha umudugudu (ushatse)…"
          className="w-full bg-transparent py-2 text-sm outline-none" aria-label="Shakisha umudugudu" />
      </label>

      {!query.trim() && level !== "province" && (
        <button type="button" onClick={goBack}
          className="mt-3 inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-muted">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Subira inyuma
        </button>
      )}

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {query.trim() ? "Imidugudu ijyanye n'ishakisha" : LABEL[level]}
        {!busy && visibleChoices.length > 0 && (
          <span className="ml-2 normal-case">({visibleChoices.length.toLocaleString("rw-RW")})</span>
        )}
      </p>

      {busy && <p className="py-4 text-sm text-muted-foreground">Turimo gufungura uru rwego…</p>}
      {!busy && message && <p role="status" className="py-3 text-sm text-amber-700">{message}</p>}
      {!busy && !message && visibleChoices.length === 0 && (
        <p className="py-3 text-sm text-muted-foreground">
          Nta handi hantu habonetse kuri uru rwego. Subira inyuma cyangwa ugerageze gushakisha izina ry'umudugudu.
        </p>
      )}

      {!message && (
        <div className="mt-2 grid max-h-[300px] gap-2 overflow-y-auto sm:grid-cols-2">
          {visibleChoices.map((choice) => (
            <button type="button" key={choice.scope_code} onClick={() => choose(choice)}
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
        Urutonde rufunguka urwego ku rundi kandi rukabikwa kuri telefone. Uru ni uburyo bwo gukosora aho hantu, si bwo bwa mbere bwo kukumenya.
      </p>
    </section>
  );
}
