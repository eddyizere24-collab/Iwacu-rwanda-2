import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Browser-facing server client (respects RLS via user session cookies).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    url &&
      key &&
      !url.includes("placeholder") &&
      !url.includes("xxxxxxxx") &&
      !key.includes("eyJ...")
  );
}

/**
 * Service-role client. Bypasses RLS. Use ONLY on the server for
 * geospatial calculations and admin operations that require elevated rights.
 * Never expose this client or its key to the browser.
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


/**
 * Stateless public client for citizen-facing location lookups.
 * It never uses a service-role key; RLS protects public boundary reads.
 */
export function isSupabasePublicConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || url.includes("placeholder") || key.includes("xxxxxxxx")) {
    return false;
  }
  const urlRef = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)?.[1];
  const tokenParts = key.split(".");
  if (urlRef && tokenParts.length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(tokenParts[1], "base64url").toString("utf8")
      ) as { ref?: string };
      if (payload.ref && payload.ref !== urlRef) return false;
    } catch {
      // New publishable keys aren't JWTs; the URL still determines the target project.
    }
  }
  return true;
}

export function createSupabasePublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "placeholder-public-key";
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
