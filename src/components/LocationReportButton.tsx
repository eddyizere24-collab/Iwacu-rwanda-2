"use client";

import { useState } from "react";
import type { LocateSuccess } from "@/types/location";

export function LocationReportButton({ data }: { data: LocateSuccess | null }) {
  const [message, setMessage] = useState("");

  async function copyReport() {
    const report = {
      report_version: "IWACU-W4",
      created_at: new Date().toISOString(),
      source: data?.source ?? null,
      level: data?.level ?? null,
      path: data?.path ?? null,
      per_level_candidates: data?.per_level_candidates ?? data?.hierarchyCandidates ?? {},
      top3_villages: data?.top3_villages ?? data?.matches?.filter((item) => item.level === "village").slice(0, 3) ?? [],
      signals_used: data?.signals_used ?? [],
      flags: data?.flags ?? [],
      accuracy_m: data?.accuracy_m ?? null,
      fix_age_ms: data?.fix_age_ms ?? null,
      dataset_version: data?.dataset_version ?? "unknown",
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
