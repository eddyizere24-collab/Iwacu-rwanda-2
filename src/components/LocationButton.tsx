"use client";

import { Loader2, Compass } from "lucide-react";
import type { LocationStatus } from "@/hooks/useLocation";
import { RwandanSun } from "./RwandanSun";

interface LocationButtonProps {
  status: LocationStatus;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function LocationButton({
  status,
  onClick,
  disabled = false,
  className = "",
}: LocationButtonProps) {
  const isLoading =
    status === "requesting_gps" || status === "locating";

  const label =
    status === "requesting_gps"
      ? "Turimo gusaba GPS..."
      : status === "locating"
        ? "Turimo gushaka aho uri..."
        : "Menya aho ndi";

  return (
    <div className="w-full flex flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        aria-label={label}
        className={`
          group relative inline-flex min-h-[64px] w-full max-w-md items-center justify-center gap-3.5
          rounded-2xl px-8 py-4 text-lg font-extrabold text-white
          bg-gradient-to-r from-[#00A3E0] via-[#0284C7] to-[#0369A1]
          shadow-lg shadow-sky-500/25 sun-glow
          transition-all duration-300
          hover:scale-[1.02] hover:shadow-xl hover:shadow-sky-500/35 hover:from-[#0284C7] hover:to-[#00A3E0]
          active:scale-[0.98]
          focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/50
          disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:scale-100
          ${className}
        `}
      >
        {/* Subtle golden ambient accent line on top edge */}
        <div className="absolute top-0 inset-x-4 h-[2px] bg-gradient-to-r from-transparent via-[#FAD201] to-transparent opacity-80" />

        {isLoading ? (
          <Loader2 className="h-7 w-7 animate-spin text-[#FAD201]" aria-hidden />
        ) : (
          <div className="relative">
            <RwandanSun size={32} glow={false} className="group-hover:rotate-45 transition-transform duration-500" />
          </div>
        )}

        <span className="tracking-tight text-white drop-shadow-sm text-lg sm:text-xl">
          {label}
        </span>
      </button>

      {/* D1 B4 copy under the button */}
      <p className="mt-2.5 text-center text-xs text-muted-foreground max-w-sm leading-relaxed">
        Telefone iri bukubaze uruhushya rwa GPS. Ni ukugira ngo tumenye umudugudu wawe gusa.
      </p>
    </div>
  );
}
