/** The part of a PostgREST error that is safe to log (no `details`: it can quote row values). */
type DatabaseError = { code?: string; message: string; hint?: string | null };

/**
 * Logs an unexpected database error of a Server Action. The user only sees a generic message, so without this
 * line the real reason (a missing function, a constraint, a network failure) would be nowhere.
 * @param action - Name of the action, to find it in the logs.
 */
export function logActionError(action: string, error: DatabaseError): void {
  console.error(
    `[${action}] unexpected database error:`,
    error.code ?? "no-code",
    error.message,
    error.hint ?? "",
  );
}
