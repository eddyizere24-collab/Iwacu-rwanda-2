"use client";

import { FormEvent, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

interface Props { isOpen: boolean; onClose: () => void; onSuccess: (message?: string) => void; }
const roles = ["Village Leader", "Cell Executive Secretary", "Sector Executive Secretary", "Mayor", "Vice Mayor", "District Executive Secretary", "Other"];

export function AddLeaderModal({ isOpen, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({ first_name: "", last_name: "", role: "Village Leader", scope_code: "RW-01-01-01", phone_number: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!isOpen) return null;
  function change(key: keyof typeof form, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const res = await fetch("/api/leaders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leaders: [{ ...form, email: form.email || null, phone_number: form.phone_number || null }] }) });
      const json = await res.json();
      if (!res.ok || json.status !== "success") throw new Error(json.message_kiny || "Ntibyashobotse kubika umuyobozi.");
      setForm({ first_name: "", last_name: "", role: "Village Leader", scope_code: "RW-01-01-01", phone_number: "", email: "" });
      onSuccess("Umuyobozi mushya yongeweho neza.");
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Habaye ikibazo. Ongera ugerageze."); }
    finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="add-leader-heading" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between"><h2 id="add-leader-heading" className="flex items-center gap-2 text-xl font-bold"><Plus className="h-5 w-5 text-sky-600" /> Ongeramo umuyobozi</h2><button type="button" onClick={onClose} disabled={busy} className="rounded-lg p-2 hover:bg-muted" aria-label="Funga"><X className="h-5 w-5" /></button></div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Amazina ya mbere<input required minLength={2} value={form.first_name} onChange={(e) => change("first_name", e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3" /></label><label className="text-sm font-medium">Izina ry'umuryango<input required minLength={2} value={form.last_name} onChange={(e) => change("last_name", e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3" /></label></div>
          <label className="block text-sm font-medium">Umwanya<select value={form.role} onChange={(e) => change("role", e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3">{roles.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label className="block text-sm font-medium">Kode y'aho akorera<input required pattern="RW(-[0-9A-Z]{2,})*" value={form.scope_code} onChange={(e) => change("scope_code", e.target.value.toUpperCase())} className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 font-mono" /><span className="text-xs text-muted-foreground">Urugero: RW-01 cyangwa RW-01-01-01-001. Kode igomba kuba iri mu mipaka yemejwe.</span></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Telefone<input inputMode="tel" placeholder="+25078XXXXXXX" value={form.phone_number} onChange={(e) => change("phone_number", e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3" /></label><label className="text-sm font-medium">Imeyili<input type="email" value={form.email} onChange={(e) => change("email", e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3" /></label></div>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-lg border border-border px-4 text-sm">Kureka</button><button disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Bika umuyobozi</button></div>
        </form>
      </section>
    </div>
  );
}
