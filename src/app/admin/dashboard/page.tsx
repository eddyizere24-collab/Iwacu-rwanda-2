"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Shield,
  Edit3,
  Trash2,
  RefreshCw,
  LogOut,
  Eye,
  EyeOff,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  UserPlus,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Landmark,
  Building,
  MapPin,
  Home,
  ShieldAlert,
  GraduationCap,
  Flag,
  Check,
} from "lucide-react";
import type { LeaderPublic, InactiveNumberReport } from "@/types/leader";
import { LeaderEditForm } from "@/components/admin/LeaderEditForm";
import { AddLeaderModal } from "@/components/AddLeaderModal";
import { BulkImportModal } from "@/components/BulkImportModal";
import { AdminDossierModal } from "@/components/admin/AdminDossierModal";
import { RwandanSun } from "@/components/RwandanSun";
import type { AdministrativeUnit } from "@/lib/rwanda-geo";
import { createSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import type { AdminTier } from "@/app/admin/login/page";

interface StoredAdminSession {
  tier: AdminTier;
  scope_code: string;
  scope_name: string;
  email: string;
  loginTime: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();

  // Current governance session. A missing session defaults to the national
  // overview; actual scope enforcement must be performed by the authenticated API.
  const [session, setSession] = useState<StoredAdminSession>({
    tier: "national",
    scope_code: "RW",
    scope_name: "U Rwanda Rwose",
    email: "admin@national.gov.rw",
    loginTime: new Date().toISOString(),
  });

  const [leaders, setLeaders] = useState<LeaderPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");

  // Inactive number reports
  const [reports, setReports] = useState<InactiveNumberReport[]>([]);
  const [activeTab, setActiveTab] = useState<"leaders" | "reports">("leaders");

  // Nationwide filter lists are fetched from the official NISR boundary service.
  const [provinces, setProvinces] = useState<AdministrativeUnit[]>([]);
  const [availableDistricts, setAvailableDistricts] = useState<AdministrativeUnit[]>([]);
  const [availableSectors, setAvailableSectors] = useState<AdministrativeUnit[]>([]);
  const [filterProvince, setFilterProvince] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterSector, setFilterSector] = useState("all");
  const [unitError, setUnitError] = useState<string | null>(null);

  async function fetchAdminUnits(
    level: "province" | "district" | "sector",
    parentCode?: string
  ): Promise<AdministrativeUnit[]> {
    const params = new URLSearchParams({ level });
    if (parentCode) params.set("parent_code", parentCode);
    const response = await fetch(`/api/administrative-units?${params.toString()}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      status?: string;
      units?: AdministrativeUnit[];
      message_kiny?: string;
    };
    if (!response.ok || payload.status !== "success" || !Array.isArray(payload.units)) {
      throw new Error(payload.message_kiny || "Amakuru y'inzego z'ubuyobozi ntiyabonetse.");
    }
    return payload.units;
  }

  useEffect(() => {
    let active = true;
    fetchAdminUnits("province")
      .then((units) => {
        if (!active) return;
        setProvinces(units);
      })
      .catch((error: unknown) => {
        if (active) setUnitError(error instanceof Error ? error.message : "Ntibyashobotse kubona intara.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setUnitError(null);
    const parent = filterProvince || undefined;
    fetchAdminUnits("district", parent)
      .then((units) => {
        if (!active) return;
        setAvailableDistricts(units);
        setFilterDistrict((current) =>
          current && units.some((unit) => unit.code === current) ? current : ""
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAvailableDistricts([]);
        setFilterDistrict("");
        setUnitError(error instanceof Error ? error.message : "Ntibyashobotse kubona uturere.");
      });
    return () => { active = false; };
  }, [filterProvince]);

  useEffect(() => {
    let active = true;
    if (!filterDistrict) {
      setAvailableSectors([]);
      setFilterSector("all");
      return () => { active = false; };
    }
    fetchAdminUnits("sector", filterDistrict)
      .then((units) => {
        if (!active) return;
        setAvailableSectors(units);
        setFilterSector((current) =>
          current !== "all" && units.some((unit) => unit.code === current)
            ? current
            : "all"
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAvailableSectors([]);
        setFilterSector("all");
        setUnitError(error instanceof Error ? error.message : "Ntibyashobotse kubona imirenge.");
      });
    return () => { active = false; };
  }, [filterDistrict]);

  // Modals
  const [editingLeader, setEditingLeader] = useState<LeaderPublic | null>(null);
  const [dossierLeader, setDossierLeader] = useState<LeaderPublic | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const [revealedPhones, setRevealedPhones] = useState<Record<string, string>>({});
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Verify the real Supabase session and admin profile before showing the dashboard.
  // localStorage is only a display preference; it is never trusted for authorization.
  useEffect(() => {
    let active = true;

    async function verifyAdminSession() {
      if (!isSupabaseBrowserConfigured()) {
        localStorage.removeItem("iwacu_admin_session");
        router.replace("/admin/login");
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          localStorage.removeItem("iwacu_admin_session");
          router.replace("/admin/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("admin_profiles")
          .select("user_id, full_name, scope_code, is_super_admin")
          .eq("user_id", authData.user.id)
          .maybeSingle();

        if (profileError || !profile || typeof profile.scope_code !== "string") {
          localStorage.removeItem("iwacu_admin_session");
          await supabase.auth.signOut();
          router.replace("/admin/login");
          return;
        }

        const profileScope = profile.scope_code;
        const validScope = /^RW(?:-[0-9A-Z]{2,})*$/.test(profileScope);
        const profileDepth = profileScope === "RW" ? 0 : profileScope.split("-").length - 1;
        if (!validScope || profileDepth > 5) {
          localStorage.removeItem("iwacu_admin_session");
          await supabase.auth.signOut();
          router.replace("/admin/login");
          return;
        }

        let preferredScope = profileScope;
        let preferredName = profile.full_name || profileScope;
        try {
          const stored = localStorage.getItem("iwacu_admin_session");
          if (stored) {
            const parsed = JSON.parse(stored) as Partial<StoredAdminSession>;
            const requested = typeof parsed.scope_code === "string" ? parsed.scope_code : "";
            const allowed =
              profile.is_super_admin === true ||
              requested === profileScope ||
              (profileScope !== "RW" && requested.startsWith(profileScope + "-"));
            const requestedDepth = requested === "RW" ? 0 : requested.split("-").length - 1;
            if (/^RW(?:-[0-9A-Z]{2,})*$/.test(requested) && requestedDepth <= 4 && allowed) {
              preferredScope = requested;
              preferredName = typeof parsed.scope_name === "string" ? parsed.scope_name : requested;
            }
          }
        } catch {
          localStorage.removeItem("iwacu_admin_session");
        }

        const depth = preferredScope === "RW" ? 0 : preferredScope.split("-").length - 1;
        const tierByDepth: AdminTier[] = ["national", "province", "district", "sector", "cell"];
        const verifiedSession: StoredAdminSession = {
          tier: tierByDepth[Math.min(depth, 4)],
          scope_code: preferredScope,
          scope_name: preferredName,
          email: authData.user.email || "",
          loginTime: new Date().toISOString(),
        };

        if (!active) return;
        setSession(verifiedSession);
        localStorage.setItem("iwacu_admin_session", JSON.stringify(verifiedSession));
        const parts = preferredScope.split("-");
        if (parts[0] === "RW" && parts.length > 1) {
          setFilterProvince(parts.slice(0, 2).join("-"));
          setFilterDistrict(depth >= 2 ? parts.slice(0, 3).join("-") : "");
          setFilterSector(depth >= 3 ? parts.slice(0, 4).join("-") : "all");
        } else {
          setFilterProvince("");
          setFilterDistrict("");
          setFilterSector("all");
        }
        setAuthReady(true);
      } catch (error) {
        console.error("[admin dashboard] session verification failed:", error);
        localStorage.removeItem("iwacu_admin_session");
        router.replace("/admin/login");
      }
    }

    void verifyAdminSession();
    return () => { active = false; };
  }, [router]);

  const fetchLeaders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const scopeParam = session.tier === "national" ? "RW" : session.scope_code;
      const res = await fetch(`/api/leaders?scope_code=${encodeURIComponent(scopeParam)}&reveal=true`);
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
  }, [session]);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/report-number");
      const json = await res.json();
      if (res.ok && json.reports) {
        setReports(json.reports);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    fetchLeaders();
    fetchReports();
  }, [authReady, fetchLeaders, fetchReports]);

  /**
   * Authority Check: Can the current admin edit or assign this leader's core role?
   * Rule: A leader CANNOT promote themselves or change their own assigned title.
   * Only the authority above them can alter their rank.
   */
  function canAdminEditRole(leader: LeaderPublic): boolean {
    if (session.tier === "national") return true; // Ministry has universal authority
    if (session.tier === "province") {
      return leader.level !== "province" && leader.level !== "national";
    }
    if (session.tier === "district") {
      return (
        leader.level === "sector" ||
        leader.level === "cell" ||
        leader.level === "village"
      );
    }
    if (session.tier === "sector") {
      return leader.level === "cell" || leader.level === "village";
    }
    if (session.tier === "cell") {
      return leader.level === "village";
    }
    return false;
  }

  async function handleDeleteLeader(id: string, name: string) {
    if (!confirm(`Uremeza ko ushaka gukura ${name} ku rutonde rw'abayobozi?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/leaders?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok) {
        setSuccessBanner(`${name} yakuwemo neza.`);
        fetchLeaders();
      } else {
        setError(json.message_kiny || "Gukura umuyobozi byanze.");
      }
    } catch {
      setError("Ikibazo mu gukura umuyobozi.");
    }
  }

  async function handleResolveReport(reportId: string) {
    try {
      const res = await fetch("/api/report-number", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId }),
      });
      if (res.ok) {
        setSuccessBanner("Raporo yakemuwe neza.");
        fetchReports();
      }
    } catch {
      // Ignore
    }
  }

  async function toggleRevealPhone(leaderId: string, currentMasked?: string) {
    if (revealedPhones[leaderId]) {
      setRevealedPhones((prev) => {
        const copy = { ...prev };
        delete copy[leaderId];
        return copy;
      });
      return;
    }

    try {
      const scopeParam = session.tier === "national" ? "RW" : session.scope_code;
      const res = await fetch(`/api/leaders?scope_code=${scopeParam}&reveal=true`);
      const json = await res.json();
      if (res.ok && json.leaders) {
        const found = json.leaders.find((l: any) => l.id === leaderId);
        if (found?.phone_number || found?.phone_raw) {
          setRevealedPhones((prev) => ({
            ...prev,
            [leaderId]: found.phone_number || found.phone_raw,
          }));
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

    const matchesProvince =
      !filterProvince || l.scope_code.startsWith(filterProvince);
    const matchesDistrict =
      !filterDistrict || l.scope_code.startsWith(filterDistrict);
    const matchesSector =
      filterSector === "all" || l.scope_code.startsWith(filterSector);

    return matchesSearch && matchesLevel && matchesProvince && matchesDistrict && matchesSector;
  });

  async function handleLogout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("iwacu_admin_session");
    }
    try {
      if (isSupabaseBrowserConfigured()) {
        await createSupabaseBrowserClient().auth.signOut();
      }
    } finally {
      router.replace("/admin/login");
    }
  }

  // Staffing metrics
  const totalInScope = leaders.length;
  const verifiedCount = leaders.filter((l) => l.is_verified).length;
  const pendingReportsCount = reports.filter((r) => r.status === "pending").length;

  // Do not render the administration interface until the real Auth session and
  // authoritative admin profile have been verified successfully.
  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div role="status" aria-live="polite" className="rounded-2xl border border-border bg-card px-6 py-5 text-center shadow-sm">
          <RwandanSun size={40} glow={false} />
          <p className="mt-3 text-sm font-semibold text-foreground">Turimo kugenzura uburenganzira bwawe…</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Banner with Rwandan National Colors */}
      <header className="border-b border-border bg-card">
        <div className="h-1 bg-gradient-to-r from-[#00A3E0] via-[#FAD201] to-[#20603D]" />
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <RwandanSun size={40} glow={false} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                  IWACU RWANDA · IBUSHINGIRO
                </h1>
                <span className="rounded-full bg-[#00A3E0]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#00A3E0] uppercase tracking-wider">
                  {session.tier}
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-[#20603D]" />
                <span>{session.scope_name}</span>
                <span className="text-muted-foreground/60">· {session.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <span>Reba Urubuga rw&apos;Abaturage</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
              title="Sohoka muri sisitemu"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sohoka</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Success Banner */}
        {successBanner && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
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

        {/* 1. EXECUTIVE SUMMARY & STATS CARDS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-3xl border border-sky-100 bg-card p-4 sm:p-5 shadow-xs dark:border-sky-950">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Abayobozi Bariho
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                {totalInScope}
              </span>
              <span className="text-xs text-[#00A3E0] font-semibold">Muri aka gace</span>
            </div>
          </div>

          <div className="rounded-3xl border border-sky-100 bg-card p-4 sm:p-5 shadow-xs dark:border-sky-950">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Abemejwe (Verified)
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
                {verifiedCount}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">
                ({totalInScope > 0 ? Math.round((verifiedCount / totalInScope) * 100) : 100}%)
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-sky-100 bg-card p-4 sm:p-5 shadow-xs dark:border-sky-950">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Raporo z&apos;Abaturage
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-extrabold ${pendingReportsCount > 0 ? "text-amber-600" : "text-foreground"}`}>
                {pendingReportsCount}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">
                Nimero zitarakemuka
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-sky-100 bg-card p-4 sm:p-5 shadow-xs dark:border-sky-950">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Imbonerahamwe y&apos;Inzego
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-base sm:text-lg font-bold text-foreground truncate">
                100% Byubatse
              </span>
            </div>
          </div>
        </section>

        {/* 2. TAB CONTROLS: LEADERS MANAGEMENT vs. INACTIVE PHONE REPORTS */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("leaders")}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold transition-all ${
              activeTab === "leaders"
                ? "border-[#00A3E0] text-[#00A3E0]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Gucunga Abayobozi ({leaders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold transition-all ${
              activeTab === "reports"
                ? "border-[#00A3E0] text-[#00A3E0]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flag className="h-4 w-4 text-amber-600" />
            <span>Raporo z&apos;Abaturage ku Nimero ({pendingReportsCount})</span>
          </button>
        </div>

        {activeTab === "leaders" ? (
          <>
            {/* 3. CONTROLS & CASCADING FILTER BAR */}
            <div className="rounded-3xl border border-sky-100 bg-card p-4 sm:p-6 shadow-xs dark:border-sky-950 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="search"
                    placeholder="Shaka mu bayobozi (izina, inshingano, umudugudu)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-input bg-background pl-10 pr-4 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#00A3E0] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0090c6] active:scale-95 transition-all"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Ongeraho Umuyobozi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBulkModal(true)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Shyiramo abayobozi benshi mu cyarimwe (Excel/CSV)"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-[#20603D]" />
                    <span className="hidden sm:inline">Bulk Import</span>
                  </button>

                  <button
                    type="button"
                    onClick={fetchLeaders}
                    className="inline-flex min-h-[44px] w-11 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Ongera uvugurure urutonde"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Cascading Filter Bar */}
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground font-semibold flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" /> Akayunguruzo:
                </span>

                {/* National users can select one province or see all provinces. */}
                {session.tier === "national" && (
                  <select
                    value={filterProvince}
                    onChange={(e) => {
                      setFilterProvince(e.target.value);
                      setFilterDistrict("");
                      setFilterSector("all");
                    }}
                    aria-label="Hitamo Intara cyangwa Umujyi"
                    className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  >
                    <option value="">Intara zose n'Umujyi wa Kigali</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>{p.name_kiny}</option>
                    ))}
                  </select>
                )}

                {/* National and province scopes can filter by any district. */}
                {(session.tier === "national" || session.tier === "province") && (
                  <select
                    value={filterDistrict}
                    onChange={(e) => {
                      setFilterDistrict(e.target.value);
                      setFilterSector("all");
                    }}
                    aria-label="Hitamo Akarere"
                    className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                  >
                    <option value="">Uturere twose</option>
                    {availableDistricts.map((d) => (
                      <option key={d.code} value={d.code}>Akarere ka {d.name_kiny}</option>
                    ))}
                  </select>
                )}

                {unitError && (
                  <span role="alert" className="text-xs text-red-600">{unitError}</span>
                )}

                {/* Drill by Sector */}
                <select
                  value={filterSector}
                  onChange={(e) => setFilterSector(e.target.value)}
                  className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                >
                  <option value="all">Imirenge Yose</option>
                  {availableSectors.map((s) => (
                    <option key={s.code} value={s.code}>
                      Umurenge wa {s.name_kiny}
                    </option>
                  ))}
                </select>

                {/* Filter by Administrative Level */}
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3E0]"
                >
                  <option value="all">Inzego Zose (Levels)</option>
                  <option value="village">Imidugudu gusa</option>
                  <option value="cell">Utugari gusa</option>
                  <option value="sector">Imirenge gusa</option>
                  <option value="district">Akarere</option>
                </select>

                <span className="ml-auto text-[11px] text-muted-foreground">
                  Habonetse abayobozi: <span className="font-bold text-foreground">{filtered.length}</span>
                </span>
              </div>
            </div>

            {/* 4. LEADERS MANAGEMENT TABLE */}
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3.5">Umuyobozi</th>
                      <th className="px-4 py-3.5">Inshingano (Role)</th>
                      <th className="px-4 py-3.5">Agace (Jurisdiction)</th>
                      <th className="px-4 py-3.5">Telefone y&apos;Akazi</th>
                      <th className="px-4 py-3.5">Dossier y&apos;Akazi</th>
                      <th className="px-4 py-3.5 text-right">Ibikorwa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          Turimo gukuramo amakuru y&apos;abayobozi…
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          Nta muyobozi uhuye n&apos;ibyo mushakishije.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((leader) => {
                        const canEditRole = canAdminEditRole(leader);
                        const fullName = `${leader.first_name} ${leader.last_name}`;
                        const isPhoneRevealed = !!revealedPhones[leader.id];
                        const phoneDisplay =
                          revealedPhones[leader.id] || leader.phone_raw || leader.phone_masked;

                        return (
                          <tr key={leader.id} className="hover:bg-muted/30 transition-colors">
                            {/* Photo & Name */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-sky-100 dark:bg-sky-950">
                                  {leader.photo_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={leader.photo_url}
                                      alt={fullName}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center font-bold text-sky-700 text-xs">
                                      {leader.first_name[0]}{leader.last_name[0]}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-foreground text-xs sm:text-sm">
                                    {fullName}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {leader.email || "Nta email"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Role */}
                            <td className="px-4 py-3.5">
                              <span className="font-bold text-[#00A3E0]">{leader.role}</span>
                              <div className="mt-0.5">
                                {leader.is_verified ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                                    <Check className="h-2.5 w-2.5" /> Byemejwe
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                                    Igerageza
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Jurisdiction */}
                            <td className="px-4 py-3.5">
                              <div className="font-medium text-foreground">
                                {leader.boundary_name_kiny}
                              </div>
                              <span className="text-[10px] text-muted-foreground uppercase font-mono">
                                {leader.level} · {leader.scope_code}
                              </span>
                            </td>

                            {/* Phone with Mask Reveal */}
                            <td className="px-4 py-3.5 font-mono">
                              <div className="flex items-center gap-2">
                                <span>{phoneDisplay}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleRevealPhone(leader.id, leader.phone_masked || undefined)}
                                  className="text-muted-foreground hover:text-foreground"
                                  title={isPhoneRevealed ? "Hisha nimero" : "Erekana nimero yose"}
                                >
                                  {isPhoneRevealed ? (
                                    <EyeOff className="h-3.5 w-3.5" />
                                  ) : (
                                    <Eye className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Confidential HR Dossier Button */}
                            <td className="px-4 py-3.5">
                              <button
                                type="button"
                                onClick={() => setDossierLeader(leader)}
                                className="inline-flex items-center gap-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 text-xs font-bold text-[#00A3E0] hover:bg-sky-100 transition-colors"
                              >
                                <GraduationCap className="h-3.5 w-3.5" />
                                <span>Reba Dossier</span>
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3.5 text-right space-x-1">
                              <button
                                type="button"
                                onClick={() => setEditingLeader(leader)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-muted"
                                title={
                                  canEditRole
                                    ? "Vugurura amakuru n'inshingano"
                                    : "Vugurura amakuru ye bwite (inshingano zikuri hejuru)"
                                }
                              >
                                <Edit3 className="h-3 w-3 text-sky-600" />
                                <span>Hindura</span>
                              </button>

                              {canEditRole && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLeader(leader.id, fullName)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-destructive hover:bg-destructive/10"
                                  title="Kura ku rutonde"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* 5. CITIZEN INACTIVE PHONE NUMBER REPORTS SECTION */
          <div className="rounded-3xl border border-sky-100 bg-card p-6 shadow-xs dark:border-sky-950 space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Raporo z&apos;Abaturage ku Nimero Zidahuye cyangwa Zidakora
              </h2>
              <p className="text-xs text-muted-foreground">
                Izi ni raporo zoherejwe n&apos;abaturage bagerageje guhamagara umuyobozi bakabura umurongo.
              </p>
            </div>

            {reports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                Nta raporo y&apos;abaturage iraboneka muri aka gace.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {reports.map((rep) => (
                  <div key={rep.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-foreground text-sm flex items-center gap-2">
                        <span>{rep.leader_name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rep.status === "pending"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}>
                          {rep.status === "pending" ? "Itegereje gusuzumwa" : "Irakemutse"}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        Agace: <span className="font-semibold text-foreground">{rep.boundary_name}</span> · Nimero yaregwaga: <span className="font-mono">{rep.reported_phone}</span>
                      </div>
                      {rep.citizen_comment && (
                        <p className="mt-1 text-foreground/80 italic">
                          «{rep.citizen_comment}»
                        </p>
                      )}
                      <span className="text-[10px] text-muted-foreground mt-1 block">
                        Yoherejwe: {new Date(rep.created_at).toLocaleString("rw-RW")}
                      </span>
                    </div>

                    {rep.status === "pending" && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const found = leaders.find((l) => l.id === rep.leader_id);
                            if (found) setEditingLeader(found);
                          }}
                          className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-[#00A3E0] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#0090c6]"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Hindura Nimero</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveReport(rep.id)}
                          className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Emeza ko Yakemutse</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL 1: EDIT LEADER FORM */}
      {editingLeader && (
        <LeaderEditForm
          leader={editingLeader}
          canEditRole={canAdminEditRole(editingLeader)}
          onClose={() => setEditingLeader(null)}
          onSuccess={(updated) => {
            setSuccessBanner(`${updated.first_name} ${updated.last_name} yavuguruwe neza.`);
            setEditingLeader(null);
            fetchLeaders();
          }}
        />
      )}

      {/* MODAL 2: CONFIDENTIAL ADMIN DOSSIER MODAL */}
      <AdminDossierModal
        isOpen={!!dossierLeader}
        onClose={() => setDossierLeader(null)}
        leader={dossierLeader}
      />

      {/* MODAL 3: ADD LEADER MODAL */}
      <AddLeaderModal
        isOpen={showAddModal}
        adminTier={session.tier}
        onClose={() => setShowAddModal(false)}
        onLeaderAdded={() => {
          setSuccessBanner("Umuyobozi mushya yongewemo neza.");
          fetchLeaders();
        }}
      />

      {/* MODAL 4: BULK IMPORT MODAL */}
      <BulkImportModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onImportComplete={() => {
          setSuccessBanner("Uruhererekane rw'abayobozi rwinjijwe neza.");
          fetchLeaders();
        }}
      />
    </div>
  );
}
