import { PageHeader, EmptyState } from "@/components/ui";

// TODO(phase-c): Guests screen — households, side/RSVP chips, counts header,
// search, CSV import (DESIGN.md §6).
export default function GuestsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Guests" subtitle="Households · RSVPs" />
      <EmptyState
        title="Guests screen comes in Phase C"
        description="Guest households, per-event RSVP status and counts will render here."
      />
    </div>
  );
}
