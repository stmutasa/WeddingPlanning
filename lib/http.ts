import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUser } from "@/lib/session";
import { ServiceError } from "@/lib/services/errors";
import { AiDisabled } from "@/lib/ai/client";

/** `{ error }` JSON with a status, per DESIGN.md's API conventions. */
export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Session gate for route handlers. Returns the acting user, or a ready-to
 * return 401 Response when there is no session — every route does:
 *   const session = await requireSession();
 *   if (session instanceof NextResponse) return session;
 */
export async function requireSession() {
  try {
    return await requireUser();
  } catch {
    return apiError("Unauthorized", 401);
  }
}

export function isSessionError(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

/** Runs `fn` and turns thrown Zod/service/generic errors into `{ error }` responses. */
export async function withApiErrors(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError(err.issues.map((i) => i.message).join("; "), 400);
    }
    if (err instanceof SyntaxError) {
      return apiError("Invalid JSON body", 400);
    }
    // Every service error carries the status a route should answer with:
    // NotFound 404, Conflict 409, FxUnavailable / AiUnavailable 502,
    // PlaidNotConfigured 503 (lib/services/errors.ts).
    if (err instanceof ServiceError) {
      return apiError(err.message, err.status);
    }
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[api]", err);
    return apiError(message, 500);
  }
}

/**
 * AI routes answer `{ disabled: true }` when the assistant is off or no key
 * is configured (DESIGN.md §7), and 502 when both providers failed.
 */
export async function withAiErrors(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AiDisabled) {
      return NextResponse.json({ disabled: true, reason: err.reason });
    }
    return withApiErrors(async () => {
      throw err;
    });
  }
}
