import { db } from "@/lib/db";
import { recordActivity } from "@/lib/activity";
import type { ActivityAction, ActivityEntityType } from "@/lib/types";
import { formatUSD } from "@/lib/money/format";

/**
 * Activity summaries read like "Annette added Ruracio venue hold, $800"
 * (DESIGN.md §3), so every service needs the acting person's display name.
 * Cached per process for the life of the request wave — two users, and the
 * name only changes from Settings.
 */
const nameCache = new Map<string, string>();

export async function actorName(userId: string | null | undefined): Promise<string> {
  if (!userId) return "Harusi";
  const cached = nameCache.get(userId);
  if (cached) return cached;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, settings: { select: { displayName: true } } },
  });
  const name =
    user?.settings?.displayName?.trim() ||
    user?.name?.trim() ||
    user?.email?.split("@")[0] ||
    "Someone";
  nameCache.set(userId, name);
  return name;
}

export function forgetActorName(userId: string): void {
  nameCache.delete(userId);
}

export interface LogInput {
  userId: string | null;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string | null;
  /** Everything after the actor's name, e.g. `added Ruracio venue hold, $800`. */
  summary: string;
}

/** Appends the Activity row every mutation owes (DESIGN.md §4). */
export async function log(input: LogInput): Promise<void> {
  const who = await actorName(input.userId);
  await recordActivity({
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    summary: `${who} ${input.summary}`,
  });
}

/**
 * `$800` for a round amount, `$115.38` when there are cents — activity
 * lines read like DESIGN.md §3's example without ever rounding a real
 * figure away.
 */
export function money(cents: number): string {
  return formatUSD(cents, { detail: cents % 100 !== 0 });
}
