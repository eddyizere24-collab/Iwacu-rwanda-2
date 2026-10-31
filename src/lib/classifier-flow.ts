export interface ClassifierRpcError {
  code?: string | null;
  message?: string | null;
}

export interface ClassifierState<T> {
  classification: T | null;
  unavailable: boolean;
  errorCode: string | null;
}

/**
 * A country-classifier RPC is advisory. A failure or thrown transport error
 * must not prevent the caller from searching for a village.
 */
export async function classifyThenContinue<T, TResult>(
  classify: () => Promise<{
    data: T[] | null;
    error: ClassifierRpcError | null;
  }>,
  continueSearch: (state: ClassifierState<T>) => Promise<TResult>,
  onState?: (state: ClassifierState<T>) => void,
): Promise<ClassifierState<T> & { result: TResult }> {
  let classification: T | null = null;
  let unavailable = false;
  let errorCode: string | null = null;

  try {
    const outcome = await classify();
    if (outcome.error) {
      unavailable = true;
      errorCode = outcome.error.code || "UNKNOWN";
    } else if (!Array.isArray(outcome.data) || outcome.data.length === 0) {
      unavailable = true;
      errorCode = "EMPTY_RESULT";
    } else {
      classification = outcome.data[0];
    }
  } catch (error) {
    unavailable = true;
    const caught = error as { code?: unknown } | null;
    errorCode = typeof caught?.code === "string" ? caught.code : "UNKNOWN";
  }

  const state = { classification, unavailable, errorCode };
  onState?.(state);
  const result = await continueSearch(state);
  return { ...state, result };
}
