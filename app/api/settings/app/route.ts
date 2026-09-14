import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { AI_PROVIDERS, AI_EFFORTS } from "@/lib/types";

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

async function getOrCreateAppSettings() {
  return db.appSettings.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" },
  });
}

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const settings = await getOrCreateAppSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = patchSchema.parse(await request.json());
    await getOrCreateAppSettings();
    const settings = await db.appSettings.update({ where: { id: "main" }, data: body });

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "Settings",
      entityId: "main",
      summary: `${session.name ?? "Someone"} updated app settings`,
    });

    return NextResponse.json(settings);
  });
}
