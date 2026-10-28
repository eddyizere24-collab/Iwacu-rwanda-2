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

interface ErrorDisplayProps {
  code: LocationErrorCode;
  messageKiny: string;
  messageEng?: string | null;
  onRetry?: () => void;
  className?: string;
}

const ICON_MAP: Record<
  LocationErrorCode,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  GPS_DENIED: ShieldOff,
  GPS_ACCURACY_TOO_LOW: MapPinOff,
  OUTSIDE_RWANDA: MapPinOff,
  POINT_IN_GAP: SearchX,
  POINT_IN_OVERLAP: AlertTriangle,
  CONFIDENCE_TOO_LOW: MapPinOff,
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

const TITLE_KINY: Record<LocationErrorCode, string> = {
  GPS_DENIED: "GPS yanze",
  GPS_ACCURACY_TOO_LOW: "GPS ntabwo iri ku buryo bwiza",
  OUTSIDE_RWANDA: "Uri hanze y’u Rwanda",
  POINT_IN_GAP: "Ahantu hatabonetse",
  POINT_IN_OVERLAP: "Ahantu hagaragara mu bice byinshi",
  CONFIDENCE_TOO_LOW: "Icyizere gito cyane",
  MISSING_LEADER_CONTACT: "Nta numero ya telefone",
  NETWORK_ERROR: "Ikibazo cy’urukurikirane",
  NOT_FOUND: "Nticyabonetse",
  SLOW_NETWORK: "Urukurikirane rurasize",
  OFFLINE_CACHE: "Uri offline",
  BROWSER_NOT_SUPPORTED: "Browser ntabwo ishyigikiwe",
  RATE_LIMIT: "Byinshi cyane",
  CONCURRENT_EDIT_CONFLICT: "Impinduka zihuye",
  LEADER_MISSING: "Nta muyobozi uhari",
};

export function ErrorDisplay({
  code,
  messageKiny,
  messageEng,
  onRetry,
  className = "",
}: ErrorDisplayProps) {
  const Icon = ICON_MAP[code] ?? HelpCircle;
  const title = TITLE_KINY[code] ?? "Ikibazo";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`mx-auto w-full max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center shadow-sm ${className}`}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Icon className="h-7 w-7" aria-hidden />
      </div>

      <h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>

      <p className="mb-1 text-sm leading-relaxed text-muted-foreground">
        {messageKiny}
      </p>

      {messageEng && (
        <p className="mb-4 text-xs text-muted-foreground/80">{messageEng}</p>
      )}

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Ongera ugerageze
        </button>
      )}
    </div>
  );
}
