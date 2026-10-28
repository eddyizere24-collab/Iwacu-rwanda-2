"use client";

import { useState } from "react";
import {
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Quote,
} from "lucide-react";
import type { LeaderPublic } from "@/types/leader";

interface LeaderCardProps {
  leader: LeaderPublic;
  className?: string;
}

export function LeaderCard({ leader, className = "" }: LeaderCardProps) {
  const [revealed, setRevealed] = useState(false);

  const fullName = `${leader.first_name} ${leader.last_name}`;
  const rawPhone = leader.phone_raw || leader.phone_masked?.replace(/\s/g, "");
  const whatsappTarget = (leader.whatsapp_number || rawPhone)?.replace(/[^0-9]/g, "");

  const initials = `${leader.first_name.charAt(0)}${leader.last_name.charAt(0)}`.toUpperCase();
  const isVerified = leader.is_verified ?? true;

  // Office hours display
  const officeHoursText = leader.office_hours || "Kuwa Mbere – Kuwa Gatanu: 08:00 – 17:00";

  return (
    <>
      <article
        className={`group relative overflow-hidden rounded-3xl border border-sky-100 bg-card p-5 sm:p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-sky-300 dark:border-sky-950 dark:hover:border-sky-800 ${className}`}
        aria-label={`Umuyobozi: ${fullName}`}
      >
        {/* Subtle Rwandan National Border Top Accent */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#00A3E0] via-[#FAD201] to-[#20603D] opacity-80" />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {/* Authentic Leader Photo / Avatar */}
            <div className="relative shrink-0">
              <div className="h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-2xl border-2 border-sky-200/80 bg-gradient-to-br from-sky-600 via-sky-500 to-emerald-600 shadow-md dark:border-sky-800">
                {leader.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={leader.photo_url}
                    alt={`Ifoto ya ${fullName}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    width={80}
                    height={80}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-extrabold text-white text-lg tracking-wider">
                    {initials}
                  </div>
                )}
              </div>

              {/* Live availability green indicator */}
              <span
                title="Arahari mu masaha y'akazi"
                className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            </div>

            {/* Profile Info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-extrabold text-foreground tracking-tight">
                  {fullName}
                </h3>

                {/* Verification Badge */}
                {isVerified ? (
                  <span
                    title={leader.verified_by ? `Amakuru yemejwe na ${leader.verified_by}` : "Amakuru yemejwe n'ubuyobozi bw'Akarere"}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                    <span>{leader.verified_by || "Byemejwe n'Akarere"}</span>
                  </span>
                ) : (
                  <span
                    title="Amakuru aracyari mu igerageza"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                    <span>Igerageza</span>
                  </span>
                )}
              </div>

              {/* Title / Role */}
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-[#00A3E0]">
                {leader.role}
              </p>

              {/* Boundary */}
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#20603D]" aria-hidden />
                <span className="truncate font-medium">
                  {leader.boundary_name_kiny}
                  {leader.level ? ` (${leader.level})` : ""}
                </span>
              </div>

              {/* Office hours */}
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/90">
                <Clock className="h-3 w-3 shrink-0 text-amber-600" aria-hidden />
                <span>{officeHoursText}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Vision & Community Priorities (Intego z'Umuyobozi) */}
        {leader.vision_priorities && (
          <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-3.5 dark:border-sky-900/40 dark:bg-sky-950/30">
            <div className="flex items-start gap-2">
              <Quote className="h-4 w-4 shrink-0 text-[#00A3E0] rotate-180 mt-0.5" aria-hidden />
              <div className="text-xs text-foreground/90 leading-relaxed font-normal">
                <span className="font-bold text-foreground">Intego z&apos;umuyobozi: </span>
                «{leader.vision_priorities}»
              </div>
            </div>
          </div>
        )}

        {/* Social Media Links (if provided) */}
        {leader.social_media && (leader.social_media.twitter_x || leader.social_media.linkedin) && (
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="text-[11px] font-semibold text-muted-foreground">Imbuga nkoranyambaga:</span>
            {leader.social_media.twitter_x && (
              <a
                href={leader.social_media.twitter_x}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#00A3E0] hover:underline"
              >
                X (Twitter)
              </a>
            )}
            {leader.social_media.linkedin && (
              <a
                href={leader.social_media.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-sky-700 hover:underline dark:text-sky-400"
              >
                LinkedIn
              </a>
            )}
          </div>
        )}

        {/* Action Buttons: Call, WhatsApp, Email, Report dead number */}
        <div className="mt-5 pt-3.5 border-t border-border/70 flex flex-wrap items-center gap-2">
          {/* Call button */}
          {leader.phone_masked && (
            <>
              {!revealed ? (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#00A3E0] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#0090c6] active:scale-95"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  <span>Hamagara {leader.phone_masked}</span>
                </button>
              ) : (
                <a
                  href={`tel:${rawPhone}`}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#20603D] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#1b5234] active:scale-95"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  <span>Kanda uhamagare {rawPhone || leader.phone_masked}</span>
                </a>
              )}
            </>
          )}

          {/* WhatsApp button */}
          {whatsappTarget && (
            <a
              href={`https://wa.me/${whatsappTarget}?text=${encodeURIComponent(
                `Muraho ${fullName}, nkeneye ubufasha bwawe nk'umuyobozi muri ${leader.boundary_name_kiny}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
              aria-label={`Andikira kuri WhatsApp ${fullName}`}
            >
              <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <span>WhatsApp</span>
            </a>
          )}

          {/* Email button (if present) */}
          {leader.email && (
            <a
              href={`mailto:${leader.email}`}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Ohereza email kuri ${fullName}`}
              title={leader.email}
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
      </article>
    </>
  );
}
