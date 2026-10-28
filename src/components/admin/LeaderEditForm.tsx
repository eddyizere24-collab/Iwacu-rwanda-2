"use client";

import { useState, FormEvent } from "react";
import { X, Loader2, AlertTriangle, Check, GraduationCap, User, ShieldAlert } from "lucide-react";
import type { LeaderPublic, LeaderRole, AdminDossier } from "@/types/leader";

interface LeaderEditFormProps {
  leader: LeaderPublic & { phone_raw_masked?: string | null };
  onClose: () => void;
  onSuccess: (updated: LeaderPublic) => void;
  canEditRole?: boolean;
}

interface ConflictDiff {
  server_version: number;
  your_version: number;
  server_data: Record<string, unknown>;
  your_data: Record<string, unknown>;
}

const ROLES: LeaderRole[] = [
  "Village Leader",
  "Cell Executive Secretary",
  "Sector Executive Secretary",
  "Mayor",
  "Vice Mayor",
  "District Executive Secretary",
  "Other",
];

export function LeaderEditForm({
  leader,
  onClose,
  onSuccess,
  canEditRole = true,
}: LeaderEditFormProps) {
  const [activeTab, setActiveTab] = useState<"public" | "dossier">("public");

  // Public Fields
  const [firstName, setFirstName] = useState(leader.first_name);
  const [lastName, setLastName] = useState(leader.last_name);
  const [role, setRole] = useState<LeaderRole>(leader.role);
  const [phone, setPhone] = useState(leader.phone_raw || "");
  const [whatsapp, setWhatsapp] = useState(leader.whatsapp_number || "");
  const [email, setEmail] = useState(leader.email ?? "");
  const [photoUrl, setPhotoUrl] = useState(leader.photo_url ?? "");
  const [vision, setVision] = useState(leader.vision_priorities ?? "");
  const [officeHours, setOfficeHours] = useState(leader.office_hours ?? "Kuwa Mbere – Kuwa Gatanu: 08:00 – 17:00");
  const [twitterX, setTwitterX] = useState(leader.social_media?.twitter_x ?? "");
  const [linkedin, setLinkedin] = useState(leader.social_media?.linkedin ?? "");

  // Confidential Admin Dossier Fields
  const [eduLevel, setEduLevel] = useState(leader.admin_dossier?.education_level ?? "Impamyabumenyi ya Kaminuza (A0)");
  const [fieldOfStudy, setFieldOfStudy] = useState(leader.admin_dossier?.field_of_study ?? "Imiyoborere (Public Administration)");
  const [institution, setInstitution] = useState(leader.admin_dossier?.institution ?? "Kaminuza y'u Rwanda");
  const [appointRef, setAppointRef] = useState(leader.admin_dossier?.appointment_letter_ref ?? "MINALOC/2023/APP/104");
  const [startDate, setStartDate] = useState(leader.admin_dossier?.start_date ?? "2023-01-15");
  const [certifications, setCertifications] = useState(leader.admin_dossier?.special_certifications?.join(", ") ?? "Amahugurwa y'Imiyoborere, Gukemura Amakimbirane");
  const [dossierNotes, setDossierNotes] = useState(leader.admin_dossier?.notes ?? "");

  const [version, setVersion] = useState(leader.version);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictDiff | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConflict(null);
    setSaving(true);

    let normalisedPhone = phone.trim().replace(/\s/g, "");
    if (normalisedPhone.startsWith("07") && normalisedPhone.length === 10) {
      normalisedPhone = "+250" + normalisedPhone.slice(1);
    } else if (normalisedPhone.startsWith("250") && normalisedPhone.length === 12) {
      normalisedPhone = "+" + normalisedPhone;
    }

    const certList = certifications
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const updatedDossier: AdminDossier = {
      education_level: eduLevel.trim(),
      field_of_study: fieldOfStudy.trim(),
      institution: institution.trim(),
      appointment_letter_ref: appointRef.trim(),
      start_date: startDate.trim(),
      special_certifications: certList,
      work_history: leader.admin_dossier?.work_history || [
        { title: "Umukozi mu Nzego z'Ibanze", organization: "Akarere", period: "2019 - 2023" },
      ],
      notes: dossierNotes.trim() || undefined,
    };

    const payload: Record<string, unknown> = {
      id: leader.id,
      version,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role,
      phone_number: normalisedPhone || undefined,
      whatsapp_number: whatsapp.trim() || normalisedPhone || undefined,
      email: email.trim() || null,
      photo_url: photoUrl.trim() || null,
      vision_priorities: vision.trim() || null,
      office_hours: officeHours.trim() || null,
      social_media: {
        twitter_x: twitterX.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
      },
      admin_dossier: updatedDossier,
    };

    try {
      const res = await fetch("/api/leaders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.status === 409) {
        setConflict(json.conflict as ConflictDiff);
        setSaving(false);
        return;
      }

      if (!res.ok) {
        setError(
          json.message_kiny ||
            json.message_eng ||
            "Ikibazo cyabaye. Ongera ugerageze."
        );
        setSaving(false);
        return;
      }

      onSuccess(json.leader as LeaderPublic);
    } catch {
      setError("Ikibazo cy’urukurikirane. Ongera ugerageze.");
      setSaving(false);
    }
  }

  function resolveWithServer() {
    if (!conflict) return;
    setVersion(conflict.server_version);
    const s = conflict.server_data;
    if (typeof s.first_name === "string") setFirstName(s.first_name);
    if (typeof s.last_name === "string") setLastName(s.last_name);
    if (typeof s.role === "string") setRole(s.role as LeaderRole);
    if (typeof s.email === "string" || s.email === null) setEmail((s.email as string) ?? "");
    if (typeof s.photo_url === "string" || s.photo_url === null) setPhotoUrl((s.photo_url as string) ?? "");
    setConflict(null);
    setError("Version yavuguruwe na server. Reba amakuru hanyuma wongere wohereze.");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-leader-title"
    >
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-sky-200 bg-card shadow-2xl dark:border-sky-800">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div>
            <h2 id="edit-leader-title" className="text-base font-extrabold text-foreground">
              Vugurura Umwirondoro w&apos;Umuyobozi
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {leader.boundary_name_kiny} · {leader.role}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Funga"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conflict banner */}
        {conflict && (
          <div role="alert" className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-4 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold text-foreground">Impinduka zihuye (409 Conflict)</p>
                <p className="text-muted-foreground mt-0.5">
                  Undi muyobozi aherutse guhindura iyi record.
                </p>
                <button
                  type="button"
                  onClick={resolveWithServer}
                  className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white hover:bg-blue-700"
                >
                  Koresha amakuru aheruka kuri server
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex border-b border-border px-6 pt-2 bg-muted/20">
          <button
            type="button"
            onClick={() => setActiveTab("public")}
            className={`flex items-center gap-1.5 border-b-2 py-3 px-3 text-xs font-bold transition-all ${
              activeTab === "public"
                ? "border-[#00A3E0] text-[#00A3E0]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Amakuru y&apos;Abaturage (Public)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dossier")}
            className={`flex items-center gap-1.5 border-b-2 py-3 px-3 text-xs font-bold transition-all ${
              activeTab === "dossier"
                ? "border-[#00A3E0] text-[#00A3E0]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            <span>Dossier y&apos;Akazi (Admin Only)</span>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {activeTab === "public" ? (
            /* TAB 1: PUBLIC PROFILE */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="first_name" className="block font-semibold text-foreground mb-1">
                    Izina (First Name) *
                  </label>
                  <input
                    id="first_name"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block font-semibold text-foreground mb-1">
                    Izina ry&apos;umuryango (Last Name) *
                  </label>
                  <input
                    id="last_name"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
              </div>

              {/* Role with Strict Downward Authority Lock */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="role" className="font-semibold text-foreground">
                    Inshingano / Umwanya *
                  </label>
                  {!canEditRole && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded font-bold">
                      Bigenzurwa n&apos;inzego zo hejuru gusa
                    </span>
                  )}
                </div>
                <select
                  id="role"
                  value={role}
                  disabled={!canEditRole}
                  onChange={(e) => setRole(e.target.value as LeaderRole)}
                  className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 font-semibold disabled:opacity-60 disabled:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {!canEditRole && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Nta muyobozi wihindura inshingano cyangwa ngo yizamure. Inshingano zihindurwa gusa n&apos;urwego rw&apos;Akarere cyangwa Minisiteri.
                  </p>
                )}
              </div>

              {/* Phone & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="phone" className="block font-semibold text-foreground mb-1">
                    Nimero ya Telefone *
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    placeholder="+250788XXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
                <div>
                  <label htmlFor="whatsapp" className="block font-semibold text-foreground mb-1">
                    WhatsApp (Iyo itandukanye)
                  </label>
                  <input
                    id="whatsapp"
                    type="tel"
                    placeholder="+250788XXXXXX"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
              </div>

              {/* Photo & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="photo_url" className="block font-semibold text-foreground mb-1">
                    Ifoto y&apos;Umuyobozi (URL) *
                  </label>
                  <input
                    id="photo_url"
                    type="url"
                    placeholder="https://..."
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block font-semibold text-foreground mb-1">
                    Email y&apos;Akazi
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="izina@gov.rw"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
              </div>

              {/* Vision & Priorities */}
              <div>
                <label htmlFor="vision" className="block font-semibold text-foreground mb-1">
                  Intego z&apos;Umuyobozi & Icyerekezo cye (Vision & Priorities):
                </label>
                <textarea
                  id="vision"
                  rows={2}
                  value={vision}
                  onChange={(e) => setVision(e.target.value)}
                  placeholder="urugero: Guteza imbere umutekano, isuku y'umudugudu, kwishyura Mutuelle ku 100%..."
                  className="w-full rounded-xl border border-input bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                />
              </div>

              {/* Office hours & Social */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="hours" className="block font-semibold text-foreground mb-1">
                    Amasaha y&apos;Akazi:
                  </label>
                  <input
                    id="hours"
                    value={officeHours}
                    onChange={(e) => setOfficeHours(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
                <div>
                  <label htmlFor="twitter" className="block font-semibold text-foreground mb-1">
                    Konti ya X (Twitter):
                  </label>
                  <input
                    id="twitter"
                    placeholder="https://x.com/..."
                    value={twitterX}
                    onChange={(e) => setTwitterX(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: CONFIDENTIAL ADMIN DOSSIER */
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Aya makuru ni ay&apos;ubuyobozi gusa (HR Record); abaturage ntibayabona ku rubuga.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edu_lvl" className="block font-semibold text-foreground mb-1">
                    Urwego rw&apos;Amashuri (Education Level):
                  </label>
                  <input
                    id="edu_lvl"
                    value={eduLevel}
                    onChange={(e) => setEduLevel(e.target.value)}
                    placeholder="urugero: Kaminuza (A0 / Master's)"
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
                <div>
                  <label htmlFor="field" className="block font-semibold text-foreground mb-1">
                    Ibyo Yize (Field of Study):
                  </label>
                  <input
                    id="field"
                    value={fieldOfStudy}
                    onChange={(e) => setFieldOfStudy(e.target.value)}
                    placeholder="urugero: Public Administration, Law, etc."
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="inst" className="block font-semibold text-foreground mb-1">
                  Ishuri / Kaminuza (Institution):
                </label>
                <input
                  id="inst"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="urugero: Kaminuza y'u Rwanda (UR)"
                  className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="appoint" className="block font-semibold text-foreground mb-1">
                    Ref y&apos;Ibaruwa yo Gushyiraho mu Kazi:
                  </label>
                  <input
                    id="appoint"
                    value={appointRef}
                    onChange={(e) => setAppointRef(e.target.value)}
                    placeholder="urugero: MINALOC/GAS/2023/118"
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
                <div>
                  <label htmlFor="start_date" className="block font-semibold text-foreground mb-1">
                    Itariki Yatangiriyeho Inshingano:
                  </label>
                  <input
                    id="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="certs" className="block font-semibold text-foreground mb-1">
                  Amahugurwa n&apos;Impamyabushobozi (Bitandukanye n&apos;akanyotso):
                </label>
                <input
                  id="certs"
                  value={certifications}
                  onChange={(e) => setCertifications(e.target.value)}
                  placeholder="Amahugurwa y'Imiyoborere (RGB), Gukemura Amakimbirane..."
                  className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block font-semibold text-foreground mb-1">
                  Icyitonderwa cy&apos;Ubuyobozi bw&apos;Akarere (Internal HR Notes):
                </label>
                <textarea
                  id="notes"
                  rows={2}
                  value={dossierNotes}
                  onChange={(e) => setDossierNotes(e.target.value)}
                  placeholder="Ibyo ubuyobozi bwifuza kuzirikana kuri uyu muyobozi..."
                  className="w-full rounded-xl border border-input bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border px-5 font-semibold text-muted-foreground hover:bg-muted"
            >
              Reka
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#00A3E0] px-6 font-bold text-white shadow-md hover:bg-[#0090c6] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Bika Impinduka</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
