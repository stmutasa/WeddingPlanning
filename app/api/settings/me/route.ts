import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { HUES, THEMES } from "@/lib/types";
import * as settings from "@/lib/services/settings";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  displayName: z.string().min(1).optional(),
  hue: z.enum(HUES).optional(),
  timezone: z.string().min(1).optional(),
  digestHour: z.number().int().min(0).max(23).optional(),
  pushEnabled: z.boolean().optional(),
  theme: z.enum(THEMES).optional(),
});

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;
  return NextResponse.json(await settings.forUser(session.id));
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = patchSchema.parse(await request.json());
    return NextResponse.json(await settings.updateForUser(session.id, body));
  });
}
