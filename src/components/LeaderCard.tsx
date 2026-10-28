"use client";

import { useState } from "react";
import { Phone, Mail, User, MapPin } from "lucide-react";
import type { LeaderPublic } from "@/types/leader";

interface LeaderCardProps {
  leader: LeaderPublic;
  className?: string;
}

/**
 * Renders a leader card.
 * Phone numbers are always displayed masked.
 * A real tel: link is only generated after the user explicitly taps
 * "Hamagara" (Call) — NCSA compliance.
 */
export function LeaderCard({ leader, className = "" }: LeaderCardProps) {
  const [revealed, setRevealed] = useState(false);

  const fullName = `${leader.first_name} ${leader.last_name}`;
  const hasPhone = Boolean(leader.phone_masked);

  return (
    <article
      className={`rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md ${className}`}
      aria-label={`Umuyobozi: ${fullName}`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600/10 text-blue-600">
          {leader.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={leader.photo_url}
              alt=""
              className="h-full w-full object-cover"
              width={56}
              height={56}
            />
          ) : (
            <User className="h-7 w-7" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">
            {fullName}
          </h3>
          <p className="text-sm font-medium text-green-600 dark:text-green-500">
            {leader.role}
          </p>

          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {leader.boundary_name_kiny}
              {leader.level ? ` · ${leader.level}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Contact actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {hasPhone && (
          <>
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <Phone className="h-4 w-4 text-blue-600" aria-hidden />
                <span>{leader.phone_masked}</span>
              </button>
            ) : (
              <a
                href={`tel:${leader.phone_masked?.replace(/\s/g, "")}`}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              >
                <Phone className="h-4 w-4" aria-hidden />
                Hamagara {leader.phone_masked}
              </a>
            )}
          </>
        )}

        {leader.email && (
          <a
            href={`mailto:${leader.email}`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Mail className="h-4 w-4 text-blue-600" aria-hidden />
            <span className="truncate max-w-[180px]">{leader.email}</span>
          </a>
        )}
      </div>
    </article>
  );
}
