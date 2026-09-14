"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { PageHeader, Tabs } from "@/components/ui";
import { VendorsTab } from "@/components/vendors/VendorsTab";
import { ExpensesTab } from "./ExpensesTab";
import { BudgetTab } from "./BudgetTab";
import { PaymentsTab } from "./PaymentsTab";
import { InboxTab } from "./InboxTab";
import { SettleTab } from "./SettleTab";

const TABS = [
  { value: "expenses", label: "Expenses" },
  { value: "budget", label: "Budget" },
  { value: "vendors", label: "Vendors" },
  { value: "payments", label: "Payments" },
  { value: "inbox", label: "Inbox" },
  { value: "settle", label: "Settle up" },
];

/**
 * Money (DESIGN.md §6). The tab and any event filter live in the URL, so
 * Home's "tap an event row" and the inbox chip both land in the right place
 * and the back button behaves.
 */
export function MoneyScreen({ defaultFunderId }: { defaultFunderId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "expenses";
  const eventSlug = params.get("event") ?? undefined;
  const [expenseId, setExpenseId] = useState<string | null>(params.get("expense"));

  const openExpense = useCallback(
    (id: string | null) => {
      setExpenseId(id);
      const search = new URLSearchParams(params.toString());
      if (id) search.set("expense", id);
      else search.delete("expense");
      const qs = search.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const setTab = useCallback(
    (next: string) => {
      const search = new URLSearchParams(params.toString());
      search.set("tab", next);
      router.replace(`${pathname}?${search.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Money" subtitle="Everything paid, committed and planned" />
      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === "expenses" ? (
        <ExpensesTab eventSlug={eventSlug} openExpenseId={expenseId} onOpenExpense={openExpense} />
      ) : null}
      {tab === "budget" ? <BudgetTab /> : null}
      {tab === "vendors" ? <VendorsTab /> : null}
      {tab === "payments" ? <PaymentsTab defaultFunderId={defaultFunderId} /> : null}
      {tab === "inbox" ? <InboxTab defaultFunderId={defaultFunderId} /> : null}
      {tab === "settle" ? <SettleTab /> : null}
    </div>
  );
}
