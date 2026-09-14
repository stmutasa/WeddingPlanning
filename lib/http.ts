import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUser } from "@/lib/session";

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

/** Runs `fn` and turns thrown Zod/Prisma/generic errors into `{ error }` responses. */
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
    const message = err instanceof Error ? err.message : "Unexpected error";
    return apiError(message, 500);
  }
}
