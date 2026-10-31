export function isLandmarksFeatureEnabled(
  value: string | undefined = process.env.NEXT_PUBLIC_FEATURE_LANDMARKS
): boolean {
  return value === "true";
}

/** Guarded loader so callers and unit tests share the exact OFF behaviour. */
export async function runLandmarksRequest<T>(
  request: () => Promise<T>,
  enabled = isLandmarksFeatureEnabled()
): Promise<{ status: "disabled" } | { status: "ok"; value: T }> {
  if (!enabled) return { status: "disabled" };
  return { status: "ok", value: await request() };
}
