import { db } from "@/lib/db";
import type { ActivityAction, ActivityEntityType } from "@/lib/types";

export interface RecordActivityInput {
  userId: string | null;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string | null;
  summary: string;
}

/**
 * DESIGN.md: "All writes go through lib/services/* and append an Activity
 * row." Phase A routes touch Prisma directly (services land in Phase B) but
 * still call this on every mutation so the Activity feed is populated from
 * day one.
 */
export async function recordActivity(input: RecordActivityInput) {
  return db.activity.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
    },
  });
}
