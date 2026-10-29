"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Check configuration before attempting to contact Supabase Auth. */
export function isSupabaseBrowserConfigured(): boolean {
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
 * Browser Supabase client (anon key). Never place a service-role key here.
 * RLS applies to every data operation initiated through this client.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
  return createBrowserClient(url, key);
}
