"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Search } from "lucide-react";

type BoundaryLevel = "province" | "district" | "sector" | "cell" | "village";
type Choice = {
  id: string;
  scope_code: string;
  name_kiny: string;
  name_eng: string | null;
  level: BoundaryLevel;
  parent_id: string | null;
};

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

export function VillagePicker({ onSelect }: { onSelect: (scopeCode: string) => void }) {
  const [level, setLevel] = useState<BoundaryLevel>("province");
  const [parentScopeCode, setParentScopeCode] = useState("");
  const [query, setQuery] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [history, setHistory] = useState<Array<{ level: BoundaryLevel; parentScopeCode: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBusy(true);
      setMessage("");
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        else {
          params.set("level", level);
          if (parentScopeCode) params.set("parent_scope_code", parentScopeCode);
        }
        const response = await fetch("/api/locate?" + params.toString(), {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== "choices" || !Array.isArray(payload.choices)) {
          throw new Error("choices_unavailable");
        }
        if (!cancelled) setChoices(payload.choices as Choice[]);
      } catch {
        if (!cancelled) {
          setChoices([]);
          setMessage("Ntitwashoboye gufungura urutonde. Reba interineti cyangwa wongere ugerageze.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, query.trim() ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [level, parentScopeCode, query]);

  function choose(choice: Choice) {
    if (query.trim() || choice.level === "village") {
      if (choice.level === "village") {
        onSelect(choice.scope_code);
        try {
          localStorage.setItem("iwacu-confirmed-village", JSON.stringify({
            scope_code: choice.scope_code,
            name_kiny: choice.name_kiny,
            confirmed_at: new Date().toISOString(),
          }));
        } catch {}
      }
      return;
    }
    setHistory((previous) => [...previous, { level, parentScopeCode }]);
    setParentScopeCode(choice.scope_code);
    setLevel(NEXT_LEVEL[choice.level] ?? "village");
  }

  function goBack() {
    setHistory((previous) => {
      const last = previous[previous.length - 1];
      if (last) {
        setLevel(last.level);
        setParentScopeCode(last.parentScopeCode);
        return previous.slice(0, -1);
      }
      setLevel("province");
      setParentScopeCode("");
      return [];
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-[#20603D]" aria-hidden />
        <h2 className="text-sm font-bold">Hitamo cyangwa ushakishe umudugudu wawe</h2>
      </div>
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
      </p>
      {busy && <p className="py-4 text-sm text-muted-foreground">Turimo gufungura urutonde…</p>}
      {!busy && message && <p role="status" className="py-3 text-sm text-amber-700">{message}</p>}
      {!busy && !message && choices.length === 0 && (
        <p className="py-3 text-sm text-muted-foreground">
          Nta mazina ahuye n'ishakisha wabonye. Gerageza andi magambo.
        </p>
      )}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => (
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
      <p className="mt-3 text-[11px] text-muted-foreground">
        Aho GPS idasobanutse, ushobora kwemeza umudugudu uhitiyemo. Ntabwo dutekereza izina ry'ahantu tutabonye mu makuru yemewe.
      </p>
    </section>
  );
}
