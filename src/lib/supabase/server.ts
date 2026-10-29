import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * True only when real Supabase Auth configuration is present.
 * Never treat placeholder values as credentials.
 */
export function isSupabaseAuthConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(
    url &&
      anonKey &&
      !url.toLowerCase().includes("placeholder") &&
      !url.includes("xxxxxxxx") &&
      !anonKey.toLowerCase().includes("placeholder") &&
      !anonKey.includes("xxxxxxxx") &&
      !anonKey.includes("eyJ...")
  );
}

/**
 * True only when both user authentication and the server-only database key
 * are configured. The service-role key must never be exposed to a browser.
 */
export function isSupabaseConfigured(): boolean {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(
    isSupabaseAuthConfigured() &&
      serviceRoleKey &&
      !serviceRoleKey.toLowerCase().includes("placeholder") &&
      !serviceRoleKey.includes("xxxxxxxx") &&
      !serviceRoleKey.includes("eyJ...")
  );
}

/**
 * Browser-facing server client (respects RLS via Supabase Auth cookies).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isSupabaseAuthConfigured() || !url || !anonKey) {
    throw new Error("Supabase Auth environment variables are not configured.");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as any)
          );
        } catch {
          // Called from a Server Component — ignore.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS. Use ONLY on the server after verifying
 * the authenticated user's admin profile and permitted scope.
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key";

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
