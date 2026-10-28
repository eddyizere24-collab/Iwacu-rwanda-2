"use client";

import { useState } from "react";
import { X, UserPlus, Loader2, CheckCircle2, User, GraduationCap, ShieldAlert } from "lucide-react";
import type { LeaderRole, AdminDossier } from "@/types/leader";
import {
  RWANDA_DISTRICTS,
  getSectorsByDistrict,
  getCellsBySector,
  getVillagesByCell,
} from "@/lib/rwanda-geo";

interface AddLeaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeaderAdded: () => void;
  adminTier?: "national" | "province" | "district" | "sector" | "cell";
  initialScope?: {
    province?: string;
    district?: string;
    sector?: string;
    cell?: string;
    village?: string;
  };
}

const ALL_ROLES: { value: LeaderRole; labelKiny: string; allowedTiers: string[] }[] = [
  { value: "Village Leader", labelKiny: "Umukuru w'Umudugudu", allowedTiers: ["cell", "sector", "district", "province", "national"] },
  { value: "Cell Executive Secretary", labelKiny: "Umunyamabanga Nshingwabikorwa w'Akagari", allowedTiers: ["sector", "district", "province", "national"] },
  { value: "Sector Executive Secretary", labelKiny: "Umunyamabanga Nshingwabikorwa w'Umurenge", allowedTiers: ["district", "province", "national"] },
  { value: "Mayor", labelKiny: "Umuyobozi w'Akarere (Meya)", allowedTiers: ["province", "national"] },
  { value: "Vice Mayor", labelKiny: "Umuyobozi w'Akarere wungirije", allowedTiers: ["province", "national"] },
  { value: "District Executive Secretary", labelKiny: "Umunyamabanga Nshingwabikorwa w'Akarere", allowedTiers: ["province", "national"] },
  { value: "Other", labelKiny: "Uwundi muyobozi w'Inzego z'Ibanze", allowedTiers: ["district", "province", "national"] },
];

