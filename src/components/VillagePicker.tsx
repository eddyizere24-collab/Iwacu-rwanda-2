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
  province: "Intara / Umujyi",
  district: "Akarere",
  sector: "Umurenge",
  cell: "Akagari",
  village: "Umudugudu",
};
let indexPromise: Promise<Choice[]> | null = null;

async function fetchLocationIndex(): Promise<Choice[]> {
  if (!indexPromise) {
    indexPromise = fetch("/api/locate?index=1")
      .then(async (response) => {
        if (!response.ok) throw new Error("index_unavailable");
        const payload = await response.json();
        if (payload.status !== "index" || !Array.isArray(payload.choices)) {
          throw new Error("index_invalid");
        }
        return payload.choices as Choice[];
      })
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  }
  return indexPromise;
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/\\p{Diacritic}/gu, "").toLocaleLowerCase();
}

export function VillagePicker({ onSelect }: { onSelect: (scopeCode: string) => void }) {
  const [level, setLevel] = useState<BoundaryLevel>("province");
  const [parentScopeCode, setParentScopeCode] = useState("");
  const [history, setHistory] = useState<Array<{ level: BoundaryLevel; parentScopeCode: string }>>([]);
  const [query, setQuery] = useState("");
  const [allChoices, setAllChoices] = useState<Choice[]>([]);
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
    fetchLocationIndex()
      .then((choices) => {
        if (!cancelled) {
          setAllChoices(choices);
          setMessage("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("Nta rutonde rwabitswe kuri telefone. Huza interineti rimwe kugira ngo urutonde rw'imidugudu rubikwe.");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
  }, []);

  const visibleChoices = useMemo(() => {
    if (!allChoices.length) return [];
    if (query.trim()) {
      const needle = normalizeName(query.trim());
      return allChoices
        .filter((choice) => choice.level === "village" && normalizeName(choice.name_kiny).includes(needle))
        .sort((a, b) => a.name_kiny.localeCompare(b.name_kiny, "rw"))
        .slice(0, 30);
    }
    return allChoices
      .filter((choice) => choice.level === level)
      .filter((choice) => level === "province"
        ? !choice.parent_scope_code
        : choice.parent_scope_code === parentScopeCode)
      .sort((a, b) => a.name_kiny.localeCompare(b.name_kiny, "rw"));
  }, [allChoices, level, parentScopeCode, query]);

  function choose(choice: Choice) {
    if (choice.level === "village") {
      onSelect(choice.scope_code);
      return;
    }
    setHistory((previous) => [...previous, { level, parentScopeCode }]);
    setParentScopeCode(choice.scope_code);
    setLevel(NEXT_LEVEL[choice.level] ?? "village");
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
      return previous.slice(0, -1);
    });
  }

  const savedVillageIsKnown = lastVillage && allChoices.some(
    (choice) => choice.level === "village" && choice.scope_code === lastVillage.scope_code
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-[#20603D]" aria-hidden />
        <h2 className="text-sm font-bold">Hitamo cyangwa ushakishe umudugudu wawe</h2>
      </div>

      {savedVillageIsKnown && lastVillage && (
        <div className="mb-3 rounded-xl bg-emerald-500/10 p-3">
          <p className="text-xs text-muted-foreground">Umudugudu wari wemeje mbere</p>
          <p className="mt-1 text-sm font-semibold">{lastVillage.name_kiny}</p>
          <button
            type="button"
            onClick={() => onSelect(lastVillage.scope_code)}
            className="mt-2 min-h-[40px] rounded-lg border border-emerald-700/30 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300"
          >
            Ongera uwemeze
          </button>
        </div>
      )}

      <label className="flex min-h-[46px] items-center gap-2 rounded-xl border border-border bg-background px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Andika izina ry'umudugudu…"
          className="w-full bg-transparent py-2 text-sm outline-none"
          aria-label="Shakisha umudugudu"
        />
      </label>

      {!query.trim() && level !== "province" && (
        <button
          type="button"
          onClick={goBack}
          className="mt-3 inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Subira inyuma
        </button>
      )}

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {query.trim() ? "Imidugudu ijyanye n'ishakisha" : LABEL[level]}
        {allChoices.length > 0 && <span className="ml-2 normal-case">({allChoices.length.toLocaleString("rw-RW")})</span>}
      </p>

      {busy && <p className="py-4 text-sm text-muted-foreground">Turimo gufungura urutonde rw'igihugu…</p>}
      {!busy && message && <p role="status" className="py-3 text-sm text-amber-700">{message}</p>}
      {!busy && !message && visibleChoices.length === 0 && (
        <p className="py-3 text-sm text-muted-foreground">Nta mazina ahuye n'ishakisha wabonye. Gerageza andi magambo.</p>
      )}

      {!message && (
        <div className="mt-2 grid max-h-[360px] gap-2 overflow-y-auto sm:grid-cols-2">
          {visibleChoices.map((choice) => (
            <button
              type="button"
              key={choice.scope_code}
              onClick={() => choose(choice)}
              className="flex min-h-[46px] items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-left text-sm hover:border-[#20603D] hover:bg-[#20603D]/5 focus:outline-none focus:ring-2 focus:ring-[#20603D]"
            >
              <span>
                <span className="block font-semibold">{choice.name_kiny}</span>
                {choice.name_eng && choice.name_eng !== choice.name_kiny && (
                  <span className="block text-xs text-muted-foreground">{choice.name_eng}</span>
                )}
              </span>
              {choice.level === "village" ? (
                <MapPin className="h-4 w-4 shrink-0 text-[#20603D]" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Urutonde rwabikwa kuri telefone nyuma yo kurufungura kuri interineti. Hitamo umudugudu uzi; ntituhimba amazina y'ahantu.
      </p>
    </section>
  );
}
