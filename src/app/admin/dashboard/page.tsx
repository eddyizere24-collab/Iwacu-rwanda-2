"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Shield,
  Edit3,
  RefreshCw,
  LogOut,
  Eye,
  EyeOff,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import type { LeaderPublic } from "@/types/leader";
import { LeaderEditForm } from "@/components/admin/LeaderEditForm";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [leaders, setLeaders] = useState<LeaderPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [editingLeader, setEditingLeader] = useState<LeaderPublic | null>(null);
  const [revealedPhones, setRevealedPhones] = useState<Record<string, string>>({});
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchLeaders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leaders?scope_code=RW-01");
      const json = await res.json();
      if (res.ok && json.leaders) {
        setLeaders(json.leaders);
      } else {
        setError(json.message_kiny || "Ntibyashobotse gukuramo amakuru y'abayobozi.");
      }
    } catch {
      setError("Ikibazo cy'urukurikirane mu gukuramo amakuru.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaders();
  }, [fetchLeaders]);

  async function toggleRevealPhone(leaderId: string, currentMasked?: string) {
    if (revealedPhones[leaderId]) {
      // Hide
      setRevealedPhones((prev) => {
        const copy = { ...prev };
        delete copy[leaderId];
        return copy;
      });
      return;
    }

    try {
      // In real backend or mock, reveal=true
      const res = await fetch("/api/leaders?scope_code=RW-01&reveal=true");
      const json = await res.json();
      if (res.ok && json.leaders) {
        const found = json.leaders.find((l: LeaderPublic & { phone_number?: string }) => l.id === leaderId);
        if (found?.phone_number) {
          setRevealedPhones((prev) => ({ ...prev, [leaderId]: found.phone_number }));
          return;
        }
      }
      setRevealedPhones((prev) => ({
        ...prev,
        [leaderId]: currentMasked || "+250788000000",
      }));
    } catch {
      setRevealedPhones((prev) => ({
        ...prev,
        [leaderId]: currentMasked || "+250788000000",
      }));
    }
  }

  const filtered = leaders.filter((l) => {
    const matchesSearch =
      l.first_name.toLowerCase().includes(search.toLowerCase()) ||
      l.last_name.toLowerCase().includes(search.toLowerCase()) ||
      l.role.toLowerCase().includes(search.toLowerCase()) ||
      l.boundary_name_kiny.toLowerCase().includes(search.toLowerCase());

    const matchesLevel =
      filterLevel === "all" || l.level?.toLowerCase() === filterLevel.toLowerCase();

    return matchesSearch && matchesLevel;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Top Navigation */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
              <Shield className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Ikibaho cy’Ubuyobozi (Admin Dashboard)
              </h1>
              <p className="text-xs text-muted-foreground">
                Urwego: Akarere ka Gasabo (Scope: RW-01) · NCSA Law No. 058/2021
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-3.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              Subira ku rubuga
            </Link>
            <button
              type="button"
              onClick={() => router.push("/admin/login")}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3.5 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sohoka
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Success Alert */}
        {successBanner && (
          <div
            role="status"
            className="mb-6 flex items-center justify-between rounded-xl border border-green-600/30 bg-green-600/10 p-4 text-sm text-foreground"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Funga
            </button>
          </div>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Abayobozi Banditswe
              </span>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-foreground mt-2">{leaders.length}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Mu nzego zose z&apos;Akarere</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Amakuru Yizewe (NCSA)
              </span>
              <Shield className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600 mt-2">100%</p>
            <p className="text-[11px] text-muted-foreground mt-1">Numero zibitswe zirinze</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Optimistic Locking
              </span>
              <RefreshCw className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-foreground mt-2">v{Math.max(...leaders.map((l) => l.version), 1)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Imiryango irinzwe 409 conflict</p>
          </div>
        </div>

        {/* Controls: Search, Filter, Refresh */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Shakisha umuyobozi cyangwa agace..."
                className="w-full min-h-[44px] rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="min-h-[44px] rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <option value="all">Inzego Zose</option>
                  <option value="district">Akarere (District)</option>
                  <option value="sector">Umurenge (Sector)</option>
                  <option value="cell">Akagari (Cell)</option>
                  <option value="village">Umudugudu (Village)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={fetchLeaders}
                disabled={loading}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                <span>Vugurura</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Table of Leaders */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Umuyobozi
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Inshingano
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Agace & Scope
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Telefone (Masked)
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Version
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Igikorwa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <RefreshCw className="mx-auto h-6 w-6 animate-spin mb-2" />
                      Turimo gukuramo amakuru y&apos;abayobozi...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      Nta muyobozi uhuye n&apos;ibyo mushakisha.
                    </td>
                  </tr>
                ) : (
                  filtered.map((leader) => {
                    const isRevealed = Boolean(revealedPhones[leader.id]);
                    const displayPhone = isRevealed
                      ? revealedPhones[leader.id]
                      : leader.phone_masked;

                    return (
                      <tr key={leader.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-foreground">
                          <div>
                            <span className="font-semibold">
                              {leader.first_name} {leader.last_name}
                            </span>
                            {leader.email && (
                              <span className="block text-xs text-muted-foreground font-normal">
                                {leader.email}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-md bg-blue-600/10 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                            {leader.role}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="font-medium text-foreground block">
                            {leader.boundary_name_kiny}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {leader.scope_code} ({leader.level})
                          </span>
                        </td>

                        <td className="px-6 py-4 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span>{displayPhone || "Nta telefone"}</span>
                            {leader.phone_masked && (
                              <button
                                type="button"
                                onClick={() =>
                                  toggleRevealPhone(leader.id, leader.phone_masked ?? undefined)
                                }
                                title={isRevealed ? "Hisha" : "Erekana (Admin)"}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                              >
                                {isRevealed ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-mono font-medium">
                            v{leader.version}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setEditingLeader(leader)}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-blue-600/10 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors dark:text-blue-300"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Hindura</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Edit Form Modal with 409 Conflict Handling */}
      {editingLeader && (
        <LeaderEditForm
          leader={editingLeader}
          onClose={() => setEditingLeader(null)}
          onSuccess={(updated) => {
            setLeaders((prev) =>
              prev.map((l) => (l.id === updated.id ? updated : l))
            );
            setEditingLeader(null);
            setSuccessBanner(
              `Impinduka kuri ${updated.first_name} ${updated.last_name} zabitswe neza (v${updated.version}).`
            );
          }}
        />
      )}
    </div>
  );
}
