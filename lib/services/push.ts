import webpush from "web-push";
import { db } from "@/lib/db";
import { PushNotConfigured } from "./errors";

/**
 * Web push over VAPID (DESIGN.md §2). Subscriptions that answer 404 or 410
 * are gone for good and are pruned, as DESIGN.md §4 requires.
 *
 * iOS only delivers to the installed PWA (16.4+); that is a client-side
 * fact, documented in the README, and changes nothing here.
 */

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured = false;

export function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim()
  );
}

export function publicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;
}

function ensureConfigured(): void {
  if (!isConfigured()) throw new PushNotConfigured();
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:noreply@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim()
  );
  configured = true;
}

export async function subscribe(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string | null
) {
  const row = await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    },
  });

  await db.userSettings.updateMany({ where: { userId }, data: { pushEnabled: true } });
  return row;
}

export async function unsubscribe(userId: string, endpoint: string): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
  const left = await db.pushSubscription.count({ where: { userId } });
  if (left === 0) {
    await db.userSettings.updateMany({ where: { userId }, data: { pushEnabled: false } });
  }
}

/** Sends to every subscription the user has; prunes dead endpoints. */
export async function send(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; pruned: number }> {
  ensureConfigured();

  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let pruned = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        pruned++;
      } else {
        console.error("[push] send failed", status, err);
      }
    }
  }

  return { sent, pruned };
}

/** Best-effort variant for the scheduler: logs instead of throwing. */
export async function trySend(userId: string, payload: PushPayload): Promise<void> {
  try {
    await send(userId, payload);
  } catch (err) {
    if (err instanceof PushNotConfigured) return;
    console.error("[push] could not send", err);
  }
}