export function AddLeaderModal({
  isOpen,
  onClose,
  onLeaderAdded,
  adminTier = "national",
  initialScope,
}: AddLeaderModalProps) {
  const [activeTab, setActiveTab] = useState<"public" | "dossier">("public");

  const filteredRoles = ALL_ROLES.filter((r) => r.allowedTiers.includes(adminTier));
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<LeaderRole>(filteredRoles[0]?.value || "Village Leader");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [photoUrl, setPhotoUrl] = useState("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80");
  const [vision, setVision] = useState("Guteza imbere umutekano, isuku, no kwishyura Mutuelle de Santé 100%.");
  const [officeHours, setOfficeHours] = useState("Kuwa Mbere – Kuwa Gatanu: 08:00 – 17:00");
  const [twitterX, setTwitterX] = useState("");

  // Administrative Scope
  const [districtCode, setDistrictCode] = useState(initialScope?.district || "RW-01-01");
  const availableSectors = getSectorsByDistrict(districtCode);

  const [sectorCode, setSectorCode] = useState(availableSectors[0]?.code || "RW-01-01-01");
  const availableCells = getCellsBySector(sectorCode);

  const [cellCode, setCellCode] = useState(availableCells[0]?.code || "RW-01-01-01-01");
  const availableVillages = getVillagesByCell(cellCode);

  const [villageName, setVillageName] = useState(availableVillages[0]?.name_kiny || "Umudugudu w'Ubumwe");

  // Confidential Admin Dossier
  const [eduLevel, setEduLevel] = useState("Impamyabumenyi ya Kaminuza (A0)");
  const [fieldOfStudy, setFieldOfStudy] = useState("Imiyoborere (Public Administration)");
  const [institution, setInstitution] = useState("Kaminuza y'u Rwanda");
  const [appointRef, setAppointRef] = useState("MINALOC/GAS/2024/098");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [certifications, setCertifications] = useState("Amahugurwa y'Imiyoborere, Gukemura Amakimbirane");

  const [isVerified, setIsVerified] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError("Shyiramo amazina yombi na nimero ya telefone.");
      setLoading(false);
      return;
    }

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

    const dossier: AdminDossier = {
      education_level: eduLevel.trim(),
      field_of_study: fieldOfStudy.trim(),
      institution: institution.trim(),
      appointment_letter_ref: appointRef.trim(),
      start_date: startDate.trim(),
      special_certifications: certList,
      work_history: [
        {
          title: "Inshingano z'Inzego z'Ibanze",
          organization: "Akarere",
          period: "2020 - 2024",
        },
      ],
    };

    const targetScope =
      role === "Village Leader"
        ? `${cellCode}-01`
        : role === "Cell Executive Secretary"
        ? cellCode
        : role === "Sector Executive Secretary"
        ? sectorCode
        : districtCode;

    const sectorObj = availableSectors.find((s) => s.code === sectorCode);
    const cellObj = availableCells.find((c) => c.code === cellCode);

    const boundaryLabel =
      role === "Village Leader"
        ? `${villageName} (${cellObj?.name_kiny || "Akagari"})`
        : role === "Cell Executive Secretary"
        ? cellObj?.name_kiny || "Akagari"
        : role === "Sector Executive Secretary"
        ? sectorObj?.name_kiny || "Umurenge"
        : "Akarere";

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role,
      phone_number: normalisedPhone,
      whatsapp_number: whatsapp.trim() || normalisedPhone,
      email: email.trim() || null,
      photo_url: photoUrl.trim() || null,
      scope_code: targetScope,
      boundary_name_kiny: boundaryLabel,
      boundary_name_eng: boundaryLabel,
      level:
        role === "Village Leader"
          ? "village"
          : role === "Cell Executive Secretary"
          ? "cell"
          : role === "Sector Executive Secretary"
          ? "sector"
          : "district",
      is_verified: isVerified,
      verified_by: "Urwego rw'Akarere",
      vision_priorities: vision.trim() || null,
      office_hours: officeHours.trim() || null,
      social_media: {
        twitter_x: twitterX.trim() || undefined,
      },
      admin_dossier: dossier,
    };

    try {
      const res = await fetch("/api/leaders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onLeaderAdded();
          onClose();
        }, 1200);
      } else {
        setError(json.message_kiny || "Ntibyashobotse kubika umuyobozi.");
      }
    } catch {
      setError("Ikibazo cy'urukurikirane mu kubika.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-modal-title"
    >
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-sky-200 bg-card shadow-2xl dark:border-sky-800">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00A3E0]/15 text-[#00A3E0]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 id="add-modal-title" className="text-base font-extrabold text-foreground">
                Ongeraho Umuyobozi Mushya
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Inzira y&apos;ubuyobozi bw&apos;Akarere n&apos;Imirenge
              </p>
            </div>
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

        {success ? (
          <div className="p-10 text-center animate-in zoom-in-95">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Umuyobozi Yashyizwemo Neza!</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Amakuru yemejwe kandi yashyizwe mu nzego z&apos;akarere.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            {activeTab === "public" ? (
              <div className="space-y-4">
                {/* Names */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="add_fn" className="block font-semibold text-foreground mb-1">
                      Izina (First Name) *
                    </label>
                    <input
                      id="add_fn"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jean"
                      className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                    />
                  </div>
                  <div>
                    <label htmlFor="add_ln" className="block font-semibold text-foreground mb-1">
                      Izina ry&apos;umuryango (Last Name) *
                    </label>
                    <input
                      id="add_ln"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Uwimana"
                      className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                    />
                  </div>
                </div>

                {/* Role Filtered by Downward Authority */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="add_role" className="font-semibold text-foreground">
                      Inshingano (Role) *
                    </label>
                    <span className="text-[10px] text-[#00A3E0] font-bold">
                      Imyanya yemerewe urwego rwa {adminTier}
                    </span>
                  </div>
                  <select
                    id="add_role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as LeaderRole)}
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  >
                    {filteredRoles.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.labelKiny} ({r.value})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cascading Jurisdiction Selection */}
                <div className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-3">
                  <p className="font-bold text-foreground">Agace Umuyobozi Aherereyemo:</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="add_dist" className="block font-semibold text-muted-foreground mb-1">
                        Akarere:
                      </label>
                      <select
                        id="add_dist"
                        value={districtCode}
                        onChange={(e) => {
                          setDistrictCode(e.target.value);
                          const secs = getSectorsByDistrict(e.target.value);
                          if (secs.length > 0) {
                            setSectorCode(secs[0].code);
                            const cls = getCellsBySector(secs[0].code);
                            if (cls.length > 0) setCellCode(cls[0].code);
                          }
                        }}
                        className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                      >
                        {RWANDA_DISTRICTS.map((d) => (
                          <option key={d.code} value={d.code}>
                            Akarere ka {d.name_kiny}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="add_sec" className="block font-semibold text-muted-foreground mb-1">
                        Umurenge:
                      </label>
                      <select
                        id="add_sec"
                        value={sectorCode}
                        onChange={(e) => {
                          setSectorCode(e.target.value);
                          const cls = getCellsBySector(e.target.value);
                          if (cls.length > 0) setCellCode(cls[0].code);
                        }}
                        className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                      >
                        {availableSectors.map((s) => (
                          <option key={s.code} value={s.code}>
                            Umurenge wa {s.name_kiny}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(role === "Village Leader" || role === "Cell Executive Secretary") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="add_cell" className="block font-semibold text-muted-foreground mb-1">
                          Akagari:
                        </label>
                        <select
                          id="add_cell"
                          value={cellCode}
                          onChange={(e) => setCellCode(e.target.value)}
                          className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                        >
                          {availableCells.map((c) => (
                            <option key={c.code} value={c.code}>
                              Akagari ka {c.name_kiny}
                            </option>
                          ))}
                        </select>
                      </div>

                      {role === "Village Leader" && (
                        <div>
                          <label htmlFor="add_vil" className="block font-semibold text-muted-foreground mb-1">
                            Izina ry&apos;Umudugudu:
                          </label>
                          <input
                            id="add_vil"
                            value={villageName}
                            onChange={(e) => setVillageName(e.target.value)}
                            placeholder="Umudugudu w'Ubumwe"
                            className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Contact Phone & WhatsApp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="add_tel" className="block font-semibold text-foreground mb-1">
                      Nimero ya Telefone *
                    </label>
                    <input
                      id="add_tel"
                      type="tel"
                      required
                      placeholder="+250788XXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                    />
                  </div>
                  <div>
                    <label htmlFor="add_wa" className="block font-semibold text-foreground mb-1">
                      WhatsApp (Iyo itandukanye)
                    </label>
                    <input
                      id="add_wa"
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
                    <label htmlFor="add_photo" className="block font-semibold text-foreground mb-1">
                      Ifoto y&apos;Umuyobozi (URL) *
                    </label>
                    <input
                      id="add_photo"
                      type="url"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                    />
                  </div>
                  <div>
                    <label htmlFor="add_email" className="block font-semibold text-foreground mb-1">
                      Email y&apos;Akazi
                    </label>
                    <input
                      id="add_email"
                      type="email"
                      placeholder="izina@gasabo.gov.rw"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                    />
                  </div>
                </div>

                {/* Vision / Priorities */}
                <div>
                  <label htmlFor="add_vision" className="block font-semibold text-foreground mb-1">
                    Intego z&apos;Umuyobozi ku baturage (Vision & Key Priorities):
                  </label>
                  <textarea
                    id="add_vision"
                    rows={2}
                    value={vision}
                    onChange={(e) => setVision(e.target.value)}
                    placeholder="urugero: Gushyira imbaraga mu mutekano, isuku, no kugeza Mutuelle de Santé ku 100%..."
                    className="w-full rounded-xl border border-input bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
              </div>
            ) : (
              /* TAB 2: CONFIDENTIAL ADMIN DOSSIER */
              <div className="space-y-4">
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>Aya makuru ni ay&apos;ubuyobozi bw&apos;Akarere gusa (HR Dossier) ntabwo agaragara ku baturage.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="add_edu" className="block font-semibold text-foreground mb-1">
                      Urwego rw&apos;Amashuri (Education Level):
                    </label>
                    <input
                      id="add_edu"
                      value={eduLevel}
                      onChange={(e) => setEduLevel(e.target.value)}
                      placeholder="urugero: Kaminuza (A0 / Master's)"
                      className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                    />
                  </div>
                  <div>
                    <label htmlFor="add_field" className="block font-semibold text-foreground mb-1">
                      Ibyo Yize (Field of Study):
                    </label>
                    <input
                      id="add_field"
                      value={fieldOfStudy}
                      onChange={(e) => setFieldOfStudy(e.target.value)}
                      placeholder="Public Administration, Economics, Law..."
                      className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="add_inst" className="block font-semibold text-foreground mb-1">
                    Ishuri / Kaminuza (Institution):
                  </label>
                  <input
                    id="add_inst"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Kaminuza y'u Rwanda"
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="add_ref" className="block font-semibold text-foreground mb-1">
                      Nimero y&apos;Ibaruwa yo Gushyiraho mu Kazi (Ref):
                    </label>
                    <input
                      id="add_ref"
                      value={appointRef}
                      onChange={(e) => setAppointRef(e.target.value)}
                      placeholder="MINALOC/GAS/2024/098"
                      className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                    />
                  </div>
                  <div>
                    <label htmlFor="add_sdate" className="block font-semibold text-foreground mb-1">
                      Itariki Yatangiriyeho Akazi:
                    </label>
                    <input
                      id="add_sdate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="add_certs" className="block font-semibold text-foreground mb-1">
                    Amahugurwa n&apos;Impamyabushobozi (Certifications):
                  </label>
                  <input
                    id="add_certs"
                    value={certifications}
                    onChange={(e) => setCertifications(e.target.value)}
                    placeholder="Amahugurwa y'Imiyoborere (RGB), Gukemura Amakimbirane..."
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
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
                disabled={loading}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#00A3E0] px-6 font-bold text-white shadow-md hover:bg-[#0090c6] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Emeza Umuyobozi</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
