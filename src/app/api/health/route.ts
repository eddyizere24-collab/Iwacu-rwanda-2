import { NextResponse } from "next/server";
import {
  createSupabaseServiceClient,
  isSupabaseAuthConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CheckState = "ok" | "missing" | "error" | "not_checked";

export async function GET() {
  const authConfigured = isSupabaseAuthConfigured();
  const databaseConfigured = isSupabaseConfigured();

  const checks: Record<string, CheckState> = {
    "env:NEXT_PUBLIC_SUPABASE_URL": process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "ok"
      : "missing",
    "env:NEXT_PUBLIC_SUPABASE_ANON_KEY": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? "ok"
      : "missing",
    "env:SUPABASE_SERVICE_ROLE_KEY": process.env.SUPABASE_SERVICE_ROLE_KEY
      ? "ok"
      : "missing",
    supabase_auth_configured: authConfigured ? "ok" : "missing",
    supabase_database_configured: databaseConfigured ? "ok" : "missing",
    database_connection: "not_checked",
  };

  // Check a single non-sensitive row without returning data or doing a full count.
  // Never return credentials or raw database error details from this public endpoint.
  if (databaseConfigured) {
    try {
      const supabase = createSupabaseServiceClient();
      const { error } = await supabase
        .from("boundaries")
        .select("id", { head: true })
        .limit(1);
      checks.database_connection = error ? "error" : "ok";
      if (error) {
        console.error("[health] Supabase database connectivity check failed:", error.message);
      }
    } catch {
      checks.database_connection = "error";
      console.error("[health] Supabase database connectivity check threw an error.");
    }
  }

  const degraded = Object.values(checks).some((value) => value !== "ok");

  return NextResponse.json(
    {
      status: degraded ? "degraded" : "ok",
      time: new Date().toISOString(),
      service: "iwacu-rwanda-2",
      checks,
    },
    { status: degraded ? 503 : 200 }
  );
}
