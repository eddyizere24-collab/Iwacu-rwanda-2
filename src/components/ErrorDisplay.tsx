"use client";

import {
  AlertTriangle,
  MapPinOff,
  WifiOff,
  ShieldOff,
  SearchX,
  Clock,
  RefreshCw,
  Smartphone,
  Ban,
  Users,
  HelpCircle,
} from "lucide-react";
import type { LocationErrorCode } from "@/types/location";
import { D1_ERRORS } from "@/lib/utils/errors";

interface ErrorDisplayProps {
  code: LocationErrorCode | string;
  messageKiny?: string;
  messageEng?: string | null;
  onRetry?: () => void;
  className?: string;
}

const ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  GPS_DENIED: ShieldOff,
  GPS_UNAVAILABLE: MapPinOff,
  GPS_TIMEOUT: Clock,
  GPS_ACCURACY_TOO_LOW: MapPinOff,
  OUTSIDE_RWANDA: MapPinOff,
  POINT_IN_GAP: SearchX,
  POINT_IN_OVERLAP: AlertTriangle,
  CONFIDENCE_TOO_LOW: MapPinOff,
  DATA_NOT_AVAILABLE: SearchX,
  DATABASE_ERROR: AlertTriangle,
  MISSING_LEADER_CONTACT: Users,
  NETWORK_ERROR: WifiOff,
  NOT_FOUND: SearchX,
  SLOW_NETWORK: Clock,
  OFFLINE_CACHE: WifiOff,
  BROWSER_NOT_SUPPORTED: Smartphone,
  RATE_LIMIT: Ban,
  CONCURRENT_EDIT_CONFLICT: RefreshCw,
  LEADER_MISSING: Users,
};

export function ErrorDisplay({
  code,
  messageKiny,
  onRetry,
  className = "",
}: ErrorDisplayProps) {
  const d1Info = D1_ERRORS[code];
  const Icon = ICON_MAP[code] ?? HelpCircle;
  const title = d1Info?.title ?? "Ikibazo cyabaye";
  const displayMessage = messageKiny || d1Info?.message || "Mwihangane, ongera ugerageze.";
  const buttonText = d1Info?.buttonText ?? "Ongera ugerageze";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`mx-auto w-full max-w-md rounded-2xl border border-amber-500/30 bg-card p-6 text-center shadow-lg ${className}`}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Icon className="h-7 w-7" aria-hidden />
      </div>

      <h2 className="mb-2 text-lg font-bold text-foreground tracking-tight">
        {title}
      </h2>

      <p className="mb-5 text-xs sm:text-sm leading-relaxed text-muted-foreground">
        {displayMessage}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          <span>{buttonText}</span>
        </button>
      )}
    </div>
  );
}
