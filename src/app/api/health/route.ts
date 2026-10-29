import { NextResponse } from "next/server";
import { isSupabaseAuthConfigured, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    "env:NEXT_PUBLIC_SUPABASE_URL": process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "ok"
      : "missing",
    "env:NEXT_PUBLIC_SUPABASE_ANON_KEY": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? "ok"
      : "missing",
    "env:SUPABASE_SERVICE_ROLE_KEY": process.env.SUPABASE_SERVICE_ROLE_KEY
      ? "ok"
      : "missing",
    supabase_auth_configured: isSupabaseAuthConfigured() ? "ok" : "missing",
    supabase_database_configured: isSupabaseConfigured() ? "ok" : "missing",
  };

  const degraded = Object.values(checks).some((v) => v === "missing");

  return NextResponse.json(
    {
      status: degraded ? "degraded" : "ok",
      time: new Date().toISOString(),
      service: "iwacu-rwanda-2",
      checks,
    },
    { status: 200 }
  );
}
