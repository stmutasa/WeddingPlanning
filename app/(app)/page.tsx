import { PageHeader, EmptyState } from "@/components/ui";

// TODO(phase-c): Home screen — remaining/budget card, by-event rows, next
// payments, inbox chip, recent activity, weekly digest card (DESIGN.md §6).
export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Home" subtitle="Nairobi · August 2027" />
      <EmptyState
        title="Nothing to show yet"
        description="The budget summary, next payments and recent activity will land here once the money services ship in Phase B."
      />
    </div>
  );
}
