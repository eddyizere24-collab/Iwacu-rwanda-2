import { NextRequest } from "next/server";

/**
 * Temporary admin gate until Supabase Auth is wired.
 * Requires header: x-iwacu-admin-token matching ADMIN_WRITE_TOKEN env
 * (or development-only fallback disabled in production).
 */
export function requireAdminWrite(req: NextRequest): {
  ok: true;
} | {
  ok: false;
  status: number;
  body: { status: string; message_kiny: string };
} {
  const token = req.headers.get("x-iwacu-admin-token")?.trim();
  const expected = process.env.ADMIN_WRITE_TOKEN?.trim();

  if (!expected) {
    // No token configured: refuse all writes in production-like deploys
    return {
      ok: false,
      status: 503,
      body: {
        status: "error",
        message_kiny:
          "Serivisi yo kwandika ntiyashyizweho neza. ADMIN_WRITE_TOKEN irakenewe.",
      },
    };
  }

  if (!token || token !== expected) {
    return {
      ok: false,
      status: 401,
      body: {
        status: "error",
        message_kiny:
          "Nta uburenganzira bwo guhindura amakuru. Injira nk'umuyobozi wemewe.",
      },
    };
  }

  return { ok: true };
}
