import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { AI_PROVIDERS, AI_EFFORTS } from "@/lib/types";
import * as settings from "@/lib/services/settings";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  aiPrimaryProvider: z.enum(AI_PROVIDERS).optional(),
  aiPrimaryModel: z.string().optional(),
  aiBackupProvider: z.enum(AI_PROVIDERS).optional(),
  aiBackupModel: z.string().optional(),
  aiReasoning: z.enum(AI_EFFORTS).optional(),
  aiEnabled: z.boolean().optional(),
  assistantTone: z.string().min(1).optional(),
  digestDay: z.number().int().min(0).max(6).optional(),
});

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;
  return NextResponse.json(await settings.app());
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = patchSchema.parse(await request.json());
    return NextResponse.json(await settings.updateApp(session.id, body));
  });
}
