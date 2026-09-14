import type { AppSettings, UserSettings, Wedding } from "@prisma/client";
import { db } from "@/lib/db";
import type { AiEffort, AiProvider, Hue, Theme } from "@/lib/types";
import { forgetActorName, log, money } from "./actor";
import * as brief from "./brief";

/**
 * The three settings singletons. DESIGN.md §8: the Brief is regenerated
 * "after any change to `Wedding` or `AppSettings`", which is why those two
 * updaters kick a regeneration off (without blocking the response on it).
 */

export async function wedding(): Promise<Wedding> {
  return db.wedding.upsert({ where: { id: "main" }, update: {}, create: { id: "main" } });
}

export async function app(): Promise<AppSettings> {
  return db.appSettings.upsert({ where: { id: "main" }, update: {}, create: { id: "main" } });
}

export async function forUser(userId: string): Promise<UserSettings> {
  return db.userSettings.upsert({ where: { userId }, update: {}, create: { userId } });
}

function regenerateBrief(): void {
  void brief.generate("MANUAL").catch((err) => {
    console.error("[settings] brief regeneration failed", err);
  });
}

export interface WeddingInput {
  coupleNames?: string;
  city?: string;
  country?: string;
  eventTimezone?: string;
  targetMonth?: string;
  weddingDate?: Date | null;
  budgetCents?: number;
  currency?: string;
  splitNumerator?: number;
  splitDenominator?: number;
}

export async function updateWedding(userId: string, input: WeddingInput): Promise<Wedding> {
  const before = await wedding();
  const updated = await db.wedding.update({ where: { id: "main" }, data: { ...input } });

  const changes: string[] = [];
  if (input.budgetCents != null && input.budgetCents !== before.budgetCents) {
    changes.push(`the total budget to ${money(input.budgetCents)}`);
  }
  if (input.weddingDate !== undefined && String(input.weddingDate) !== String(before.weddingDate)) {
    changes.push(
      input.weddingDate
        ? `the wedding date to ${input.weddingDate.toISOString().slice(0, 10)}`
        : "the wedding date to not set"
    );
  }
  if (
    (input.splitNumerator != null && input.splitNumerator !== before.splitNumerator) ||
    (input.splitDenominator != null && input.splitDenominator !== before.splitDenominator)
  ) {
    changes.push(`the split to ${updated.splitNumerator}/${updated.splitDenominator}`);
  }

  await log({
    userId,
    action: "UPDATED",
    entityType: "Wedding",
    entityId: "main",
    summary: changes.length ? `set ${changes.join(" and ")}` : "updated the wedding details",
  });

  regenerateBrief();
  return updated;
}

export interface AppSettingsInput {
  aiPrimaryProvider?: AiProvider;
  aiPrimaryModel?: string;
  aiBackupProvider?: AiProvider;
  aiBackupModel?: string;
  aiReasoning?: AiEffort;
  aiEnabled?: boolean;
  assistantTone?: string;
  digestDay?: number;
}

export async function updateApp(userId: string, input: AppSettingsInput): Promise<AppSettings> {
  await app();

  // Choosing a model by hand pins it: DESIGN.md §7's resolution order puts
  // a user choice above AI_MODEL and above the AI_MODEL_MATCH lookup.
  const data: AppSettingsInput & { aiPrimaryResolvedFrom?: string } = { ...input };
  if (input.aiPrimaryModel !== undefined) data.aiPrimaryResolvedFrom = "user";

  const updated = await db.appSettings.update({ where: { id: "main" }, data });

  await log({
    userId,
    action: "UPDATED",
    entityType: "Settings",
    entityId: "main",
    summary:
      input.aiEnabled === false
        ? "switched the assistant off"
        : input.aiEnabled === true
          ? "switched the assistant on"
          : input.aiPrimaryModel
            ? `set the primary model to ${input.aiPrimaryModel}`
            : "updated app settings",
  });

  regenerateBrief();
  return updated;
}

export interface UserSettingsInput {
  displayName?: string;
  hue?: Hue;
  timezone?: string;
  digestHour?: number;
  pushEnabled?: boolean;
  theme?: Theme;
}

export async function updateForUser(
  userId: string,
  input: UserSettingsInput
): Promise<UserSettings> {
  await forUser(userId);
  const updated = await db.userSettings.update({ where: { userId }, data: { ...input } });

  if (input.displayName) forgetActorName(userId);

  await log({
    userId,
    action: "UPDATED",
    entityType: "Settings",
    entityId: updated.id,
    summary: "updated their settings",
  });

  return updated;
}
