"use client";

import { Phone, Shield, Flame, HeartPulse } from "lucide-react";

/** National Rwanda emergency numbers — always visible, no DB required. */
const EMERGENCY_NUMBERS = [
  {
    number: "112",
    labelKiny: "Polisi",
    labelEng: "Police",
    icon: Shield,
    color: "bg-blue-600 hover:bg-blue-700",
  },
  {
    number: "113",
    labelKiny: "Abazimya umuriro",
    labelEng: "Fire",
    icon: Flame,
    color: "bg-orange-600 hover:bg-orange-700",
  },
  {
    number: "912",
    labelKiny: "Ambulance",
    labelEng: "Ambulance",
    icon: HeartPulse,
    color: "bg-red-600 hover:bg-red-700",
  },
] as const;

export function EmergencyBar() {
  return (
    <div
      role="region"
      aria-label="Numero z'ubutabazi"
      className="border-b border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2 px-3 py-2 sm:justify-between sm:px-6">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-800 dark:text-red-300">
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Ubutabazi (Emergency)</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {EMERGENCY_NUMBERS.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.number}
                href={`tel:${item.number}`}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors ${item.color}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span>{item.number}</span>
                <span className="font-medium opacity-90">{item.labelKiny}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
