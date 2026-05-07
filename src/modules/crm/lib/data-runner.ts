import * as Sentry from "@sentry/nextjs";

type SupabaseError = {
  message?: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

type SupabaseListResponse<T> = {
  data: T[] | null;
  error: SupabaseError | null;
};

type SupabaseSingleResponse<T> = {
  data: T | null;
  error: SupabaseError | null;
};

function reportError(fnName: string, error: SupabaseError) {
  const message = `crm.data.${fnName}: ${error.message ?? "unknown error"}`;
  Sentry.captureException(new Error(message), {
    tags: {
      area: "crm.data",
      fn: fnName,
      pg_code: error.code ?? "unknown",
    },
    extra: {
      details: error.details ?? null,
      hint: error.hint ?? null,
    },
  });
  if (process.env.NODE_ENV !== "production") {
    console.error(`[crm.data][${fnName}]`, error);
  }
}

/**
 * Wraps a Supabase list query and routes any error through Sentry instead of
 * silently swallowing it. Returns `[]` on error so the caller's UI degrades to
 * an empty list rather than crashing — but the failure is now observable.
 *
 * Existed to fix the silent-failure class of bugs surfaced by the PostgREST
 * FK ambiguity on `listLeads` (commit deb93df), where `data ?? []` masked a
 * 300-class error and the leads page rendered empty even with rows in the DB.
 */
export async function runCrmList<T>(
  fnName: string,
  query: PromiseLike<SupabaseListResponse<T>>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    reportError(fnName, error);
    return [];
  }
  return data ?? [];
}

/**
 * Same contract as runCrmList but for `.single()` / `.maybeSingle()` queries.
 * Returns `null` on error.
 */
export async function runCrmSingle<T>(
  fnName: string,
  query: PromiseLike<SupabaseSingleResponse<T>>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) {
    reportError(fnName, error);
    return null;
  }
  return data ?? null;
}
