import { NextRequest } from "next/server";
import { createSupabaseServerClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

export type AdminIdentity = {
  userId: string;
  scopeCode: string;
  isSuperAdmin: boolean;
};

export type AdminGateResult =
  | { ok: true; admin: AdminIdentity }
  | { ok: false; status: number; body: { status: string; message_kiny: string } };

function denied(status: number, message_kiny: string): AdminGateResult {
  return { ok: false, status, body: { status: "error", message_kiny } };
}

/**
 * Server-side authorization. The profile is loaded from Supabase using the
 * signed-in user's cookie-backed session; localStorage, selected UI scope,
 * and client-supplied admin tokens are never treated as proof of identity.
 */
export async function requireAdminWrite(_req?: NextRequest): Promise<AdminGateResult> {
  if (!isSupabaseAuthConfigured()) {
    return denied(
      503,
      "Kwinjira mu buyobozi ntibirashyirwaho neza. Serivisi ya Supabase Auth irakenewe."
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return denied(401, "Banza winjire ukoresheje konti yemewe y'ubuyobozi.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("admin_profiles")
      .select("user_id, scope_code, is_super_admin")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[admin-gate] failed to verify admin profile:", profileError.message);
      return denied(503, "Ntibyashobotse kugenzura uburenganzira bw'ubuyobozi.");
    }

    if (!profile) {
      return denied(403, "Konti yawe nta burenganzira bw'ubuyobozi ifite.");
    }

    const scopeCode = typeof profile.scope_code === "string" ? profile.scope_code : "";
    const scopeDepth = scopeCode === "RW" ? 0 : scopeCode.split("-").length - 1;
    if (!/^RW(?:-[0-9A-Z]{2,})*$/.test(scopeCode) || scopeDepth > 4) {
      console.error("[admin-gate] invalid admin scope configured for user");
      return denied(403, "Aho konti yawe yemerewe kugenzura ntabwo handitse neza.");
    }

    return {
      ok: true,
      admin: {
        userId: authData.user.id,
        scopeCode,
        isSuperAdmin: profile.is_super_admin === true,
      },
    };
  } catch (error) {
    console.error("[admin-gate] authentication verification failed:", error);
    return denied(503, "Serivisi yo kwemeza ubuyobozi ntibonetse. Ongera ugerageze nyuma.");
  }
}

/**
 * Scope comparison must respect complete hierarchy segments. For example,
 * RW-01 must not be treated as the parent of RW-010.
 */
export function adminCanManageScope(admin: AdminIdentity, targetScope: string): boolean {
  if (!/^RW(?:-[0-9A-Z]{2,})*$/.test(targetScope)) return false;
  if (admin.isSuperAdmin) return true;
  return targetScope === admin.scopeCode || targetScope.startsWith(`${admin.scopeCode}-`);
}
