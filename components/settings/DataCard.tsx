"use client";

import { Card, SectionLabel } from "@/components/ui";

/**
 * Settings › Data (DESIGN.md §6). Both exports are plain GET routes, so
 * they are links rather than scripted downloads: the browser saves them,
 * and they still work if JavaScript is having a bad day.
 */
export function DataCard() {
  return (
    <Card>
      <SectionLabel>Data</SectionLabel>
      <p className="mb-3 text-sm text-ink-soft">
        Everything in this app is yours. The JSON export is the whole database minus secrets; the
        CSV is every expense, in cents and in dollars.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href="/api/export"
          download="harusi-export.json"
          className="focus-ring inline-flex min-h-11 items-center rounded-lg bg-primary px-[18px] text-[13px] font-bold uppercase tracking-[0.06em] text-on-primary"
        >
          Export JSON
        </a>
        <a
          href="/api/export/expenses.csv"
          download="expenses.csv"
          className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink px-[18px] text-[13px] font-bold uppercase tracking-[0.06em] text-ink"
        >
          Export expenses CSV
        </a>
      </div>
    </Card>
  );
}
