import "dotenv/config";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/**
 * DESIGN.md §4 smoke test. Runs the whole service layer against a throwaway
 * SQLite file with AI disabled and FX mocked, and reports PASS/FAIL per step:
 *
 *   migrate → seed → expense in KES → assert USD cents → schedule vendor
 *   payments → mark one paid → assert forecast + status → settle-up math →
 *   import a CSV containing a duplicate → assert dedupe → generate the Brief
 *   → assert every section is present.
 *
 *   DATABASE_URL=file:./prisma/smoke.db npm run smoke
 */

const DEFAULT_URL = "file:./prisma/smoke.db";
process.env.DATABASE_URL ??= DEFAULT_URL;

const url = process.env.DATABASE_URL;
if (!url.includes("smoke")) {
  console.error(
    `Refusing to run: DATABASE_URL is "${url}".\n` +
      `The smoke test wipes its database, so it only runs against a path containing "smoke".\n` +
      `Try: DATABASE_URL=${DEFAULT_URL} npm run smoke`
  );
  process.exit(1);
}

// Prisma resolves a relative `file:` URL against prisma/, not the cwd.
const dbFile = path.resolve("prisma", url.replace(/^file:/, ""));

interface StepResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: StepResult[] = [];

function record(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function step(name: string, fn: () => Promise<string>): Promise<boolean> {
  try {
    record(name, true, await fn());
    return true;
  } catch (err) {
    record(name, false, err instanceof Error ? err.message : String(err));
    return false;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function main(): Promise<void> {
  console.log(`smoke: ${url}\n`);

  // ---- 1. migrate (a fresh file every run, so results never depend on order)
  const migrated = await step("migrate", async () => {
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      rmSync(`${dbFile}${suffix}`, { force: true });
    }
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: url },
    });
    return dbFile;
  });
  if (!migrated) return finish();

  // ---- 2. seed
  const seeded = await step("seed", async () => {
    execFileSync("npx", ["tsx", "scripts/seed.ts"], {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: url },
    });
    return "base seed";
  });
  if (!seeded) return finish();

  // Imported only now: the Prisma client must be constructed after
  // DATABASE_URL is settled and the database exists.
  const { db } = await import("@/lib/db");
  const fx = await import("@/lib/services/fx");
  const expenses = await import("@/lib/services/expenses");
  const payments = await import("@/lib/services/payments");
  const budget = await import("@/lib/services/budget");
  const forecast = await import("@/lib/services/forecast");
  const settle = await import("@/lib/services/settle");
  const transactions = await import("@/lib/services/transactions");
  const brief = await import("@/lib/services/brief");

  // FX is mocked: no network, and a rate the assertions can predict.
  const USD_TO_KES = 130;
  fx.setFxFetcher(async () => ({ KES: USD_TO_KES, EUR: 0.92 }));

  // AI is off: every AI-touching path must still work.
  await db.appSettings.update({ where: { id: "main" }, data: { aiEnabled: false } });

  const simi = await db.user.findFirstOrThrow({ where: { email: "stmutasa@gmail.com" } });
  const annette = await db.user.findFirstOrThrow({ where: { email: "annettemugambi@gmail.com" } });
  const simiFunder = await db.funder.findUniqueOrThrow({ where: { userId: simi.id } });
  const annetteFunder = await db.funder.findUniqueOrThrow({ where: { userId: annette.id } });
  const ruracio = await db.event.findUniqueOrThrow({ where: { slug: "ruracio" } });
  const wedding = await db.event.findUniqueOrThrow({ where: { slug: "wedding" } });
  const venue = await db.category.findFirstOrThrow({ where: { name: "Venue" } });

  // ---- 3. an expense in KES, converted by the mocked rate
  await step("expense in KES converts to USD cents", async () => {
    const expense = await expenses.create(simi.id, {
      description: "Ruracio venue hold",
      originalAmount: 15_000,
      originalCurrency: "KES",
      date: new Date(),
      eventId: ruracio.id,
      funderId: simiFunder.id,
      source: "QUICK_ADD",
    });

    // 15,000 KES at 130 KES per USD = $115.38 = 11,538 cents.
    assert(
      expense.amountCents === 11_538,
      `expected 11538 cents, got ${expense.amountCents}`
    );
    assert(expense.originalCurrency === "KES", "original currency was not kept");
    assert(
      Math.abs((expense.fxRate ?? 0) - 1 / USD_TO_KES) < 1e-12,
      `fxRate should be KES→USD, got ${expense.fxRate}`
    );

    const cached = await db.fxRate.findFirst({ where: { base: "USD", quote: "KES" } });
    assert(cached?.rate === USD_TO_KES, "the rate was not cached in FxRate");

    return `${money(expense.amountCents)} from KES 15,000`;
  });

  await step("an activity row is appended on every write", async () => {
    const latest = await db.activity.findFirst({ orderBy: { createdAt: "desc" } });
    assert(latest != null, "no activity row was written");
    assert(
      latest!.summary.startsWith("Simi added"),
      `summary should name the actor, got "${latest!.summary}"`
    );
    return latest!.summary;
  });

  // ---- 4. a vendor with a payment schedule
  const vendor = await db.vendor.create({
    data: {
      name: "Ridgeview Gardens",
      categoryId: venue.id,
      eventId: wedding.id,
      status: "BOOKED",
      quotedCents: 1_200_000,
    },
  });

  await step("schedule vendor payments", async () => {
    const scheduled = await payments.schedule(simi.id, vendor.id, [
      { label: "Deposit", dueDate: new Date(Date.now() + 5 * 86_400_000), amountCents: 400_000 },
      { label: "Balance", dueDate: new Date(Date.now() + 90 * 86_400_000), amountCents: 800_000 },
    ]);
    assert(scheduled.length === 2, `expected 2 payments, got ${scheduled.length}`);

    // Scheduling again replaces the OPEN set rather than doubling it.
    const again = await payments.schedule(simi.id, vendor.id, [
      { label: "Deposit", dueDate: new Date(Date.now() + 5 * 86_400_000), amountCents: 400_000 },
      { label: "Balance", dueDate: new Date(Date.now() + 90 * 86_400_000), amountCents: 800_000 },
    ]);
    const open = await db.paymentDue.count({ where: { vendorId: vendor.id, status: "OPEN" } });
    assert(open === 2, `replacing the schedule left ${open} open payments`);

    return `${again.length} instalments, ${money(1_200_000)} total`;
  });

  await step("mark one payment paid, in one transaction", async () => {
    const deposit = await db.paymentDue.findFirstOrThrow({
      where: { vendorId: vendor.id, label: "Deposit", status: "OPEN" },
    });

    const { payment, expense } = await payments.markPaid(deposit.id, annette.id, {
      funderId: annetteFunder.id,
    });

    assert(payment.status === "PAID", `payment status is ${payment.status}`);
    assert(payment.expenseId === expense.id, "the payment was not linked to its expense");
    assert(expense.amountCents === 400_000, `expense is ${expense.amountCents} cents`);
    assert(expense.vendorId === vendor.id, "the expense was not attributed to the vendor");

    return `${money(expense.amountCents)} paid by Annette`;
  });

  // ---- 5. forecast and status
  await step("forecast and status per event", async () => {
    const summary = await budget.summary();
    const weddingEnvelope = summary.envelopes.find((e) => e.eventSlug === "wedding");
    assert(weddingEnvelope != null, "no wedding envelope in the summary");

    // $4,000 paid + $8,000 still committed against a $32,000 envelope.
    assert(
      weddingEnvelope!.paidCents === 400_000,
      `wedding paid is ${weddingEnvelope!.paidCents}`
    );
    assert(
      weddingEnvelope!.committedCents === 800_000,
      `wedding committed is ${weddingEnvelope!.committedCents}`
    );
    assert(
      weddingEnvelope!.forecastCents === 1_200_000,
      `wedding forecast is ${weddingEnvelope!.forecastCents}`
    );
    assert(
      weddingEnvelope!.status === "ON_TRACK",
      `wedding status is ${weddingEnvelope!.status}`
    );

    // And the thresholds themselves, on the pure function.
    assert(forecast.statusFor(950_000, 1_000_000) === "ON_TRACK", "95% should be ON_TRACK");
    assert(forecast.statusFor(1_000_000, 1_000_000) === "AT_RISK", "100% should be AT_RISK");
    assert(forecast.statusFor(1_060_000, 1_000_000) === "OVER", "106% should be OVER");

    return `wedding forecast ${money(weddingEnvelope!.forecastCents)} of ${money(weddingEnvelope!.budgetCents)} — ${weddingEnvelope!.status}`;
  });

  // ---- 6. settle-up
  await step("settle-up splits personal spending 50/50", async () => {
    const summary = await settle.summary();

    // Simi fronted $115.38 (the KES expense), Annette $4,000 (the deposit).
    assert(
      summary.simiFrontedCents === 11_538,
      `Simi fronted ${summary.simiFrontedCents}`
    );
    assert(
      summary.annetteFrontedCents === 400_000,
      `Annette fronted ${summary.annetteFrontedCents}`
    );

    // Half of $4,115.38 each; Simi owes Annette the difference.
    const expectedOwed = (400_000 + 11_538) / 2 - 11_538;
    assert(
      summary.owedCents === expectedOwed,
      `owed is ${summary.owedCents}, expected ${expectedOwed}`
    );
    assert(summary.owedFromUserId === simi.id, "Simi should be the one who owes");
    assert(summary.owedToUserId === annette.id, "Annette should be the one owed");

    // Recording the settlement squares them.
    await settle.record(simi.id, summary.owedCents, "Bank transfer");
    const after = await settle.summary();
    assert(after.owedCents === 0, `after settling, owed is ${after.owedCents}`);

    return `Simi owed ${money(expectedOwed)}, settled to zero`;
  });

  // ---- 7. CSV import with a duplicate row
  await step("CSV import dedupes by date + amount + name", async () => {
    const csv = [
      "Date,Description,Amount",
      "2027-01-04,RIDGEVIEW GARDENS,-400.00",
      "2027-01-05,NAIROBI BLOOM FLORISTS,-120.50",
      // The same row again, which must not be imported twice.
      "2027-01-04,RIDGEVIEW GARDENS,-400.00",
      // Money in is not spending.
      "2027-01-06,PAYROLL,2500.00",
    ].join("\n");

    const first = await transactions.importCsv(simi.id, new Blob([csv]), {
      dateColumn: "Date",
      nameColumn: "Description",
      amountColumn: "Amount",
    });
    assert(first.imported === 2, `first import brought in ${first.imported}, expected 2`);
    assert(first.duplicates === 1, `first import saw ${first.duplicates} duplicates, expected 1`);
    assert(first.skipped === 1, `first import skipped ${first.skipped}, expected 1 (money in)`);

    // Importing the whole file again is a no-op.
    const second = await transactions.importCsv(simi.id, new Blob([csv]), {
      dateColumn: "Date",
      nameColumn: "Description",
      amountColumn: "Amount",
    });
    assert(second.imported === 0, `re-import brought in ${second.imported}, expected 0`);

    const rows = await db.transaction.count({ where: { source: "CSV" } });
    assert(rows === 2, `there are ${rows} CSV rows, expected 2`);

    return `2 imported, ${first.duplicates + second.duplicates} duplicates rejected`;
  });

  // ---- 8. the Brief, with AI disabled
  await step("brief generates with AI disabled", async () => {
    const snapshot = await brief.generate("MANUAL");
    const markdown = snapshot.markdown;

    // Section 14 is written by the model, so it is absent here by design.
    const expected = brief.HEADINGS.filter((h) => !h.startsWith("## 14."));
    let cursor = -1;
    for (const heading of expected) {
      const at = markdown.indexOf(`\n${heading}`);
      assert(at !== -1, `the Brief is missing "${heading}"`);
      assert(at > cursor, `"${heading}" is out of order`);
      cursor = at;
    }
    assert(
      !markdown.includes("## 14. State of play"),
      "section 14 should be omitted when AI is disabled"
    );
    assert(markdown.includes("Ruracio venue hold"), "the Brief does not list the KES expense");
    assert(markdown.includes("Ridgeview Gardens"), "the Brief does not list the vendor");
    assert(snapshot.words > 200, `the Brief is only ${snapshot.words} words`);

    return `${expected.length} sections in order, ${snapshot.words} words`;
  });

  await step("brief prunes to the last 30 snapshots", async () => {
    await db.briefSnapshot.createMany({
      data: Array.from({ length: 35 }, (_, i) => ({
        markdown: `filler ${i}`,
        words: 2,
        trigger: "CRON",
        generatedAt: new Date(Date.now() - (i + 1) * 60_000),
      })),
    });
    await brief.generate("CRON");
    const kept = await db.briefSnapshot.count();
    assert(kept === 30, `${kept} snapshots kept, expected 30`);
    return "30 kept";
  });

  await db.$disconnect();
  finish();
}

function finish(): never {
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} steps passed — ${failed.length === 0 ? "PASS" : "FAIL"}`
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  record("unexpected error", false, err instanceof Error ? err.message : String(err));
  console.error(err);
  finish();
});
