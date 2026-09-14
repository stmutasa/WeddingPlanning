import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { HUES, THEMES } from "@/lib/types";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  displayName: z.string().min(1).optional(),
  hue: z.enum(HUES).optional(),
  timezone: z.string().min(1).optional(),
  digestHour: z.number().int().min(0).max(23).optional(),
  pushEnabled: z.boolean().optional(),
  theme: z.enum(THEMES).optional(),
});

async function getOrCreateUserSettings(userId: string) {
  return db.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const settings = await getOrCreateUserSettings(session.id);
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = patchSchema.parse(await request.json());
    await getOrCreateUserSettings(session.id);
    const settings = await db.userSettings.update({
      where: { userId: session.id },
      data: body,
    });

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "Settings",
      entityId: settings.id,
      summary: `${session.name ?? "Someone"} updated their settings`,
    });

    return NextResponse.json(settings);
  });
}
