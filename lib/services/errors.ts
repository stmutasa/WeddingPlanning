/**
 * Typed service errors. Every one carries the HTTP status a route should
 * turn it into; `lib/http.ts`'s `withApiErrors()` reads `status` off the
 * error and answers `{ error }` with it.
 */

export class ServiceError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
  }
}

/** The row (event, funder, vendor, …) the caller named does not exist. */
export class NotFound extends ServiceError {
  constructor(what: string) {
    super(`${what} not found`, 404);
    this.name = "NotFound";
  }
}

/** The request is well-formed but the state forbids it (e.g. payment already PAID). */
export class Conflict extends ServiceError {
  constructor(message: string) {
    super(message, 409);
    this.name = "Conflict";
  }
}

/**
 * DESIGN.md §2 FX: `open.er-api.com` is unauthenticated and free, so it can
 * simply be down. Routes turn this into 502 with a message telling the user
 * to enter the rate by hand — the manual path always works.
 */
export class FxUnavailable extends ServiceError {
  readonly quote: string;

  constructor(quote: string, detail?: string) {
    super(
      `Could not fetch today's USD→${quote} exchange rate${detail ? ` (${detail})` : ""}. ` +
        `Enter the rate manually on the expense and save again.`,
      502
    );
    this.name = "FxUnavailable";
    this.quote = quote;
  }
}

/** Plaid credentials are absent — the bank routes answer 503, CSV import still works. */
export class PlaidNotConfigured extends ServiceError {
  constructor() {
    super(
      "Bank sync is not configured on this server (PLAID_CLIENT_ID / PLAID_SECRET are unset). " +
        "Import a CSV instead.",
      503
    );
    this.name = "PlaidNotConfigured";
  }
}

/** Push is not configured (no VAPID keys). Never fatal: callers log and move on. */
export class PushNotConfigured extends ServiceError {
  constructor() {
    super("Web push is not configured (VAPID keys are unset)", 503);
    this.name = "PushNotConfigured";
  }
}

export function statusOf(err: unknown): number | null {
  if (err instanceof ServiceError) return err.status;
  return null;
}
