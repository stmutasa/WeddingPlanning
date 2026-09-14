import { db } from "@/lib/db";
import type { Hue } from "@/lib/types";

/**
 * The two humans, with the hue each one picked. Screens need this to colour
 * attribution (who paid, who added, who a task is assigned to) without a
 * client component ever reaching for Prisma: `/api/people` is the read.
 */
export interface Person {
  userId: string;
  funderId: string | null;
  name: string;
  email: string;
  hue: Hue;
}

export async function list(): Promise<Person[]> {
  const users = await db.user.findMany({
    include: { settings: true, funder: true },
    orderBy: { createdAt: "asc" },
  });

  return users.map((user) => ({
    userId: user.id,
    funderId: user.funder?.id ?? null,
    name: user.settings?.displayName ?? user.name ?? user.email,
    email: user.email,
    hue: (user.settings?.hue ?? "pink") as Hue,
  }));
}
