import cron from "node-cron";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import * as models from "@/lib/ai/models";
import * as brief from "@/lib/services/brief";
import * as digest from "@/lib/services/digest";
import * as fx from "@/lib/services/fx";
import * as plaid from "@/lib/services/plaid";
import * as reminders from "@/lib/services/reminders";
import * as transactions from "@/lib/services/transactions";

/**
 * DESIGN.md §4 scheduler, started once from `instrumentation.ts`.
 *
 * Three of the four jobs are timezone-sensitive — the nightly Brief runs in
 * `Wedding.eventTimezone`, reminders and the digest in each *user's*
 * timezone — and node-cron's own `timezone` option can only pin a schedule
 * to one zone. So those three hang off one hourly tick that asks, per zone,
 * "is it that hour there now?". The bank sync, which has no timezone rule,
 * is a plain 6-hourly cron.
 *
 * Every job is wrapped: one failure logs and never stops the loop.
 */

let registered = false;

const BRIEF_HOUR = 3;
const REMINDER_HOUR = 9;

async function safely(name: string, fn: () => Promise<unknown>): Promise<void> {
  const started = Date.now();
  try {
    const result = await fn();
    console.log(`[jobs] ${name} ok in ${Date.now() - started}ms`, result ?? "");
  } catch (err) {
    console.error(`[jobs] ${name} failed after ${Date.now() - started}ms:`, err);
  }
}

function hourIn(timezone: string, now: Date): number {
  try {
    return Number(formatInTimeZone(now, timezone, "H"));
  } catch {
    return Number(formatInTimeZone(now, "UTC", "H"));
  }
}

function weekdayIn(timezone: string, now: Date): number {
  try {
    // date-fns "i" is 1 (Monday) to 7 (Sunday); DESIGN.md uses 0 = Sunday.
    return Number(formatInTimeZone(now, timezone, "i")) % 7;
  } catch {
    return Number(formatInTimeZone(now, "UTC", "i")) % 7;
  }
}

/** Every six hours: pull the bank feed for every connected item. */
async function bankSync(): Promise<unknown> {
  if (!plaid.isConfigured()) return "plaid not configured, skipped";
  return transactions.sync(null);
}

/** 03:00 in the wedding's timezone: the Brief, the model cache, the FX rate. */
async function nightly(now: Date): Promise<void> {
  const wedding = await db.wedding.findUnique({ where: { id: "main" } });
  const timezone = wedding?.eventTimezone ?? "Africa/Nairobi";
  if (hourIn(timezone, now) !== BRIEF_HOUR) return;

  await safely("brief.generate", () => brief.generate("CRON"));
  await safely("models.refreshIfStale", () => models.refreshIfStale());
  await safely("fx.refreshDaily", () => fx.refreshDaily("KES"));
}

/** 09:00 in any user's timezone: payment reminders, once a day. */
async function reminderTick(now: Date): Promise<void> {
  const settings = await db.userSettings.findMany();
  const zones = new Set(settings.map((s) => s.timezone));
  const anyAtNine = [...zones].some((tz) => hourIn(tz, now) === REMINDER_HOUR);
  if (!anyAtNine) return;

  await safely("reminders.paymentReminders", () => reminders.paymentReminders());
}

/** `digestDay` at each user's `digestHour`: the weekly digest, once a week. */
async function digestTick(now: Date): Promise<void> {
  const app = await db.appSettings.findUnique({ where: { id: "main" } });
  const digestDay = app?.digestDay ?? 0;

  const settings = await db.userSettings.findMany();
  const isTime = settings.some(
    (s) => weekdayIn(s.timezone, now) === digestDay && hourIn(s.timezone, now) === s.digestHour
  );
  if (!isTime) return;

  // One digest a week, whichever user's clock gets there first.
  const last = await db.note.findFirst({ where: { kind: "DIGEST" }, orderBy: { createdAt: "desc" } });
  if (last && Date.now() - last.createdAt.getTime() < 6 * 86_400_000) return;

  await safely("digest.weekly", () => digest.weekly());
}

export function register(): void {
  if (registered) return;
  registered = true;

  // Every 6 hours: bank sync (DESIGN.md §4).
  cron.schedule("15 */6 * * *", () => {
    void safely("transactions.sync", bankSync);
  });

  // Hourly tick that drives the three timezone-sensitive jobs.
  cron.schedule("5 * * * *", () => {
    const now = new Date();
    void safely("nightly", () => nightly(now));
    void safely("reminders", () => reminderTick(now));
    void safely("digest", () => digestTick(now));
  });

  // Resolve the primary model once at boot (DESIGN.md §7: "at boot and
  // after each cache refresh").
  void safely("models.resolvePrimaryModel", async () => {
    const resolution = await models.resolvePrimaryModel();
    return resolution.problem ?? resolution.model ?? "unresolved";
  });

  console.log("[jobs] scheduler registered");
}
