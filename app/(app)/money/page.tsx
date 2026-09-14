import { PageHeader, EmptyState } from "@/components/ui";

// TODO(phase-c): Money screen tabs — Expenses / Budget / Vendors / Payments /
// Inbox / Settle up (DESIGN.md §6). Phase A ships the CRUD routes only.
export default function MoneyPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Money" subtitle="Expenses · Budget · Payments · Inbox" />
      <EmptyState
        title="Money screens come in Phase C"
        description="Expenses, the budget editor, vendor payment schedules, the transaction inbox and settle-up will render here."
      />
    </div>
  );
}
