"use client";

import { useState } from "react";
import type { ConfidenceMatch } from "@/types/boundary";
import type { LocateSuccess } from "@/types/location";

const LEVELS = ["province", "district", "sector", "cell", "village"] as const;

export function LocationReportButton({ data }: { data: LocateSuccess | null }) {
  const [message, setMessage] = useState("");

  async function copyReport() {
    const candidates = data?.per_level_candidates ?? data?.hierarchyCandidates ?? {};
    const percentages = LEVELS.map((level) => ({
      level,
      candidates: ((candidates[level] ?? []) as ConfidenceMatch[]).slice(0, 3).map((item) => ({
        scope_code: item.scope_code,
        name_kiny: item.name_kiny,
        score_percent: item.confidence,
      })),
    }));
    const report = {
      report_version: "IWACU-W04",
      created_at: new Date().toISOString(),
      source: data?.source ?? null,
      signals_used: data?.signals_used ?? [],
      accuracy_m: data?.accuracy_m ?? null,
      level: data?.level ?? null,
      path: data?.path ?? null,
      percentages,
      score_note: "Scores are geometric overlap scores, not calibrated probabilities.",
      per_level_candidates: candidates,
      top3_villages: data?.top3_villages ?? data?.matches?.filter((item) => item.level === "village").slice(0, 3) ?? [],
      timings_ms: {
        elapsed_ms: data?.elapsed_ms ?? null,
        fix_age_ms: data?.fix_age_ms ?? null,
      },
      flags: data?.flags ?? [],
      dataset_version: data?.dataset_version ?? "unknown",
      commit_sha: data?.commit_sha ?? "unknown",
      // No exact coordinates, IP address, account ID, or secret is included.
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    };
    const output = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(output);
      setMessage("Raporo yakoporowewe. Ushobora kuyishyira mu butumwa bwo kuyigenzura.");
    } catch {
      const area = document.createElement("textarea");
      area.value = output;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      setMessage(copied
        ? "Raporo yakoporowewe."
        : "Ntibyashobotse kuyikoporora kuri iyi telefone.");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <button
        type="button"
        onClick={() => void copyReport()}
        className="min-h-[42px] w-full rounded-xl border border-[#20603D]/40 px-3 py-2 text-sm font-semibold text-[#20603D]"
      >
        Koporora raporo
      </button>
      {message && <p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
