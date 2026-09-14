import { db } from "@/lib/db";
import { formatUSD } from "@/lib/money/format";
import * as push from "./push";

/**
 * DESIGN.md §4: "daily 09:00 per user timezone — push for any `PaymentDue`
 * OPEN due within 7 days with `reminderSentAt` null (one push per user,
 * dedupe by day)".
 *
 * `reminderSentAt` is the dedupe: it is stamped once the batch goes out, so
 * the same instalment is never announced twice, and the send itself is one
 * push per user summarising the batch.
 */
export async function paymentReminders(): Promise<{ users: number; payments: number }> {
  const horizon = new Date(Date.now() + 7 * 86_400_000);

  const due = await db.paymentDue.findMany({
    where: { status: "OPEN", reminderSentAt: null, dueDate: { lte: horizon } },
    include: { vendor: true },
    orderBy: { dueDate: "asc" },
  });
  if (due.length === 0) return { users: 0, payments: 0 };

  const total = due.reduce((t, p) => t + p.amountCents, 0);
  const first = due[0];
  const body =
    due.length === 1
      ? `${first.vendor.name} — ${first.label}, ${formatUSD(first.amountCents)} due ${first.dueDate.toISOString().slice(0, 10)}`
      : `${due.length} payments totalling ${formatUSD(total)}, starting with ${first.vendor.name} ${first.label} on ${first.dueDate.toISOString().slice(0, 10)}`;

  const users = await db.user.findMany({ include: { settings: true } });
  let sent = 0;
  for (const user of users) {
    if (!user.settings?.pushEnabled) continue;
    await push.trySend(user.id, {
      title: due.length === 1 ? "A payment is due" : "Payments are due",
      body,
      url: "/money",
      tag: "payments",
    });
    sent++;
  }

  await db.paymentDue.updateMany({
    where: { id: { in: due.map((p) => p.id) } },
    data: { reminderSentAt: new Date() },
  });

  return { users: sent, payments: due.length };
}
