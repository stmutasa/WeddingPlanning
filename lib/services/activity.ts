import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const RELATIONS = {
  user: { select: { id: true, name: true, settings: { select: { displayName: true, hue: true } } } },
} satisfies Prisma.ActivityInclude;

export type ActivityRow = Prisma.ActivityGetPayload<{ include: typeof RELATIONS }>;

/** DESIGN.md §4 — the shared feed the Home screen and the Brief both read. */
export async function recent(n = 25): Promise<ActivityRow[]> {
  return db.activity.findMany({
    include: RELATIONS,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(n, 1), 200),
  });
}
