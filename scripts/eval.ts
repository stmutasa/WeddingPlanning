// PROMPTS.md "Evaluation set". Runs the quick-add and receipt contracts
// through the same facade the app uses, against the seeded database, and
// reports per-field accuracy. Needs at least one provider key; otherwise it
// exits 0 with a note so CI without keys stays green.
//
//   npm run seed -- --demo && npm run eval
//
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import { ai, AiDisabled, AiUnavailable, type AiContentPart } from "@/lib/ai/client";
import * as aiContext from "@/lib/ai/context";
import * as prompts from "@/lib/ai/prompts";

interface QuickCase {
  text: string;
  expect: Partial<{
    amount: number | null;
    originalCurrency: string;
    eventSlug: string;
    funderName: string;
    isDeposit: boolean;
    dateOffsetDays: number;
  }>;
}
interface ReceiptCase {
  file: string;
  expect: Partial<{ kind: string; currency: string; total: number; merchantContains: string; scheduleCount: number }>;
}

function jsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

const tally: Record<string, { hit: number; total: number }> = {};
function score(field: string, ok: boolean) {
  tally[field] ??= { hit: 0, total: 0 };
  tally[field].total += 1;
  if (ok) tally[field].hit += 1;
}
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const availability = await ai.availability();
  if (!availability.enabled) {
    console.log(`eval: skipped — ${availability.reason ?? "AI disabled"}`);
    return;
  }
  const viewer = await db.user.findFirst({ where: { email: "stmutasa@gmail.com" } });
  const viewerFunder = viewer ? await db.funder.findUnique({ where: { userId: viewer.id } }) : null;
  const base = await aiContext.base(viewer?.id);
  const capture = await aiContext.capture(viewer?.id);

  const quick = jsonl<QuickCase>(join("docs/eval/quick-add.jsonl"));
  console.log(`\nQuick add — ${quick.length} cases`);
  for (const c of quick) {
    const prompt = prompts.quickAdd(base, capture, c.text);
    try {
      const completion = await ai.json<prompts.QuickAddDraft>({
        feature: "QUICK_ADD",
        system: prompt.system,
        user: prompt.user,
        schema: prompts.jsonSchema(prompts.quickAddSchema),
        schemaName: "quick_add",
        effort: "low",
        maxTokens: 600,
      });
      const d = prompts.quickAddSchema.parse(completion.data);
      const e = c.expect;
      if ("amount" in e) score("amount", d.amount === e.amount);
      if (e.originalCurrency) score("currency", d.originalCurrency.toUpperCase() === e.originalCurrency);
      if (e.eventSlug) score("event", d.eventSlug === e.eventSlug);
      if (e.funderName) {
        const want = e.funderName === "__viewer__" ? viewerFunder?.name : e.funderName;
        score("funder", d.funderName === want);
      }
      if (e.isDeposit !== undefined) score("isDeposit", d.isDeposit === e.isDeposit);
      if (e.dateOffsetDays !== undefined) {
        const want = isoDay(new Date(Date.now() + e.dateOffsetDays * 86_400_000));
        score("date", d.date === want);
      }
      console.log(`  ✓ ${c.text}  →  ${d.amount ?? "∅"} ${d.originalCurrency} · ${d.eventSlug ?? "∅"} · ${d.funderName ?? "∅"} · ${d.date ?? "∅"}  [${completion.model}${completion.fellBack ? ", fell back" : ""}]`);
    } catch (err) {
      console.log(`  ✗ ${c.text}  →  ${(err as Error).message}`);
      for (const f of ["amount", "currency", "event", "funder", "isDeposit", "date"]) if (f in c.expect || (f === "currency" && c.expect.originalCurrency)) score(f, false);
    }
  }

  const receipts = jsonl<ReceiptCase>(join("docs/eval/receipts.jsonl"));
  console.log(`\nReceipts — ${receipts.length} cases`);
  const rp = prompts.receipt(base, capture);
  for (const c of receipts) {
    const bytes = readFileSync(join("docs/eval/receipts", c.file));
    const content: AiContentPart[] = [
      { type: "text", text: rp.user },
      { type: "image", mediaType: "image/png", dataBase64: bytes.toString("base64") },
    ];
    try {
      const completion = await ai.json<prompts.ReceiptDraft>({
        feature: "RECEIPT",
        system: rp.system,
        user: content,
        schema: prompts.jsonSchema(prompts.receiptSchema),
        schemaName: "receipt",
        effort: "medium",
        maxTokens: 1500,
      });
      const d = prompts.receiptSchema.parse(completion.data);
      const e = c.expect;
      if (e.kind) score("receipt.kind", d.kind === e.kind);
      if (e.currency) score("receipt.currency", (d.currency ?? "").toUpperCase() === e.currency);
      if (e.total !== undefined) score("receipt.total", d.total !== null && Math.abs(d.total - e.total) < 0.01);
      if (e.merchantContains) score("receipt.merchant", (d.merchant ?? "").toLowerCase().includes(e.merchantContains.toLowerCase()));
      if (e.scheduleCount !== undefined) score("receipt.schedule", d.schedule.length === e.scheduleCount);
      console.log(`  ✓ ${c.file}  →  ${d.kind} · ${d.merchant ?? "∅"} · ${d.total ?? "∅"} ${d.currency ?? ""} · schedule ${d.schedule.length}  [${completion.model}]`);
    } catch (err) {
      console.log(`  ✗ ${c.file}  →  ${(err as Error).message}`);
      for (const f of Object.keys(c.expect)) score(`receipt.${f}`, false);
    }
  }

  console.log("\nField accuracy");
  let failing = false;
  for (const [field, t] of Object.entries(tally)) {
    const pct = Math.round((t.hit / t.total) * 100);
    const gate = ["amount", "currency", "date", "receipt.total", "receipt.currency"].includes(field);
    if (gate && pct < 90) failing = true;
    console.log(`  ${field.padEnd(18)} ${String(pct).padStart(3)}%  (${t.hit}/${t.total})${gate ? "  ← gated at 90%" : ""}`);
  }
  console.log(failing ? "\nRESULT: FAIL — a gated field is under 90%" : "\nRESULT: PASS");
  process.exitCode = failing ? 1 : 0;
}

main()
  .catch((err) => {
    if (err instanceof AiDisabled) console.log(`eval: skipped — ${err.message}`);
    else if (err instanceof AiUnavailable) { console.error(`eval: AI unavailable — ${err.message}`); process.exitCode = 1; }
    else { console.error(err); process.exitCode = 1; }
  })
  .finally(() => db.$disconnect());
