import { PageHeader, EmptyState } from "@/components/ui";

// TODO(phase-c): Plan screen tabs — Tasks / Timeline / Notes (DESIGN.md §6).
export default function PlanPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Plan" subtitle="Tasks · Timeline · Notes" />
      <EmptyState
        title="Plan screens come in Phase C"
        description="Tasks grouped by due date, the wedding timeline, and shared notes will render here."
      />
    </div>
  );
}
