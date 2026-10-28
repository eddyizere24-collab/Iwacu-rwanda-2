"use client";

import { useState, FormEvent } from "react";
import { X, Loader2, AlertTriangle, Check } from "lucide-react";
import type { LeaderPublic, LeaderRole } from "@/types/leader";

interface LeaderEditFormProps {
  leader: LeaderPublic & { phone_raw_masked?: string | null };
  onClose: () => void;
  onSuccess: (updated: LeaderPublic) => void;
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
}: LeaderEditFormProps) {
  const [firstName, setFirstName] = useState(leader.first_name);
  const [lastName, setLastName] = useState(leader.last_name);
  const [role, setRole] = useState<LeaderRole>(leader.role);
  const [phone, setPhone] = useState(""); // admin types full number when changing
  const [email, setEmail] = useState(leader.email ?? "");
  const [photoUrl, setPhotoUrl] = useState(leader.photo_url ?? "");
  const [version, setVersion] = useState(leader.version);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictDiff | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConflict(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      id: leader.id,
      version,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role,
      email: email.trim() || null,
      photo_url: photoUrl.trim() || null,
    };

    // Only send phone if admin typed a new one
    if (phone.trim()) {
      let normalised = phone.trim().replace(/\s/g, "");
      if (normalised.startsWith("07") && normalised.length === 10) {
        normalised = "+250" + normalised.slice(1);
      } else if (normalised.startsWith("250") && normalised.length === 12) {
        normalised = "+" + normalised;
      }
      payload.phone_number = normalised;
    }

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

  /** Accept server version and re-apply our changes on top */
  function resolveWithServer() {
    if (!conflict) return;
    setVersion(conflict.server_version);
    // Optionally pre-fill server values
    const s = conflict.server_data;
    if (typeof s.first_name === "string") setFirstName(s.first_name);
    if (typeof s.last_name === "string") setLastName(s.last_name);
    if (typeof s.role === "string") setRole(s.role as LeaderRole);
    if (typeof s.email === "string" || s.email === null)
      setEmail((s.email as string) ?? "");
    if (typeof s.photo_url === "string" || s.photo_url === null)
      setPhotoUrl((s.photo_url as string) ?? "");
    setConflict(null);
    setError(
      "Version yavuguruwe. Reba amakuru hanyuma wongere wohereze."
    );
  }

  /** Force our values (will still send current version+1 after bump) */
  function resolveWithMine() {
    if (!conflict) return;
    setVersion(conflict.server_version);
    setConflict(null);
    setError(
      "Version yavuguruwe. Ongera wohereze kugira ngo amahanga yawe yemewe."
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-leader-title"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2
            id="edit-leader-title"
            className="text-lg font-semibold text-foreground"
          >
            Hindura umuyobozi
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Funga"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conflict banner */}
        {conflict && (
          <div
            role="alert"
            className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-foreground">
                  Impinduka zihuye (409 Conflict)
                </p>
                <p className="mt-1 text-muted-foreground">
                  Ubundi mukoresha ahinduye iyi record (server v
                  {conflict.server_version} vs yawe v{conflict.your_version}).
                </p>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="mb-1 font-semibold text-foreground">
                      Server (ubu)
                    </p>
                    <pre className="whitespace-pre-wrap text-muted-foreground">
                      {JSON.stringify(conflict.server_data, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="mb-1 font-semibold text-foreground">
                      Amahanga yawe
                    </p>
                    <pre className="whitespace-pre-wrap text-muted-foreground">
                      {JSON.stringify(conflict.your_data, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resolveWithServer}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80"
                  >
                    Koresha amakuru ya server
                  </button>
                  <button
                    type="button"
                    onClick={resolveWithMine}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Komeza n’amahanga yanjye
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="first_name"
                className="mb-1 block text-sm font-medium"
              >
                Izina
              </label>
              <input
                id="first_name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>
            <div>
              <label
                htmlFor="last_name"
                className="mb-1 block text-sm font-medium"
              >
                Izina ry’umuryango
              </label>
              <input
                id="last_name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium">
              Inshingano
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as LeaderRole)}
              className="w-full min-h-[44px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium">
              Telefone nshya{" "}
              <span className="font-normal text-muted-foreground">
                (siga ubusa niba udahindura · ubu:{" "}
                {leader.phone_masked ?? "nta"})
              </span>
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="+2507XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="photo_url"
              className="mb-1 block text-sm font-medium"
            >
              URL ya foto
            </label>
            <input
              id="photo_url"
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full min-h-[44px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Version y’ubu: <strong>v{version}</strong> · Scope:{" "}
            {leader.scope_code}
          </p>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Hagarika
            </button>
            <button
              type="submit"
              disabled={saving || !!conflict}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Turimo kubika...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Bika impinduka
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
