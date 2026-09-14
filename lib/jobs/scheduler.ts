/**
 * DESIGN.md §4 scheduler. Phase A wires the singleton-guarded entry point
 * only — Phase B adds the actual node-cron jobs:
 *   - every 6h: transactions.sync for all items
 *   - daily 03:00 Wedding.eventTimezone: brief.generate("CRON"),
 *     refresh ModelCache if stale, refresh the USD->KES rate
 *   - daily 09:00 per user timezone: payment reminders (PaymentDue due <= 7d)
 *   - weekly digestDay @ digestHour: digest.weekly()
 */

let registered = false;

export function register(): void {
  if (registered) return;
  registered = true;

  // No jobs yet — Phase B calls cron.schedule(...) here for each bullet
  // above, guarded the same way instrumentation.ts guards this call.
}
