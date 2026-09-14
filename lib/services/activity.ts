import type { Activity } from "@prisma/client";
import { NotImplemented } from "./errors";

/**
 * The Phase B service — will likely just wrap db.activity.findMany with the
 * same shape app/api/activity already returns directly. The lightweight
 * `lib/activity.ts` helper (used by every route today to append a row) is
 * intentionally separate and already implemented; it stays once this lands.
 */
export async function recent(_n: number): Promise<Activity[]> {
  throw new NotImplemented("activity.recent");
}
