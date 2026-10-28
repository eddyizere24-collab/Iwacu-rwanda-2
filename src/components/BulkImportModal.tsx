"use client";

import { useState } from "react";
import { X, UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { LeaderRole } from "@/types/leader";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ParsedLeaderRow {
  first_name: string;
  last_name: string;
  role: LeaderRole;
  phone_number: string;
  scope_code: string;
  boundary_name_kiny: string;
  level: string;
  email?: string;
}

const SAMPLE_CSV = `first_name,last_name,role,phone_number,boundary_name,level
Alice,Mukamana,Village Leader,+250788100101,Umudugudu w'Amahoro,village
Eric,Nshimiyimana,Cell Executive Secretary,+250788200202,Akagari ka Kibagabaga,cell
Clarisse,Uwamahoro,Sector Executive Secretary,+250788300303,Umurenge wa Kimironko,sector`;

export function BulkImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: BulkImportModalProps) {
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  async function handleImport() {
    setError(null);
    setLoading(true);

    try {
      const lines = csvText.trim().split("\n");
      if (lines.length <= 1) {
        throw new Error("CSV igomba kuba ifite imitwe y'inkingi n'imibare y'abayobozi byibuze umwe.");
      }

      const rows: ParsedLeaderRow[] = [];
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length < 5) continue;

        const [first_name, last_name, role, phone_number, boundary_name, level, email] = parts;

        rows.push({
          first_name: first_name || "Umuyobozi",
          last_name: last_name || "Wungirije",
          role: (role as LeaderRole) || "Village Leader",
          phone_number: phone_number || "+250788000000",
          boundary_name_kiny: boundary_name || "Agace",
          level: level || "village",
          scope_code: "RW-01-01",
          email: email || undefined,
        });
      }

      if (rows.length === 0) {
        throw new Error("Nta makuru yemewe yabonetse muri iyi CSV.");
      }

      // Send rows to API
      let count = 0;
      for (const row of rows) {
        await fetch("/api/leaders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...row,
            is_verified: true,
          }),
        });
        count++;
      }

      setSuccessCount(count);
      setTimeout(() => {
        onImportComplete();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ikibazo mu gushyiramo amakuru.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2 text-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
              <FileSpreadsheet className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="bulk-import-title" className="text-lg font-bold">
                Kwinjiza Abayobozi Benshi (CSV / Excel)
              </h2>
              <p className="text-xs text-muted-foreground">
                Koporora no kumenyekanisha urutonde rw&apos;abayobozi icyarimwe
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Funga"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {successCount !== null ? (
          <div className="py-8 text-center text-green-600">
            <CheckCircle2 className="mx-auto h-12 w-12 mb-3" />
            <h3 className="text-base font-bold text-foreground">
              Abayobozi {successCount} binjijwe neza!
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Amakuru yahise yongerwa muri sisitemu.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Andika cyangwa pomeka (paste) amakuru ya CSV hano. Inkingi zisabwa: <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">first_name,last_name,role,phone_number,boundary_name,level</code>.
            </p>

            <div>
              <label htmlFor="csv-input" className="block font-semibold mb-1 text-foreground">
                Amakuru ya CSV:
              </label>
              <textarea
                id="csv-input"
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full font-mono text-xs rounded-xl border border-input bg-background p-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] items-center rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
              >
                Reka
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Turimo kwinjiza...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    Injiza muri Sisitemu
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
