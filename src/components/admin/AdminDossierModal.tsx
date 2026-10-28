"use client";

import { X, GraduationCap, Briefcase, FileText, Award, ShieldAlert, CheckCircle2 } from "lucide-react";
import type { LeaderPublic } from "@/types/leader";

interface AdminDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  leader: LeaderPublic | null;
}

export function AdminDossierModal({ isOpen, onClose, leader }: AdminDossierModalProps) {
  if (!isOpen || !leader) return null;

  const dossier = leader.admin_dossier;
  const fullName = `${leader.first_name} ${leader.last_name}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dossier-modal-title"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-sky-200 bg-card p-6 sm:p-8 shadow-2xl dark:border-sky-800">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Funga"
          className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Confidential Admin Banner */}
        <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 mb-6">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Dossier y&apos;Akazi y&apos;Umuyobozi (Amakuru y&apos;Ibanga Agenewe Ubuyobozi Gusa)</span>
        </div>

        {/* Leader Profile Header */}
        <div className="flex items-center gap-4 border-b border-border pb-5 mb-6">
          <div className="h-16 w-16 overflow-hidden rounded-2xl border border-border bg-sky-100 dark:bg-sky-950 shrink-0">
            {leader.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={leader.photo_url}
                alt={fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-bold text-sky-700 dark:text-sky-300 text-lg">
                {leader.first_name[0]}{leader.last_name[0]}
              </div>
            )}
          </div>

          <div>
            <h2 id="dossier-modal-title" className="text-xl font-extrabold text-foreground tracking-tight">
              {fullName}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-[#00A3E0]">{leader.role}</span>
              <span className="text-xs text-muted-foreground">· {leader.boundary_name_kiny}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Telefone y&apos;akazi: <span className="font-mono font-semibold text-foreground">{leader.phone_raw || leader.phone_masked}</span>
            </div>
          </div>
        </div>

        {dossier ? (
          <div className="space-y-6">
            {/* 1. Amashuri Yize & Impamyabumenyi */}
            <section className="rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3 text-sm font-bold text-foreground">
                <GraduationCap className="h-4 w-4 text-[#00A3E0]" />
                <span>Amashuri Yize & Impamyabumenyi (Education)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Urwego rw&apos;amashuri:</span>
                  <span className="font-bold text-foreground">{dossier.education_level || "Impamyabumenyi ya Kaminuza"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Ibyo yize (Field of Study):</span>
                  <span className="font-bold text-foreground">{dossier.field_of_study || "Imiyoborere y'Inzego z'Ibanze"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground block">Ishuri / Kaminuza:</span>
                  <span className="font-bold text-foreground">{dossier.institution || "Kaminuza y'u Rwanda"}</span>
                </div>
              </div>
            </section>

            {/* 2. Urwandiko rw'Akazi & Itariki y'Itangira */}
            <section className="rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3 text-sm font-bold text-foreground">
                <FileText className="h-4 w-4 text-[#20603D]" />
                <span>Inyandiko y&apos;Ishyirwaho mu Kazi (Appointment Details)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Nimero y&apos;Ibaruwa / Ref:</span>
                  <span className="font-mono font-bold text-foreground">{dossier.appointment_letter_ref || "MINALOC/GAS/2023/118"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Itariki yatangiriyeho inshingano:</span>
                  <span className="font-bold text-foreground">{dossier.start_date || "2023-01-15"}</span>
                </div>
              </div>
            </section>

            {/* 3. Aho Yakoze Mbere (Work History) */}
            <section className="rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3 text-sm font-bold text-foreground">
                <Briefcase className="h-4 w-4 text-amber-600" />
                <span>Uburambe n&apos;Aho Yakoze Mbere (Work Experience)</span>
              </div>
              {dossier.work_history && dossier.work_history.length > 0 ? (
                <div className="space-y-2.5">
                  {dossier.work_history.map((job, idx) => (
                    <div key={idx} className="flex items-start justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0 text-xs">
                      <div>
                        <div className="font-bold text-foreground">{job.title}</div>
                        <div className="text-muted-foreground">{job.organization}</div>
                      </div>
                      <span className="rounded-lg bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                        {job.period}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nta bundi burambe bwongewemo.</p>
              )}
            </section>

            {/* 4. Amahugurwa n'Ubumenyi Bwihariye */}
            {dossier.special_certifications && dossier.special_certifications.length > 0 && (
              <section className="rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3 text-sm font-bold text-foreground">
                  <Award className="h-4 w-4 text-purple-600" />
                  <span>Amahugurwa n&apos;Impamyabushobozi (Certifications)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dossier.special_certifications.map((cert, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
                      <span>{cert}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Notes if any */}
            {dossier.notes && (
              <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
                <span className="font-bold text-foreground">Icyitonderwa cy&apos;ubuyobozi: </span>
                {dossier.notes}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            Dossier y&apos;uyu muyobozi ntaruzuzwa neza mu biro by&apos;akarere. Kanda kuri «Hindura» kugira ngo wongeremo amashuri n&apos;uburambe bwe.
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-muted px-6 text-xs font-bold text-foreground hover:bg-muted/80"
          >
            Funga Dossier
          </button>
        </div>
      </div>
    </div>
  );
}
